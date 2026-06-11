---
name: ScoutPro PDF removal
description: PDF export was fully removed from ScoutPro — what was cleaned up and where.
---

# ScoutPro PDF removal

PDF export (useExportPdf hook) was completely removed. When doing future work, do NOT re-add it — the user explicitly rejected it as too complex.

**What was removed from each file:**
- Import: `useExportPdf` from `@/hooks/use-export-pdf`
- Import: `Download`, `Loader2` from lucide (unless used elsewhere)
- Hook call: `const { contentRef, exportPdf, exporting } = useExportPdf(...)`
- Button: the export PDF button JSX
- Ref: `<div ref={contentRef}>` wrapping the printable content (revert to plain `<div>`)

**Why:**
- PDF export using html2canvas/jspdf was unreliable and produced poor quality output.
- The hook file (`use-export-pdf.ts`) still exists in the codebase but is unused — safe to delete if needed.
