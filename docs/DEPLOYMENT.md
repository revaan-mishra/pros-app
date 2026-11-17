# Deploying PROS Online: Hosting & Cloud Synchronization

This guide covers deploying **PROS (Personal RPG Operating System)** online for public web access and activating multi-device cloud synchronization.

---

## 🌐 1. Live Web Hosting (Two Deployment Targets)

### Option A: GitHub Pages (Automated via GitHub Actions)

PROS includes an automated CI/CD workflow (`.github/workflows/deploy.yml`) that verifies all asset checksums, runs unit tests, compiles the Vite PWA, and deploys to GitHub Pages on every push to `main`.

#### Enable GitHub Pages on your repository:
1. Go to your repository settings on GitHub:  
   **[Settings → Pages](https://github.com/revaan-mishra/pros-app/settings/pages)**
2. Under **Build and deployment → Source**, select:  
   **`GitHub Actions`**
3. Once enabled, every push automatically publishes to:  
   **`https://revaan-mishra.github.io/pros-app/`**
4. Anyone on iPhone, Mac, Android, or PC can immediately open the app, play locally, or tap **"Add to Home Screen"** to install the full PWA.

---

### Option B: Firebase Hosting (`pros-rpg.web.app`)

The project is pre-configured with Google Cloud's Firebase project **`pros-rpg`** in `asia-south1 (Mumbai)`. Both `pros-rpg.web.app` and `pros-rpg.firebaseapp.com` are pre-authorized for Firebase Auth.

#### Manual Deployment via Firebase CLI:
```bash
# 1. Install Firebase CLI (if not already installed)
curl -sL firebase.tools | bash

# 2. Authenticate
firebase login

# 3. Deploy Hosting, Security Rules, and Indexes
firebase deploy --only hosting,firestore:rules,firestore:indexes --project pros-rpg
```

---

## ☁️ 2. Multi-Device Cloud Synchronization

PROS is **local-first**: all data lives client-side in `IndexedDB` (Dexie.js). Going online enables an optional, cryptographically validated synchronization bridge so you can play across iPhone and Mac without losing progress.

### Architecture Highlights:
- **Client Account ID:** Authenticated accounts are namespaced as `firebase:<uid>`.
- **Private Data Partition:** `firestore.rules` enforces that `/users/{userId}` is strictly isolated to `request.auth.uid == userId`.
- **Atomic CAS (Compare-And-Swap) Sync:** The client submits a transaction containing the local mutation, expected sequence number, and an immutable command receipt.
- **7 Automated Local Rollback Snapshots:** Accidental deletions or revisions can always be reverted on-device.

---

## 🔑 3. Connecting Production Firebase Credentials

For production builds to connect to the live `pros-rpg` database:

### Setting Repository Secrets (for GitHub Actions):
In your GitHub repository:  
**[Settings → Secrets and variables → Actions](https://github.com/revaan-mishra/pros-app/settings/secrets/actions)**

Add the following Repository Secrets:
- `VITE_FIREBASE_API_KEY`: Your Firebase Web API key
- `VITE_FIREBASE_APP_ID`: Your Firebase Web App ID

---

## 👤 4. First-Time Owner Onboarding Runbook

Once the app is live at `https://revaan-mishra.github.io/pros-app/` or `https://pros-rpg.web.app`:

1. **Sign Up**: Click **"Begin your journey"** on the welcome screen and create an account with your email and password.
2. **Verify Email**: Click the verification link sent to your email inbox.
3. **Grant Beta Access**: The Firestore security rules enforce that only operator-approved UIDs can sync. In your terminal, grant your new account UID:
   ```bash
   node scripts/firebase-admin.mjs grant <YOUR_FIREBASE_UID>
   ```
4. **Connect & Sync**: Return to PROS. Cloud sync turns green (`● Synced`), and your local IndexedDB records automatically synchronize to your private Firestore partition.
5. **Multi-Device**: Log into the same account on your iPhone or secondary device. All restored lands, character XP, and quests will populate seamlessly.
