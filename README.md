# MEMRISYS 2026 — camera capture

Each talk/poster now has two photo actions:

- **Take photo** — opens the phone camera (rear/environment camera where supported) and attaches the resulting image directly to that presentation.
- **Add existing** — keeps the existing gallery/file-picker flow.

After a camera capture, the app stores its own compressed copy + thumbnail in IndexedDB and also makes a best-effort request to save the original image as a normal file on the phone. On Android/Chrome this normally appears in Downloads and may also be indexed by the phone's Photos/Gallery app. Some camera apps already save captures to the normal camera roll themselves.

A browser/PWA cannot reliably write directly into the system camera-roll folder on every Android device without native-app permissions, so the phone copy is best-effort rather than guaranteed.

Service-worker cache: v18.

## Deployment
Replace:
- `index.html`
- `app.js`
- `styles.css`
- `service-worker.js`

`README.md` is optional.
