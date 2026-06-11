---
name: PDF/canvas export with Tailwind v4
description: Why html2canvas silently fails on Tailwind v4 colors and the fix
---

# PDF / html2canvas export under Tailwind v4

Tailwind v4 emits modern CSS color functions — `oklch()` and `color-mix()` (the
latter is what `bg-primary/10`, `text-primary/90`, etc. compile to). The classic
`html2canvas` (1.4.x) parser cannot read these and throws while cloning the DOM,
which often gets swallowed by a `catch`, so the PDF never downloads and nothing
visibly happens.

**Fix:** use the maintained fork `html2canvas-pro` (2.x) instead. It understands
oklch/color-mix. Swap the import (dynamic `import("html2canvas-pro")`) and keep
jspdf. Also surface failures (e.g. an `alert`) instead of a silent
`console.error` so a real future failure is visible.

**Why:** any Tailwind v4 app that screenshots/exports DOM to canvas (PDF export,
image export) will hit this the moment a themed/opacity color enters the captured
subtree. Plain html2canvas is effectively incompatible with Tailwind v4 colors.

**How to apply:** if asked to add or fix DOM-to-PDF/image export in a Tailwind v4
project, reach for `html2canvas-pro` from the start; don't debug `html2canvas`
1.4.x color parsing.
