# MEMRISYS 2026 Conference Calendar

## PowerPoint export update

Settings now includes **Export PPTX**. It builds a local PowerPoint slideshow from the notes and photos stored in the app.

- Includes one title slide.
- Includes one or more slides for every talk/poster/unclassified group that has notes or photos.
- Notes appear as text boxes.
- Photos are embedded into the deck as JPEGs, up to 1600 px max side.
- The slideshow is created fully inside the browser from local IndexedDB/localStorage data. No upload or server is involved.

JSON export/import remains separate. Photos are still not added to JSON backups.

## Deployment
Replace `index.html`, `app.js`, `styles.css`, and `service-worker.js` in the repository root and commit to `main`. `README.md` is optional.
