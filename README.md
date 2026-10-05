# MEMRISYS 2026 — v21 forced-update build

This build is deliberately redundant to defeat the stale PWA asset problem.

## Photo editing
Open **any photo** (assigned to a presentation/poster or Unclassified). Under the image you should see:

**Photo details**
- Title
- Notes
- attached presentation/poster
- autosave status

## How to verify the update
Go to **Settings → App**. It should visibly say:

`Build v21 · photo titles + photo notes`

If you do not see that text, the phone is still running an older deployed build.

## Why this update is different
The exact same v21 JavaScript/CSS/service-worker content is published under all of these names:

- `app.js`
- `app-v20.js`
- `app-v21.js`
- `styles.css`
- `styles-v20.css`
- `styles-v21.css`
- `service-worker.js`
- `service-worker-v20.js`
- `service-worker-v21.js`

So whether the installed PWA is still using the old index, the v20 index, or the v21 index, it receives the current code once these files are deployed.

The service worker also now fetches HTML/JS/CSS network-first to make future code updates less sticky.

## Deployment
Upload **all files in the UPDATE zip** to the repository root and overwrite existing files when names already exist.
