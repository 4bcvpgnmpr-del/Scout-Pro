import { useState, useRef } from "react";
import { Target, Trash2, Eye } from "lucide-react";

type ShotType = "2pt" | "3pt" | "tl" | "medio";

export type ShotEntry = {
  id: string;
  x: number;
  y: number;
  type: ShotType;
  made: boolean;
  playerId: number | null;
  playerName: string;
  createdAt: string;
};

export type ShotPlayer = { id: number; name: string; teamName?: string | null };

const LS_KEY = "sf-shots";

function loadShots(): ShotEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); }
  catch { return []; }
}
function saveShots(shots: ShotEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(shots));
}

const VBW = 500;
const VBH = 450;

const TYPE_META: Record<ShotType, { label: string; fill: string; stroke: string }> = {
  "2pt":   { label: "2PT",   fill: "#22c55e", stroke: "#16a34a" },
  "3pt":   { label: "3PT",   fill: "#3b82f6", stroke: "#2563eb" },
  "tl":    { label: "TL",    fill: "#f97316", stroke: "#ea580c" },
  "medio": { label: "Media", fill: "#a855f7", stroke: "#9333ea" },
};

function BasketballCourt() {
  return (
    <g>
      <rect x="0" y="0" width={VBW} height={VBH} fill="#d4a853" rx="6" />
      {[50, 100, 150, 200, 250, 300, 350, 400].map((y) => (
        <line key={y} x1="5" y1={y} x2="495" y2={y} stroke="#c99e45" strokeWidth="0.6" opacity="0.35" />
      ))}
      <rect x="5" y="5" width="490" height="440" fill="none" stroke="#7a4a18" strokeWidth="2.5" rx="2" />
      <rect x="170" y="5" width="160" height="190" fill="#bf784044" stroke="#7a4a18" strokeWidth="2" />
      <line x1="170" y1="195" x2="330" y2="195" stroke="#7a4a18" strokeWidth="2" />
      <path d="M 190 195 A 60 60 0 0 0 310 195" fill="none" stroke="#7a4a18" strokeWidth="2" />
      <path d="M 190 195 A 60 60 0 0 1 310 195" fill="none" stroke="#7a4a18" strokeWidth="1.5" strokeDasharray="5 4" />
      <rect x="220" y="8" width="60" height="5" fill="#9a6020" rx="1" />
      <line x1="250" y1="13" x2="250" y2="26" stroke="#9a6020" strokeWidth="1.5" />
      <circle cx="250" cy="38" r="13" fill="none" stroke="#f97316" strokeWidth="2.5" />
      <circle cx="250" cy="38" r="13" fill="none" stroke="#f9731630" strokeWidth="6" />
      <path d="M 213 38 A 40 40 0 0 1 287 38" fill="none" stroke="#7a4a18" strokeWidth="1.5" />
      <line x1="42" y1="5" x2="42" y2="102" stroke="#7a4a18" strokeWidth="2" />
      <line x1="458" y1="5" x2="458" y2="102" stroke="#7a4a18" strokeWidth="2" />
      <path d="M 42 102 A 216 216 0 0 1 458 102" fill="none" stroke="#7a4a18" strokeWidth="2" />
      <text x="250" y="435" textAnchor="middle" fontSize="10" fill="#9a6020" fontWeight="bold" opacity="0.5">LÍNEA DE MEDIO CAMPO</text>
      <line x1="5" y1="443" x2="495" y2="443" stroke="#7a4a18" strokeWidth="1" opacity="0.3" />
    </g>
  );
}

