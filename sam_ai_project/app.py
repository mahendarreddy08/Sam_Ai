"""
Sam AI Voice Assistant — FastAPI Backend Core
- Pure-NumPy LSTM intent classification (no PyTorch runtime dependency)
- Safe skill routers:
  • time: returns action="time" for browser-side local time resolution
  • open_site: strictly allowlisted destinations (YouTube, Google, GitHub, etc.)
  • search: URL-encoded Google search queries
  • chat: Groq LLaMA integration with voice-optimized system instructions
- Confidence fallback (< 0.5 threshold routes to chat)
- Input validation (length, type, role, history bounds)
- In-memory rate limiting and CORS middleware
- Lazy client initialization for robust credential-free test execution
"""

import json
import logging
import os
import re
import time
import urllib.parse
from collections import defaultdict
from pathlib import Path
from typing import Literal, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------
# 1. Environment & Logging
# ---------------------------------------------------------
PROJECT_DIR = Path(__file__).parent
load_dotenv(PROJECT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sam_assistant")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))
ALLOWED_ORIGINS_RAW = os.getenv("ALLOWED_ORIGINS", "*").strip()

if ALLOWED_ORIGINS_RAW == "*" or not ALLOWED_ORIGINS_RAW:
    ALLOWED_ORIGINS = ["*"]
else:
    ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

# ---------------------------------------------------------
# 2. Allowlisted Sites & Safe Patterns
# ---------------------------------------------------------
SAFE_SITES = {
    "youtube": "https://www.youtube.com",
    "google": "https://www.google.com",
    "github": "https://github.com",
    "wikipedia": "https://www.wikipedia.org",
    "reddit": "https://www.reddit.com",
    "stackoverflow": "https://stackoverflow.com",
    "stack overflow": "https://stackoverflow.com",
    "linkedin": "https://www.linkedin.com",
    "gmail": "https://mail.google.com",
    "chatgpt": "https://chatgpt.com",
}

SITE_DISPLAY_NAMES = {
    "youtube": "YouTube",
    "google": "Google",
    "github": "GitHub",
    "wikipedia": "Wikipedia",
    "reddit": "Reddit",
    "stackoverflow": "Stack Overflow",
    "stack overflow": "Stack Overflow",
    "linkedin": "LinkedIn",
    "gmail": "Gmail",
    "chatgpt": "ChatGPT",
}

# ---------------------------------------------------------
# 3. Pure NumPy Classifier Engine
# ---------------------------------------------------------
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50.0, 50.0)))

def softmax(x):
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / np.sum(e_x, axis=-1, keepdims=True)

class IntentClassifier:
    def __init__(self, weights_path: Path, vocab_path: Path):
        self.ready = False
        if not weights_path.exists() or not vocab_path.exists():
            logger.warning(f"Model files not found at {weights_path} or {vocab_path}")
            return

        try:
            data = np.load(weights_path)
            self.embedding = data["embedding_weight"]
            self.w_ih = data["lstm_weight_ih"]
            self.w_hh = data["lstm_weight_hh"]
            self.b_ih = data["lstm_bias_ih"]
            self.b_hh = data["lstm_bias_hh"]
            self.w_fc = data["fc_weight"]
            self.b_fc = data["fc_bias"]
            self.intents = list(data["intents"])
            self.max_seq_len = int(data["max_seq_len"])
            self.hidden_dim = int(data["hidden_dim"])

            with open(vocab_path, "r", encoding="utf-8") as f:
                self.vocab = json.load(f)

            self.ready = True
            logger.info("Pure NumPy LSTM Intent Classifier successfully loaded.")
        except Exception as e:
            logger.error(f"Failed to load model weights: {e}")

    def tokenize(self, text: str) -> list[str]:
        text = text.lower()
        text = re.sub(r"[^\w\s]", " ", text)
        return [t.strip() for t in text.split() if t.strip()]

    def encode(self, tokens: list[str]) -> list[int]:
        ids = [self.vocab.get(t, self.vocab.get("<unk>", 1)) for t in tokens[:self.max_seq_len]]
        if len(ids) < self.max_seq_len:
            ids += [self.vocab.get("<pad>", 0)] * (self.max_seq_len - len(ids))
        return ids

    def predict(self, text: str) -> tuple[str, float]:
        if not self.ready:
            # Safe fallback if model files are uninitialized
            return "chat", 0.0

        tokens = self.tokenize(text)
        token_ids = self.encode(tokens)
        H = self.hidden_dim
        h_t = np.zeros(H, dtype=np.float32)
        c_t = np.zeros(H, dtype=np.float32)

        for tid in token_ids:
            x_t = self.embedding[tid]
            gates = np.dot(self.w_ih, x_t) + self.b_ih + np.dot(self.w_hh, h_t) + self.b_hh

            i = sigmoid(gates[0:H])
            f = sigmoid(gates[H:2*H])
            g = np.tanh(gates[2*H:3*H])
            o = sigmoid(gates[3*H:4*H])

            c_t = f * c_t + i * g
            h_t = o * np.tanh(c_t)

        logits = np.dot(self.w_fc, h_t) + self.b_fc
        probs = softmax(logits)
        pred_idx = int(np.argmax(probs))
        pred_intent = self.intents[pred_idx]
        confidence = float(probs[pred_idx])

        return pred_intent, confidence

