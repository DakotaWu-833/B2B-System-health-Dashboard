# Local model memory profile

The default profile retains the Qwen 9B Q4_K_M model, 8,192-token chat context,
4,096-token embedding context and 1,200-token output limit. It reduces working
buffers and idle residency without replacing the chat model or disabling hybrid
retrieval or tool calling.

| Setting | Default | Purpose |
| --- | --- | --- |
| `AI_CONTEXT_TOKENS` | `8192` | Existing chat context capacity. |
| `AI_BATCH_SIZE` | `256` | Smaller processing batches for chat and embeddings. |
| `AI_EMBEDDING_CONTEXT_TOKENS` | `4096` | Embedding input capacity; oversized input still fails instead of silently truncating. |
| `AI_KEEP_ALIVE` | `PT1M` | Release the chat runner after one idle minute. |
| `AI_EMBEDDING_KEEP_ALIVE` | `PT15S` | Release an idle embedding runner promptly. |
| `OLLAMA_FLASH_ATTENTION` | `1` | Enable supported memory-efficient attention. |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` | Quantize attention cache, independently of model weight quantization. |
| `OLLAMA_NUM_PARALLEL` | `1` | One active inference slot per model. |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | Load embedding and chat models in turn. |
| `OLLAMA_KEEP_ALIVE` | `60s` | Short residency also applies to requests outside the backend. |
| `OLLAMA_MAX_QUEUE` | `8` | Bound queued inference work. |
| `LLAMA_ARG_CACHE_RAM` | `256` | Limit the Ollama 0.40.3 llama.cpp runner's CPU prompt cache to 256 MiB, rather than its 8,192 MiB default. |

Compose passes these settings through in `docker-compose.advance.yml`. Native
installations must apply `OLLAMA_*` and `LLAMA_ARG_CACHE_RAM` to the **Ollama
server process** and restart it; apply `AI_*` to Spring Boot. Example values are
in `.env.advance.example`. Exporting these variables in a shell does not change
an already running server. Backend runtime settings are visible in the
authenticated `GET /api/assistant/status` response under `runtime`.

## Native verification, 2026-11-02

Measured on an RTX 4080 Laptop GPU (12 GiB), 64 GB system RAM, native Windows,
Ollama 0.40.3. The same embedding input followed by the same short chat request
was used before and after. These are samples of **model-reported residency**
from `/api/ps`, rather than peak whole-system memory or a quality benchmark.

| Measurement | Previous | Optimized |
| --- | --- | --- |
| Model GPU residency after embedding then chat | 7.54 GiB, two models | 5.19 GiB, one model |
| Embedding model GPU residency on its own | 2.21 GiB | 0.97 GiB |
| Chat context | 8,192 tokens | 8,192 tokens |
| Idle release | Previous default: five minutes | Verified empty model list after 60.3 seconds |
| CPU prompt-cache maximum | 8,192 MiB runner default | Verified 256 MiB in runner logs |

The combined resident-model sample decreased by approximately 31%. Windows and
other GPU applications use additional memory. The old dashboard service's
identified orphan embedding runner was also stopped; other applications were
left running. The optimized benchmark was repeated after that cleanup.

Validation: 199 backend checks, including model request options, timeouts,
source permissions, tool calls and H2 schema migration, passed. A live hybrid
RAG request returned a cited answer in 6.98 seconds; normal chat returned a cited
observation-based answer, and a live Agent called `list_alerts` and completed
without proposals or alert changes. Four long Chinese inputs also produced
valid 1,024-dimensional embeddings with the smaller batch setting. The Compose
configuration was updated but was not executed in this native verification.

The prompt cache limit is a maximum, not a claim that the previous configuration
always consumed 8 GiB of physical RAM. Model weights and active inference buffers
still require memory. Switching between embedding and chat, or asking after an
idle unload, adds model loading time. Q8 cache precision can affect answers;
the existing source validation, permission checks and proposal confirmation
remain in effect. Smaller batches trade some prefill throughput for memory.

Redis continues to cache embeddings by model/text for seven days; cached vectors
are checked for valid dimensions and finite values. No source text or embedding
vector dimensions are reduced by this profile.

Verify with `GET /api/ps` and GPU/process measurements after embedding plus chat,
then verify that `models` becomes empty after the keep-alive period. Test a long
embedding input, a cited RAG answer and a read-only tool investigation before
claiming application compatibility. Distinguish model-reported residency from
whole-GPU memory, which also includes Windows and unrelated applications.

References: [Ollama memory and residency controls](https://docs.ollama.com/faq),
[chat options](https://docs.ollama.com/api/chat),
[embedding options](https://docs.ollama.com/api/embed), and the installed
llama.cpp runner's `--help` for `LLAMA_ARG_CACHE_RAM` support.
