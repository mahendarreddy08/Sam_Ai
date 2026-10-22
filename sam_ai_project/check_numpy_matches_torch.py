#!/usr/bin/env python3
"""
Verification Script: NumPy vs PyTorch LSTM Mathematical Equivalence
Verifies that pure NumPy forward pass produces identical probabilities and predictions
to PyTorch within a documented numerical tolerance (atol=1e-4).
"""

import csv
import json
import re
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

PROJECT_DIR = Path(__file__).parent
DATA_PATH = PROJECT_DIR / "data" / "intents.csv"
MODEL_DIR = PROJECT_DIR / "model"
WEIGHTS_PATH = MODEL_DIR / "intent_weights.npz"
VOCAB_PATH = MODEL_DIR / "vocab.json"

TOLERANCE = 1e-4

# ---------------------------------------------------------
# 1. Pure NumPy Activation Functions
# ---------------------------------------------------------
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50.0, 50.0)))

def softmax(x):
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / np.sum(e_x, axis=-1, keepdims=True)

# ---------------------------------------------------------
# 2. Pure NumPy LSTM Forward Pass
# ---------------------------------------------------------
class NumpyLSTMClassifier:
    def __init__(self, weights_path: Path, vocab_path: Path):
        data = np.load(weights_path)
        self.embedding = data["embedding_weight"]      # (V, D)
        self.w_ih = data["lstm_weight_ih"]              # (4H, D)
        self.w_hh = data["lstm_weight_hh"]              # (4H, H)
        self.b_ih = data["lstm_bias_ih"]                # (4H,)
        self.b_hh = data["lstm_bias_hh"]                # (4H,)
        self.w_fc = data["fc_weight"]                  # (C, H)
        self.b_fc = data["fc_bias"]                    # (C,)
        self.intents = list(data["intents"])
        self.max_seq_len = int(data["max_seq_len"])
        self.hidden_dim = int(data["hidden_dim"])

        with open(vocab_path, "r", encoding="utf-8") as f:
            self.vocab = json.load(f)

    def tokenize(self, text: str) -> list[str]:
        text = text.lower()
        text = re.sub(r"[^\w\s]", " ", text)
        return [t.strip() for t in text.split() if t.strip()]

    def encode(self, tokens: list[str]) -> list[int]:
        ids = [self.vocab.get(t, self.vocab.get("<unk>", 1)) for t in tokens[:self.max_seq_len]]
        if len(ids) < self.max_seq_len:
            ids += [self.vocab.get("<pad>", 0)] * (self.max_seq_len - len(ids))
        return ids

    def forward(self, token_ids: list[int]):
        """
        Pure NumPy forward pass matching PyTorch nn.LSTM (single-layer, batch_first).
        PyTorch gate ordering: [i, f, g, o] (input, forget, cell candidate, output).
        """
        H = self.hidden_dim
        h_t = np.zeros(H, dtype=np.float32)
        c_t = np.zeros(H, dtype=np.float32)

        # Loop through sequence
        for token_id in token_ids:
            x_t = self.embedding[token_id]  # (D,)
            gates = np.dot(self.w_ih, x_t) + self.b_ih + np.dot(self.w_hh, h_t) + self.b_hh

            i = sigmoid(gates[0:H])
            f = sigmoid(gates[H:2*H])
            g = np.tanh(gates[2*H:3*H])
            o = sigmoid(gates[3*H:4*H])

            c_t = f * c_t + i * g
            h_t = o * np.tanh(c_t)

        # Fully connected layer
        logits = np.dot(self.w_fc, h_t) + self.b_fc
        probs = softmax(logits)
        pred_idx = int(np.argmax(probs))
        return logits, probs, self.intents[pred_idx], float(probs[pred_idx])

# ---------------------------------------------------------
# 3. Reconstruct PyTorch Model for Comparison
# ---------------------------------------------------------
class TorchLSTMModel(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, num_classes)

    def forward(self, x):
        emb = self.embedding(x)
        out, (h_n, c_n) = self.lstm(emb)
        logits = self.fc(h_n.squeeze(0))
        return logits

