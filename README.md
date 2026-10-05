# MEMRISYS 2026 — current-slot navigation v24

The top **Now** button now does more than select today's conference day.

When pressed it:
- switches to the **Program** page,
- selects the current conference day in Darmstadt,
- clears programme search and room filtering so parallel talks are not hidden,
- finds the programme item(s) happening at the current Darmstadt time,
- scrolls directly to that time slot,
- briefly highlights the slot.

If the conference is currently between programme items, it jumps to the **next** scheduled slot instead.

The status card (for example **Happening now**) is now tappable and performs exactly the same action.

Build: v24.

## Deploy
Upload all files in the UPDATE zip to the repository root and overwrite matching files.
