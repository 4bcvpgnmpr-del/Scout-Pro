---
name: Multi-page PDF export pattern
description: How to build a 3-page A4 PDF dossier with html2canvas-pro + jsPDF in this project.
---

## Pattern

Each A4 page is a fixed-size div (794 × 1123 px) positioned at `fixed; left: -9999px` — stays in DOM but off-screen so html2canvas can capture it.

Refs must be typed as `React.RefObject<HTMLDivElement | null>` (React 19 change — `useRef<T>(null)` returns `RefObject<T | null>`).

Hook:
```typescript
const [html2canvas, jspdfModule] = await Promise.all([
  import("html2canvas-pro").then(m => m.default),
  import("jspdf"),
]);
const jsPDF = jspdfModule.default;
const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
for (let i = 0; i < pageRefs.length; i++) {
  if (i > 0) pdf.addPage();
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297);
}
pdf.save(`${filename}.pdf`);
```

**Why:** html2canvas-pro is required (not plain html2canvas) — handles oklch()/color-mix() colors from Tailwind v4. A4 at 96dpi = 794 × 1123px. jsPDF A4 unit is mm (210 × 297). Capturing separately allows different backgrounds per page (dark cover, white stats page).

**How to apply:** Any time a multi-page PDF export is needed. The component renders all pages off-screen and the hook captures + assembles them.
