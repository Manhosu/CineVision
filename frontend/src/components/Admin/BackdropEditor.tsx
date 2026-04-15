'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface BackdropEditorProps {
  imageUrl: string;
  initialDesktop?: Position;
  initialMobile?: Position;
  onSave: (desktop: Position, mobile: Position) => void;
  onClose: () => void;
  contentTitle?: string;
}

type ActiveTab = 'desktop' | 'mobile';

function DraggablePreview({
  imageUrl,
  position,
  onChange,
  aspectRatio,
  width,
  label,
  contentTitle,
  isMobile,
}: {
  imageUrl: string;
  position: Position;
  onChange: (pos: Position) => void;
  aspectRatio: string;
  width?: string;
  label: string;
  contentTitle: string;
  isMobile?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const move = useCallback((clientX: number, clientY: number) => {
    if (!dragging || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onChange({ x, y });
  }, [dragging, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); };
    const onEnd = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging, move]);

  return (
    <div style={{ width: width || '100%' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-white/30 font-mono">{Math.round(position.x)}% {Math.round(position.y)}%</span>
      </div>
      <div
        ref={ref}
        className="relative rounded-xl overflow-hidden cursor-crosshair select-none border-2 border-white/10 hover:border-white/20 transition-colors"
        style={{ aspectRatio }}
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={() => setDragging(true)}
      >
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${position.x}% ${position.y}%` }}
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 pointer-events-none" />
        {!isMobile && <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />}

        {/* Simulated UI */}
        <div className={`absolute bottom-0 left-0 right-0 pointer-events-none ${isMobile ? 'p-3' : 'p-5'}`}>
          {!isMobile && (
            <div className="inline-flex items-center gap-1 bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-400 text-[10px] font-semibold mb-1">
              <svg className="w-2.5 h-2.5 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              8.5
            </div>
          )}
          <h2 className={`font-black text-white mb-1 ${isMobile ? 'text-sm' : 'text-2xl'}`}>{contentTitle}</h2>
          <div className={`flex items-center gap-2 text-white/50 mb-2 ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
            <span>2026</span>
            <span className="border border-white/30 px-1 rounded text-[9px]">14</span>
            <span>2h 15min</span>
          </div>
          <div className="flex gap-2">
            <div className={`bg-red-600 text-white rounded-md font-bold ${isMobile ? 'px-3 py-1 text-[9px]' : 'px-4 py-1.5 text-xs'}`}>Comprar</div>
            {!isMobile && <div className="bg-white/10 text-white px-3 py-1.5 rounded-md text-xs">Salvar</div>}
          </div>
        </div>

        {/* Crosshair */}
        <div
          className="absolute w-6 h-6 border-2 border-white rounded-full pointer-events-none"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 0 12px rgba(255,255,255,0.3)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

const PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Topo', x: 50, y: 15 },
  { label: 'Centro', x: 50, y: 50 },
  { label: 'Baixo', x: 50, y: 85 },
  { label: 'Esquerda', x: 20, y: 50 },
  { label: 'Direita', x: 80, y: 50 },
];

export default function BackdropEditor({
  imageUrl,
  initialDesktop = { x: 50, y: 50 },
  initialMobile,
  onSave,
  onClose,
  contentTitle = 'Título do Filme',
}: BackdropEditorProps) {
  const [desktop, setDesktop] = useState(initialDesktop);
  const [mobile, setMobile] = useState(initialMobile || initialDesktop);
  const [tab, setTab] = useState<ActiveTab>('desktop');

  const activePos = tab === 'desktop' ? desktop : mobile;
  const setActivePos = tab === 'desktop' ? setDesktop : setMobile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Ajustar Backdrop</h3>
            <p className="text-xs text-white/40">Arraste para definir o ponto focal em cada tela</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab('desktop')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative ${
              tab === 'desktop' ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2"/><path d="M8 21h8M12 17v4" strokeWidth="2"/></svg>
              Desktop
            </span>
            {tab === 'desktop' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
          </button>
          <button
            onClick={() => setTab('mobile')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative ${
              tab === 'mobile' ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2"/><path d="M12 18h.01" strokeWidth="2" strokeLinecap="round"/></svg>
              Mobile
            </span>
            {tab === 'mobile' && <div className="absolute bottom-0 left-0 h-0.5 bg-primary-500 right-0" />}
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-5">
          {tab === 'desktop' ? (
            <DraggablePreview
              imageUrl={imageUrl}
              position={desktop}
              onChange={setDesktop}
              aspectRatio="16/7"
              contentTitle={contentTitle}
              label="Como aparece no desktop / tablet"
            />
          ) : (
            <div className="flex justify-center">
              <DraggablePreview
                imageUrl={imageUrl}
                position={mobile}
                onChange={setMobile}
                aspectRatio="9/16"
                width="300px"
                contentTitle={contentTitle}
                label="Como aparece no celular"
                isMobile
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-t border-white/10 space-y-2.5">
          {/* Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-white/30 mr-1">Atalhos:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setActivePos({ x: p.x, y: p.y })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  Math.abs(activePos.x - p.x) < 5 && Math.abs(activePos.y - p.y) < 5
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-all">
              Cancelar
            </button>
            <button
              onClick={() => { onSave(desktop, mobile); onClose(); }}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-all"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
