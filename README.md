# MEMRISYS 2026 Conference Calendar — branding, venue & photo viewer update

- Header now uses the official MEMRISYS 2026 white logo from the conference website, with an offline text fallback.
- Manifest advertises the official SVG brand mark as an icon candidate while keeping the existing PNG fallbacks.
- Settings now includes a clickable darmstadtium venue card.
- Presentation details make the venue/location clickable in Maps; lunch and poster-session locations get their own map searches.
- The photo viewer no longer uses the browser `<dialog>` element. It is now a fixed full-viewport overlay with the image constrained by both viewport width and height, which avoids Android Chrome opening/rendering the image at its natural resolution.
- Cache version: v11.

Replace `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, and `service-worker.js`. `README.md` is optional.
