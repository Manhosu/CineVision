'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'cv_intro_played';

// Total splash window: 5.5s of choreography + 0.6s exit fade.
// The Netflix-style "tudum" jingle is 4.1s and climaxes at the
// end. We start audio at 0.4s so the climax lands at ~4.5s of
// splash time, which is where the logo slam-in resolves.
const INTRO_DURATION_MS = 5500;
const AUDIO_OFFSET_MS = 400;
const ANIMATION_DURATION_S = 5.5;

// Tempo máximo que mantemos a splash esperando window.load. Existe
// pra cobrir casos patológicos (rede que nunca completa, recurso
// pesado pendurado) — depois desse tempo seguimos com a animação
// mesmo que a página não tenha terminado de carregar.
const PAGE_LOAD_TIMEOUT_MS = 10000;

export default function CineVisionIntro() {
  const [visible, setVisible] = useState(false);
  // `started` controla quando começa de fato a contagem dos 5.5s da
  // animação e quando o áudio toca. Fica `false` enquanto a página
  // ainda está carregando — durante esse intervalo a splash já está
  // visível (tela preta cobrindo o paint inicial), mas a coreografia
  // do logo ainda não rodou. Assim a animação inteira acontece com a
  // home já pronta por baixo, sem corte seco no navegador embutido
  // do Telegram.
  const [started, setStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Effect 1: decide se vai mostrar o splash. Roda 1x no mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    setVisible(true);
    sessionStorage.setItem(SESSION_KEY, '1');
  }, []);

  // Effect 2: aguarda a página estar pronta (window.load) antes de
  // iniciar a contagem da animação. Necessário porque no navegador
  // embutido do Telegram a splash entrava ao mesmo tempo em que o
  // chrome do app + a home estavam montando, e o redraw cortava
  // frames da coreografia. Esperar window.load dá a garantia de que
  // a animação inteira acontece com nada mais competindo pela GPU.
  useEffect(() => {
    if (!visible) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const start = () => { if (!cancelled) setStarted(true); };

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }

    // Safety: nunca prender a splash mais que PAGE_LOAD_TIMEOUT_MS.
    const safety = setTimeout(start, PAGE_LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
      clearTimeout(safety);
    };
  }, [visible]);

  // Effect 3: agora que a animação começou de verdade, agenda o
  // hide depois dos 5.5s.
  useEffect(() => {
    if (!started) return;
    const hideTimer = setTimeout(() => setVisible(false), INTRO_DURATION_MS);
    return () => clearTimeout(hideTimer);
  }, [started]);

  // Effect 4: tocar o áudio quando o splash ficar visível. Tem que
  // ser separado do effect de mount porque setVisible(true) é
  // assíncrono — o <audio> só renderiza no re-render seguinte. Ler
  // audioRef.current dentro do mesmo effect dá `null` e a chamada de
  // play() nunca acontece. Também depende de `started` pra que o
  // som só dispare junto com a animação, mantendo sincronia com a
  // batida do "tudum".
  //
  // No mobile: NÃO toca. iOS Safari e Chrome Android bloqueiam
  // autoplay sem gesto prévio. O fallback de "tocar no primeiro
  // toque" funcionava mas dava UX estranha (toca quando o user rola
  // ou clica em qualquer coisa). Igor pediu pra remover do mobile.
  useEffect(() => {
    if (!visible || !started) return;
    if (typeof window === 'undefined') return;
    const isMobile =
      window.matchMedia('(max-width: 768px)').matches ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.7;

    const audioTimer = setTimeout(() => {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        // Se mesmo no desktop o autoplay falhar (extremamente raro
        // em desktop sem engajamento), desiste silenciosamente —
        // sem fallback de listener pra evitar tocar fora do contexto
        // da splash.
        playPromise.catch(() => {});
      }
    }, AUDIO_OFFSET_MS);

    return () => {
      clearTimeout(audioTimer);
    };
  }, [visible, started]);

  // Lock body scroll while the splash is up so the underlying page
  // can't move behind the overlay.
  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.6 } }}
          className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden bg-black"
          aria-hidden="true"
        >
          {/* A coreografia do logo só monta depois que window.load
              dispara — antes disso ficamos só com a tela preta. Sem
              isso, no navegador embutido do Telegram a animação
              cortava frames porque a home estava sendo montada por
              baixo ao mesmo tempo. */}
          {started && <CinematicLogoReveal />}
          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The reveal arc, designed to land beats at the same moments as the
 * Netflix-style "tudum" jingle (audio climax at ~4.5s of splash):
 *
 *   0.0 – 1.6s  Anticipation. Black screen with a faint red ember
 *               pulsing at center, slowly building. Sets the mood.
 *   1.6 – 3.6s  Approach. Logo emerges from depth — starts at ~6%
 *               scale, heavily blurred and over-bright, then zooms
 *               toward the camera as blur clears and brightness
 *               normalises.
 *   3.6 – 4.4s  TUDUM. Logo overshoots to ~118% scale, a white-hot
 *               camera-flash bursts from behind it, and 12 light
 *               streaks fan outward across the screen.
 *   4.4 – 5.0s  Settle. Logo pulls back from the overshoot to its
 *               final 100% scale; flash fades; sustained pulsing
 *               glow takes over the bg.
 *   5.0 – 5.5s  Hold + breath. Subtle scale breathing (1.0→1.03→1.0)
 *               while AnimatePresence stages the exit fade.
 *
 * All sizes are vmin-based so the same animation reads correctly on
 * a 320px phone and a 27" desktop monitor — no separate code paths.
 */
