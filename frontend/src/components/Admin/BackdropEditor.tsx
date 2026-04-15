'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface BackdropEditorProps {
  imageUrl: string;
  initialPosition?: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onClose: () => void;
  contentTitle?: string;
}

export default function BackdropEditor({
  imageUrl,
  initialPosition = { x: 50, y: 50 },
  onPositionChange,
  onClose,
  contentTitle = 'Título do Filme',
}: BackdropEditorProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setPosition({ x, y });
  }, [isDragging]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleEnd]);

  const handleSave = () => {
    onPositionChange(position);
    onClose();
  };

  const presetPositions = [
    { label: 'Topo', x: 50, y: 20 },
    { label: 'Centro', x: 50, y: 50 },
    { label: 'Baixo', x: 50, y: 80 },
    { label: 'Esquerda', x: 25, y: 50 },
    { label: 'Direita', x: 75, y: 50 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">Ajustar Backdrop</h3>
            <p className="text-sm text-white/50">Arraste na imagem para definir o ponto focal</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Preview simulating the detail page hero */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Desktop preview */}
          <div>
            <span className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Preview Desktop</span>
            <div
              ref={containerRef}
              className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none border border-white/10"
              style={{ aspectRatio: '16/7' }}
              onMouseDown={handleMouseDown}
              onTouchStart={(e) => { setIsDragging(true); }}
            >
              <img
                src={imageUrl}
                alt="Backdrop preview"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ objectPosition: `${position.x}% ${position.y}%` }}
                draggable={false}
              />
              {/* Gradient overlay like the real hero */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />

              {/* Simulated content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
                <div className="inline-flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded text-yellow-400 text-xs font-semibold mb-2">
                  <svg className="w-3 h-3 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  8.5
                </div>
                <h2 className="text-3xl font-black text-white mb-2">{contentTitle}</h2>
                <div className="flex items-center gap-3 text-white/50 text-sm mb-3">
                  <span>2026</span>
                  <span className="border border-white/30 px-1 rounded text-xs">14</span>
                  <span>2h 15min</span>
                  <span className="border border-white/30 px-1 rounded text-xs">FULL HD</span>
                </div>
                <div className="flex gap-3">
                  <div className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-bold">Comprar</div>
                  <div className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm">Salvar</div>
                </div>
              </div>

              {/* Crosshair indicator */}
              <div
                className="absolute w-8 h-8 border-2 border-white rounded-full shadow-lg pointer-events-none transition-all duration-75"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.3)',
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile preview */}
          <div>
            <span className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Preview Mobile</span>
            <div
              className="relative rounded-xl overflow-hidden border border-white/10 mx-auto"
              style={{ width: '280px', aspectRatio: '9/16' }}
            >
              <img
                src={imageUrl}
                alt="Mobile preview"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: `${position.x}% ${position.y}%` }}
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-lg font-black text-white mb-1">{contentTitle}</h3>
                <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                  <span>2026</span><span>14+</span><span>2h 15min</span>
                </div>
                <div className="bg-red-600 text-white text-center py-2 rounded-lg text-xs font-bold">Comprar</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-white/10 space-y-3">
          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-white/40 mr-1">Posição:</span>
            {presetPositions.map((p) => (
              <button
                key={p.label}
                onClick={() => setPosition({ x: p.x, y: p.y })}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  Math.abs(position.x - p.x) < 5 && Math.abs(position.y - p.y) < 5
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="text-xs text-white/30 ml-auto">
              {Math.round(position.x)}% , {Math.round(position.y)}%
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-all"
            >
              Aplicar posição
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
