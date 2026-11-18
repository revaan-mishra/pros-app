<h1 align="center">PROS</h1>

<p align="center"><strong>Personal RPG Operating System</strong></p>
<p align="center">A world for the work you come back to.</p>

<p align="center">
  <a href="#run-locally">Run locally</a> ·
  <a href="#your-first-session">Try the sample</a> ·
  <a href="#the-canine-council">Meet the Council</a>
</p>

![An open atlas of the six regions, with a brass compass and a worn guitar pick on the Surveyor's desk](docs/assets/field-guide/surveyors-atlas.webp)

A shuttered studio sits by the river. There’s a cold forge in the hills and a telescope waiting for a lens. Pick something you want to practice, log the time you spend, and finish a piece of work. Bit by bit, the valley changes.

## The Atelier turns on its lights

Say you’ve put **35 minutes** into that guitar part. You practice for **25 more**, then add a finished recording as an output. The Atelier has the **60 minutes and one finished result** it needs to open its practice room.

![Animated illustration of Atelier practice time rising from 35 to 60 minutes. The room lights up after a finished recording brings the result count to one.](docs/assets/field-guide/atelier-first-light.gif)

One credited minute earns one character XP. Finish a result and it can leave a keepsake in the room. Take a week off and the room will be there when you return. [Still image](docs/assets/field-guide/atelier-still.webp)

## A desk to come back to

Pin one project to Today and start with the next action. Run a focus session or type `guitar 25m yesterday` to fill an activity draft you can review. Later, the Chronicle shows what your time went into.

<picture>
  <source media="(max-width: 640px)" srcset="docs/assets/field-guide/today-mobile.jpg">
  <img src="docs/assets/field-guide/today-sample.jpg" alt="The real PROS Today screen in the sample world, with the guitar expedition pinned below the Surveyor's Home">
</picture>

*Today in the sample world. Choose **Explore a sample world** to try it with example progress. Anything you log there stays in the sample.*

## Your first session

1. **Open the expedition.** In the sample world, select **A twelve-bar moment** on Today. The project takes you through preparation, guitar practice, and what counts as a finished recording.
2. **Record some practice.** Back on Today, choose **Log activity** and enter ten minutes of guitar. Check the XP preview, then choose **Record activity**. For live practice, **Start focus** opens the timer. End the session and review the time before recording it.
3. **Visit the Atelier.** Open it in **World** to see the practice time and finished results still needed. **Preview transformations** lets you look ahead from the waiting room to the open terrace.
4. **Look on the shelf.** Open **Collection** on Today and select *A first twelve-bar study*. Choose a numbered spot and use **Display in slot** to put the study there.

When you’re ready, choose **Create your world** in the sample banner, then **Begin your journey**. Give a small project a finish you’ll recognize, like “Record the verse in one take.” Use **Pin at home** on the project to keep its next action on Today. When the required steps and practice are done, **Confirm finished output** completes the project and creates its keepsake.

At the end of a focus session, **Where will you pick up next?** gives you a place to leave “Start at bar nine.” That note can become your next action on Today.

<details>
<summary><strong>Find the right screen</strong></summary>

On a phone, open the navigation menu for Chronicle, Library, Journal, and Settings.

- **Quests** holds one-off actions, routines, and projects. Open a project to see its required steps and the practice linked to it.
- **Skills** shows your next milestone. Browse **Discover** for a new path or create a skill that fits the work you already do.
- **Library** keeps books, pages, and reading sessions. Log a reading session to credit the time, then mark the book finished when you have a result to keep.
- **Chronicle** brings practice and finished results together. **Journal** is where you can write down what you learned and link it to the work.
- **Olive**, on Today, can suggest a smaller step for a project or recap the week from your records. Her written guidance and the activity sentence field run on your device.

</details>

## From practice to restoration

Each region grows through both practice and finished results. Split a 30-minute session 70/30 between two skills and they receive 21 and 9 minutes of practice, which count toward their regions. Your character earns 30 XP in total. A checkbox tracks the step’s completion. Log an activity to credit the time spent on it.

| Stage | Regional practice to date | Distinct results |
| --- | ---: | --- |
| 1 | 60 min | 1 output |
| 2 | 240 min | 2 outputs |
| 3 | 720 min | 3 outputs, including a completed project’s result |

If you entered the wrong time or skill, open the activity from **Chronicle** or **History** to review a correction. The same records determine your levels, current restoration stage, and wardrobe eligibility, so a correction can change all three.

<details>
<summary><strong>Unfold the atlas</strong></summary>

| Region | What opens it up |
| --- | --- |
| **Observatory** | Learn a language, work through a book, or make sense of a question. |
| **Foundry** | Build a tool, fix something, or get a prototype working. |
| **Atelier** | Keep a take, a sketch, or a piece of writing. |
| **Training Grounds** | Develop a movement practice and record what you can do. |
| **Citadel** | Practice a conversation, plan a project, or work through a decision. |
| **Sanctuary** | Make time for focus, reflection, or a change in routine. |

Each region has three restoration stages. **Skills** has 26 starter paths and 48 more to discover, plus custom skills. **Character** holds the regional wardrobe and a small 3D wayfinder you can turn over. [Experience guide](docs/ENHANCEMENTS.md)

</details>

Sound starts off. Use **Settings → Preferences → Open listening room** to preview music, nature sounds, and cues, then save the mix you like. Try [*Homestead* by troubadour](public/audio/homestead.mp3), one of the app’s CC0 tracks. [Art and audio credits](public/licenses/THIRD-PARTY.txt)

## The Canine Council

![Freddie, Olive, Coco, and Mungru on a green cushion, with a small gold star above Freddie](docs/assets/field-guide/canine-council.webp)

<p align="center"><strong>Freddie ✦ · Olive · Coco · Mungru</strong></p>

The gold star is for Freddie, forever first chair. Olive is the little white Spitz who guides you in PROS. Coco handles playtime, and Mungru reserves the good napping spots.

<p align="center">
  <strong><a href="https://github.com/revaan-mishra">Revaan Mishra</a></strong><br>
  <em>Built at the desk. Supervised from the cushion.</em>
</p>

[Design notes](docs/MANIFESTO.md)

## Run locally

Use **Node.js 22 LTS** and **pnpm 9**.

```sh
git clone https://github.com/revaan-mishra/pros-app.git
cd pros-app
pnpm install --frozen-lockfile
pnpm dev
```

Open the address Vite prints. Choose **Explore a sample world** for a quick look or **Begin your journey** for a fresh device profile. A local build can run without a Firebase project.

For the production build, run `pnpm build` and then `node scripts/serve.mjs`. On macOS, **Start PROS.command** starts the built app at `http://127.0.0.1:4173`. Reopen it in the same browser and at the same address to return to your device profile. [Quick start](docs/QUICK-START.md)

### Back up your world

PROS saves to your browser as you work. From **Settings → Data and recovery → Export backup**, save a JSON copy of your records, pending changes, and drafts somewhere you trust. It can contain private notes. On another device or browser, **Import backup** lets you review that copy before restoring it. [Data recovery guide](docs/DATA-RECOVERY.md)

<details>
<summary><strong>Build notes and release status</strong></summary>

Configured Firebase builds can synchronize records for verified accounts with approved access. The hosted release is pending. [Deployment](docs/DEPLOYMENT.md) · [Current repository status](docs/IMPLEMENTATION-CHECKPOINT.md)

Start with the [progression engine](src/domain.ts) for XP and restoration rules, [experience screens](src/experience/) for the player flows, and [local storage](src/storage.ts) for saving and recovery.

```sh
pnpm test
pnpm check:assets
pnpm check:server
pnpm build
```

[![Verify PROS](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml/badge.svg)](https://github.com/revaan-mishra/pros-app/actions/workflows/verify.yml)

</details>

[MIT License](LICENSE) · [Art and audio](docs/ART-AND-AUDIO.md) · [Security](SECURITY.md) · [Making the field guide](docs/SHOWCASE.md)
