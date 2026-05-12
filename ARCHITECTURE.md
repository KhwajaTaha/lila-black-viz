LILA BLACK — Journey Visualization Architecture

What this actually is (and why it’s built this way)

At a high level, this project takes a bunch of raw match data (in Parquet files), processes it once offline, and turns it into something the browser can replay smoothly at 60fps — without needing a backend.

Everything is optimized around one idea: do the heavy work once, not at runtime.

---

Tech stack choices (with the real reasoning)

Framework: Next.js 16 (App Router) — Easy to iterate, TypeScript works out of the box, static export is simple
Rendering: HTML5 Canvas (2D) — WebGL is overkill; Canvas handles this scale easily
Styling: Tailwind CSS v3 — Fast and avoids v4 ARM64 issues
Data pipeline: Python + Pandas + PyArrow — Fast Parquet processing, runs once
Deployment: Vercel static export — No server needed

---

How data moves through the system

1,243 Parquet files
→ preprocess.py (one-time)
→ grouped, converted, split into events
→ outputs JSON files
→ browser fetches match
→ enrichMatchData()
→ animation loop (60fps with requestAnimationFrame)

React updates UI ~15fps; canvas runs independently at 60fps.

---

How coordinates are mapped

Game uses (x, z), screen uses (x, y), so vertical is flipped.

Process:
- Normalize (0–1)
- Scale to 1024
- Flip vertical axis

---

Map configs (reverse-engineered)

AmbroseValley: scale 900, origin (-370, -473)
GrandRift: scale 581, origin (-290, -290)
Lockdown: scale 1000, origin (-500, -500)

---

Assumptions

- Timestamps misread as ms instead of seconds
- UUID = human, short ID = bot
- Some participants missing
- Map system inferred visually

---

Tradeoffs

- Static export over SSR → simpler, faster
- Canvas over WebGL → less complexity
- Precomputed JSON → no backend
- Single file per match → simpler
- Batched drawing → fewer draw calls
- Virtual scrolling → faster UI

---

Core philosophy

Make runtime as dumb and fast as possible.

- Heavy work offline
- Small payloads
- Avoid React in loops
- Canvas handles rendering
