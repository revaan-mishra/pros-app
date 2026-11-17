# Artwork and audio

## Overhaul artwork — 16 November 2026

The first experience slice adds three original paintings using the built-in ImageGen tool: `public/art/home.webp`, `public/art/atelier.webp`, and `public/art/atelier-flourish.webp`. The last is a targeted edit of the same Atelier composition, opening the terrace and shutters. All reference the existing arrival painting's world and materials.

The files total 703,362 bytes. Full production prompts, focal points, dimensions, responsive/fallback notes and hashes are retained in [the original artwork manifest](../public/licenses/original-artwork.json). PNG masters and the prompt set are preserved under `work/art-masters/` in the project. The app uses local optimized WebP files. Scene controls and records remain HTML; artwork failure does not prevent work.

Stages 0–2 add light and output-derived exhibition foregrounds; Stage 3 uses the restored painting. The painting and foregrounds share an SVG coordinate system for responsive alignment. Four original vector keepsakes represent a volume, folio, mechanism and seal. Marin's original vector vignette accompanies authored Atelier guidance.

Existing licensed music is reused in this slice. The broader mixer and additional soundtrack selection remain Phase 4 work.

PROS combines original scenes and modular vector artwork with selected free online resources. Assets are bundled locally; ordinary app use does not request images, fonts, audio, or samples from third-party servers. The listening room and Help include credits.

## Downloaded music

