/**
 * PdfSettingsPopover — compact PDF appearance settings panel.
 * Rendered as a portal at document.body level so it is never clipped
 * by parent containers with overflow:hidden.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { Settings2, Check } from "lucide-react";
import { usePdfPrefs, FONT_OPTIONS, COLOR_PRESETS, type PdfPrefs } from "@/hooks/use-pdf-prefs";

interface Props {
  onChange?: (prefs: PdfPrefs) => void;
}

interface PanelPos { top: number; right: number; }

export function PdfSettingsPopover({ onChange }: Props) {
  const { prefs, setPrefs } = usePdfPrefs();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos>({ top: 0, right: 0 });
  const [hexInput, setHexInput] = useState(prefs.accent);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHexInput(prefs.accent); }, [prefs.accent]);

  // Position panel relative to trigger button
  const openPanel = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setOpen(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    // Small delay so the open click doesn't immediately close
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function update(patch: Partial<PdfPrefs>) {
    setPrefs(patch);
    onChange?.({ ...prefs, ...patch });
  }

  function handleHexInput(value: string) {
    setHexInput(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) update({ accent: value });
  }

  const panel = open ? ReactDOM.createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, width: 288 }}
      className="rounded-xl border border-border bg-card shadow-2xl shadow-black/20"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 rounded-t-xl">
        <Settings2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
          Estilo del PDF
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">Se guarda automáticamente</span>
      </div>

      {/* Scrollable body */}
      <div className="p-4 space-y-5 overflow-y-auto" style={{ maxHeight: "min(70vh, 480px)" }}>

        {/* ── Font family ───────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Tipografía
          </p>
          <div className="flex gap-2">
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ font: opt.value })}
                className={`flex-1 py-2 px-2 rounded-lg border text-center transition
                  ${prefs.font === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
              >
                <span
                  className="block text-sm leading-none mb-1"
                  style={{
                    fontFamily:
                      opt.value === "helvetica" ? "Arial, Helvetica, sans-serif"
                      : opt.value === "times"    ? "Times New Roman, serif"
                      :                           "Courier New, monospace",
                  }}
                >
                  Aa
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {/* Live preview */}
          <div className="mt-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
            <p
              className="text-[11px] font-bold leading-relaxed"
              style={{
                fontFamily:
                  prefs.font === "helvetica" ? "Arial, Helvetica, sans-serif"
                  : prefs.font === "times"    ? "Times New Roman, serif"
                  :                            "Courier New, monospace",
                color: prefs.accent,
              }}
            >
              INFORME DE SCOUTING
            </p>
            <p
              className="text-[10px] text-muted-foreground"
              style={{
                fontFamily:
                  prefs.font === "helvetica" ? "Arial, Helvetica, sans-serif"
                  : prefs.font === "times"    ? "Times New Roman, serif"
                  :                            "Courier New, monospace",
              }}
            >
              Análisis táctico · Temporada 2025/26
            </p>
          </div>
        </div>

        {/* ── Accent color ──────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Color de acento
          </p>

          {/* Presets grid */}
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {COLOR_PRESETS.map(({ hex, label }) => (
              <button
                key={hex}
                title={label}
                onClick={() => { update({ accent: hex }); setHexInput(hex); }}
                className="relative h-7 w-7 rounded-md border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: hex,
                  borderColor: prefs.accent === hex ? "white" : "transparent",
                  boxShadow: prefs.accent === hex ? `0 0 0 2px ${hex}` : "none",
                }}
              >
                {prefs.accent === hex && (
                  <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>

          {/* Custom hex */}
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-md border border-border flex-shrink-0"
              style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : "#e5e7eb" }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={e => handleHexInput(e.target.value)}
              placeholder="#f97316"
              maxLength={7}
              className="flex-1 h-7 px-2 rounded-md border border-border bg-muted/20 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:bg-card transition"
            />
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Hex</span>
          </div>
        </div>

        {/* Accent preview bar */}
        <div
          className="h-1.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${prefs.accent}, ${prefs.accent}66)` }}
        />
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? setOpen(false) : openPanel()}
        className={`h-7 w-7 rounded-lg border transition flex items-center justify-center
          ${open
            ? "bg-primary/15 border-primary/40 text-primary"
            : "bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        title="Configurar estilo del PDF"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
      {panel}
    </>
  );
}
