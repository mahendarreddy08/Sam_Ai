# Comprehensive Viva Voce Examination Guide: Sam AI Voice Assistant

A compilation of **35 technical examination questions with rigorous, detailed answers** covering Deep Learning, Natural Language Processing, Web Speech APIs, Systems Architecture, and Security.

---

## Section 1: Deep Learning & Recurrent Architectures (Q1 – Q10)

### Q1: What is a Recurrent Neural Network (RNN) and how does it differ from a standard Feedforward Neural Network (FNN)?
**Answer:** A standard Feedforward Neural Network processes fixed-size inputs independently, assuming that all inputs are conditionally independent of each other ($P(y|x)$). In contrast, Recurrent Neural Networks process sequential data of variable length by introducing a recurrent hidden state $h_t$ that acts as internal memory:
$$h_t = \tanh(W_{ih} x_t + b_{ih} + W_{hh} h_{t-1} + b_{hh})$$
Because $h_t$ is computed from both the current input $x_t$ and the previous hidden state $h_{t-1}$, RNNs share parameters across all time steps and maintain temporal context across sequential text tokens.

### Q2: What is the Vanishing and Exploding Gradient problem in traditional RNNs?
**Answer:** During Backpropagation Through Time (BPTT), gradients of the loss function with respect to early hidden states $h_0$ involve repeated matrix multiplications of the recurrent weight matrix $W_{hh}$:
$$\frac{\partial h_T}{\partial h_1} = \prod_{t=2}^{T} \frac{\partial h_t}{\partial h_{t-1}} = \prod_{t=2}^{T} \text{diag}(1 - \tanh^2(\dots)) W_{hh}^T$$
- If the eigenvalues of $W_{hh}$ are strictly less than 1, the product decays exponentially toward zero as sequence length $T$ increases (**vanishing gradient**), preventing the network from learning long-term dependencies.
- If the eigenvalues are greater than 1, gradients grow exponentially toward infinity (**exploding gradient**), causing numerical overflow (`NaN`). In our project, we mitigate exploding gradients during training using gradient clipping: `clip_grad_norm_(model.parameters(), max_norm=5.0)`.

### Q3: How does an LSTM (Long Short-Term Memory) solve the vanishing gradient problem?
**Answer:** LSTMs introduce an explicit constant error carousel known as the **Cell State ($c_t$)**, along with three non-linear multiplicative gates:
1. **Forget Gate ($f_t$):** Controls what fraction of the previous cell state to discard:
   $$f_t = \sigma(W_f x_t + U_f h_{t-1} + b_f)$$
2. **Input Gate ($i_t$) & Candidate Cell ($g_t$):** Controls what new candidate memory to store:
   $$i_t = \sigma(W_i x_t + U_i h_{t-1} + b_i), \quad g_t = \tanh(W_g x_t + U_g h_{t-1} + b_g)$$
3. **Cell State Update:** The cell state is updated via an additive linear highway:
   $$c_t = f_t \odot c_{t-1} + i_t \odot g_t$$
4. **Output Gate ($o_t$) & Hidden State ($h_t$):** Controls what part of the memory is emitted:
   $$o_t = \sigma(W_o x_t + U_o h_{t-1} + b_o), \quad h_t = o_t \odot \tanh(c_t)$$
Because the cell state update ($c_t = f_t c_{t-1} + \dots$) is primarily **additive** rather than purely multiplicative, error gradients can flow backwards across many time steps without exponential decay.

### Q4: What is the difference between an LSTM and a GRU (Gated Recurrent Unit)?
**Answer:** 
- An LSTM has two separate recurrent vectors ($h_t$ and $c_t$) and three gates (Input, Forget, Output).
- A GRU merges the cell state and hidden state into a single state vector $h_t$ and reduces the gating mechanism to two gates: an **Update Gate ($z_t$)** (which combines the forget and input gates) and a **Reset Gate ($r_t$)**.
- GRUs have approximately 25% fewer parameters than LSTMs, leading to faster training times, but LSTMs offer greater expressive capacity for complex sequential patterns. In our benchmarks, both achieved high accuracy (GRU: 92.31%, LSTM: 89.23%).

