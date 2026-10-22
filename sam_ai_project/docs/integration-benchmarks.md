# System Integration and Latency Benchmarks Report

## 1. Test Environment & Hardware Specification
- **System Platform:** `Linux 4.19.0-gvisor (x86_64), Python 3.11.2`
- **CPU Inference Architecture:** Pure-NumPy single-layer LSTM (Hidden: 64, Embed: 64, Seq: 20)
- **Runtime Dependency:** Zero PyTorch runtime dependency for production inference.
- **Timestamp:** 2026-10-18 16:34:11 UTC

---

## 2. Statistical Inference Latency (1,000 Iterations)

Measured across 1,000 real forward-pass executions using high-resolution hardware timers (`time.perf_counter`):

| Metric | Measured Value | Standard Target | Status |
| :--- | :--- | :--- | :--- |
| **Mean Latency** | **0.464 ms** | < 10.0 ms | **PASS** |
| **Median (p50)** | **0.427 ms** | < 5.0 ms | **PASS** |
| **95th Percentile (p95)** | **0.630 ms** | < 10.0 ms | **PASS** |
| **99th Percentile (p99)** | **1.038 ms** | < 15.0 ms | **PASS** |
| **Minimum Latency** | 0.383 ms | - | - |
| **Maximum Latency** | 1.839 ms | - | - |
| **Standard Deviation** | ± 0.127 ms | - | - |

---

## 3. End-to-End System Scenarios Ledger

All 10 integration scenarios were executed and validated against their expected API contracts and response structures:

| Scenario | Input Utterance | Expected Intent | API Round-Trip Time | Result |
| :--- | :--- | :--- | :--- | :--- |
| Wake word + Time Intent | `Hey Sam, what time is it?` | `time` | 24.96 ms | **PASS** |
| Direct Time Query | `tell me the time please` | `time` | 7.85 ms | **PASS** |
| Open Allowlisted Site | `open youtube` | `open_site` | 7.06 ms | **PASS** |
| Unknown Site Safe Fallback | `open randomunverifieddomain99` | `search` | 8.00 ms | **PASS** |
| Google Search Routing | `search for black hole astrophysics` | `search` | 7.42 ms | **PASS** |
| Offline Chat Fallback | `tell me a story about a robot` | `chat` | 11.64 ms | **PASS** |
| Mocked Groq LLaMA Generation | `tell me a funny joke` | `chat` | 8.33 ms | **PASS** |
| Max History Bound (10 items) | `what time is it (with 10 turns)` | `time` | 7.15 ms | **PASS** |
| System Health Check | `GET /health` | `N/A` | 7.27 ms | **PASS** |
| Feedback Endpoint Isolation | `POST /feedback` | `N/A` | 4.76 ms | **PASS** |

---

## 4. Key Engineering Insights
1. **Sub-Millisecond Inference:** Pure-NumPy LSTM inference averages `0.464 ms` on CPU, providing virtually instantaneous response generation.
2. **Deterministic Safety:** Unknown and untrusted site requests safely convert to Google search URLs, strictly preventing URL-injection attacks.
3. **Resilient Fallback:** When external AI credentials are unconfigured or unavailable, the assistant falls back to polite spoken plain text without throwing 500 status errors.
4. **Isolated Storage:** Feedback submission executes asynchronously and gracefully defaults to `saved: false` if no PostgreSQL instance is attached.
