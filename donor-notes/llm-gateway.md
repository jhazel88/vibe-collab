# LLM Gateway — Donor Notes

**Source:** `EHDSTracker_ChatGPT_Codex/api/lib/llm-gateway.js` (326 lines)
**Target:** `api/lib/llm-gateway.js`

## What was lifted
Vendor-neutral LLM abstraction supporting Anthropic Claude and OpenAI. Includes task-to-model-tier routing, in-memory rate limiting per provider, exponential backoff retries, and mock fallback when no API keys are configured.

## What was changed
- **TASK_MODEL_MAP**: Removed EHDS-specific tasks (`change_type_detection`, `drift_audit`, `map_spec_generation`, `rule_extraction`, `summary_generation`, `reform_scoring`). Added HTA domain tasks: `intent_classification`, `entity_extraction`, `trial_extraction`, `hta_report_parsing`, `pathway_comparison`, `sponsor_analysis`, `market_access_analysis`.
- **Model versions**: Updated to current models (`claude-haiku-3-5-20241022`, `claude-sonnet-4-20250514`).

## What was NOT changed
RateLimiter class, withRetry logic, callAnthropic/callOpenAI/callMock adapters, getActiveProvider routing, public `call()` and `status()` API — all identical to donor.
