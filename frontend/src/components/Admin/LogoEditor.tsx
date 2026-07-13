'use client';

/**
 * Igor (14/07): editor do logo PNG oficial do filme no hero.
 *
 * Clone estrutural do BackdropEditor com 3 diferenças:
 * 1. Preview compõe backdrop (fundo) + logo (foreground absoluto)
 * 2. Slider de SCALE (50-150%) além da posição X/Y
 * 3. Modelo de posicionamento IDÊNTICO ao runtime: `position: absolute`
 *    com `left/top: X% Y%` + `transform: translate(-50%, -50%)` + `width: N%`.
 *    Assim o drag no editor corresponde 1:1 ao que aparece no site.
 *    (Diferente do backdrop que usa object-position em img cover.)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface Position { x: number; y: number; }
interface Snapshot { pos: Position; scale: number; }

interface LogoEditorProps {
  logoUrl: string;
  backdropUrl?: string;
  initialDesktop?: Snapshot;
  initialMobile?: Snapshot;
  onSave: (desktop: Snapshot, mobile: Snapshot) => void;
  onClose: () => void;
  contentTitle?: string;
}

type ActiveTab = 'desktop' | 'mobile';

function DraggableLogoPreview({
  logoUrl,
  backdropUrl,
  position,
  scale,
  onChange,
  aspectRatio,
  width,
  label,
  isMobile,
}: {
  logoUrl: string;
  backdropUrl?: string;
  position: Position;
  scale: number;
  onChange: (pos: Position) => void;
  aspectRatio: string;
  width?: string;
  label: string;
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
        <span className="text-xs text-white/30 font-mono">
          {Math.round(position.x)}% {Math.round(position.y)}% · {scale}%
        </span>
      </div>
      <div
        ref={ref}
        className="relative rounded-xl overflow-hidden cursor-crosshair select-none border-2 border-white/10 hover:border-white/20 transition-colors"
        style={{ aspectRatio }}
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={() => setDragging(true)}
      >
        {/* Backdrop layer (fallback preto quando não tem) */}
        {backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black pointer-events-none" />
        )}
        {/* Gradientes escuros (só decorativos, mesmos do runtime) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 pointer-events-none" />
        {!isMobile && <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />}

        {/* Logo layer — modelo idêntico ao runtime:
            absolute + left/top % + translate(-50%,-50%) + width: scale% */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          className="absolute h-auto object-contain pointer-events-none drop-shadow-2xl"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${scale}%`,
            maxWidth: '95%',
            transform: 'translate(-50%, -50%)',
          }}
          draggable={false}
        />

        {/* Simulated UI de contexto — dá noção de onde a UI real cobre */}
        <div className={`absolute bottom-0 left-0 right-0 pointer-events-none ${isMobile ? 'p-3' : 'p-5'}`}>
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

        {/* Crosshair no centro do logo */}
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

// Presets adaptados pra logo (cantos e centro fazem sentido)
const PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Sup-Esq', x: 20, y: 30 },
  { label: 'Sup-Dir', x: 80, y: 30 },
  { label: 'Centro', x: 50, y: 50 },
  { label: 'Inf-Esq', x: 20, y: 70 },
  { label: 'Inf-Dir', x: 80, y: 70 },
];

const SCALE_MIN = 50;
const SCALE_MAX = 150;

export default function LogoEditor({
  logoUrl,
  backdropUrl,
  initialDesktop = { pos: { x: 50, y: 50 }, scale: 100 },
  initialMobile,
  onSave,
  onClose,
  contentTitle = 'Título do Filme',
}: LogoEditorProps) {
  const [desktop, setDesktop] = useState<Snapshot>(initialDesktop);
  const [mobile, setMobile] = useState<Snapshot>(initialMobile || initialDesktop);
  const [tab, setTab] = useState<ActiveTab>('desktop');

  const active = tab === 'desktop' ? desktop : mobile;
  const setActive = tab === 'desktop' ? setDesktop : setMobile;

  const setPos = (pos: Position) => setActive({ ...active, pos });
  const setScale = (scale: number) => setActive({ ...active, scale });

  // ESC pra fechar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Ajustar Logo — {contentTitle}</h3>
            <p className="text-xs text-white/40">Arraste pra posicionar · use o slider pro tamanho · desktop e celular separados</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none px-2">&times;</button>
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
            <DraggableLogoPreview
              logoUrl={logoUrl}
              backdropUrl={backdropUrl}
              position={desktop.pos}
              scale={desktop.scale}
              onChange={setPos}
              aspectRatio="16/7"
              label="Como aparece no desktop / tablet"
            />
          ) : (
            <div className="flex justify-center">
              <DraggableLogoPreview
                logoUrl={logoUrl}
                backdropUrl={backdropUrl}
                position={mobile.pos}
                scale={mobile.scale}
                onChange={setPos}
                aspectRatio="9/16"
                width="300px"
                label="Como aparece no celular"
                isMobile
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-t border-white/10 space-y-3">
          {/* Scale slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/40 uppercase tracking-wider">Tamanho</span>
              <span className="text-xs text-white/60 font-mono">{active.scale}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={5}
                value={active.scale}
                onChange={(e) => setScale(parseInt(e.target.value, 10))}
                className="flex-1 accent-primary-500"
              />
              <button
                type="button"
                onClick={() => setScale(100)}
                className="text-[10px] text-white/40 hover:text-white/70 uppercase tracking-wider"
              >
                reset
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-white/30 mr-1">Atalhos:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPos({ x: p.x, y: p.y })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  Math.abs(active.pos.x - p.x) < 5 && Math.abs(active.pos.y - p.y) < 5
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
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-all"
            >
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