### Q5: Why did you deploy the LSTM instead of TF-IDF + Logistic Regression when TF-IDF achieved higher accuracy?
**Answer:** In an academic capstone, demonstrating neural sequence modeling, recurrent memory states, and pure-NumPy inference is a core pedagogical objective. TF-IDF uses a "bag-of-words" representation that ignores token order, whereas the LSTM models the exact sequential syntax of human speech. Furthermore, as explicitly documented in `docs/ml-report.md`, we report all 5 benchmarked models transparently and explain the architectural trade-offs without fabricating metrics.

### Q6: What loss function and optimizer were used to train the LSTM?
**Answer:** We used **Cross-Entropy Loss** (`nn.CrossEntropyLoss`), which combines a LogSoftmax function with negative log-likelihood (NLL) loss:
$$\mathcal{L} = -\sum_{c=1}^{C} y_c \log(p_c)$$
The optimizer used was **Adam** (`lr=0.001`, `weight_decay=1e-5`), which maintains adaptive learning rates based on first and second order gradient moments ($m_t$ and $v_t$).

### Q7: What is the purpose of the validation split in training?
**Answer:** The dataset was split into 70% Train, 15% Validation, and 15% Test using stratified sampling. The validation set is evaluated at the end of every epoch to monitor generalization performance, perform early model checkpointing (saving only when validation accuracy improves), and prevent overfitting. The test split is held out completely and only evaluated once after training is finalized.

### Q8: What does "stratified split" mean and why is it essential here?
**Answer:** Stratified splitting ensures that each random partition (train, validation, and test) maintains the exact same percentage of samples for each class as the original dataset. Since our 4 classes (`time`, `open_site`, `search`, `chat`) are balanced with ~25% each, stratification prevents any single split from having an overrepresentation or absence of a specific intent.

### Q9: What is Macro F1 and why is it preferred over Micro F1 or simple Accuracy for multi-class classification?
**Answer:** Accuracy computes the total fraction of correct predictions across all samples. However, if a dataset is imbalanced, accuracy can be misleading. Macro F1 calculates the F1-score (harmonic mean of Precision and Recall) independently for each class and then takes the unweighted arithmetic mean:
$$\text{Macro F1} = \frac{1}{C} \sum_{c=1}^{C} F1_c$$
This gives equal weight to all classes regardless of their frequency, ensuring that the model performs well on all intents.

### Q10: What does the Confusion Matrix tell you about your LSTM model?
**Answer:** The confusion matrix displays true labels on rows and predicted labels on columns. Off-diagonal numbers represent misclassifications. In our LSTM evaluation on 65 test samples, 58 samples were correctly classified along the diagonal. The primary misclassifications occurred between ambiguous `chat` requests and allowlisted `open_site` requests, which is why our confidence fallback routes low-confidence predictions (< 0.50) into general chat.

---

## Section 2: Pure-NumPy Inference & Export (Q11 – Q18)

### Q11: What is the primary technical motivation for exporting model weights to pure NumPy?
**Answer:** Standard deep learning libraries like PyTorch or TensorFlow are massive; the PyTorch wheel with CUDA dependencies exceeds 800MB, and even CPU-only wheels exceed 180MB. Serverless hosting platforms (e.g., Vercel, AWS Lambda free tiers) have strict uncompressed function size limits (typically 250MB) and incur heavy cold-start delays. By implementing the forward pass in **pure NumPy**, our entire exported weight file is only **235 KB**, allowing cold starts under 400ms and zero serverless deployment size violations.

### Q12: How are the PyTorch LSTM weights stored internally and what are their dimensions?
**Answer:** In PyTorch, an `nn.LSTM(input_size=64, hidden_size=64)` combines all 4 gates into single contiguous matrices:
- `weight_ih_l0`: Shape `(4*H, D)` = `(256, 64)` representing weights for Input, Forget, Cell, and Output gates.
- `weight_hh_l0`: Shape `(4*H, H)` = `(256, 64)` representing recurrent state weights.
- `bias_ih_l0` and `bias_hh_l0`: Shape `(4*H,)` = `(256,)`.
- `fc.weight`: Shape `(C, H)` = `(4, 64)`.
- `fc.bias`: Shape `(C,)` = `(4,)`.
- `embedding.weight`: Shape `(V, D)` = `(406, 64)`.

