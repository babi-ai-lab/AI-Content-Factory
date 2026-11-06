# Android and Google Play release

## Current approach

Persian Google Play store listing draft and asset checklist: [PLAY_STORE_LISTING_DRAFT_FA.md](PLAY_STORE_LISTING_DRAFT_FA.md).
The Android release uses a Trusted Web Activity (TWA) around the production PWA. The web application remains the source of truth; authentication, database access, content generation, and media storage stay on the existing backend.

Production origin: https://app.eltbabak.ir  
Manifest: https://app.eltbabak.ir/manifest.webmanifest  
Service worker: https://app.eltbabak.ir/sw.js

## Android project configuration

The confirmed permanent application ID is `ir.eltbabak.contentfactory`. Its Bubblewrap configuration is version-controlled at [android/twa-manifest.json](../android/twa-manifest.json).

The GitHub Actions workflow at [android-twa.yml](../.github/workflows/android-twa.yml) validates the live PWA's manifest, install icons, service worker and offline fallback using a deterministic Node.js check, provisions Java 17 and Android SDK 36, regenerates the TWA project, and builds an **unsigned** App Bundle for internal engineering checks. Bubblewrap's optional `validate` command calls the external PageSpeed Insights API; it is not used in CI because that API returned HTTP 429 rate limits. The local checks do not depend on that third-party quota. It does not create, store, or use an upload key and does not publish to Google Play. Workflow artifacts are retained for 14 days. The workflow also builds a debug-signed APK for installing on a physical Android device and acceptance testing; this debug APK is not a Play Store release artifact.

The production upload key and Play App Signing certificate must remain owner-controlled. Once Play App Signing is configured, its SHA-256 certificate fingerprint is required to create the production Digital Asset Links statement at `/.well-known/assetlinks.json`.

## Implemented in the web application
- Web app manifest with stable identity, RTL Persian metadata, standalone display, and maskable icon artwork.
- Production-only service worker registration.
- Network-first navigation and a minimal offline fallback.
- No caching of authenticated pages, API responses, private content, or generated media.
- Offline notice explicitly avoids promising offline access to private data.

## TWA packaging requirements

- Google Play policy as of 31 August 2026 requires new apps and updates to target Android 16 (API level 36) or higher. Set and verify the generated Android project's target SDK accordingly at release time.
1. Confirm the manifest and service worker are reachable over HTTPS.
2. Confirm Android Chrome installs the PWA and reports no manifest/service-worker errors.
3. Produce production PNG launcher assets (at least 512x512 and 192x192) from the approved icon artwork.
4. [x] Record the confirmed package ID `ir.eltbabak.contentfactory` in `android/twa-manifest.json` and add an automated Bubblewrap/Android SDK 36 build workflow. The first workflow run must still pass PWA validation.
5. Generate the upload key under the owner's control only after choosing Play App Signing; store it outside the repository and back it up securely. The CI workflow deliberately produces unsigned artifacts.
6. Publish /.well-known/assetlinks.json with the SHA-256 fingerprint of the Play App Signing certificate. Do not publish a debug fingerprint as the production relationship.
7. Verify the TWA opens in fullscreen without browser chrome and that all navigation remains within the trusted origin.
8. Build a signed Android App Bundle (AAB), test it using an internal Play track, then complete Play Console declarations and review.

## Release gates that require the owner
- Google Play Console developer account and one-time registration fee, if not already enrolled.
- Final confirmation of the permanent Android application ID and public-facing app name.
- Owner-controlled signing key custody and Play App Signing enrollment.
- Accurate privacy policy URL, support contact, Data safety form, content rating, target audience, ads declaration, app access instructions, and any required testing declaration.
- Final production approval and submission to Google Play.

## Security and privacy
The service worker intentionally does not cache private application content. Offline mode is limited to a generic connectivity notice. Do not add background synchronization or local persistence of private generated content without a separate threat model and explicit product decision.

Never commit keystores, passwords, Play service-account JSON, signing passwords, OAuth secrets, or production credentials.
