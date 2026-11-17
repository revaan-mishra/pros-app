# Free AI for PROS: findings and recommended design

Research checked 17 November 2026. The offline foundation is implemented: smart capture interprets bounded activity sentences into reviewed form fields; Olive offers project next-step guidance and factual weekly reflection. No language model was downloaded, no remote inference request was made, no provider keys were added and no billing was enabled. Model-provider comparison below remains research.

## Recommendation

Use an **offline structured parser and authored planning guidance by default**, then offer a small, explicitly requested AI assistant for a few bounded jobs. For an online owner beta, Cloudflare Workers AI is the best candidate to evaluate first. Keep browser-local inference as an optional Mac experiment, rather than a required iPhone download. Do not send private journals to a free model by default.

The new 74-skill catalog, evidence paths and factual Chronicle already supply useful context. The model should help choose or phrase the next action; the deterministic engine continues to own dates, effort, XP, completion and unlocks. Authored guidance should be labeled as guidance, not presented as AI.

## What can actually be free?

| Option | Useful role | Limits and implications | PROS decision |
| --- | --- | --- | --- |
| Local parser + authored guidance | Fast capture, dates/units/skill matching, next-action defaults and factual recaps | No model quality or server quota dependency; ambiguous text needs review | Build this as the dependable base |
| Cloudflare Workers AI on Workers Free | Short project decomposition, rewriting an unclear action, explaining a practice summary | Currently 10,000 neurons/day across the account; not 10,000 requests. Free-plan requests stop at quota. Some models require paid access | Best online candidate, with an allowlisted small model and hard limits |
| WebLLM / browser-local model | Private wording and small planning jobs on capable hardware | Device compute, initial weight download, memory, battery and browser support matter; compatibility must be tested | Optional, separately downloaded experiment; never a condition for using the app |
| Gemini API unpaid tier | General generation with model-specific free allowances | Unpaid inputs/outputs may be used to improve products and reviewed by people; Google says not to submit sensitive/personal information | Poor default for private PROS records; consider only explicitly nonprivate input |

Cloudflare's current allowance and paid-model exceptions are documented in [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). Its standard inference data policy says customer content is not used for model training, with operational metadata and security/legal exceptions; stateful features can store content. That is a more suitable candidate for a private planner, but it still involves sending selected text to another service. [Cloudflare data policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

