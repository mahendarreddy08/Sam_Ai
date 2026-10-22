# Privacy, Security & Engineering Limitations

## 1. Privacy Architecture

### 1.1 Client-Side Audio Guarantee
Unlike traditional voice assistants (e.g. Amazon Alexa, Google Assistant, Apple Siri) that stream raw acoustic PCM audio to cloud servers for speech-to-text processing, **Sam processes 100% of audio client-side within the user's browser sandbox**:
- Speech recognition is performed via the browser engine's native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- Raw microphone audio never leaves the client's device, eliminating audio eavesdropping, storage, and interception risks.
- Only transcribed plain-text strings are transmitted to the backend API (`/chat`).

### 1.2 Data Retention & Logging
- **Default Behavior:** By default, no database is connected. The assistant operates entirely in memory, and conversational history is stored exclusively in the user's browser `localStorage` (bounded to 20 messages).
- **Opt-In Feedback:** If an external PostgreSQL database is configured by the operator (`DATABASE_URL`), conversation ratings are saved **only if the user explicitly opts in** via the "Help improve Sam" checkbox in the Privacy modal (`sam_opt_in_feedback` in `localStorage`).
- **No Personally Identifiable Information (PII):** Feedback logs record only anonymous session tokens, query text, predicted intent, and helpfulness booleans. No IP addresses, user accounts, cookies, or hardware identifiers are stored.

### 1.3 Third-Party Generative AI (Groq Cloud)
- When a query is routed to the general `chat` intent, the plain-text query and up to 10 prior conversation turns are sent to the Groq Cloud API for inference with LLaMA 3.3.
- In accordance with Groq's API privacy policy for commercial developers, inputs submitted through standard API keys are not used to train foundational models.

---

## 2. Engineering Limitations & Trade-Offs

### 2.1 Browser Engine Compatibility
- **Chromium Requirement for Voice:** The W3C SpeechRecognition standard is currently fully implemented only in Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera).
- **Firefox & Safari:** Mozilla Firefox and Apple Safari do not natively implement the `webkitSpeechRecognition` standard. In these environments, Sam detects the missing API and presents a polite informational banner advising the user to use Chrome/Edge for voice, while keeping typed text chat 100% functional.

### 2.2 Wake Phrase Reliability
- **Acoustic Wake Word vs. Continuous Transcript Scanning:** Hardware voice assistants use dedicated low-power digital signal processor (DSP) chips running acoustic models (e.g., Porcupine or Snowboy) listening for acoustic phoneme patterns.
- In a web browser environment, security policies prohibit background hardware DSP access without explicit user activation. Sam implements continuous transcript keyword matching ("Hey Sam" / "Sam") after a single user gesture (tapping the orb or mic button).

### 2.3 Acoustic Environment & Background Noise
- Web Speech transcription accuracy is susceptible to ambient classroom or café noise. If words are misheard, the pure-NumPy LSTM classifier may classify an utterance into `chat` or mispredict intent. The confidence threshold (`0.50`) ensures that low-confidence mispredictions are safely treated as general conversational requests rather than executing unwanted actions.

### 2.4 Serverless Cold Starts
- On serverless platforms (e.g., Vercel, AWS Lambda), a cold start occurs when a function instance is initialized from scratch. Because Sam uses pure-NumPy inference rather than PyTorch in production, the function bundle is under 15MB, keeping cold-start latency under 400ms.