### Q13: In what order does PyTorch slice the gate matrices?
**Answer:** PyTorch orders the gates as **$[i, f, g, o]$**:
- Indices $0$ to $H$: Input gate ($i$)
- Indices $H$ to $2H$: Forget gate ($f$)
- Indices $2H$ to $3H$: Cell candidate gate ($g$)
- Indices $3H$ to $4H$: Output gate ($o$)
Our NumPy forward pass slices `gates[0:H]`, `gates[H:2*H]`, `gates[2*H:3*H]`, and `gates[3*H:4*H]` to match PyTorch's internal layout identically.

### Q14: How is numerical stability ensured in the pure-NumPy Softmax function?
**Answer:** The standard softmax formula $\frac{e^{z_i}}{\sum e^{z_j}}$ is vulnerable to numerical overflow if any logit $z_i > 709$ (the limit of 64-bit IEEE floating point). In `app.py`, we subtract the maximum logit before exponentiation:
$$\text{Softmax}(z)_i = \frac{e^{z_i - \max(z)}}{\sum_j e^{z_j - \max(z)}}$$
Because $\frac{e^{z_i - c}}{\sum e^{z_j - c}} = \frac{e^{-c} e^{z_i}}{e^{-c} \sum e^{z_j}} = \frac{e^{z_i}}{\sum e^{z_j}}$, this transformation is mathematically identical while guaranteeing that the largest exponent evaluated is $e^0 = 1$, completely preventing floating-point overflow.

### Q15: How did you verify that the NumPy forward pass produces identical results to PyTorch?
**Answer:** In `check_numpy_matches_torch.py`, we load the exact weights into both a PyTorch model and our NumPy classifier. We execute both on 60 diverse utterances and compare the output probability vectors using the absolute difference metric:
$$\text{max\_diff} = \max |p_{\text{PyTorch}} - p_{\text{NumPy}}|$$
The script confirmed a maximum difference of **$3.58 \times 10^{-7}$**, which is well within our strict numerical tolerance threshold of $1.0 \times 10^{-4}$, and achieved **100% classification agreement (0 mismatches)**.

### Q16: What is the measured inference latency of the pure-NumPy model?
**Answer:** Over 1,000 continuous benchmarked iterations on standard CPU hardware (measured with `time.perf_counter` in `benchmark_and_scenarios.py`), the model achieved a **mean latency of 0.464 ms**, a median of 0.427 ms, and a 99th percentile latency of 1.038 ms.

### Q17: What file format is used for exported weights?
**Answer:** We use Python's native uncompressed NumPy archive format (`.npz`), which serializes multiple named NumPy arrays into a single standard zip container. It requires no external dependencies beyond `numpy`.

### Q18: What is the vocabulary file (`vocab.json`) and why must it be shared between training and production?
**Answer:** `vocab.json` maps every known vocabulary word string to a unique integer ID (e.g. `"youtube": 24`). If production inference used a different vocabulary mapping or tokenization rule, the integer IDs looked up in the embedding matrix would correspond to different semantic vectors, completely breaking model predictions.

---

## Section 3: NLP & Preprocessing (Q19 – Q23)

### Q19: Explain the tokenization process used in your system.
**Answer:** Tokenization is deterministic:
1. Convert all characters to lowercase: `text.lower()`.
2. Strip all punctuation using regular expressions: `re.sub(r"[^\w\s]", " ", text)`.
3. Split on whitespace to produce clean token strings: `[t.strip() for t in text.split() if t.strip()]`.
4. Truncate to maximum sequence length `MAX_SEQ_LEN = 20` tokens.
5. Pad shorter sequences with the `<pad>` token (ID 0) up to length 20.