def load_torch_model(weights_path: Path, vocab_size: int, embed_dim: int, hidden_dim: int, num_classes: int):
    data = np.load(weights_path)
    model = TorchLSTMModel(vocab_size, embed_dim, hidden_dim, num_classes)
    state = {
        "embedding.weight": torch.from_numpy(data["embedding_weight"]),
        "lstm.weight_ih_l0": torch.from_numpy(data["lstm_weight_ih"]),
        "lstm.weight_hh_l0": torch.from_numpy(data["lstm_weight_hh"]),
        "lstm.bias_ih_l0": torch.from_numpy(data["lstm_bias_ih"]),
        "lstm.bias_hh_l0": torch.from_numpy(data["lstm_bias_hh"]),
        "fc.weight": torch.from_numpy(data["fc_weight"]),
        "fc.bias": torch.from_numpy(data["fc_bias"]),
    }
    model.load_state_dict(state)
    model.eval()
    return model

# ---------------------------------------------------------
# 4. Main Verification Check
# ---------------------------------------------------------
def main():
    print("=" * 65)
    print("Sam AI Voice Assistant — NumPy vs PyTorch Parity Check")
    print("=" * 65)

    if not WEIGHTS_PATH.exists() or not VOCAB_PATH.exists():
        print(f"Error: Model files missing at {WEIGHTS_PATH} or {VOCAB_PATH}")
        print("Please run `python3 intent_model.py` first to generate weights.")
        sys.exit(1)

    numpy_classifier = NumpyLSTMClassifier(WEIGHTS_PATH, VOCAB_PATH)
    vocab = numpy_classifier.vocab
    embed_dim = numpy_classifier.embedding.shape[1]
    hidden_dim = numpy_classifier.hidden_dim
    num_classes = len(numpy_classifier.intents)

    torch_model = load_torch_model(WEIGHTS_PATH, len(vocab), embed_dim, hidden_dim, num_classes)

    # Load test sentences
    test_samples = [
        "what time is it right now",
        "tell me the time please",
        "open youtube",
        "launch github dot com",
        "search for quantum computing",
        "google machine learning tutorial",
        "hello sam how are you doing",
        "what is the philosophical meaning of time",
        "explain gradient descent to a beginner",
        "sam what is the local time",
    ]

    # Also load first 50 lines from intents.csv for broad verification
    if DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader)
            test_samples.extend([row[0].strip() for row in reader if row][:50])

    print(f"Comparing inference across {len(test_samples)} distinct sentences...\n")

    max_logit_diff = 0.0
    max_prob_diff = 0.0
    mismatches = 0

    for idx, text in enumerate(test_samples):
        tokens = numpy_classifier.tokenize(text)
        token_ids = numpy_classifier.encode(tokens)

        # 1. Pure NumPy Inference
        np_logits, np_probs, np_pred, np_conf = numpy_classifier.forward(token_ids)

        # 2. PyTorch Inference
        x_torch = torch.tensor([token_ids], dtype=torch.long)
        with torch.no_grad():
            t_logits = torch_model(x_torch).squeeze(0).numpy()
            t_probs = torch.softmax(torch.from_numpy(t_logits), dim=-1).numpy()
            t_pred_idx = int(np.argmax(t_probs))
            t_pred = numpy_classifier.intents[t_pred_idx]

        logit_diff = float(np.max(np.abs(np_logits - t_logits)))
        prob_diff = float(np.max(np.abs(np_probs - t_probs)))

        max_logit_diff = max(max_logit_diff, logit_diff)
        max_prob_diff = max(max_prob_diff, prob_diff)

        if np_pred != t_pred:
            mismatches += 1
            print(f"MISMATCH on \"{text}\": NumPy={np_pred} vs PyTorch={t_pred}")

        if idx < 4:
            print(f"Sample [{idx+1}]: \"{text}\"")
            print(f"  PyTorch: Intent={t_pred:<9s} | Probs={np.round(t_probs, 4)}")
            print(f"  NumPy:   Intent={np_pred:<9s} | Probs={np.round(np_probs, 4)}")
            print(f"  Max Diff: {prob_diff:.2e}\n")

    print("-" * 65)
    print(f"Verification Results across {len(test_samples)} utterances:")
    print(f"  - Max Absolute Logit Difference:       {max_logit_diff:.2e}")
    print(f"  - Max Absolute Probability Difference: {max_prob_diff:.2e}")
    print(f"  - Tolerated Threshold:                 {TOLERANCE:.2e}")
    print(f"  - Prediction Class Mismatches:         {mismatches}")
    print("-" * 65)

    if max_prob_diff > TOLERANCE or mismatches > 0:
        print("FAILED: NumPy forward pass diverged beyond numerical tolerance.")
        sys.exit(1)
    else:
        print("PASSED: Pure NumPy forward pass is mathematically equivalent to PyTorch.")
        print("=" * 65)

if __name__ == "__main__":
    main()
