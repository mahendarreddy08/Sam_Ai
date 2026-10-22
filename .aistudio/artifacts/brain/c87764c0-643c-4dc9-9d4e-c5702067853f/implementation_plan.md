# Implementation Plan: Sam AI Voice Assistant

A Siri/Jarvis-inspired conversational voice assistant web application designed as a rigorous college AI/ML capstone project. Sam combines browser-native Web Speech recognition with a custom-trained RNN/LSTM intent classifier exported to lightweight pure-NumPy inference, generative AI fallback powered by Groq LLaMA, a modern dark-glass UI with an animated reactive orb, and an optional serverless PostgreSQL database.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Workspace Inspection Findings:**
> - The directory `sam_ai_project` does not yet exist; it will be cleanly created in Phase 0 without overwriting any existing code.
> - The runtime container provides **Python 3.11.2** with `pip` and `git` available. Python 3.11 is fully compatible with PyTorch, FastAPI, and NumPy.
> - No project source files have been modified yet in accordance with Plan Mode rules.

- **Decision 1: Client-Side Speech vs. Server Audio Stream**
  - *Confirmed Choice:* Use the W3C Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition` and `speechSynthesis`) directly in modern browsers (Chrome/Edge). Microphone audio never leaves the browser to the backend server.
  - *Rationale:* Zero audio latency on the server, zero server bandwidth for streaming audio, compliant with free-tier serverless limits.
- **Decision 2: PyTorch Offline Training vs. Pure NumPy Production Inference**
  - *Confirmed Choice:* Train PyTorch RNN/GRU/LSTM models offline, export weights and vocabulary as `intent_weights.npz` and `vocab.json`, and run production inference in plain NumPy.
  - *Rationale:* PyTorch adds 700MB+ to dependencies, which exceeds Vercel serverless function size limits (250MB uncompressed). NumPy inference executes in <2ms with negligible memory overhead.
- **Decision 3: Wake Phrase Architecture**
  - *Confirmed Choice:* Keyword matching on browser's live speech transcript ("Hey Sam" / "Sam"), with manual gesture initiation and audio ducking before speech output.
  - *Rationale:* Compliant with browser security policies (no background eavesdropping without user gesture).
- **Decision 4: Database Isolation**
  - *Confirmed Choice:* Optional PostgreSQL database via `DATABASE_URL` with lazy initialization and best-effort storage.
  - *Rationale:* Chat and voice assistant work 100% out of the box with zero database configuration.

---

## 1. Overview & Core Concept

Sam provides a hands-free conversational voice interface coupled with an interactive chat stream:
1. **Wake & Listen:** User taps to start or says "Hey Sam" / "Sam".
2. **Intent Classification:** User utterances are classified into one of four distinct intents:
   - `time`: Browser fills in the user's local system time (avoids server timezone mismatch).
   - `open_site`: Safe navigation to strictly allowlisted destinations (YouTube, GitHub, Google, Wikipedia, StackOverflow, etc.).
   - `search`: Safe Google search query URL generation.
   - `chat`: Routed to Groq LLaMA with a short, voice-friendly response prompt.
3. **Audio-Safe Turn Taking:** Recognition pauses before Sam speaks to prevent transcribing its own voice, then resumes safely.
4. **Full Offline/Typed Fallback:** Full keyboard input, message history persistence in `localStorage`, transcript download (`.txt`), and intent/confidence feedback badges.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Theme:** Dark glassmorphism with deep space navy background (`#070B14`, `#0D1527`), subtle backdrop blur, and vivid cyan (`#00F2FE`) and violet/purple (`#7F00FF`, `#A855F7`) glowing accents.
- **Typography:** Modern clean sans-serif system stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`) with clear optical hierarchy.
- **Layout:** Centered responsive chat column (max-width 768px), rounded bubble chat on desktop and mobile.

### Interactive Orb States
The central visual element is a glowing, animated orb featuring 4 distinct functional states:
1. **Idle:** Gentle, slow blue-cyan breathing pulse (`#00B4D8`, `#0077B6`).
2. **Listening:** Responsive green energetic pulse (`#10B981`, `#059669`).
3. **Thinking:** Rapid purple/violet rotating glow (`#8B5CF6`, `#6D28D9`).
4. **Speaking:** Warm orange/amber radial pulse (`#F59E0B`, `#D97706`).