### Q20: How are Out-of-Vocabulary (OOV) words handled during inference?
**Answer:** When the tokenizer encounters a word that was not present in the training vocabulary (e.g. a rare slang word or brand name), it maps that token to the special `<unk>` token at index `1`. During training, the embedding vector for index 1 learns a generalized representation for unseen terms, allowing the LSTM to classify the rest of the sentence based on surrounding contextual words.

### Q21: Why is sequence length capped at 20 tokens?
**Answer:** In a voice assistant, user spoken command queries are typically brief (e.g. "What time is it?", "Open YouTube", "Search for quantum mechanics"). Analysis of our dataset indicated that 99% of utterances are under 15 tokens. Setting `MAX_SEQ_LEN = 20` balances memory overhead and computation speed while preserving the full context of user commands.

### Q22: What are "Hard Negatives" in your dataset and why were they added?
**Answer:** Hard negatives are challenging utterances designed to prevent spurious keyword triggers. For example, if a model only saw the word "time" in the `time` class, it might misclassify "What is the philosophical meaning of time?" as `time`. We specifically added utterances like:
- *"What is the philosophical meaning of time?"* -> labeled as `chat`
- *"Tell me the history of YouTube"* -> labeled as `chat`
- *"Who founded Google?"* -> labeled as `chat`
This forces the LSTM to learn structural and syntactic context rather than relying on isolated keyword detection.

### Q23: Why do we pad sequences from the end (post-padding) instead of pre-padding?
**Answer:** In single-layer recurrent networks processed with `batch_first=True` and unrolled sequentially, padding with zeros ensures that initial tokens populate the early time steps. While pre-padding is sometimes used to keep recent tokens close to the final hidden state $h_T$, post-padding with zero-embeddings preserves standard forward reading order.

---

## Section 4: Web Speech & Voice Turn-Taking (Q24 – Q28)

### Q24: What is the Web Speech API and what are its two constituent interfaces?
**Answer:** The W3C Web Speech API is an open browser standard that enables speech processing directly in client web applications without external libraries. It consists of:
1. **SpeechRecognition (`webkitSpeechRecognition`):** Translates audio captured by the device microphone into text strings via real-time acoustic recognition.
2. **SpeechSynthesis (`window.speechSynthesis`):** Text-to-Speech (TTS) synthesizer that converts text strings into audible speech using installed OS voice engines.

### Q25: Why did you choose client-side Web Speech over server-side audio streaming (e.g., Whisper API)?
**Answer:** 
1. **Zero Bandwidth & Latency:** Streaming audio chunks (e.g. 16kHz PCM audio) over WebSocket or HTTP upload adds significant network latency (often 500ms–1.5s) and consumes large server bandwidth. Web Speech transcription runs directly in the client.
2. **Privacy:** Microphone audio never leaves the user's computer, satisfying privacy-by-design standards.
3. **Zero Cost:** The Web Speech API is built into modern browsers at zero operational or API cost.

### Q26: Explain how your application solves the "Audio Echo Loop" collision problem.
**Answer:** If speech recognition remains active while the assistant speaks through the computer speakers, the microphone records the assistant's own synthesized speech, creating an acoustic feedback loop.
We prevent this via **Audio Collision Prevention**:
1. When a reply is ready, we set `isSpeaking = true` and immediately call `recognition.abort()`.
2. We invoke `speechSynthesis.speak(utterance)`.
3. We attach an event listener to `utterance.onend`. Only after the audio playback completes do we reset `isSpeaking = false` and safely restart `recognition.start()`.

### Q27: How does the wake-word detection mechanism work?
**Answer:** Because web browsers restrict background acoustic DSP listening for security reasons, Sam initiates listening upon an initial user interaction (clicking the glowing orb or microphone button). Once listening, the recognition engine streams transcripts to a regex scanner matching the word boundary `\b(hey\s+sam|sam)\b/i`. When detected, the wake word is stripped and the trailing command is dispatched to the backend. If no command is appended, Sam answers *"Yes, I'm listening!"*.

