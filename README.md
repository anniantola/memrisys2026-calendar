# MEMRISYS 2026 Conference Calendar

This update extends the presentation-photo feature with timestamp-based suggestions.

## Photo import by time
Open **My schedule** and tap **Import photos by time**. Select one or many existing photos from the phone. The app reads the JPEG camera capture timestamp (EXIF DateTimeOriginal) when available and otherwise falls back to the file modification date converted to Darmstadt time.

Each photo is compared with the MEMRISYS programme. Presentations happening at the capture time are suggested first, and starred items are prioritized when parallel sessions overlap. Photos taken during the Tuesday poster session suggest starred posters first. Every suggestion is shown for review before anything is saved, and each photo can be reassigned to another programme item from that day or skipped.

Photos continue to be stored locally in IndexedDB and are not included in the JSON backup. Manual **Add photos** from an individual talk/poster still works as before.

## Deployment
Replace `index.html`, `app.js`, `styles.css`, and `service-worker.js` in the repository root and commit to `main`. GitHub Actions will redeploy automatically.
