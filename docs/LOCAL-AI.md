# Olive: optional local AI and dependable capture

Implemented 18 November 2026. Olive’s written guidance and activity parser remain available without a model. Compatible browsers can additionally prepare a real on-device SmolLM2 language model through WebLLM. No paid inference service, provider key, subscription or server endpoint is used.

## Use it

1. Open Today → **Take a moment**, or a project → **Find a smaller step with Olive**.
2. Select an active project, choose5/15/30/60minutes, then expand **Try local AI**.
3. Review the selected context and download information. Choose **Download and prepare local AI**. Nothing downloads just from opening the ordinary guide.
4. Wait for preparation, then choose **Suggest a next step**. The result is labeled as AI and may be imperfect.
5. **Edit as a quest draft** opens the existing recoverable editor with both the action and stopping-point note. Review/edit/save normally. No AI suggestion can complete work or award XP.

**Open activity interpretation** opens the ordinary capture sheet with its sentence parser visible. It works when AI is unavailable, stopped, timed out, or returns invalid output. Ordinary Log activity also offers **Describe it in one line**. Interpretation reviews skill/time/date fields; missing minutes are not invented, planned/negated work is not recorded, and page counts earn no XP.

## Download, hardware and removal

Pinned runtime: **@mlc-ai/web-llm0.2.89**, Apache 2.0. Optional model: **SmolLM2-360M-Instruct**, Apache 2.0. The shader-f16 variant is chosen when available; otherwise the f32 variant is used. Both repository revisions are pinned in `src/assistance/local-ai-models.ts` and public license metadata.

Model repositories contain about 207 MB of files. Allow about 220 MB for the download, including the runtime, plus browser overhead. Estimated graphics memory is 376 MB for the compact model or 580 MB for the compatible model. Preparation checks the WebGPU adapter and buffer limits used by the model worker before downloading.

Model/runtime requests contact Hugging Face and MLC AI’s GitHub distribution. Downloads are deliberate. The optional worker/panel are excluded from essential PWA precaching and cached on use. Model caches are shared by profiles in this browser, separate from account records. Cached files can be reused while retained; browser storage cleanup/eviction can require another download. Actual offline model reload remains unverified.

An interrupted download retries once while the browser is online. Completed files can be reused. If a saved file could not be read, choose **Remove model files**, then prepare the model again. The reset targets the two PROS model copies and can clear a damaged index without reading it.

**Stop** cancels outstanding work. **Unload** releases the active worker. Closing the guide, switching accounts or hiding the tab releases the worker and keeps saved model files available for the next visit. Requests have deadlines so the controls recover if the worker stops responding.

## Privacy and authority

The prompt contains only bounded selected project title, skill name, next action, output criterion and time budget. Journal bodies, account details and full history are excluded. Internal IDs/revisions bind results to the correct context but are not sent to the model. No prompt is sent to an inference server or logged by PROS. Authenticated game records still synchronize separately through Firebase according to the privacy notice.

Output must match the bounded `{action, finish}` schema. It is rendered as plain text and handed to the ordinary quest editor only after explicit choice. It has no database access, record ID authority, XP capability, equipment permission or delete/complete action. Late results cannot cross accounts or revised projects. Each request resets model conversation context.

## Verification and limits

Targeted automated checks cover explicit loading, unsupported-device fallback, cancellation/removal, deadlines, resource release, StrictMode cleanup/reactivation, bounded prompts/output, stale account/context results and absence of eager model requests. They use controlled workers/drivers; they are not model-quality or GPU-inference tests.

The live sample world loaded the compact model and generated a real suggestion in WebKit on a Mac. Interrupting a model request reproduced the original load error. The recovery checks cover an interrupted download and a corrupt model index in isolated browser storage. Physical iPhone inference, offline model reload, and coaching quality across varied projects remain open.

Sources: [WebLLM getting started](https://webllm.mlc.ai/docs/user/get_started.html), [WebLLM source](https://github.com/mlc-ai/web-llm), [original SmolLM2 model and license](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct). Public attribution is in `public/licenses/local-ai-models.json`, `LOCAL-AI.md` and `webllm-LICENSE.txt`.
