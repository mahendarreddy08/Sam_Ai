# Machine Learning Evaluation Report: Intent Classification

## 1. Executive Summary
This report documents the design, baseline comparison, training procedure, and pure-NumPy export of the intent classification model for **Sam AI Voice Assistant**. The deployed classifier uses a recurrent Long Short-Term Memory (LSTM) neural network designed to run with **zero PyTorch runtime dependency** during production serverless execution.

---

## 2. Dataset Overview
- **Source:** Synthetic and curated intent dataset (`data/intents.csv`).
- **Total Utterances:** 431 samples across 4 balanced categories.
- **Label Distribution:**
  - `time`: 105 samples
  - `open_site`: 114 samples
  - `search`: 105 samples
  - `chat`: 107 samples
- **Splits:** 70% Train (301 samples), 15% Validation (65 samples), 15% Test (65 samples).
- **Vocabulary:** 406 unique tokens extracted exclusively from the training split.

---

## 3. Five-Model Architecture Comparison

All models were evaluated on the exact same held-out test split (65 unseen samples):

| Model Architecture | Test Accuracy | Macro F1 | Parameter Count | Latency (CPU) |
| :--- | :--- | :--- | :--- | :--- |
| **Majority Class Baseline** | 26.15% | 0.1037 | 1 | 0.001 ms |
| **TF-IDF + Logistic Regression** | 96.92% | 0.9686 | 1620 | 0.209 ms |
| **Simple RNN** | 81.54% | 0.8164 | 34,564 | 0.179 ms |
| **GRU (Gated Recurrent Unit)** | 92.31% | 0.9195 | 51,204 | 0.729 ms |
| **LSTM (Deployed Architecture)** | **89.23%** | **0.8936** | **59,524** | **0.254 ms** |

---

## 4. LSTM Per-Class Performance

| Intent | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- |
| `time` | 0.938 | 0.938 | 0.938 | 16.0 |
| `open_site` | 0.800 | 0.941 | 0.865 | 17.0 |
| `search` | 1.000 | 0.875 | 0.933 | 16.0 |
| `chat` | 0.867 | 0.812 | 0.839 | 16.0 |

---

## 5. Visual Artifacts
- **Confusion Matrix:** Saved to `docs/images/confusion_matrix.png`
- **Training Loss Curve:** Saved to `docs/images/training_loss.png`

---

## 6. Export & Mathematical Verification
The model weights were exported to `model/intent_weights.npz` and vocabulary to `model/vocab.json`. Forward pass mathematical equivalence is verified against PyTorch logits in `check_numpy_matches_torch.py` within an absolute numerical tolerance of `atol=1e-5`.
