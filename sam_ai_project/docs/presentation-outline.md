# Academic Capstone Presentation Deck Outline: Sam AI Voice Assistant

A 10-slide presentation structure engineered for college capstone defenses, committee evaluations, and technical seminars.

---

### Slide 1: Title & Project Overview
- **Title:** Sam AI: A Voice-First Conversational Assistant with Pure-NumPy Recurrent Intent Inference
- **Subtitle:** College Capstone Project in Artificial Intelligence & Natural Language Processing
- **Presenter Name:** [Student Name / Roll Number]
- **Department:** Department of Computer Science & Engineering
- **Visuals:** Project logo, screenshot of dark glassmorphic UI with glowing cyan orb.
- **Speaker Note:** Welcome the panel and introduce the core vision: a voice assistant that combines browser-native speech with sub-millisecond local deep learning intent classification.

---

### Slide 2: Problem Statement & Motivation
- **The Problem:**
  - Traditional voice assistants stream raw microphone audio to remote cloud servers (high latency, privacy vulnerabilities, large bandwidth consumption).
  - Heavy ML frameworks (PyTorch, TensorFlow) exceed serverless bundle limits (250MB+) and induce substantial cold starts.
  - Timezone distortions: server-evaluated time queries return incorrect local time for users in different regions.
- **Our Solution:**
  - Client-side audio processing via W3C Web Speech API.
  - Recurrent neural network intent classification exported to lightweight pure-NumPy inference (< 1ms execution).
  - Client-side action execution for localized time resolution.
- **Speaker Note:** Emphasize the architectural motivation for separating speech acoustics from serverless NLP intent extraction.

---

### Slide 3: System Architecture & Data Flow
- **Key Architectural Components:**
  - **Client Tier:** Web Speech API (`SpeechRecognition` & `SpeechSynthesis`), Wake Phrase Scanner, 4-state animated Orb.
  - **API Tier:** FastAPI (Python 3.11/3.12), Pydantic validation, sliding-window rate limiting.
  - **Inference Tier:** Pure-NumPy LSTM engine loading pre-computed weights (`intent_weights.npz`) and vocabulary (`vocab.json`).
  - **Services Tier:** Groq Cloud API (LLaMA 3.3 70B fallback) & optional serverless PostgreSQL database.
- **Visuals:** Mermaid architecture block diagram from `docs/architecture.md`.
- **Speaker Note:** Walk through the flow from spoken utterance to tokenization, forward pass, and skill execution.

---

### Slide 4: Audio Collision Prevention & Wake Word Logic
- **Audio Collision Prevention:**
  - Challenge: The microphone picking up the speaker's own synthesized voice, causing infinite speech feedback loops.
  - Solution: Event-driven mutual exclusion. `recognition.abort()` is called before `speechSynthesis.speak()`; listening resumes only upon `utterance.onend`.
- **Wake Word Recognition:**
  - Continuous transcript token matching for "Hey Sam" and "Sam".
  - Graceful direct response if no trailing command is spoken ("Yes, I'm listening!").
- **Visuals:** Sequence diagram of audio turn-taking.
- **Speaker Note:** Highlight this practical engineering design that ensures smooth human-machine conversational flow.

---

### Slide 5: Dataset Engineering & Validation
- **Dataset Specification:**
  - 431 balanced, curated utterances across 4 distinct classes:
    - `time`: 105 samples
    - `open_site`: 114 samples
    - `search`: 105 samples
    - `chat`: 107 samples
  - Stratified split: 70% Train (301), 15% Validation (65), 15% Test (65).
  - Vocabulary: 406 tokens extracted exclusively from the training split.
  - Natural Indian-English phrasing (*"what time it is now"*, *"time please"*).
  - Tricky negative cases for chat (*"philosophical meaning of time"*, *"history of youtube"*).
- **Visuals:** Class distribution pie chart and bar plot.
- **Speaker Note:** Explain how class balance and tricky boundary cases prevent spurious keyword-matching overfitting.

---

### Slide 6: Model Architecture & 5-Model Benchmark
- **Benchmarked Architectures:**
  1. Majority Class Baseline (26.15% accuracy)
  2. TF-IDF + Logistic Regression (96.92% accuracy, 0.209 ms)
  3. Simple RNN (81.54% accuracy, 0.179 ms)
  4. Gated Recurrent Unit (GRU) (92.31% accuracy, 0.729 ms)
  5. **LSTM (Deployed Architecture)** (**89.23% accuracy, 0.254 ms**)
- **Visuals:** Performance comparison table and training loss curve from `docs/images/training_loss.png`.
- **Speaker Note:** Discuss why the LSTM was chosen as the deployed neural architecture to evaluate sequential memory gates in an academic setting.

---

### Slide 7: Pure-NumPy Inference & Mathematical Parity
- **Export Strategy:**
  - Offline training in PyTorch with Adam optimizer, gradient clipping (norm=5.0), and cross-entropy loss.
  - Exported matrices: $W_{ih}, W_{hh}, b_{ih}, b_{hh}$ (LSTM cell), $W_{fc}, b_{fc}$ (Dense projection), and $E$ (Word embeddings).
  - Total weights size: **235 KB** (vs 700MB+ for PyTorch runtime).
- **Parity Verification (`check_numpy_matches_torch.py`):**
  - Evaluated on 60 diverse utterances.
  - Maximum probability difference: **$3.58 \times 10^{-7}$** (well below $10^{-4}$ threshold).
  - Class prediction agreement: **100% (0 mismatches)**.
- **Visuals:** Formula breakdown of LSTM gates in NumPy.
- **Speaker Note:** Emphasize that NumPy forward pass is not an approximation—it is mathematically identical to PyTorch.

---

### Slide 8: Latency Benchmarks & Production Performance
- **Empirical Latency Results (1,000 Iterations):**
  - **Mean Inference Latency:** **0.464 ms**
  - **Median (p50):** **0.427 ms**
  - **95th Percentile (p95):** **0.630 ms**
  - **99th Percentile (p99):** **1.038 ms**
- **Full API Round-Trip Time:** Average **~7–8 ms** for local skills on localhost.
- **Visuals:** Latency distribution histogram or box plot.
- **Speaker Note:** Point out that sub-millisecond inference leaves virtually 100% of the compute budget for network transport.

---

### Slide 9: Privacy, Security & Engineering Robustness
- **Security Guardrails:**
  - Strict allowlist for `open_site` skill to prevent arbitrary URL injection.
  - URL-encoded Google search queries.
  - Pydantic schema validation (1–300 character strings, bounded history <= 10).
  - Sliding-window rate limiting (60 requests/minute per IP).
  - Optional database storage with schema isolation and non-blocking timeouts (2.0s).
  - Comprehensive automated test suite: **30 unit and API tests passing in CI**.
- **Visuals:** Security checklist and green GitHub Actions CI badge.
- **Speaker Note:** Highlight software engineering best practices that make this project production-grade.

---

### Slide 10: Conclusion & Future Scope
- **Key Contributions:**
  - Demonstrated client-side voice processing with zero audio streaming overhead.
  - Proved mathematical equivalence of pure-NumPy LSTM inference.
  - Delivered a responsive dark glass UI with 4-state visual orb feedback.
- **Future Enhancements:**
  - On-device acoustic wake word detection using WebAssembly (Wasm) and TensorFlow.js / ONNX Runtime Web.
  - Multi-language voice synthesis supporting Hindi and regional Indian dialects.
  - Offline speech recognition via Whisper.tflite running in Web Workers.
- **Speaker Note:** Conclude the presentation and invite questions from the examination committee.
