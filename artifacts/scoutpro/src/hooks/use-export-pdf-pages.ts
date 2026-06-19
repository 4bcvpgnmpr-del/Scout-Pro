import { useState } from "react";

export function useExportPdfPages(filename: string) {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async (pageRefs: Array<React.RefObject<HTMLDivElement | null>>) => {
    setExporting(true);
    try {
      const [html2canvas, jspdfModule] = await Promise.all([
        import("html2canvas-pro").then((m) => m.default),
        import("jspdf"),
      ]);
      const jsPDF = jspdfModule.default;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let i = 0; i < pageRefs.length; i++) {
        const el = pageRefs[i].current;
        if (!el) continue;

        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: el.offsetWidth,
          height: el.offsetHeight,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.93);
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
      alert("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}