# Initialize Classifier
MODEL_DIR = PROJECT_DIR / "model"
classifier = IntentClassifier(MODEL_DIR / "intent_weights.npz", MODEL_DIR / "vocab.json")

# ---------------------------------------------------------
# 4. Lazy Groq Client
# ---------------------------------------------------------
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        key = os.getenv("GROQ_API_KEY", "").strip()
        if not key:
            return None
        from groq import Groq
        _groq_client = Groq(api_key=key, timeout=5.0)
    return _groq_client

def generate_chat_reply(text: str, history: list[dict]) -> str:
    client = get_groq_client()
    if not client:
        lower = text.lower().strip()
        if re.search(r"\b(hello|hi|hey|good\s+(morning|afternoon|evening))\b", lower):
            return "Hello! I am Sam, your voice assistant. How can I help you today?"
        if re.search(r"\b(who\s+are\s+you|what\s+is\s+your\s+name|introduce\s+yourself)\b", lower):
            return "I am Sam, an intelligent voice assistant built with an offline-trained pure NumPy neural network."
        if re.search(r"\b(how\s+are\s+you|how\s+do\s+you\s+do|how\'s\s+it\s+going)\b", lower):
            return "I'm doing great, thank you! I am ready to help you with the time, web searches, opening apps, or answering questions."
        if re.search(r"\b(what\s+can\s+you\s+do|help|capabilities)\b", lower):
            return "I can tell you the local time, launch allowlisted websites like YouTube and GitHub, search Google, or chat with you."
        if re.search(r"\b(thank\s+you|thanks|appreciate\s+it)\b", lower):
            return "You're very welcome! Let me know if you need anything else."
        if re.search(r"\b(joke|funny)\b", lower):
            return "Why do programmers prefer dark mode? Because light attracts bugs!"

        return (
            "AI chat is currently in offline mode because no Groq API key is configured. "
            "You can still ask for the time, search, or open allowlisted websites."
        )

    system_prompt = (
        "You are Sam, a helpful, polite, and intelligent voice assistant. "
        "Keep your reply spoken-style, plain text, and between 1 to 3 concise sentences. "
        "Never use markdown formatting, bullet points, asterisks, or emojis. "
        "If you do not know an answer or fact, state so simply."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-10:]:
        role = msg.get("role")
        content = msg.get("content", "").strip()
        if role in ["user", "assistant"] and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": text})

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=150,
            temperature=0.6,
        )
        reply = completion.choices[0].message.content or ""
        clean_reply = re.sub(r"[\*#_`~]", "", reply).strip()
        return clean_reply or "I'm not sure how to respond to that."
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return "I'm having trouble connecting to my AI service right now. Please try again in a moment."

# ---------------------------------------------------------
# 5. Pydantic Request & Response Schemas
# ---------------------------------------------------------
class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=500)

class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=300)
    history: list[HistoryItem] = Field(default_factory=list, max_length=10)

    @field_validator("text")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Text query cannot be empty or only whitespace.")
        return clean

class ChatResponse(BaseModel):
    intent: Literal["time", "open_site", "search", "chat"]
    reply: str
    action: Optional[str] = None
    url: Optional[str] = None
    confidence: float

class HealthResponse(BaseModel):
    status: str
    database: str
    model: str

class FeedbackRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    predicted_intent: Literal["time", "open_site", "search", "chat"]
    helpful: bool
    correct_intent: Optional[Literal["time", "open_site", "search", "chat"]] = None
    session_id: Optional[str] = Field(None, max_length=64)

class FeedbackResponse(BaseModel):
    saved: bool

# ---------------------------------------------------------
# 6. In-Memory Sliding Window Rate Limiting
# ---------------------------------------------------------
RATE_LIMIT_REQUESTS = 60
RATE_LIMIT_WINDOW_SECS = 60
client_request_history = defaultdict(list)

def check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    timestamps = client_request_history[client_ip]
    valid_timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW_SECS]
    valid_timestamps.append(now)
    client_request_history[client_ip] = valid_timestamps
    return len(valid_timestamps) <= RATE_LIMIT_REQUESTS

