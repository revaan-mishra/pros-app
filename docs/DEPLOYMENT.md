# Build and host PROS

The invitation-only beta is live on Firebase Hosting. The repository’s Verify PROS workflow checks the locked dependencies, assets, unit tests, local server, and production build. [Open PROS](https://pros-rpg.web.app/) · [Verify PROS workflow](../.github/workflows/verify.yml)

## Verify on your machine

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check:assets
pnpm check:server
pnpm build
node scripts/serve.mjs
```

The build output lives in `dist/`. The local server binds to `127.0.0.1:4173`. Its service worker requires a production build and a successful initial load. Use the sample world for a review that doesn't involve personal records. [Quick start](QUICK-START.md)

## Hosting requirements

- Serve the production build over HTTPS at a stable origin. Use a root deployment with an SPA fallback to `index.html` for application routes.
- Confirm that the manifest, service worker, art, audio, and direct links resolve from the actual site address. `VITE_BASE_PATH` changes Vite's bundle paths, while some application assets and routes still use root-relative paths.
- Check the response headers on the chosen host. For an account build, the content security policy must permit the Firebase Auth, token refresh, and Firestore endpoints used by the app. Configure the host's headers directly if it does not read `public/_headers`.
- Run the [release checklist](RELEASE-CHECKLIST.md) on the address that users will open. If moving from a device profile, export a backup before changing the origin.

### GitHub Pages

Pages is disabled for this repository. A repository project site such as `/<repository>/` needs its route base, asset references, offline scope, and deep-link behavior checked together before enabling publishing. The current workflow verifies builds and has no Pages deployment job. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

### Root hosting

`firebase.json` includes a Firebase Hosting configuration for `dist/` and SPA routes. A compatible static host can also serve the built app with the same behavior. Use the project and origin selected for the release. Check the chosen host against the requirements above.

## Account builds

Use a Firebase project with email/password sign-in and matching Firestore Rules. Copy the web app configuration into an ignored environment file. See [.env.example](../.env.example) for the four `VITE_FIREBASE_*` variables. Set `VITE_REQUIRE_CLOUD=true` for an account-only build. Use a demo emulator project for the integration suites.

The configuration variables are embedded in the browser build. Keep administrative credentials and service-account keys outside the client. Authorize the final domain for account flows, then enable access for verified beta UIDs. Only configure the production project with a client and Rules revision that were tested together. [Cloud operations](CLOUD-OPERATIONS.md)

Check sign-up, verification, password recovery, offline work, synchronization, export, and deletion before releasing an account build. Remove test credentials and any private records from screenshots or build artifacts.
