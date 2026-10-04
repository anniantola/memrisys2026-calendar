# MEMRISYS 2026 — Gallery arrows update

The full-screen photo viewer now supports browsing without closing each photo.

## Navigation
- Left/right arrow buttons appear on photos when there is more than one image in the current set.
- A small `current / total` counter appears at the top.
- Swiping left/right also changes photos on touch devices.
- Keyboard left/right arrows work as well.

When a photo is opened from **Gallery**, navigation follows the complete Gallery order, including moving between presentation groups.

When a photo is opened inside a **specific talk/poster**, navigation stays within that presentation's attached photos.

Custom titles for Unclassified photos continue to be editable in the viewer.

Service-worker cache: v15.

## Deployment
Replace:
- `index.html`
- `app.js`
- `styles.css`
- `service-worker.js`

`README.md` is optional.