function ShotMarker({ shot }: { shot: ShotEntry }) {
  const cx = (shot.x / 100) * VBW;
  const cy = (shot.y / 100) * VBH;
  const { fill, stroke } = TYPE_META[shot.type];

  if (shot.made) {
    return <circle cx={cx} cy={cy} r={6} fill={fill} stroke={stroke} strokeWidth={1.5} opacity={0.9} />;
  }
  const s = 5;
  return (
    <g opacity={0.9}>
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
      <line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

export function ShotMap({
  players,
  initialPlayerId,
  onViewScout,
}: {
  players: ShotPlayer[];
  initialPlayerId?: number | null;
  onViewScout?: (playerId: number) => void;
}) {
  const [shots, setShots] = useState<ShotEntry[]>(loadShots);
  const [activeType, setActiveType] = useState<ShotType>("2pt");
  const [isMade, setIsMade] = useState(true);
  const [eraseMode, setEraseMode] = useState(false);
  const [filterPlayerId, setFilterPlayerId] = useState<number | null>(initialPlayerId ?? null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (eraseMode) {
      const best = shots.reduce<{ s: ShotEntry | null; d: number }>(
        (acc, s) => { const d = Math.hypot(s.x - x, s.y - y); return d < acc.d ? { s, d } : acc; },
        { s: null, d: 4 }
      );
      if (best.s) {
        const updated = shots.filter((s) => s.id !== best.s!.id);
        setShots(updated); saveShots(updated);
      }
      return;
    }

    const player = players.find((p) => p.id === filterPlayerId);
    const newShot: ShotEntry = {
      id: crypto.randomUUID(), x, y,
      type: activeType, made: isMade,
      playerId: filterPlayerId,
      playerName: player?.name ?? "",
      createdAt: new Date().toISOString(),
    };
    const updated = [...shots, newShot];
    setShots(updated); saveShots(updated);
  };

  const displayShots = filterPlayerId != null
    ? shots.filter((s) => s.playerId === filterPlayerId)
    : shots;

  const madeCount = displayShots.filter((s) => s.made).length;
  const total = displayShots.length;
  const pct = total > 0 ? Math.round((madeCount / total) * 100) : null;
  const activePlayer = players.find((p) => p.id === filterPlayerId);

  const clearShots = () => {
    const updated = filterPlayerId != null
      ? shots.filter((s) => s.playerId !== filterPlayerId)
      : [];
    setShots(updated); saveShots(updated);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Target className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">Mapa de Tiros</h2>
            <p className="text-[11px] text-gray-400">Registra tiros en la cancha · haz clic para añadir</p>
          </div>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Ver tiros de</label>
            <select
              value={filterPlayerId ?? ""}
              onChange={(e) => { setFilterPlayerId(e.target.value ? Number(e.target.value) : null); setEraseMode(false); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white outline-orange-500"
            >
              <option value="">Todas las jugadoras</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.teamName ? ` · ${p.teamName}` : ""}</option>
              ))}
            </select>
          </div>
          {filterPlayerId != null && onViewScout && (
            <button
              onClick={() => onViewScout(filterPlayerId)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5" /> Ver scout
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500">
            {total > 0 ? (
              <span>{madeCount}/{total} encestados{pct != null && <span className={`ml-2 font-black text-sm ${pct >= 50 ? "text-green-600" : "text-red-500"}`}>{pct}%</span>}</span>
            ) : (
              <span className="text-gray-400 italic">Sin tiros — haz clic en la cancha para registrar</span>
            )}
          </div>
          {total > 0 && (
            <button onClick={clearShots} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition">
              <Trash2 className="h-3 w-3" />
              {activePlayer ? `Limpiar ${activePlayer.name}` : "Limpiar todo"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.entries(TYPE_META) as [ShotType, (typeof TYPE_META)[ShotType]][]).map(([t, meta]) => (
            <button
              key={t}
              onClick={() => { setActiveType(t); setEraseMode(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                activeType === t && !eraseMode
                  ? "text-white border-transparent"
                  : "text-gray-500 border-gray-200 hover:border-gray-300 bg-white"
              }`}
              style={activeType === t && !eraseMode ? { backgroundColor: meta.stroke } : {}}
            >
              {meta.label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            onClick={() => setIsMade((m) => !m)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
              isMade ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-600 border-red-300"
            }`}
          >
            {isMade ? "● Encestado" : "✕ Fallado"}
          </button>
          <button
            onClick={() => setEraseMode((m) => !m)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
              eraseMode ? "bg-orange-500 text-white border-orange-600" : "text-gray-500 border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="h-full max-h-[380px] w-auto rounded-xl shadow-lg cursor-crosshair"
          onClick={handleClick}
          style={{ userSelect: "none" }}
        >
          <BasketballCourt />
          {displayShots.map((shot) => (
            <ShotMarker key={shot.id} shot={shot} />
          ))}
          {eraseMode && (
            <text x="250" y="230" textAnchor="middle" fontSize="13" fill="#ef4444" fontWeight="bold" opacity="0.6">
              MODO BORRAR · clic sobre el tiro
            </text>
          )}
        </svg>
      </div>

      <div className="px-6 py-2.5 border-t border-gray-100 flex items-center gap-4 flex-wrap bg-white flex-shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Zona:</span>
        {(Object.entries(TYPE_META) as [ShotType, (typeof TYPE_META)[ShotType]][]).map(([t, meta]) => (
          <div key={t} className="flex items-center gap-1 text-[11px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.fill }} />
            {meta.label}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-gray-400">
          <span>● anotado</span>
          <span>✕ fallado</span>
        </div>
      </div>
    </div>
  );
}
