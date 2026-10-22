# PROJECT BRIEF — SAM AI VOICE ASSISTANT

## 1. Project Goal
Build **Sam**, a ChatGPT-like web application with a Siri/Jarvis-inspired voice assistant interface. A user can tap a start/microphone button or say “Hey Sam” while browser speech recognition is actively running. Sam responds by voice, classifies user intent, performs a safe skill (time, safe website launch, Google search) or queries a LLaMA-family model through the Groq API for general chat, and displays the conversation with intent/confidence feedback badges.

This is a college AI/ML capstone project demonstrating:
- Clean, documented Python architecture with FastAPI;
- An offline-trained PyTorch RNN/LSTM intent classifier on our curated dataset;
- Weight & vocabulary export to pure NumPy inference for production runtime;
- Web Speech API integration (`SpeechRecognition` / `speechSynthesis`);
- Dark glassmorphism UI with reactive 4-state glowing orb;
- Optional best-effort PostgreSQL logging with schema isolation.

## 2. Core Decisions & Rules
- **Platform:** Web application (no desktop runtime needed).
- **Audio Processing:** Browser-native Web Speech API. Microphone audio is never transmitted to the server.
- **Backend:** Python 3.11/3.12, FastAPI.
- **Inference Runtime:** Pure NumPy for production inference (no heavy PyTorch dependency in production requirements).
- **Target Deployment:** Vercel (free tier) + GitHub repository.
- **Wake Phrase:** Live transcript keyword matching ("Hey Sam" / "Sam").
- **Database:** Strictly optional. App functions fully without a database.
- **Frontend:** Pure HTML5, CSS3, and vanilla JavaScript (no npm frameworks, no CDNs).
- **Security:** Groq API key is server-side only; allowlist for website opening; Google-encoded search queries; input sanitization.

## 3. Intents (Strict Ordering)
1. `time`: Client-side local time resolution (avoids server timezone mismatch).
2. `open_site`: Safe fixed allowlist (YouTube, Google, GitHub, Wikipedia, StackOverflow, etc.).
3. `search`: Safe Google search query with encoded parameters.
4. `chat`: Routed to Groq LLaMA model (concise spoken-style responses).
Fallback: Classifications with confidence < 0.5 are routed to `chat`.

## 4. API Contract
- `POST /chat`: `{"text": str (max 300), "history": list[{"role": str, "content": str}] (max 10)}` -> `{"intent": str, "reply": str, "action": str|null, "url": str|null, "confidence": float}`
- `POST /feedback`: `{"text": str, "predicted_intent": str, "helpful": bool, "correct_intent"?: str, "session_id"?: str}` -> `{"saved": bool}`
- `GET /health`: `{"status": "ok", "database": "disabled"|"enabled", "model": "loaded"}`

## 5. Development Phases
- Phase 0: Plan approval and scaffold
- Phase 1: Intent dataset curation and validation (`data/intents.csv`)
- Phase 2: ML pipeline, 5-model comparison, and NumPy export
- Phase 3: Backend API core (`app.py`) with NumPy inference and Groq
- Phase 4: Optional database schema and feedback API
- Phase 5: Responsive frontend with reactive orb and Web Speech
- Phase 6: End-to-end integration and latency benchmarking
- Phase 7: Automated pytest test suite and GitHub Actions CI
- Phase 8: Academic documentation, viva preparation, and demo script
- Phase 9: Security review and deployment guidance
