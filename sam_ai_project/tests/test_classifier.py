"""
Unit tests for Pure NumPy Intent Classifier
Verifies deterministic preprocessing, shape checks, tokenization,
unknown-word handling, padding, and prediction checks across all 4 intents.
"""

from pathlib import Path
import pytest
import numpy as np
from app import IntentClassifier

PROJECT_DIR = Path(__file__).parent.parent
WEIGHTS_PATH = PROJECT_DIR / "model" / "intent_weights.npz"
VOCAB_PATH = PROJECT_DIR / "model" / "vocab.json"

@pytest.fixture(scope="module")
def classifier():
    clf = IntentClassifier(WEIGHTS_PATH, VOCAB_PATH)
    assert clf.ready, "Classifier failed to load model weights and vocab."
    return clf

def test_classifier_initialization(classifier):
    assert classifier.ready is True
    assert len(classifier.intents) == 4
    assert set(classifier.intents) == {"time", "open_site", "search", "chat"}
    assert len(classifier.vocab) > 100
    assert "<pad>" in classifier.vocab
    assert "<unk>" in classifier.vocab
    assert classifier.vocab["<pad>"] == 0
    assert classifier.vocab["<unk>"] == 1

def test_weight_tensor_shapes(classifier):
    H = classifier.hidden_dim
    D = classifier.embedding.shape[1]
    V = len(classifier.vocab)
    C = len(classifier.intents)

    assert classifier.embedding.shape == (V, D)
    assert classifier.w_ih.shape == (4 * H, D)
    assert classifier.w_hh.shape == (4 * H, H)
    assert classifier.b_ih.shape == (4 * H,)
    assert classifier.b_hh.shape == (4 * H,)
    assert classifier.w_fc.shape == (C, H)
    assert classifier.b_fc.shape == (C,)

def test_tokenization_cleanliness(classifier):
    tokens = classifier.tokenize("Hey Sam! Can you, please, open YouTube???")
    assert tokens == ["hey", "sam", "can", "you", "please", "open", "youtube"]

def test_tokenization_empty_and_special_chars(classifier):
    tokens = classifier.tokenize("   !!! @@@ ###   ")
    assert tokens == []
    encoded = classifier.encode(tokens)
    assert len(encoded) == classifier.max_seq_len
    assert all(idx == 0 for idx in encoded)  # All padding tokens

def test_unknown_words_mapped_to_unk(classifier):
    weird_tokens = ["flabbergasted", "supercalifragilistic"]
    encoded = classifier.encode(weird_tokens)
    assert encoded[0] == classifier.vocab["<unk>"]
    assert encoded[1] == classifier.vocab["<unk>"]
    assert encoded[2] == classifier.vocab["<pad>"]

def test_sequence_length_truncation_and_padding(classifier):
    long_tokens = [f"word{i}" for i in range(50)]
    encoded = classifier.encode(long_tokens)
    assert len(encoded) == classifier.max_seq_len

def test_time_intent_prediction(classifier):
    intent, conf = classifier.predict("what time is it right now")
    assert intent == "time"
    assert 0.0 <= conf <= 1.0
    assert conf > 0.60

def test_open_site_intent_prediction(classifier):
    intent, conf = classifier.predict("open youtube")
    assert intent == "open_site"
    assert 0.0 <= conf <= 1.0
    assert conf > 0.50

def test_search_intent_prediction(classifier):
    intent, conf = classifier.predict("search for quantum computing algorithms")
    assert intent == "search"
    assert 0.0 <= conf <= 1.0
    assert conf > 0.50

def test_chat_intent_prediction(classifier):
    intent, conf = classifier.predict("tell me an interesting story about astronomy")
    assert intent == "chat"
    assert 0.0 <= conf <= 1.0
    assert conf > 0.40

def test_uninitialized_classifier_graceful_fallback():
    # Tests behavior if weights are missing or corrupt
    empty_clf = IntentClassifier(Path("/nonexistent/weights.npz"), Path("/nonexistent/vocab.json"))
    assert empty_clf.ready is False
    intent, conf = empty_clf.predict("test query")
    assert intent == "chat"
    assert conf == 0.0
