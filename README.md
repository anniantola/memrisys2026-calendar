# MEMRISYS 2026 — photo navigation layout fix

The full-screen photo viewer navigation has been redesigned:

- Both arrows are **below the photo**
- Both arrows are in **one horizontal row**
- The photo counter sits between them
- No arrow overlays cover the image
- Swipe left/right still works
- Keyboard left/right navigation still works

Service-worker cache: v16.

## Deployment
Replace:
- `index.html`
- `styles.css`
- `service-worker.js`

`app.js` is unchanged from the previous Gallery-arrows version.
