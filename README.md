# MEMRISYS 2026 conference app

This is the cleaned, unversioned file layout.

## Current app files
- `index.html`
- `app.js`
- `styles.css`
- `service-worker.js`
- `data.js`
- `manifest.webmanifest`
- `icon-180.png`
- `icon-192.png`
- `icon-512.png`
- `share-qr.jpg`
- `program.pdf`
- `.github/workflows/deploy.yml`

The app content/functionality corresponds to the latest v26 build, including:
- Now → current conference day/time slot
- verified conference locations
- Gallery Photos / Notes
- photo-title and photo-note search
- direct camera capture
- editable photo title/notes
- explicit Unclassified assignment even when a timestamp matches a programme item

## Deploy
Delete the old versioned app files from the repository, upload this package to the repository root, commit, and let GitHub Pages deploy.


## Organizer room change — Wednesday 7 October 2026

An organizer notice received on 6 October overrides the earlier programme for the
parallel sessions on **07.10, 14:20–15:35**:

- **High Frequency / Ultrafast / Devices** → **Helium**
- **Synaptic Behavior** → **Europium**

Session timings are unchanged. The corresponding eight talk records in `data.js`
have been updated. This notice should take precedence over the older programme/PDF
if they still show the previous rooms.


## Forced refresh package

This package keeps the simple filenames (`data.js`, `app.js`, etc.) but the HTML
requests them with `?rev=20261006-roomchange2` so Android Chrome/PWA cannot satisfy them from an
older URL cache.

After deployment, Settings should show:

**Build · 6 Oct room update confirmed**

The Wednesday 07.10 room override is:
- High Frequency / Ultrafast / Devices → Helium
- Synaptic Behavior → Europium
