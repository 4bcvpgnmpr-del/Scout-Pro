import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MousePointer2, Circle, MoveRight, Spline, Trash2, Plus, Copy, Play as PlayIcon, Save, ArrowRight, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Play, PlayElement, PlayFrame } from '@/lib/plays-api';

export interface CourtEditorProps {
  play: Play;
  readOnly?: boolean;
  onSave?: (frames: PlayFrame[]) => void;
  isSaving?: boolean;
}

type ToolMode = "select" | "attacker" | "defender" | "ball" | "move" | "pass" | "screen";

export function CourtEditor({ play, readOnly = false, onSave, isSaving = false }: CourtEditorProps) {
  const [frames, setFrames] = useState<PlayFrame[]>(
    play.frames?.length > 0 
      ? [...play.frames].sort((a, b) => a.frameIndex - b.frameIndex) 
      : [{ frameIndex: 0, elements: [] }]
  );
  
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [mode, setMode] = useState<ToolMode>("select");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<PlayElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const activeFrame = frames[currentFrameIdx] || { elements: [] };

  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setTimeout(() => {
        setCurrentFrameIdx((prev) => (prev + 1) % frames.length);
      }, 1500);
    }
    return () => {
      if (playTimer.current) clearTimeout(playTimer.current);
    };
  }, [isPlaying, currentFrameIdx, frames.length]);

  const updateFrames = (newElements: PlayElement[]) => {
    setFrames(prev => {
      const copy = [...prev];
      copy[currentFrameIdx] = { ...copy[currentFrameIdx], elements: newElements };
      return copy;
    });
  };

  const generateLabel = (type: string, elements: PlayElement[]) => {
    if (type === 'attacker') {
      for (let i = 1; i <= 5; i++) {
        if (!elements.some(e => e.type === 'attacker' && e.label === String(i))) return String(i);
      }
      return '?';
    }
    if (type === 'defender') {
      for (let i = 1; i <= 5; i++) {
        if (!elements.some(e => e.type === 'defender' && e.label === `X${i}`)) return `X${i}`;
      }
      return 'X?';
    }
    return '';
  };

  const getPoint = (e: React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    const pt = getPoint(e);
    
    if (mode === 'select') {
      // If we clicked on SVG background, deselect.
      const target = e.target as SVGElement;
      if (target.tagName === 'svg' || target.tagName === 'rect') {
        setSelectedId(null);
      }
    } else if (mode === 'attacker' || mode === 'defender' || mode === 'ball') {
      const el: PlayElement = {
        id: crypto.randomUUID(),
        type: mode,
        x: pt.x,
        y: pt.y,
        label: generateLabel(mode, activeFrame.elements)
      };
      updateFrames([...activeFrame.elements, el]);
      setSelectedId(el.id);
      setMode('select');
    } else if (mode === 'move' || mode === 'pass' || mode === 'screen') {
      setDrawing({
        id: crypto.randomUUID(),
        type: mode,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y
      });
      setSelectedId(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (readOnly) return;
    
    if (activeId) {
      const pt = getPoint(e);
      const updated = activeFrame.elements.map(el => 
        el.id === activeId ? { ...el, x: pt.x, y: pt.y } : el
      );
      updateFrames(updated);
    } else if (drawing) {
      const pt = getPoint(e);
      setDrawing({ ...drawing, x2: pt.x, y2: pt.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (activeId) {
      setActiveId(null);
    } else if (drawing) {
      updateFrames([...activeFrame.elements, drawing]);
      setDrawing(null);
      setMode('select');
    }
  };

  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    if (readOnly) return;
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedId(id);
      setActiveId(id);
      // Bring to front
      const el = activeFrame.elements.find(x => x.id === id);
      const rest = activeFrame.elements.filter(x => x.id !== id);
      if (el) updateFrames([...rest, el]);
    }
  };

  const deleteSelected = () => {
    if (!selectedId || readOnly) return;
    updateFrames(activeFrame.elements.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, currentFrameIdx, frames]);

  const addFrame = () => {
    if (frames.length >= 6) return;
    setFrames([...frames, { frameIndex: frames.length, elements: [] }]);
    setCurrentFrameIdx(frames.length);
  };

  const duplicateFrame = () => {
    if (frames.length >= 6) return;
    const clonedElements = activeFrame.elements.map(e => ({ ...e, id: crypto.randomUUID() }));
    setFrames([...frames, { frameIndex: frames.length, elements: clonedElements }]);
    setCurrentFrameIdx(frames.length);
  };

  const deleteFrame = (idx: number) => {
    if (frames.length <= 1) return;
    const newFrames = frames.filter((_, i) => i !== idx).map((f, i) => ({ ...f, frameIndex: i }));
    setFrames(newFrames);
    if (currentFrameIdx >= newFrames.length) {
      setCurrentFrameIdx(newFrames.length - 1);
    }
  };

  // Render elements
  const renderElement = (el: PlayElement) => {
    const isSelected = el.id === selectedId;
    const selectStyles = isSelected ? { filter: 'drop-shadow(0px 0px 3px rgba(37,99,235,0.8))' } : {};

    if (el.type === 'attacker') {
      return (
        <g key={el.id} style={selectStyles} onPointerDown={(e) => handleElementPointerDown(e, el.id)} className="cursor-pointer">
          <circle cx={el.x} cy={el.y} r={3.5} fill="currentColor" className="text-primary" />
          <text x={el.x} y={(el.y || 0) + 1.2} fontSize="3.5" fontWeight="bold" fill="white" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
            {el.label}
          </text>
        </g>
      );
    }
    if (el.type === 'defender') {
      return (
        <g key={el.id} style={selectStyles} onPointerDown={(e) => handleElementPointerDown(e, el.id)} className="cursor-pointer">
          <circle cx={el.x} cy={el.y} r={3.5} fill="white" stroke="currentColor" strokeWidth={0.8} className="text-blue-600" />
          <text x={el.x} y={(el.y || 0) + 1.2} fontSize="3" fontWeight="bold" fill="currentColor" className="text-blue-600" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
            {el.label}
          </text>
        </g>
      );
    }
    if (el.type === 'ball') {
      return (
        <g key={el.id} style={selectStyles} onPointerDown={(e) => handleElementPointerDown(e, el.id)} className="cursor-pointer">
          <circle cx={el.x} cy={el.y} r={2} fill="#ea580c" stroke="white" strokeWidth={0.5} />
        </g>
      );
    }
    
    // Lines
    const lineStyles = { stroke: isSelected ? '#2563eb' : 'currentColor', cursor: 'pointer' };
    
    if (el.type === 'move') {
      return <path key={el.id} d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} strokeWidth={0.8} fill="none" markerEnd="url(#arrowhead)" style={lineStyles} onPointerDown={(e) => handleElementPointerDown(e, el.id)} className={isSelected ? "" : "text-foreground"} />;
    }
    if (el.type === 'pass') {
      return <path key={el.id} d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} strokeWidth={0.8} strokeDasharray="2,2" fill="none" markerEnd="url(#arrowhead)" style={lineStyles} onPointerDown={(e) => handleElementPointerDown(e, el.id)} className={isSelected ? "" : "text-foreground"} />;
    }
    if (el.type === 'screen') {
      return <path key={el.id} d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} strokeWidth={0.8} fill="none" markerEnd="url(#screenhead)" style={lineStyles} onPointerDown={(e) => handleElementPointerDown(e, el.id)} className={isSelected ? "" : "text-foreground"} />;
    }
    
    return null;
  };

  const allElements = [...activeFrame.elements, ...(drawing ? [drawing] : [])];

  return (
    <div className="flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-border bg-muted/20">
          <Button variant={mode === 'select' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setMode('select')} title="Seleccionar">
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant={mode === 'attacker' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 text-primary" onClick={() => setMode('attacker')} title="Añadir Atacante">
            <Circle className="h-4 w-4 fill-current" />
          </Button>
          <Button variant={mode === 'defender' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 text-blue-600" onClick={() => setMode('defender')} title="Añadir Defensor">
            <Circle className="h-4 w-4" />
          </Button>
          <Button variant={mode === 'ball' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 text-orange-600" onClick={() => setMode('ball')} title="Añadir Balón">
            <Circle className="h-3 w-3 fill-current" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant={mode === 'move' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setMode('move')} title="Movimiento">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant={mode === 'pass' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setMode('pass')} title="Pase">
            <Minus className="h-4 w-4 border-b-2 border-dashed border-current pb-1" />
          </Button>
          <Button variant={mode === 'screen' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setMode('screen')} title="Bloqueo">
            <div className="h-4 w-4 border-r-2 border-t-2 border-current transform -rotate-45 mt-1" />
          </Button>
          
          <div className="flex-1" />
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:bg-destructive/10" 
            onClick={deleteSelected} 
            disabled={!selectedId}
            title="Eliminar seleccionado"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          {onSave && (
            <Button size="sm" onClick={() => onSave(frames)} disabled={isSaving} className="ml-2 font-bold text-xs h-8">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="relative w-full aspect-[15/14] bg-[#f8f5f0] dark:bg-[#1a1614] overflow-hidden" style={{ touchAction: 'none' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 150 140"
          className="w-full h-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto">
              <path d="M 0 0 L 4 2 L 0 4 z" fill="currentColor" className="text-foreground" />
            </marker>
            <marker id="screenhead" markerWidth="2" markerHeight="6" refX="1" refY="3" orient="auto">
              <rect width="2" height="6" fill="currentColor" className="text-foreground" />
            </marker>
          </defs>

          {/* FIBA Half Court Background */}
          <g className="text-muted-foreground/30 dark:text-muted-foreground/20" style={{ pointerEvents: 'none' }}>
            <rect width="150" height="140" fill="transparent" stroke="currentColor" strokeWidth="0.5" />
            <rect x="50.5" y="0" width="49" height="58" fill="rgba(var(--primary), 0.05)" stroke="currentColor" strokeWidth="0.5" />
            <path d="M 57 58 A 18 18 0 0 0 93 58" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <path d="M 93 58 A 18 18 0 0 0 57 58" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
            <path d="M 9 0 L 9 29.9 A 67.5 67.5 0 0 0 141 29.9 L 141 0" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <line x1="66" y1="12" x2="84" y2="12" stroke="currentColor" strokeWidth="1" />
            <circle cx="75" cy="15.75" r="2.25" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </g>

          {/* Elements */}
          {allElements.map(renderElement)}
        </svg>

        {readOnly && frames.length > 1 && (
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute bottom-4 right-4 h-10 w-10 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95"
          >
            {isPlaying ? <span className="h-3 w-3 bg-current rounded-sm" /> : <PlayIcon className="h-4 w-4 ml-0.5 fill-current" />}
          </button>
        )}
      </div>

      {/* Frames Panel */}
      {(frames.length > 1 || !readOnly) && (
        <div className="p-3 border-t border-border bg-muted/10 flex items-center gap-2 overflow-x-auto">
          {frames.map((f, idx) => (
            <div
              key={idx}
              className={`relative shrink-0 w-16 h-14 rounded-md border-2 overflow-hidden cursor-pointer transition-colors ${
                currentFrameIdx === idx ? 'border-primary' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => { setCurrentFrameIdx(idx); setIsPlaying(false); }}
            >
              <div className="absolute inset-0 bg-[#f8f5f0] dark:bg-[#1a1614] flex items-center justify-center">
                <span className="text-[10px] font-bold text-muted-foreground/40 absolute top-1 left-1">{idx + 1}</span>
                {f.elements.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </div>
              {!readOnly && frames.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFrame(idx); }}
                  className="absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-2 w-2" />
                </button>
              )}
            </div>
          ))}
          
          {!readOnly && frames.length < 6 && (
            <div className="flex flex-col gap-1 ml-1 shrink-0">
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={addFrame}>
                <Plus className="h-3 w-3 mr-1" /> Nuevo
              </Button>
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={duplicateFrame}>
                <Copy className="h-3 w-3 mr-1" /> Duplicar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
