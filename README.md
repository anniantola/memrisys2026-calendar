# MEMRISYS 2026 Conference Calendar

This version adds a first, deliberately simple presentation-photo feature.

## Photo feature
Open any talk or poster and tap **Add photos** to choose one or more existing images from the phone. The selected images are stored locally in IndexedDB and attached to that exact presentation. Tapping a thumbnail opens it full-screen; the × on a thumbnail deletes it.

Large images are resized/compressed in the browser to reduce storage use. Photos are device-local and are **not yet included in the JSON backup**.

Automatic assignment by photo timestamp is intentionally not included in this first version.

## Deployment
Replace `index.html`, `app.js`, `styles.css`, and `service-worker.js` in the repository root and commit to `main`. GitHub Actions will redeploy automatically.
