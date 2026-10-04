# MEMRISYS 2026 — PWA icon cache-bust update

The icon image itself was already changed in the previous update, but Android Chrome/WebAPK can reuse cached resources when the **manifest URL and icon URLs stay identical**.

This version deliberately gives both the manifest and all launcher icons completely new URLs:

- `manifest-v13.webmanifest`
- `memrisys-icon-v13-180.png`
- `memrisys-icon-v13-192.png`
- `memrisys-icon-v13-512.png`

`index.html` now references the new manifest and icons, and the service-worker cache is bumped to v13.

## Deploy
Upload/replace:
- `index.html`
- `service-worker.js`

Add:
- `manifest-v13.webmanifest`
- `memrisys-icon-v13-180.png`
- `memrisys-icon-v13-192.png`
- `memrisys-icon-v13-512.png`

The old `manifest.webmanifest` and old `icon-*.png` files can remain in the repository; the app no longer references them.

After deployment, uninstall the currently installed MEMRISYS app first, open the website in Chrome, reload once, then install again from the in-app Install button. The new manifest/icon URLs prevent the new WebAPK from fetching the old cached icon assets.