```
┌────────────────────────────────────────────────────────┐
│  Sam AI Assistant              [Clear] [Download] [⚙]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│                    ╭──────────╮                        │
│                    │   ORB    │  (State: Listening)    │
│                    ╰──────────╯                        │
│                  "Say 'Hey Sam'..."                    │
│                                                        │
│   [What's the time?]  [Open YouTube]  [Explain AI]     │
│                                                        │
│   User: Hey Sam, what's the time?                      │
│                                                        │
│   Sam: It's 7:30 PM.                                   │
│   [Badge: Intent: time | Conf: 0.98] [👍] [👎]         │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [ 🎙️ Wake Sam ] [ Type your message...     ] [ Send ]  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Technical Architecture & System Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Client Side)                           │
│                                                                           │
│   ┌────────────────────┐    Speech     ┌──────────────────────────────┐   │
│   │ Web Speech API     ├──────────────►│ Keyword & Transcript Parser   │   │
│   │ (SpeechRecognition)│               │ ("Hey Sam" / clean utterance)│   │
│   └────────────────────┘               └──────────────┬───────────────┘   │
│                                                       │                   │
│   ┌────────────────────┐   Synthesize                 │ HTTP POST /chat   │
│   │ SpeechSynthesis    │◄─────────────────────────────┤                   │
│   │ (en-IN voice)      │                              ▼                   │
└───┴────────────────────┴──────────────────────────────┼───────────────────┴┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND (Serverless)                        │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │ 1. Input Validation (Length ≤ 300, Rate Limiting, Sanitization)   │   │
│   └───────────────────────────────────┬───────────────────────────────┘   │
│                                       │                                   │
│                                       ▼                                   │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │ 2. Tokenizer & NumPy LSTM Inference (model/intent_weights.npz)    │   │
│   │    Calculates Softmax Probabilities: time, open_site, search, chat│   │
│   └───────────────────────────────────┬───────────────────────────────┘   │
│                                       │                                   │
│          ┌────────────────────────────┴────────────────────────────┐      │
│          │                                                         │      │
│    (High Confidence)                                     (Low Confidence) │
│          ▼                                                         ▼      │
│   ┌───────────────┐                                     ┌───────────────┐ │
│   │ Skill Router  │                                     │ Groq LLaMA    │ │
│   │ time: local   │                                     │ API Fallback  │ │
│   │ open: safe list                                     └───────┬───────┘ │
│   │ search: Google│                                             │         │
│   └──────┬────────┘                                             │         │
│          │                                                      │         │
│          └────────────────────────────┬─────────────────────────┘         │
│                                       ▼                                   │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │ 3. Best-Effort Logging (Optional Postgres if DATABASE_URL set)    │   │
│   └───────────────────────────────────┬───────────────────────────────┘   │
│                                       │                                   │
│                                       ▼                                   │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │ 4. JSON Response: {intent, reply, action?, url?, confidence}      │   │
│   └───────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 4. API Contract

### 1. `POST /chat`
- **Request Body:**
  ```json
  {
    "text": "Hey Sam, what time is it?",
    "history": [
      {"role": "user", "content": "hello"},
      {"role": "assistant", "content": "Hi there! How can I help?"}
    ]
  }
  ```
- **Constraints:** `text` is non-empty string <= 300 chars. `history` is array of max 10 objects with `role` in `["user", "assistant"]` and string `content`.
- **Response Body:**
  ```json
  {
    "intent": "time",
    "reply": "It's currently {time}.",
    "action": "time",
    "url": null,
    "confidence": 0.985
  }
  ```

### 2. `POST /feedback`
- **Request Body:**
  ```json
  {
    "text": "what is the date",
    "predicted_intent": "time",
    "helpful": false,
    "correct_intent": "chat",
    "session_id": "anon-uuid-123"
  }
  ```
- **Response Body:** `{"saved": false}` or `{"saved": true}`

### 3. `GET /health`
- **Response Body:** `{"status": "ok", "database": "disabled", "model": "loaded"}`

---

## 5. Detailed Phase-by-Phase Plan (Phases 0 to 9)

### Phase 0: Project Scaffold and Configuration
- **Objectives:** Initialize the `sam_ai_project/` folder structure, safety files, dependency manifests, and local git repository.
- **Files to Deliver:**
  - `sam_ai_project/.gitignore` (ignores `.env`, `__pycache__`, `.pytest_cache`, virtual environments, model checkpoints)
  - `sam_ai_project/.env.example` (`GROQ_API_KEY=`, `GROQ_MODEL=`, `DATABASE_URL=`, `ALLOWED_ORIGINS=`)
  - `sam_ai_project/requirements.txt` (production: `fastapi`, `uvicorn`, `numpy`, `groq`, `psycopg[binary]`)
  - `sam_ai_project/requirements-dev.txt` (development/training: `torch`, `scikit-learn`, `matplotlib`, `pytest`, `httpx`)
  - Pointer files: `sam_ai_project/PROJECT_BRIEF.md`, `sam_ai_project/CLAUDE.md`, `sam_ai_project/AGENTS.md`, `sam_ai_project/.clinerules`
  - Empty directories: `data/`, `model/`, `db/`, `public/`, `tests/`, `docs/images/`, `.github/workflows/`
- **Implementation Approach:** Create standard clean structure; verify `.env` is ignored by Git. Initialize local git repository (`git init`).
- **Commands & Tests:**
  ```bash
  cd sam_ai_project
  git init
  git check-ignore -v .env
  git status
  ```
- **Acceptance Criteria:** Directory structure exists; `.env` is ignored; git repository initialized with clean scaffold commit.
- **Risks & Fallbacks:** None. No secrets staged or committed.
- **User Actions Required:** None.

---

### Phase 1: Intent Dataset Creation and Validation
- **Objectives:** Curate and validate a balanced, diverse NLP dataset in `data/intents.csv`.
- **Files to Deliver:**
  - `sam_ai_project/data/intents.csv`
  - Validation check script: checks row counts, balance, missing values, and near-duplicates.
- **Implementation Approach:**
  - 4 classes: `time`, `open_site`, `search`, `chat`.
  - At least 100 diverse, high-quality utterances per class (total 400+ rows).
  - Varied lengths, polite phrases, Indian-English idioms, allowlisted sites, and ambiguous chat boundary cases (e.g. "Do you have time to talk?", "Tell me the history of YouTube").
- **Commands & Tests:**
  ```bash
  python3 -c "
  import csv
  from collections import Counter
  with open('sam_ai_project/data/intents.csv') as f:
      reader = csv.DictReader(f)
      rows = list(reader)
  counts = Counter(r['intent'] for r in rows)
  print('Counts:', counts)
  assert all(c >= 100 for c in counts.values()), 'Class imbalance!'
  assert set(counts.keys()) == {'time', 'open_site', 'search', 'chat'}
  print('Dataset validation passed: Total', len(rows))
  "
  ```
- **Acceptance Criteria:** Total rows >= 400; exactly 4 intents with >= 100 rows each; zero exact duplicates; labels verified.
- **Risks & Fallbacks:** If classes are slightly imbalanced, balance with additional natural variations.
- **User Actions Required:** None.

---

### Phase 2: Offline ML Training, Baseline Comparison & NumPy Export
- **Objectives:** Build reproducible training pipeline in `intent_model.py`, benchmark 5 model architectures, export trained LSTM weights to pure NumPy, and verify mathematical equivalence.
- **Files to Deliver:**
  - `sam_ai_project/intent_model.py`: Tokenizer, PyTorch dataset/loader, models (Majority class, TF-IDF + LogisticRegression, Simple RNN, GRU, LSTM), training loop with early stopping, evaluation metrics (Accuracy, Macro F1, Confusion Matrix, Latency).
  - `sam_ai_project/check_numpy_matches_torch.py`: Re-implements forward pass (Embedding + LSTM cell/unroll + Dense + Softmax) in pure NumPy and asserts `np.allclose(torch_probs, numpy_probs, atol=1e-5)`.
  - Exported artifacts: `sam_ai_project/model/intent_weights.npz`, `sam_ai_project/model/vocab.json`.
  - Visual charts: `sam_ai_project/docs/images/confusion_matrix.png`, `training_loss.png`.
- **Implementation Approach:**
  - Fixed random seeds (Python, NumPy, PyTorch).
  - Train/Val/Test split (70/15/15) stratified by intent.
  - Export weights: `W_ih`, `W_hh`, `b_ih`, `b_hh`, linear weights & biases.
- **Commands & Tests:**
  ```bash
  python3 sam_ai_project/intent_model.py
  python3 sam_ai_project/check_numpy_matches_torch.py
  ```
- **Acceptance Criteria:** All 5 models trained and evaluated; test accuracy, macro F1, model size, and inference latency reported; NumPy output matches PyTorch within `atol=1e-5`; charts generated.
- **Risks & Fallbacks:** If PyTorch is too slow on CPU, configure smaller hidden dimensions (e.g. 64-dim) and max sequence length of 24 tokens.
- **User Actions Required:** None.

---

### Phase 3: Backend API Core (FastAPI + NumPy Inference + Groq Integration)
- **Objectives:** Implement high-performance, lightweight FastAPI backend with pure-NumPy inference, safe skills, Groq LLaMA integration, input validation, and rate limiting.
- **Files to Deliver:**
  - `sam_ai_project/app.py`:
    - NumPy LSTM inference engine loading `intent_weights.npz` and `vocab.json`.
    - Safe skill handlers:
      - `time`: returns `action="time"` for client-side local time resolution.
      - `open_site`: fixed allowlist (`youtube`, `google`, `github`, `wikipedia`, `stackoverflow`, `reddit`, `linkedin`, `gmail`, `chatgpt`).
      - `search`: Google search query with `urllib.parse.quote_plus`.
      - `chat`: Groq client with fallback, retry, and system instructions for concise responses.
    - Endpoints: `POST /chat`, `GET /health`.
    - Middleware: CORS, error handlers, in-memory sliding window rate limiting.
- **Implementation Approach:** Lazy client initialization for Groq (works even when `GROQ_API_KEY` is not yet set); safe error payloads.
- **Commands & Tests:**
  ```bash
  python3 -m pytest sam_ai_project/tests/test_classifier.py sam_ai_project/tests/test_chat_api.py -v
  ```
- **Acceptance Criteria:** Unit tests pass for all 4 intents, confidence fallback (< 0.5 routes to chat), input validation rejects invalid payloads (>300 chars, empty text, malformed history), and mocked Groq integration succeeds.
- **Risks & Fallbacks:** If `GROQ_API_KEY` is missing, return friendly "AI chat is currently in offline mode" message without crashing server.
- **User Actions Required:** (Optional) Provide `GROQ_API_KEY` for live LLaMA responses.

---

### Phase 4: Optional Serverless PostgreSQL Database & Feedback API
- **Objectives:** Provide schema and endpoints for anonymous session feedback and usage statistics, strictly disabled by default.
- **Files to Deliver:**
  - `sam_ai_project/db/schema.sql` (`conversations` table, `feedback` table with indexes).
  - Feedback endpoint `POST /feedback` in `app.py`.
- **Implementation Approach:**
  - Lazy `psycopg` connection pool.
  - Zero database dependency if `DATABASE_URL` is omitted.
  - Asynchronous / best-effort execution with tight timeouts (2.0s max) so slow database queries never block user voice/chat responses.
- **Commands & Tests:**
  ```bash
  python3 -m pytest sam_ai_project/tests/test_feedback_api.py -v
  ```
- **Acceptance Criteria:** `POST /feedback` returns `{"saved": false}` gracefully when database is disabled; returns `{"saved": true}` when configured; database errors are caught and logged without raising 500 errors.
- **Risks & Fallbacks:** Serverless connection exhaustion handled via short timeouts and immediate connection closes.
- **User Actions Required:** (Optional) Provide Neon/Supabase PostgreSQL connection string in `DATABASE_URL` if persistent logging is desired.

---

### Phase 5: Frontend Interface & Voice Assistant UX
- **Objectives:** Create a responsive, accessible, zero-dependency HTML5/CSS/JavaScript single-page app in `public/index.html`.
- **Files to Deliver:**
  - `sam_ai_project/public/index.html` (including all CSS and vanilla JS; zero CDNs, zero npm frontend dependencies).
- **Implementation Approach:**
  - Dark glassmorphism aesthetic with CSS custom properties.
  - Reactive animated Orb with 4 distinct states (`idle`, `listening`, `thinking`, `speaking`).
  - Web Speech API integration (`SpeechRecognition` / `webkitSpeechRecognition`, `speechSynthesis`).
  - Wake phrase logic: active transcript scanner detects "Hey Sam" / "Sam" and extracts following command.
  - Audio collision prevention: pauses recognition before Sam speaks, resumes after speech ends.
  - Local state: `localStorage` chat history with clean bounding and privacy banner.
  - Transcript export: Generates and triggers download of `.txt` conversation history.
  - Safe navigation: Opens allowlisted sites in new tabs (`rel="noopener noreferrer"`).
- **Commands & Tests:**
  - Manual test checklist for Chrome and Edge:
    1. Click "Wake Sam" / Mic -> check mic permission prompt.
    2. Say "Hey Sam, what time is it?" -> check local time resolution.
    3. Say "Open YouTube" -> verify YouTube opens in a new tab.
    4. Say "Explain quantum computing" -> verify Groq response and voice synthesis.
    5. Test Clear Chat and Download Transcript buttons.
- **Acceptance Criteria:** UI operates smoothly with keyboard and screen readers; handles speech recognition unsupported state; renders responsive on mobile and desktop.
- **Risks & Fallbacks:** Speech recognition not supported in Firefox/Safari -> show clear banner recommending Chrome/Edge and enable full typed chat.
- **User Actions Required:** Allow microphone permission in browser when prompted.

---

### Phase 6: End-to-End System Integration & Latency Benchmarks
- **Objectives:** Test all subsystems integrated together under real and simulated network conditions; measure and document response latencies.
- **Deliverables & Test Scenarios:**
  - "Hey Sam" wake word trigger
  - "What time is it?" (local browser time verification)
  - "Open YouTube" (safe allowlist routing)
  - "Search for machine learning" (Google search query generation)
  - "Explain neural networks in simple words" (Groq LLaMA chat stream)
  - Typed input fallback
  - Backend offline / network failure handling
  - Microphone permission denial recovery
  - Chat history persistence across page reloads
  - Latency measurement report: Classifier latency (< 5ms) + Groq generation latency (observed round-trip time).
- **Acceptance Criteria:** All test scenarios pass with documented outcomes and observed timings.
- **Risks & Fallbacks:** If network latency is high, display visual "thinking" indicator to keep user informed.
- **User Actions Required:** Perform interactive microphone checks on Chrome/Edge.

---

### Phase 7: Automated Test Suite & GitHub Actions CI
- **Objectives:** Comprehensive test suite with 100% mocked external dependencies and automated CI workflow.
- **Files to Deliver:**
  - `sam_ai_project/tests/test_classifier.py`
  - `sam_ai_project/tests/test_chat_api.py`
  - `sam_ai_project/tests/test_feedback_api.py`
  - `sam_ai_project/.github/workflows/ci.yml` (runs pytest on Python 3.11 and 3.12).
- **Implementation Approach:** Use `pytest` and `httpx.AsyncClient` with `unittest.mock` for Groq and Postgres.
- **Commands & Tests:**
  ```bash
  pytest sam_ai_project/tests/ -v --tb=short
  ```
- **Acceptance Criteria:** All unit and integration tests pass with zero network or external credential dependencies.
- **Risks & Fallbacks:** None.
- **User Actions Required:** None.

---

### Phase 8: Academic Documentation, Viva Preparation & Demo Script
- **Objectives:** Produce exhaustive, college-level documentation and viva preparation guides.
- **Files to Deliver:**
  - `sam_ai_project/README.md`: System overview, setup, training, running, API docs, credits & references.
  - `sam_ai_project/docs/architecture.md`: Complete Mermaid diagrams for system architecture, data flow, and voice turn-taking.
  - `sam_ai_project/docs/ml-report.md`: Dataset distribution, preprocessing details, baseline comparisons table (Accuracy, Macro F1, Latency, Size), confusion matrix, error analysis, and limitations.
  - `sam_ai_project/docs/privacy-and-limitations.md`: Audio privacy, data retention, Groq privacy policy, browser support limitations.
  - `sam_ai_project/docs/demo-script.md`: Timed 5-minute presentation script with step-by-step phrases and fallback responses.
  - `sam_ai_project/docs/presentation-outline.md`: 10-slide academic deck outline.
  - `sam_ai_project/docs/viva-questions.md`: 30+ frequently asked viva questions with detailed answers (covering RNN vs LSTM, cell gates, NumPy inference, Softmax, Web Speech API, and security).
- **Acceptance Criteria:** All documents written in clear, beginner-friendly academic style; no fabricated metrics.
- **Risks & Fallbacks:** None.
- **User Actions Required:** None.

---

### Phase 9: Security Review & Deployment Readiness
- **Objectives:** Security audit, code quality review, and zero-cost Vercel deployment configuration.
- **Files to Deliver:**
  - `sam_ai_project/docs/review.md`: Security and code quality audit report.
  - `sam_ai_project/vercel.json`: Vercel serverless configuration mapping `/api/.*` and static `/public` directory.
- **Implementation Approach:**
  - Verify zero secrets in code and git tree.
  - Check CORS headers and input sanitization.
  - Test production bundle build.
  - Step-by-step deployment instructions for GitHub + Vercel.
- **Acceptance Criteria:** Security review shows no high or medium vulnerabilities; static assets serve properly; deployment instructions verified against current Vercel Python runtime limits.
- **Risks & Fallbacks:** Vercel Python serverless cold starts documented in limitations.
- **User Actions Required:** Connect GitHub repo to Vercel and input `GROQ_API_KEY` in Vercel project environment variables.
