# MEMRISYS 2026 — photo search v25

The **Photos** side of Gallery now has the same search concept as the Notes side.

Search covers each photo's:
- custom **Title**
- per-photo **Notes**

Behavior:
- only matching photos remain visible,
- presentation/poster grouping is preserved,
- matching words are highlighted in photo titles and note previews,
- the Gallery summary shows `X results · Y total photos`,
- an empty result gives a clear `No matching photos` message.

Search does not use the presentation title or speaker; it is deliberately limited to the metadata written for the photo itself, as requested.

Build: v25.

## Deploy
Upload all files in the UPDATE zip to the repository root and overwrite matching files.
