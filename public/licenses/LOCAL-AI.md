# Optional local AI materials

PROS bundles the Apache-2.0-licensed @mlc-ai/web-llm0.2.89 JavaScript runtime in a separately downloaded worker. Its original license is retained in webllm-LICENSE.txt. The runtime source is https://github.com/mlc-ai/web-llm.

The optional SmolLM2-360M-Instruct model is published by HuggingFaceTB under Apache 2.0: https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct. PROS uses MLC-compiled q4f16/q4f32 variants; exact repository revisions and size metadata are recorded in local-ai-models.json. GPU memory and download values are estimates, not device compatibility guarantees.

Model weights are downloaded only on request from Hugging Face; compiled runtime libraries may be downloaded from MLC AI’s GitHub repository. Model requests contain distribution paths, not project prompts. Once prepared, inference is on the device. Model caches are shared by profiles in this browser and are independent of the account record database.

No model weights were downloaded and no actual model generation was exercised during automated source validation. Browser/GPU/offline model checks remain required.
