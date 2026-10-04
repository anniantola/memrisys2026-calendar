# MEMRISYS 2026 Conference Calendar

This update moves photo importing into a dedicated **Gallery** page.

The bottom navigation now includes **Gallery**. Timestamp-based **Import photos** lives there, and saved photos are shown as small thumbnails grouped under the talk or poster they belong to. New photos get a separate compressed thumbnail (maximum 360 px) in IndexedDB; photos saved by the previous photo version automatically get thumbnails the first time Gallery loads.

Tapping a thumbnail opens the full stored image. Tapping a group heading opens the corresponding talk/poster. Timestamp matching still prioritizes starred sessions and starred posters during the poster session. Manual **Add photos** inside presentation details still works.

Photos remain local in IndexedDB and are not included in the JSON backup.

## Deployment
Replace `index.html`, `app.js`, `styles.css`, and `service-worker.js` in the repository root and commit to `main`. `README.md` is optional.
