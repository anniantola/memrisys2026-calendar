# MEMRISYS 2026 Conference Calendar

## Chronological PPTX + fitted photo viewer

- PowerPoint export is now chronological across the whole archive.
- Normal talks/sessions stay grouped by their scheduled programme time. All photos assigned to that presentation stay on that presentation's slide(s).
- Photos within a presentation are ordered by their capture time.
- Unclassified/custom-titled photos are inserted into the PowerPoint according to their own capture date/time instead of being placed at the end.
- The full-screen Gallery/photo viewer now explicitly scales the image to the available phone screen using `object-fit: contain`.
- A previous CSS-generation issue that left literal `\n` text in the photo/gallery stylesheet has also been corrected; this was preventing reliable viewer styling on some Android Chrome builds.

## Deployment
Replace `app.js`, `styles.css`, and `service-worker.js` in the repository root and commit to `main`. `README.md` is optional.