Gemini's unpaid-service terms describe product improvement and human review and caution against personal/confidential input. Its [pricing](https://ai.google.dev/gemini-api/docs/pricing) and [terms](https://ai.google.dev/gemini-api/terms) should be rechecked before any integration. Public client code must not contain a shared provider key; Google's own [key guidance](https://ai.google.dev/gemini-api/docs/api-key) requires a production backend proxy.

None of these services promises unlimited free operation forever. Design for a provider being unavailable or its free offering changing, with the offline app remaining fully useful.

## The highest-value AI jobs

1. **Make the next action smaller.** Input: a user-selected project, one objective and a time budget. Output: up to three concrete actions and one observable finish, using existing skills.
2. **Turn an intention into a project draft.** Input: “I want to make a short recording.” Output: an editable outcome, three preparation steps and an effort suggestion. Nothing is created until reviewed.
3. **Explain a pattern, without judging the person.** Input: an explicitly selected seven-day aggregate and the next milestone. Output: a short factual observation and a useful choice. No invented causes, diagnoses or claims of expertise.
4. **Resolve difficult capture text.** Use a model only when the offline parser finds genuine ambiguity. Present candidates and uncertainties; never silently infer duration or completion.

Place these actions beside the work they help: a small “Help shape this project” action in its editor or “Suggest a smaller next step” on its detail. Avoid a new compulsory chatbot tab, automatic daily messages or an AI panel covering Today.

## A smarter parser: more than regex chains

Use a bounded pipeline: normalize Unicode and whitespace → identify action/time/date tokens → resolve skills against catalog and user aliases → resolve project context → validate a typed proposal → show the existing capture sheet with a clear preview.

Regex can recognize units and explicit syntax. Separate intent handling, calendar resolution and matching from those patterns. Longest phrase matches should beat substrings; exact aliases should beat approximate suggestions. A fuzzy match offers choices rather than selecting a skill silently. Keep original text and token spans for explanations.

| Input | Proposed behavior |
| --- | --- |
| `guitar 25m yesterday` | Candidate skill, 1,500 seconds and yesterday in the confirmed profile time zone; show review |
| `30m frontend + German 70/30` | Two skill allocations totaling exactly 100%; conserve credited seconds |
| `read 20 pages` | Page-progress draft; ask for time if effort is to be recorded; create no XP from page counts |
| `didn't meditate today` | Recognize negation; do not propose a completed activity |
| `practice guitar yesterday` | Skill/date candidate, duration missing; ask rather than manufacture minutes |

Also test duplicate units, decimal hours, midnight, DST, changing time zones, names containing numbers, similarly named custom skills, multiple projects, long/malformed input, corrections and repeat submission. A model reply is just another untrusted proposal: apply the same schemas, conservation rules and confirmation process.

## A bounded online implementation

After Firebase account isolation is verified, use a same-origin Cloudflare Pages Function/Worker with a Workers AI binding. Cloudflare documents [Pages AI bindings](https://developers.cloudflare.com/pages/functions/bindings/#workers-ai); this avoids introducing paid Firebase Functions for the inference endpoint. A small instruction model such as the currently listed [Llama 3.2 3B](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/) is an evaluation candidate, not a quality guarantee or a pinned launch choice.

Proposed owner-beta limits: five requests per user/day, one active request, bounded input and a short response. These are app decisions, separate from provider quotas. Validate Firebase identity and allowed beta access server-side; enforce limits there, not only in the browser. Keep the project on the Free plan, never automatically upgrade, and return a useful offline alternative at quota/timeout.

Send only the selected goal and needed summaries. Journals, book notes, full history and unrelated personal details stay excluded unless the user deliberately includes specific text after seeing what will be sent. Avoid body/prompt logging, stateful conversations and unnecessary remote storage.

Validate a response such as `{summary, actions, proposedOutput, uncertainties}` with strict bounds and known skill IDs. The application supplies record IDs/revisions and builds commands only after review. The model has no direct database, XP, equipment, delete or completion capability. Cache approved suggestions per account and context/rules version; corrections invalidate stale suggestions.

## Local inference: possible, with a real device gate

[WebLLM](https://webllm.mlc.ai/docs/) runs models in-browser using WebGPU and supports workers so inference can stay off the UI thread. [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) is another option for local tasks, particularly smaller specialized models. Neither removes model weights, memory or compute requirements.

Apple added WebGPU in [Safari 26](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), which makes experiments more plausible. That does not establish that a particular language model is stable in iPhone Safari and Home Screen mode. Feature-detect the adapter and required features, show the actual download size, allow removal, and test loading, response quality, suspension, low-memory recovery and latency on supported devices. Browser/device checks are currently paused, so no local-model performance or compatibility claim is made here.

## Next concrete experiment

Build the parser proposal format and a small evaluation set first. Compare the same 30–50 realistic capture/planning prompts using the offline base and one free-tier candidate. Score correct skill/date/duration, unsupported assumptions, actionable outputs, privacy payload, response time and quota use. Choose a model only if it improves the specific jobs enough to justify the extra interface and failure modes.

This research does not change the launch gate: complete verified accounts/private sync, preserve offline work and backups, then validate any optional AI separately. The core RPG must not depend on a daily API allowance.


## Implemented interface and companion

Olive is a completely white Indian American Spitz, replacing the owl. Her generated illustration is a breed-inspired interpretation, not an exact photo likeness. Guidance is optional on Today and beside project preparation; it never adds a main navigation tab or blocks work. A short next-step card accepts a project and time budget, offers ordinary Focus or an editable quest draft, and leaves all effort/output confirmation in existing forms. The weekly reflection reads the factual Chronicle aggregate rather than private journal bodies. On-device guidance is clearly identified; no live AI conversation is claimed.

Smart capture uses a recoverable sentence field and three deliberate steps: review interpretation, fill reviewed fields, save through ordinary capture. English units/dates, whole-phrase skill matches, explicit splits, negation, planned work and page counts have targeted automated coverage. Fuzzy matches stay suggestions; missing time never becomes inferred effort. Raw sentence drafts are device-local and can be included in user-exported backups. Corrections, reading capture and recovered timed sessions retain their existing context.

Apple’s current guidance emphasizes clear AI disclosure, local control, refinement and useful fallback behavior. Those principles informed the contextual cards, editable previews and explicit review; this is design interpretation, not platform certification. [Apple Generative AI guidelines](https://developer.apple.com/design/human-interface-guidelines/generative-ai). Google’s PAIR patterns also describe using transparent heuristics when predictability matters and explaining the user benefit clearly. [People + AI patterns](https://pair.withgoogle.com/guidebook-v2/patterns).

The remote planner is not connected. Adding it still requires server-side Firebase identity validation, hard free-tier request limits, selected-text preview/consent and a model evaluation set. The UI has no inert “Generate” button or exposed shared key.