# ---------------------------------------------------------
# 7. FastAPI App Initialization & Middleware
# ---------------------------------------------------------
app = FastAPI(
    title="Sam AI Voice Assistant API",
    description="Conversational Voice Assistant with NumPy LSTM intent classification and Groq fallback.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    # Only rate-limit API routes
    if request.url.path.startswith(("/chat", "/feedback")):
        client_ip = request.client.host if request.client else "unknown"
        if not check_rate_limit(client_ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Please wait a moment before sending more requests."}
            )
    response = await call_next(request)
    return response

# ---------------------------------------------------------
# 8. API Endpoints
# ---------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health_check():
    db_status = "enabled" if DATABASE_URL else "disabled"
    model_status = "loaded" if classifier.ready else "missing_weights"
    return HealthResponse(status="ok", database=db_status, model=model_status)

@app.post("/chat", response_model=ChatResponse)
async def handle_chat(req: ChatRequest):
    user_text = req.text
    pred_intent, confidence = classifier.predict(user_text)

    # Confidence fallback: route to general chat if confidence is below threshold
    effective_intent = pred_intent
    if confidence < CONFIDENCE_THRESHOLD and pred_intent != "chat":
        logger.info(f"Low confidence ({confidence:.3f} < {CONFIDENCE_THRESHOLD}) for intent '{pred_intent}'. Falling back to chat.")
        effective_intent = "chat"

    # Skill Execution
    if effective_intent == "time":
        return ChatResponse(
            intent="time",
            reply="It's currently {time}.",
            action="time",
            url=None,
            confidence=round(confidence, 4),
        )

    elif effective_intent == "open_site":
        lower_text = user_text.lower()
        matched_site = None
        for site_key, site_url in SAFE_SITES.items():
            if site_key in lower_text:
                matched_site = (site_key, site_url)
                break

        if matched_site:
            site_name, site_url = matched_site
            site_display = SITE_DISPLAY_NAMES.get(site_name, site_name.title())
            return ChatResponse(
                intent="open_site",
                reply=f"Opening {site_display}.",
                action=None,
                url=site_url,
                confidence=round(confidence, 4),
            )
        else:
            # Safe fallback: site not in allowlist -> route to Google Search
            encoded_q = urllib.parse.quote_plus(user_text)
            return ChatResponse(
                intent="search",
                reply=f"I don't have that site on my safe list, so I'm searching Google for you.",
                action=None,
                url=f"https://www.google.com/search?q={encoded_q}",
                confidence=round(confidence, 4),
            )

    elif effective_intent == "search":
        # Clean search query prefix
        clean_q = re.sub(
            r"^(hey\s+sam|sam)?\s*(can\s+you\s+)?(please\s+)?(search\s+(for|google\s+for|on\s+google\s+for|web\s+for|internet\s+for)?|google|look\s+up|find\s+information\s+on)\s*",
            "",
            user_text,
            flags=re.IGNORECASE
        ).strip()
        search_query = clean_q if clean_q else user_text
        encoded_q = urllib.parse.quote_plus(search_query)
        search_url = f"https://www.google.com/search?q={encoded_q}"
        return ChatResponse(
            intent="search",
            reply=f"Searching Google for {search_query}.",
            action=None,
            url=search_url,
            confidence=round(confidence, 4),
        )

    else:  # chat
        history_dicts = [{"role": m.role, "content": m.content} for m in req.history]
        reply_text = generate_chat_reply(user_text, history_dicts)
        return ChatResponse(
            intent="chat",
            reply=reply_text,
            action=None,
            url=None,
            confidence=round(confidence, 4),
        )

# ---------------------------------------------------------
# 9. Optional Feedback Storage (Isolated & Best-Effort)
# ---------------------------------------------------------
def save_feedback_to_db(req: FeedbackRequest) -> bool:
    """
    Saves feedback record to PostgreSQL if DATABASE_URL is configured.
    Uses short connect and query timeouts (2.0s) to prevent blocking.
    Catches all exceptions gracefully and returns False on failure.
    """
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        return False

    try:
        import psycopg
        with psycopg.connect(db_url, connect_timeout=2.0) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO feedback (session_id, text, predicted_intent, correct_intent, helpful)
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    (
                        req.session_id,
                        req.text,
                        req.predicted_intent,
                        req.correct_intent,
                        req.helpful,
                    ),
                )
            conn.commit()
        logger.info(f"Feedback successfully saved to database for session '{req.session_id}'.")
        return True
    except Exception as e:
        logger.warning(f"Optional database feedback write skipped/failed: {e}")
        return False

@app.post("/feedback", response_model=FeedbackResponse)
async def handle_feedback(req: FeedbackRequest):
    saved = save_feedback_to_db(req)
    return FeedbackResponse(saved=saved)

# ---------------------------------------------------------
# 10. Static File Serving (for direct local serving)
# ---------------------------------------------------------
PUBLIC_DIR = PROJECT_DIR / "public"
if PUBLIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="public")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
