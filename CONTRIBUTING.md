# Contributing to PROS

Thank you for your interest in contributing to **PROS**! We welcome bug fixes, documentation improvements, UI enhancements, and feature contributions.

---

## 🧭 Core Principles

Before proposing architectural or gameplay changes, please keep our core tenets in mind:

1. **Effort Into XP**: Progress derives strictly from measured effort and completed outputs ($1\text{ minute} = 1\text{ XP}$). Checkboxes, page counts, and suggestions do not fabricate artificial effort.
2. **Zero Punitive Mechanics**: Absence or missed days never penalize the character, decay skills, or break arbitrary streaks.
3. **Local-First & Offline-First**: Local browser storage (`IndexedDB` via Dexie) is canonical. The app works fully offline without requiring cloud accounts. Cloud sync serves as an optional backup/multi-device bridge.
4. **Accessible & Responsive**: High-contrast, keyboard-navigable, screen-reader friendly, and iPhone/mobile-first responsive design.
5. **No Invasive Telemetry**: User data remains private to the user's device. No third-party ad networks or trackers.

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js**: v20.x or v22.x
- **pnpm**: v9.x or later (recommended)

### Installation

Clone the repository and install dependencies using the frozen lockfile:

```bash
git clone https://github.com/revaan-mishra/pros-app.git
cd pros-app
pnpm install --frozen-lockfile
```

### Running Locally

To start the Vite development server:

```bash
pnpm dev
```

Visit `http://127.0.0.1:5173` (or the port displayed in your terminal).

To test the production build locally:

```bash
pnpm build
pnpm preview
# Or use the Mac launcher script:
node scripts/serve.mjs
```

---

## 🧪 Testing and Verification

Before submitting any Pull Request, ensure that all automated checks pass:

```bash
# Type check & build
pnpm build

# Unit and integration tests
pnpm test

# Verify all media and CC0 assets integrity
pnpm check:assets

# Local server range check
pnpm check:server
```

---

## 🎨 Asset Licensing Guidelines

All assets included in the repository must adhere to strict licensing:
- **Artworks**: Kenney cartography assets are CC0 1.0. Original regional artworks are tracked under `public/licenses/original-artwork.json`.
- **Audio**: Ambient scores and soundscapes are licensed CC0 or authored for PROS (see [ART-AND-AUDIO.md](docs/ART-AND-AUDIO.md)).
- If you contribute new art or audio, ensure you include valid license metadata in `public/licenses/asset-manifest.json` and run `pnpm check:assets`.

---

## 🚀 Pull Request Process

1. Fork the repository and create your feature branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Commit your changes with clear, descriptive commit messages.
3. Ensure all tests and asset verification checks pass.
4. Open a Pull Request on GitHub against the `main` branch.
5. Provide a summary of changes, motivation, and any relevant screenshots or testing evidence.

---

## 📜 Code of Conduct

Please be respectful, constructive, and collaborative in all interactions across issues, discussions, and pull requests.
