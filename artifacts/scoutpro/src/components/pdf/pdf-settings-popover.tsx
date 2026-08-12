/**
 * PdfSettingsPopover — compact PDF appearance settings panel.
 * Renders a gear icon that opens a popover with font + color options.
 * Settings persist in localStorage via usePdfPrefs.
 */

import React, { useState, useRef, useEffect } from "react";
import { Settings2, Check } from "lucide-react";
import { usePdfPrefs, FONT_OPTIONS, COLOR_PRESETS, type PdfPrefs } from "@/hooks/use-pdf-prefs";

interface Props {
  /** Called whenever preferences change — use to re-read loadPdfPrefs() before export */
  onChange?: (prefs: PdfPrefs) => void;
}

export function PdfSettingsPopover({ onChange }: Props) {
  const { prefs, setPrefs } = usePdfPrefs();
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(prefs.accent);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync hex input when accent changes externally
  useEffect(() => { setHexInput(prefs.accent); }, [prefs.accent]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function update(patch: Partial<PdfPrefs>) {
    setPrefs(patch);
    onChange?.({ ...prefs, ...patch });
  }

  function handleHexInput(value: string) {
    setHexInput(value);
    // Validate and apply only complete valid hex colors
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) update({ accent: value });
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        className={`h-7 w-7 rounded-lg border transition flex items-center justify-center
          ${open
            ? "bg-primary/15 border-primary/40 text-primary"
            : "bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        title="Configurar estilo del PDF"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
              Estilo del PDF
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">Se guarda automáticamente</span>
          </div>

          <div className="p-4 space-y-5">

            {/* ── Font family ─────────────────────────────────────── */}
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
                        fontFamily: opt.value === "helvetica" ? "Arial, Helvetica, sans-serif"
                          : opt.value === "times" ? "Times New Roman, serif"
                          : "Courier New, monospace",
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

              {/* Sample preview */}
              <div className="mt-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                <p
                  className="text-[11px] leading-relaxed"
                  style={{
                    fontFamily: prefs.font === "helvetica" ? "Arial, Helvetica, sans-serif"
                      : prefs.font === "times" ? "Times New Roman, serif"
                      : "Courier New, monospace",
                    color: prefs.accent,
                  }}
                >
                  INFORME DE SCOUTING
                </p>
                <p
                  className="text-[10px] text-muted-foreground"
                  style={{
                    fontFamily: prefs.font === "helvetica" ? "Arial, Helvetica, sans-serif"
                      : prefs.font === "times" ? "Times New Roman, serif"
                      : "Courier New, monospace",
                  }}
                >
                  Análisis táctico del rival · Temporada 2025/26
                </p>
              </div>
            </div>

            {/* ── Accent color ────────────────────────────────────── */}
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
                    className="relative h-7 w-7 rounded-md border-2 transition hover:scale-110"
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

              {/* Custom hex input */}
              <div className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-md border border-border flex-shrink-0"
                  style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : "#e5e7eb" }}
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={hexInput}
                    onChange={e => handleHexInput(e.target.value)}
                    placeholder="#f97316"
                    maxLength={7}
                    className="w-full h-7 px-2 rounded-md border border-border bg-muted/20 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:bg-card transition"
                  />
                </div>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Hex</span>
              </div>
            </div>

            {/* ── Color accent preview bar ─────────────────────────── */}
            <div
              className="h-1.5 rounded-full"
              style={{ background: `linear-gradient(90deg, ${prefs.accent}, ${prefs.accent}88)` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