### Q28: How does the assistant convey its operational state visually?
**Answer:** The interactive glowing Orb displays 4 distinct visual states through CSS animations and color gradients:
1. `idle`: Calm cyan breathing pulse (`#00F2FE`), indicating ready for wake word.
2. `listening`: Energetic emerald green pulse (`#10B981`), indicating active speech recognition.
3. `thinking`: Rapid violet rotation (`#8B5CF6`), indicating backend inference or Groq generation.
4. `speaking`: Warm amber soundwave pulse (`#F59E0B`), indicating active voice synthesis.

---

## Section 5: Backend, Security & Database (Q29 – Q35)

### Q29: What is FastAPI and why is it preferred over Flask or Django for this project?
**Answer:** FastAPI is a modern, high-performance web framework for Python based on ASGI (Asynchronous Server Gateway Interface), Starlette, and Pydantic. It is preferred because:
- **Asynchronous Concurrency:** Built-in support for `async/await` allows handling concurrent HTTP connections without blocking.
- **Automatic Validation:** Automatic request body deserialization and schema validation via Pydantic.
- **Serverless Readiness:** FastAPI apps run natively as ASGI handlers in Vercel and AWS Lambda with minimal memory footprint.

### Q30: How does the sliding-window rate limiter function?
**Answer:** To prevent denial-of-service and brute-force abuse, `app.py` implements an in-memory sliding-window rate limiter tracking timestamps of client IP requests. When a request arrives, timestamps older than 60 seconds are purged:
$$\text{valid\_requests} = [t \text{ for } t \in \text{history}[ip] \text{ if } \text{now} - t < 60]$$
If the count exceeds 60 requests per minute, the server rejects the request immediately with HTTP 429 Too Many Requests.

### Q31: How is the application secured against URL Redirection and Open Redirect vulnerabilities?
**Answer:** Untrusted user input is never used to construct arbitrary navigation URLs. For the `open_site` skill, the backend checks the requested site name against a strictly maintained immutable dictionary allowlist (`SAFE_SITES`). If a requested website is not on the allowlist, the server safely converts the request into a Google search URL with URL-encoded query parameters.

### Q32: Why is the Groq LLaMA client initialized lazily?
**Answer:** If the Groq client were initialized at module import time (`client = Groq()`), importing `app.py` in test environments or CI pipelines where `GROQ_API_KEY` is not present would raise an immediate fatal initialization exception. Initializing lazily inside `get_groq_client()` allows tests and non-LLM skills (time, open site, search) to run seamlessly without credentials.

### Q33: How does the application handle database isolation and failure recovery?
**Answer:** The PostgreSQL database is completely optional. In `app.py`, the `save_feedback_to_db()` function wraps all database transactions in a `try...except` block with a 2.0-second connection timeout. If `DATABASE_URL` is omitted, the database is unreachable, or a query fails, the function catches the exception, logs a warning, and returns `{"saved": false}` with an HTTP 200 status code—ensuring the assistant never crashes or returns a 500 error to the user.

### Q34: How is conversation history persisted across page refreshes?
**Answer:** The browser stores the conversation log in HTML5 `localStorage` under the key `sam_ai_conversation_history`. The array is bounded to the 20 most recent messages to prevent storage bloat. When the user returns to or refreshes the page, the history is restored into the UI and the last 6–8 turns are passed to `/chat` for multi-turn contextual chat.

### Q35: What would be the next step to convert Sam into a fully productionized, offline enterprise application?
**Answer:**
1. **On-Device Wake Word:** Compile an acoustic wake-word engine (like openWakeWord or Porcupine) to WebAssembly (Wasm) to run fully on-device without continuous Web Speech streaming.
2. **Local Client-Side LLM:** Integrate WebLLM / ONNX Runtime Web with a quantized 1B/3B parameter model (e.g., Llama 3.2 1B or SmolLM2) running directly in the browser via WebGPU, making general chat 100% offline.
3. **Multi-Dialect Acoustics:** Train an acoustic model specifically fine-tuned on regional Indian English accents to further reduce speech transcription error rates.
