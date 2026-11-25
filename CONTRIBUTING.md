# Contribute to PROS

You can help by reporting a confusing step, improving a guide, testing a phone layout, or fixing a bug. Try the sample world before changing your own records. [Open PROS](https://pros-rpg.web.app/)

## Report a problem

Include the screen, what you did, what you expected, and what happened. Mention your phone or browser and whether the app was offline. Use a sample profile for screenshots. Keep account details, backups, and private writing out of public issues. [GitHub issues](https://github.com/revaan-mishra/pros-app/issues) · [Private security reports](SECURITY.md)

## Run a local copy

Use Node 24 LTS and pnpm 11. Fork and clone the repository, then run these commands from the checkout.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the address the server prints. You can use a sample world or a local profile without a Firebase project. [Build and host PROS](docs/DEPLOYMENT.md)

## Keep the rules visible

- Practice time earns experience. Finished results have their own role in restoration and keepsakes.
- Users can pause or return after a break with their progress intact.
- Saves commit on the device first. Keep account data, local profiles, and the sample separate.
- Make new controls usable with a keyboard and at phone width. Keep important actions available with reduced motion.

## Check and share a change

Make a branch from `main`. Run the checks that cover your change, and include the results in your pull request. For a visual change, add a screenshot from a sample profile and name the device or viewport you used.

```sh
pnpm test
pnpm build
pnpm check:server
pnpm check:assets
```

The [release checklist](docs/RELEASE-CHECKLIST.md) lists browser, device, and cloud checks. The [showcase notes](docs/SHOWCASE.md) explain how to refresh the public screenshots.

## Add art or audio

Include the creator, source, and license for any new asset. Check the existing manifests and credits for the format. Showcase illustrations are recorded separately from assets bundled for play. [Art and audio](docs/ART-AND-AUDIO.md) · [Third-party credits](public/licenses/THIRD-PARTY.txt)
