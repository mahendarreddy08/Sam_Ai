# Sam AI Voice Assistant

[![Python Version](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Framework-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Inference Engine](https://img.shields.io/badge/Inference-Pure%20NumPy%20LSTM-orange.svg)](https://numpy.org/)
[![Tests](https://img.shields.io/badge/Tests-30%20Passed-brightgreen.svg)](tests/)

A Siri/Jarvis-inspired conversational voice assistant web application designed as an academic AI/ML capstone project. Sam combines browser-native Web Speech recognition with an offline-trained PyTorch recurrent LSTM intent classifier exported to **sub-millisecond pure-NumPy inference**, a generative AI fallback powered by Groq LLaMA 3.3, a dark glassmorphic UI with a 4-state glowing animated orb, and an optional serverless PostgreSQL database.

---

## Key Highlights

1. **Client-Side Speech Processing:** Powered by the standard W3C Web Speech API (`SpeechRecognition` & `speechSynthesis`). 100% of microphone audio stays on the user's device—zero audio bandwidth to the server.
2. **Pure-NumPy Production Inference:** PyTorch is used strictly offline for training and evaluation. Model weights and vocabulary are exported to `model/intent_weights.npz` (235 KB) and `model/vocab.json`, executing with an average latency of **0.46ms** with **zero PyTorch runtime dependency** in production.
3. **Audio Collision Prevention:** Speech recognition automatically pauses before Sam begins speaking and resumes only after speech synthesis concludes, eliminating acoustic feedback loops.
4. **Deterministic Safe Skills:**
   - `time`: Emits an action marker so the browser resolves the user's localized system time (avoids server timezone mismatch).
   - `open_site`: Navigates exclusively to allowlisted destinations (YouTube, Google, GitHub, Wikipedia, etc.).
   - `search`: Automatically sanitizes and URL-encodes queries into Google search links.
   - `chat`: Bounded multi-turn dialogue powered by Groq LLaMA 3.3 70B Versatile with spoken-style plain text replies.
5. **Interactive 4-State Glowing Orb:** Visually communicates assistant state:
   - `idle`: Calm cyan breathing pulse (`#00F2FE`).
   - `listening`: Energetic green pulse with radial ripple (`#10B981`).
   - `thinking`: Rapid violet rotation (`#8B5CF6`).
   - `speaking`: Warm amber radial soundwave pulse (`#F59E0B`).

---

## 5-Model Benchmark Comparison

All 5 architectures were evaluated under identical seeds (42) and stratified splits (70/15/15) on our curated 431-sample dataset:

| Model Architecture | Test Accuracy | Macro F1 | Parameter Count | Latency (CPU) |
| :--- | :--- | :--- | :--- | :--- |
| **Majority Class Baseline** | 26.15% | 0.1037 | 1 | 0.001 ms |
| **TF-IDF + Logistic Regression** | 96.92% | 0.9686 | 1,620 | 0.209 ms |
| **Simple RNN** | 81.54% | 0.8164 | 34,564 | 0.179 ms |
| **GRU (Gated Recurrent Unit)** | 92.31% | 0.9195 | 51,204 | 0.729 ms |
| **LSTM (Deployed Architecture)** | **89.23%** | **0.8936** | **59,524** | **0.254 ms** |

*Mathematical Parity:* The exported pure-NumPy LSTM forward pass matches PyTorch within **$3.58 \times 10^{-7}$** maximum absolute probability difference across 60 evaluation utterances with **0 prediction mismatches**.

---

## Directory Structure

```
sam_ai_project/
├── PROJECT_BRIEF.md                # Master architectural brief and constraints
├── CLAUDE.md / AGENTS.md           # AI assistant pointer files
├── .clinerules                     # Coding rules pointer
├── .gitignore                      # Strict ignore rules for .env and caches
├── .env.example                    # Template for environment configuration
├── requirements.txt                # Production dependencies (FastAPI, NumPy, Groq)
├── requirements-dev.txt            # Dev & training dependencies (PyTorch, sklearn)
├── README.md                       # Master documentation
├── app.py                          # FastAPI backend core with NumPy LSTM engine
├── intent_model.py                 # Reproducible training pipeline & 5-model comparison
├── check_numpy_matches_torch.py    # NumPy vs PyTorch numerical parity validator
├── validate_dataset.py             # Dataset schema and duplicate validator
├── benchmark_and_scenarios.py      # 1,000-run statistical latency benchmark suite
├── data/
│   └── intents.csv                 # 431 curated samples across 4 balanced intents
├── model/
│   ├── intent_weights.npz          # Exported pure-NumPy weight matrices (235 KB)
│   └── vocab.json                  # Shared tokenizer vocabulary (406 tokens)
├── db/
│   └── schema.sql                  # Optional PostgreSQL DDL schema with privacy notes
├── public/
│   └── index.html                  # Responsive standalone single-page application
├── tests/
│   ├── test_classifier.py          # 11 unit tests for NumPy classifier
│   ├── test_chat_api.py            # 14 integration and contract tests
│   └── test_feedback_api.py        # 5 tests for feedback and DB isolation
├── docs/
│   ├── architecture.md             # Mermaid architectural and sequence diagrams
│   ├── ml-report.md                # Comprehensive machine learning evaluation report
│   ├── privacy-and-limitations.md  # Privacy boundaries and browser limitations
│   ├── demo-script.md              # 5-minute timed presentation script
│   ├── presentation-outline.md     # 10-slide capstone slide deck outline
│   ├── viva-questions.md           # 35 viva voce examination questions & answers
│   └── images/
│       ├── confusion_matrix.png    # Confusion matrix visual plot
│       └── training_loss.png       # Loss convergence curve
└── .github/
    └── workflows/
        └── ci.yml                  # GitHub Actions CI matrix for Python 3.11 & 3.12
```

---

## Quickstart

### 1. Installation
Clone the repository and install dependencies:
```bash
# 1. For running the production server:
pip install -r requirements.txt

# 2. For training, benchmarking, and running tests:
pip install -r requirements-dev.txt
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional: add your `GROQ_API_KEY` from [console.groq.com](https://console.groq.com/) for live generative chat).*

### 3. Running the Server Locally
```bash
uvicorn app:app --reload --port 8000
```
Open **Google Chrome** or **Microsoft Edge** at `http://localhost:8000`.

---

## API Contract

### `POST /chat`
- **Request:**
  ```json
  {
    "text": "What time is it right now?",
    "history": [
      {"role": "user", "content": "hi"},
      {"role": "assistant", "content": "Hello! How can I help?"}
    ]
  }
  ```
- **Response:**
  ```json
  {
    "intent": "time",
    "reply": "It's currently {time}.",
    "action": "time",
    "url": null,
    "confidence": 0.985
  }
  ```

### `POST /feedback`
- **Request:**
  ```json
  {
    "text": "what is the date",
    "predicted_intent": "time",
    "helpful": false,
    "correct_intent": "chat",
    "session_id": "anon-session-123"
  }
  ```
- **Response:**
  ```json
  {
    "saved": false
  }
  ```

### `GET /health`
- **Response:**
  ```json
  {
    "status": "ok",
    "database": "disabled",
    "model": "loaded"
  }
  ```

---

## Testing & Verification

Run the full automated pytest suite:
```bash
pytest tests/ -v --tb=short
```

Run the 1,000-iteration latency benchmark:
```bash
python3 benchmark_and_scenarios.py
```

Run the PyTorch vs NumPy mathematical parity check:
```bash
python3 check_numpy_matches_torch.py
```

---

## Academic & Viva Examination Resources
- **System Architecture & Mermaid Diagrams:** [`docs/architecture.md`](docs/architecture.md)
- **Machine Learning Evaluation Report:** [`docs/ml-report.md`](docs/ml-report.md)
- **Privacy & Limitations Guide:** [`docs/privacy-and-limitations.md`](docs/privacy-and-limitations.md)
- **5-Minute Presentation Script:** [`docs/demo-script.md`](docs/demo-script.md)
- **10-Slide Deck Outline:** [`docs/presentation-outline.md`](docs/presentation-outline.md)
- **35 Viva Voce Questions & Answers:** [`docs/viva-questions.md`](docs/viva-questions.md)

---

## License & Credits
Licensed under the [Apache License, Version 2.0](LICENSE). Developed as an Artificial Intelligence & Natural Language Processing Capstone Project.
