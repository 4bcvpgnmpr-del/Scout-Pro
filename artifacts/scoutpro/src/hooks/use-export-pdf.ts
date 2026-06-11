import { useRef, useState } from "react";

export function useExportPdf(filename: string) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    const el = contentRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const [html2canvas, jspdfModule] = await Promise.all([
        import("html2canvas").then((m) => m.default),
        import("jspdf"),
      ]);
      const jsPDF = jspdfModule.default;

      // Expand scrollable children so full content is captured
      type Saved = { el: HTMLElement; overflow: string; height: string; maxHeight: string };
      const saved: Saved[] = [];
      el.querySelectorAll<HTMLElement>("*").forEach((child) => {
        const cs = window.getComputedStyle(child);
        if (cs.overflow === "auto" || cs.overflow === "scroll" || cs.overflowY === "auto" || cs.overflowY === "scroll") {
          saved.push({ el: child, overflow: child.style.overflow, height: child.style.height, maxHeight: child.style.maxHeight });
          child.style.overflow = "visible";
          child.style.height = child.scrollHeight + "px";
          child.style.maxHeight = "none";
        }
      });
      const prevOverflow = el.style.overflow;
      const prevMaxHeight = el.style.maxHeight;
      const prevHeight = el.style.height;
      el.style.overflow = "visible";
      el.style.maxHeight = "none";
      el.style.height = "auto";

      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Restore
      el.style.overflow = prevOverflow;
      el.style.maxHeight = prevMaxHeight;
      el.style.height = prevHeight;
      saved.forEach((s) => {
        s.el.style.overflow = s.overflow;
        s.el.style.height = s.height;
        s.el.style.maxHeight = s.maxHeight;
      });

      const imgW = canvas.width / 2;
      const imgH = canvas.height / 2;
      const pdf = new jsPDF({ orientation: imgW > imgH ? "landscape" : "portrait", unit: "px", format: [imgW, imgH] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  };

  return { contentRef, exportPdf, exporting };
}