function CinematicLogoReveal() {
  // 12 streaks fanning at 30° increments — denser than a typical
  // 8-streak burst so the TUDUM beat feels like a full radial blast.
  const streakCount = 12;
  const streaks = Array.from({ length: streakCount }, (_, i) => ({
    angle: (360 / streakCount) * i,
    delay: i * 0.018,
  }));

  // Times below are normalized to the 5.5s animation window.
  const D = ANIMATION_DURATION_S;

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* ─── Layer 1: distant ember (anticipation) ──────────────────
          A low-saturation red bloom that grows from a tiny ember to
          a wide field. Heavily blurred so it reads as atmospheric
          rather than as a defined shape. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ scale: 0.05, opacity: 0 }}
        animate={{
          scale: [0.05, 0.4, 1.0, 1.7, 1.5, 1.6],
          opacity: [0, 0.2, 0.55, 0.85, 0.6, 0.7],
        }}
        transition={{
          duration: D,
          times: [0, 0.18, 0.4, 0.7, 0.85, 1],
          ease: 'easeOut',
        }}
        style={{
          width: '120vmin',
          height: '120vmin',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,30,40,0.55) 0%, rgba(180,15,30,0.30) 30%, rgba(80,0,15,0.15) 55%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* ─── Layer 2: TUDUM camera flash ────────────────────────────
          A tight white-hot core that explodes outward at the slam-in
          moment, blooms, then dims. Screen-blended so it adds light
          without darkening the layers below. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 0, 0.4, 1.8, 2.5, 3.0],
          opacity: [0, 0, 0.3, 1, 0.5, 0],
        }}
        transition={{
          duration: D,
          times: [0, 0.6, 0.66, 0.74, 0.82, 0.95],
          ease: 'easeOut',
        }}
        style={{
          width: '70vmin',
          height: '70vmin',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,160,180,0.7) 25%, rgba(255,40,60,0.4) 50%, transparent 70%)',
          filter: 'blur(40px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* ─── Layer 3: 12-streak light burst ─────────────────────────
          Each streak is a thin slash that originates at the logo
          center and fans outward as the camera-flash breaks. Tiny
          per-streak delay makes the burst feel like a sweep rather
          than a single instantaneous blast. */}
      {streaks.map(({ angle, delay }) => (
        <motion.div
          key={angle}
          className="pointer-events-none absolute"
          style={{
            width: '140vmax',
            height: '2.5px',
            transformOrigin: '50% 50%',
            rotate: `${angle}deg`,
            mixBlendMode: 'screen',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 0, 1, 1.05], opacity: [0, 0, 0.9, 0] }}
          transition={{
            duration: D,
            times: [0, 0.66, 0.78, 0.95],
            ease: [0.16, 1, 0.3, 1],
            delay,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,80,80,0) 35%, rgba(255,255,255,1) 50%, rgba(255,80,80,0) 65%, transparent 100%)',
              filter: 'blur(0.8px)',
            }}
          />
        </motion.div>
      ))}

      {/* ─── Layer 4: backing glow under logo (sustained) ───────────
          Sits behind the logo from the moment it lands, breathes
          gently through the hold phase. Gives the logo the "neon
          sign" feel after the burst is gone. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{
          scale: [0.6, 0.6, 1.05, 1.2, 1.1, 1.18, 1.1],
          opacity: [0, 0, 0.5, 0.65, 0.45, 0.55, 0.4],
        }}
        transition={{
          duration: D,
          times: [0, 0.65, 0.74, 0.82, 0.88, 0.95, 1],
          ease: 'easeOut',
        }}
        style={{
          width: 'clamp(280px, 75vmin, 720px)',
          height: 'clamp(220px, 55vmin, 540px)',
          borderRadius: '40%',
          background:
            'radial-gradient(ellipse, rgba(255,40,60,0.55) 0%, rgba(180,10,30,0.3) 40%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* ─── Layer 5: the hero — CINEVT.png logo ────────────────────
          Comes in from depth, blurred and over-bright, then resolves
          to its rest scale with an overshoot at the TUDUM beat.
          Subtle breathing sustains it during the hold phase.
          The inline `style` MUST match the Framer Motion `initial`
          values exactly (scale, opacity, filter). Otherwise on slower
          devices (mobile, low-end Android) the logo paints once at
          full size with the rest filter before hydration runs and
          Framer Motion takes over — that's the "flash of old logo"
          users reported on mobile. With the initial inlined, the very
          first paint is already at scale 0.06 / opacity 0 / blurred. */}
      <motion.img
        src="/CINEVT.png"
        alt=""
        draggable={false}
        className="relative z-10 select-none"
        style={{
          width: 'clamp(260px, 60vmin, 720px)',
          height: 'auto',
          opacity: 0,
          transform: 'scale(0.06)',
          filter: 'blur(40px) brightness(3)',
          willChange: 'transform, opacity, filter',
        }}
        initial={{
          scale: 0.06,
          opacity: 0,
          filter: 'blur(40px) brightness(3) drop-shadow(0 0 0 rgba(0,0,0,0))',
        }}
        animate={{
          scale: [
            0.06,  // 0%   - far away pinpoint
            0.18,  // 18%  - emerging through fog
            0.55,  // 40%  - clear of approach blur
            1.18,  // 74%  - TUDUM overshoot
            0.98,  // 82%  - small rebound past target
            1.0,   // 88%  - settle
            1.03,  // 94%  - breath in
            1.0,   // 100% - rest
          ],
          opacity: [0, 0.25, 0.85, 1, 1, 1, 1, 1],
          filter: [
            'blur(40px) brightness(3) drop-shadow(0 0 0 rgba(0,0,0,0))',
            'blur(22px) brightness(2.2) drop-shadow(0 0 12px rgba(255,40,60,0.3))',
            'blur(6px) brightness(1.6) drop-shadow(0 0 22px rgba(255,40,60,0.5))',
            'blur(0px) brightness(1.4) drop-shadow(0 0 36px rgba(255,180,180,0.85))',
            'blur(0px) brightness(1.05) drop-shadow(0 0 24px rgba(255,40,60,0.55))',
            'blur(0px) brightness(1.0) drop-shadow(0 0 18px rgba(255,40,60,0.45))',
            'blur(0px) brightness(1.08) drop-shadow(0 0 22px rgba(255,40,60,0.5))',
            'blur(0px) brightness(1.0) drop-shadow(0 0 18px rgba(255,40,60,0.45))',
          ],
        }}
        transition={{
          duration: D,
          times: [0, 0.18, 0.4, 0.74, 0.82, 0.88, 0.94, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
      />
    </div>
  );
}
