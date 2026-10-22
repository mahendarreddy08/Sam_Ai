# Five-Minute Capstone Demo Script: Sam AI Voice Assistant

This script provides an exact, timed, 5-minute presentation walkthrough designed for college final examinations, project reviews, and live evaluators.

---

## Preparation Checklist (1 Minute Before Demo)
1. Open Google Chrome or Microsoft Edge.
2. Navigate to the application URL (`http://localhost:8000`).
3. Ensure system audio/speakers are unmuted and set to ~60% volume.
4. Have the browser console open (`F12`) to demonstrate zero errors and clean logging.
5. In case of classroom noise: have a working keyboard ready for typed fallback queries.

---

## Timed Walkthrough

### [0:00 – 0:45] Introduction & Architecture Hook
- **Presenter Spoken:**
  > "Respected evaluators, today I present **Sam**, an intelligent voice assistant web application developed as an end-to-end AI/ML capstone. Traditional voice assistants stream raw microphone audio to remote cloud servers, incurring high bandwidth costs and privacy concerns. Sam is engineered with client-side speech processing using the Web Speech API and an offline-trained PyTorch recurrent LSTM neural network that we exported to **pure-NumPy** for sub-millisecond production inference with zero cloud audio latency."
- **Action:** Point out the dark glassmorphic UI, glowing cyan orb, and the suggestion chips.

---

### [0:45 – 1:30] Demonstration 1: Wake Phrase & Local Time Skill
- **Action:** Click the glowing orb once to initialize microphone access. The orb transforms into glowing green (`listening`).
- **Presenter Spoken (Into Mic):**
  > *"Hey Sam, what is the current time?"*
- **Observed Behavior:**
  - Orb rotates violet (`thinking`), then pulses warm amber (`speaking`).
  - Sam replies by voice: *"It's currently [Current Local Time]."*
  - The message appears in the chat stream with an azure `TIME` badge and `98%+` confidence pill.
- **Presenter Technical Note:**
  > "Notice that the time returned matches our local device clock exactly. Rather than evaluating time on a remote server which could be in a different timezone, our classifier emits a structured action marker that allows the client to insert the user's localized system clock."

---

### [1:30 – 2:30] Demonstration 2: Safe Website Launching & Search
- **Presenter Spoken (Into Mic or Typed):**
  > *"Open YouTube"*
- **Observed Behavior:**
  - Sam replies: *"Opening YouTube."*
  - YouTube opens in a new browser tab with `rel="noopener,noreferrer"`.
  - Emerald `OPEN SITE` badge is displayed.
- **Presenter Spoken (Into Mic):**
  > *"Search for machine learning roadmap"*
- **Observed Behavior:**
  - Sam replies: *"Searching Google for machine learning roadmap."*
  - Google search opens with the URL-encoded query.
  - Amber `SEARCH` badge is displayed.
- **Presenter Technical Note:**
  > "Our skill router enforces strict security. If a user asks to open an unknown or untrusted URL, Sam never executes an arbitrary redirect; it safely converts the request into a sanitized Google search."

---

### [2:30 – 3:30] Demonstration 3: Generative AI Chat & Spoken Fallback
- **Presenter Spoken (Into Mic):**
  > *"Tell me an interesting science joke"*
- **Observed Behavior:**
  - Sam routes to `chat` (Groq LLaMA 3.3 integration).
  - Sam replies verbally with a spoken-style, plain-text response (1–2 concise sentences without markdown or bullet points).
  - Purple `CHAT` intent badge is displayed.
- **Presenter Technical Note:**
  > "Notice that speech recognition automatically pauses the moment Sam begins speaking, and resumes only after speech synthesis concludes. This prevents Sam from transcribing its own voice and avoids acoustic echo loops."

---

### [3:30 – 4:15] Demonstration 4: Transcript Export & Privacy Controls
- **Action:** Click **Transcript** in the top navigation bar.
- **Observed Behavior:** Browser immediately downloads `sam-transcript.txt` containing the full timestamped log with intents and confidence scores.
- **Action:** Click **Privacy**. Show the consent toggle for anonymous feedback.
- **Presenter Spoken:**
  > "We adhere strictly to privacy-by-design. Audio processing is 100% client-side, history is saved in local browser storage, and feedback logging to our optional serverless PostgreSQL database is completely opt-in."

---

### [4:15 – 5:00] Summary & Viva Handover
- **Presenter Spoken:**
  > "To summarize: our system achieves an average inference latency of **0.46ms** using pure NumPy, benchmarks 5 NLP architectures, guarantees zero audio eavesdropping, and deploys cost-free on modern serverless platforms. Thank you, and I welcome any questions."

---

## Contingency & Fallback Guide

| Issue During Demo | Cause | Immediate Fallback Action |
| :--- | :--- | :--- |
| **Microphone fails to detect speech** | Ambient room noise or browser mic permission blocked | Use the input box to type: *"what time is it"* and press Enter. Explain: *"The Web Speech API handles acoustics, while our core NLP engine runs identically on text inputs."* |
| **No internet for Groq API** | Wi-Fi disconnect | Sam automatically replies with: *"AI chat is currently in offline mode..."* Point out that time, site launch, and search skills remain 100% operational offline! |
| **Browser doesn't have Indian English voice** | System OS lacks `en-IN` TTS pack | Web Speech API automatically falls back to default English voice (`en-US` / `en-GB`). |
| **Evaluator asks to see model weights** | Technical inquiry | Open terminal and show `ls -lh model/intent_weights.npz` (235 KB) and `check_numpy_matches_torch.py`. |
