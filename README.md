# PROS

**A world of your making.**

Practice a real skill, finish a project you care about, and watch your work restore an illustrated world. PROS is a personal RPG with a daily view for the next thing you want to do.

![A desk overlooking the valley at the Surveyor’s Home](public/art/home.webp)

[Run locally](#run-locally) · [How progress works](#how-progress-works) · [Documentation](#documentation)

[![Verify PROS](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml/badge.svg)](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml)

## How progress works

1. **Choose a project.** Pin an expedition to Today and pick a small next action.
2. **Practice and record your time.** Use the focus timer or log an activity. A sentence such as `guitar 25m yesterday` fills a reviewable draft.
3. **Keep something you finished.** A recording, a working prototype, or a finished book can become a keepsake tied to that result.

One credited minute earns one character XP. Splitting an activity between two skills shares the same effort. Tasks organize the work, and finished outputs help restore regions. Taking a break leaves your progress in place. If you correct a record, PROS recalculates the levels and rewards that depend on it.

## Explore the world

- **Skills and expeditions.** Start with 26 skills, explore 48 more in Discover, or create your own. The 74 catalog paths include practice guidance, starter projects, and 222 suggested milestone outputs.
- **Six regions.** Explore the Observatory, Foundry, Atelier, Training Grounds, Citadel, and Sanctuary. Each region has three restoration stages and chapters unlocked by your recorded work.
- **Focus and reflection.** Resume a countdown or stopwatch, review the time you spent, and keep notes in Journal, Library, and Chronicle.
- **Character and atmosphere.** Preview wardrobe rewards, turn a 3D wayfinder with an illustrated fallback, and choose music, forest and water ambience, or silence.

<img align="right" src="public/art/olive.webp" alt="Olive, a small white Spitz" width="112" />

**Meet Olive.** The little white Spitz offers written suggestions based on your selected project and a factual weekly recap. Her guidance and the activity parser run in the browser.

## Run locally

Use Node.js 22 LTS and pnpm 9, the toolchain used by the repository checks.

```sh
git clone https://github.com/revaan-mishra/pros-app.git
cd pros-app
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by Vite, usually `http://127.0.0.1:5173`. Choose **Explore a sample world** for example progress, or **Begin your journey** to start your own device profile. A fresh checkout runs without Firebase configuration.

For the production build and its service worker, run:

```sh
pnpm build
node scripts/serve.mjs
```

On macOS, you can also double-click **Start PROS.command** after building. The launcher uses `http://127.0.0.1:4173`. Records are tied to the browser and address where you started, so keep using the same address or move your records with an export.

The source is available here. A hosted release is pending. GitHub Actions builds and checks the app on pushes to `main` and pull requests. [Release status](docs/IMPLEMENTATION-CHECKPOINT.md)

## Your records

PROS commits activities, drafts, and other changes to browser storage first. **Settings → Data and recovery** includes backup import and export, conflict review, and up to seven local recovery snapshots. Exports are readable JSON and can contain private journal entries. Keep an external copy somewhere you trust.

Firebase account builds can synchronize records for verified, approved accounts. Use a compatible client and Rules release when configuring a deployment. [Data recovery](docs/DATA-RECOVERY.md) · [Cloud operations](docs/CLOUD-OPERATIONS.md)

## Documentation

| If you want to | Start here |
| --- | --- |
| Set up a world, use Focus, or recover a draft | [Quick start](docs/QUICK-START.md) |
| Understand the game and its design choices | [Experience guide](docs/ENHANCEMENTS.md) · [Manifesto](docs/MANIFESTO.md) |
| Run checks and prepare a hosted release | [Implementation status](docs/IMPLEMENTATION-CHECKPOINT.md) · [Deployment](docs/DEPLOYMENT.md) |
| Review licenses or report a vulnerability | [Art and audio](docs/ART-AND-AUDIO.md) · [Security](SECURITY.md) |

```sh
pnpm test
pnpm check:assets
pnpm check:server
pnpm build
```

## Credits

Created by **Revaan Mishra**. Dedicated to the Canine Council, **Freddie** (in memory), **Olive**, **Coco**, and **Mungru**. [The Canine Council](docs/MANIFESTO.md#the-canine-council)

The software is available under MIT. Third-party art and recordings retain their original licenses. [License](LICENSE) · [Art and audio credits](public/licenses/THIRD-PARTY.txt)
