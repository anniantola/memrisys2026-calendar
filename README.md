# MEMRISYS 2026 Conference Calendar — launcher icon fix

This update changes the **actual local PWA icon files** (`icon-180.png`, `icon-192.png`, and `icon-512.png`) instead of merely adding a remote SVG to the manifest.

The new square launcher icon uses MEMRISYS 2026 branding on a black background and is safe for Android maskable-icon cropping.

The manifest now references only the local PNG icons, so Chrome/WebAPK cannot keep choosing the previous generic calendar PNG icon.

Service-worker cache: v12.

## Deployment
Replace:
- `icon-180.png`
- `icon-192.png`
- `icon-512.png`
- `manifest.webmanifest`
- `service-worker.js`

If the already-installed Android launcher icon still remains cached after the update, uninstalling and reinstalling the PWA forces Android/Chrome to recreate the WebAPK icon immediately.