Three unmodified MP3 recordings from [Fantasy Song Pack Volume 1](https://opengameart.org/content/fantasy-song-pack-volume-1), created and uploaded by **troubadour**:

| File | Track | Use |
| --- | --- | --- |
| `public/audio/homestead.mp3` | Homestead | A warm everyday score |
| `public/audio/wandering-woodlands.mp3` | Wandering Woodlands | Exploring and reflective work |
| `public/audio/fairy-lights.mp3` | Fairy Lights | A quieter sense of wonder |

The creator's source page lists **CC0 1.0 Universal**, checked 13 November 2026. Full source notes are retained in `public/licenses/THIRD-PARTY.txt`; downloaded file hashes and sizes are in `public/licenses/asset-manifest.json`.

Music defaults off. A recording is selected silently; only Play starts audio. Each recording can be deliberately saved or removed separately; all three music files total about 11 MB. Their media cache and local server support byte ranges. App/artwork offline preparation is separate from optional music downloads. Browser storage can still be cleared or evicted.

## Downloaded cartography artwork

Selected files from [Kenney's Cartography Pack](https://kenney.nl/assets/cartography-pack), downloaded from [Kenney's creator-uploaded OpenGameArt page](https://opengameart.org/content/cartography-pack):

- Two seamless paper textures: `parchmentBasic.png` and `parchmentAncient.png`.
- Seven miniature illustrations: campfire, castle, chest, compass, tower, pine trees, and water wheel.

All reside in `public/art/kenney/`. The pack is **CC0**. Its original included license is retained verbatim at `public/licenses/kenney-cartography.txt`. The image files are unchanged; CSS handles their display size and tint. They appear in the listening room, journal surfaces, project invitation, guided-tour invitation, and milestone receipt.

## Generated illustrations

OpenAI's built-in image generation tool produced the original painterly landscapes below. Optimized WebP copies are saved in the app; their PNG masters remain in the originating generation output.

| Asset | Use | Direction |
| --- | --- | --- |
| `public/art/arrival.webp` | Opening and introduction | A traveler with a compass, a river valley, workshop lights, hilltop observatory, and tree sanctuary. Slate blue, moss, and lantern gold. Generated 12 November 2026. |
| `public/art/sanctuary.webp` | Focus | A lantern-lit study overlooking a mountain valley, with a stone arch, desk, open book, and reflecting pool. Generated 12 November 2026. |
| `public/art/archive.webp` | Library | A field journal and pressed fern in an archival reading room, with a distant observatory and warm desk lamp. Generated 13 November 2026. |

The first two descriptions summarize their earlier briefs. The full prompt for the new Archive asset was:

> Use case: illustration-story. Asset type: a wide decorative illustrated header for PROS, a personal RPG app's Library and Journal. Create an original, richly considered painterly fantasy archival reading room, intimate and believable: curved slate stone arch, dark timber shelves, a single open handwritten field journal and pressed fern on a warm desk, brass reading lamp, distant moss-covered observatory visible through a narrow window. Quiet blue-green dusk outside and small warm amber lamplight inside, slate blue, moss and parchment palette. Composition: landscape 3:2 with the visual story centered and toward the right, clear darker left third for interface text added separately; no lettering in the image. Subtle hand-painted grain, precise objects, atmospheric depth, editorial fantasy game art rather than generic glossy concept art. No people, no human faces, no text, no logos, no UI, no watermark, no exaggerated glowing magic.

## Experience overhaul paintings — Phases 1–3

The built-in `image_gen` tool generated these eight project assets. Their exact prompts, dimensions, focal points, master paths, fallbacks, sizes and SHA-256 hashes are retained in [original-artwork.json](../public/licenses/original-artwork.json). Final WebP files live in `public/art/`; copied PNG masters remain in `work/art-masters/`. No paid image API or new runtime image dependency was introduced.

| Project asset | Use and restoration direction |
| --- | --- |
| `public/art/home.webp` | Living Today, overlooking the valley |
| `public/art/atelier.webp` | Initial/practice/exhibition room with shared original foreground layers |
| `public/art/atelier-flourish.webp` | Open terrace, preserved room geometry and clear display frames |
| `public/art/observatory.webp` | Empty plinth → aligned telescope → chart room → constellation atlas |
| `public/art/foundry.webp` | Cold hearth → working flame → bench instruments → central mechanism |
| `public/art/training.webp` | Grown-in route → standing markers → pavilion equipment → complete circuit |
| `public/art/citadel.webp` | Closed gate → reopened hall → council map/correspondence → exchange displays |
| `public/art/sanctuary-base.webp` | Dry basin → reflection bench → returning plants; the earlier `sanctuary.webp` is reused for the flourishing water garden |

The five new Phase 3 paintings were generated separately from coordinated briefs and optimized to WebP (quality 86, unchanged pixel dimensions), totaling approximately 1.6 MiB. They keep slate, timber, brass, moss and restrained inhabited light. Their stage differences use authored code-native instruments and objects, not extra progress records. All scenes share a painting/foreground coordinate system and expose requirements/actions in ordinary HTML. Appearance previews cannot grant actual evidence or unlocks. Essential paintings join the app precache; optional music does not.

Six static resident portraits and distinct regional wardrobe silhouettes/accessories extend the original vector system. Their authored dialogue and 24 arrival/restoration chapters use no AI service. Browser cropping, visual balance, animation, missing-media behavior and physical-device performance still need hands-on verification when manual testing resumes.

## Original vector artwork and synthesis

- `src/components/WorldArt.tsx`: island, six landmarks, restoration layers, stage-gated relics, and sky palettes.
- `src/components/Avatar.tsx`: modular character, starter styles, regional equipment, optional aura and miniature familiar.
- `src/experience/RegionScene.tsx`: regional painting composition and three original restoration foregrounds per place, alongside the existing Atelier composition in `Scenes.tsx`.
- `src/experience/RegionalResident.tsx`: six original regional caretaker vignettes.
- `src/components/Companion.tsx`: original Scribe Orel illustration and authored regional field notes. It uses no AI service.
- `public/favicon.svg`: compass/tree mark, with local PNG installation icons.
- `src/soundtrack.ts`: A Place to Begin, an original procedural score with six regional chord palettes, plus brief synthesized feedback cues. No recorded samples are used in this synthesized option.

Decorative motion follows the device/app setting. Sound effects respect Quiet sounds and are dispatched after successful local writes. Selecting a region never starts music. Audio failure never becomes a data-save failure.

## Current atmosphere and Olive

The listening room keeps optional recordings separate from essential offline artwork. Music, nature, interface and milestone channels have independent controls, with Silent, Quiet focus and World presets. A selection is silent until Play; choices save through the account profile. Each recording has its own download, progress, retry and removal. A full-size integrity check prevents truncated files being labeled ready offline.

Two unchanged SpritePilot CC0 WAV recordings extend the three music tracks: `public/audio/ambience/forest.wav` and `water.wav` (source name `river.wav`). Each is 1,267,244 bytes, 48 kHz mono PCM, 13.2 seconds. Primary creator page: https://spritepilot.com/free-game-assets/sound-effects/ambient. URLs/hashes/licenses are in the source manifest. Listening, perceived loudness and loop seams have not been manually checked; do not promise seamless mastered audio.

Olive replaces the owl in Today, guidance and the optional avatar companion. The built-in ImageGen tool generated a small Spitz illustration, then edited its coat to completely white at the user’s request. A breed-inspired interpretation is used because no reference photo was supplied. The transparent PNG master is `work/art-masters/olive.png`; the shipped 528×560 WebP is about 40 kB. Exact prompts and the editing brief are retained in `public/licenses/olive-artwork-brief.json`; hash/use/fallback metadata are in `original-artwork.json`.

Character’s optional wayfinder is original geometric art rendered by native WebGL, with an SVG fallback. It loads no external mesh or graphics dependency. Viewing it does not grant or imply a reward. The renderer is closed/hidden/idle aware, capped in pixel density, and offers buttons, keyboard, touch and reduced-motion handling. GPU appearance and device behavior remain unverified.
