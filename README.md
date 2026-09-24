# InfectedVoices-iOS

Capacitor iOS / App Store pipeline for iPhone and iPad. **Core is the parity source.** This repository does not fork DSP. The studio engine stays in Core and is pinned here as a submodule.

## Pin

Core [`InfectedVoices`](https://github.com/grimvirusoffical-source/InfectedVoices) `main` at `667ae1cb2edac499b773fb9f688b6b46484a558d` (hardened Core audio/build release).

```bash
git submodule update --init
git -C core rev-parse HEAD
```

The Capacitor iOS project is `core/ios` (bundle id `space.infectedvoices.studio`).

## Cap sync from Core ios

`npm run sync` and `npm run sync:ios` run Core `npm run native:ios` inside the submodule. `npm run prepare:ios` installs Core dependencies when `core/node_modules` is missing, then runs the same `native:ios` command.

```bash
npm run sync:ios
npm run prepare:ios
```

## Store-only App Store

Distribution is the **Store-only App Store**. There is **no raw IPA** on the marketing CDN, on GitHub Releases, or on `/get`.

`/get` honesty, same rule as Core: `/get` and `/download` do not host raw store binaries. iPhone and iPad are App Store only. That page does not offer an `.ipa`.

## Mac

No Mac native shell. Mac is Open web, or the iOS app as **Designed for iPad**. Catalyst and macOS flags exit 2.

## EAS

`npm run eas` and `node scripts/ios-pipeline.mjs --eas` exit 2 until `EXPO_TOKEN` is set. This shell does not upload to the App Store.

`--submit` exits 2 until App Store Connect credentials exist at `.secrets/AuthKey_S3527PMRV3.p8` or `ASC_API_KEY_PATH`. Credentials are not committed. No upload is performed.
