'use client';
import { useEffect, useRef, useState } from 'react';
import { withBase } from '@/lib/base';

// Silent award clip: autoplays muted when on screen, pauses off screen; tap to pause/play.
export default function AwardVideo({ caption, className = '' }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 });
    io.observe(v); return () => io.disconnect();
  }, []);
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  return (
    <figure className={`feature-banner group relative ${className}`}>
      <video ref={ref} className="block aspect-video w-full rounded-[inherit] bg-ink object-cover" style={{ borderRadius: 'clamp(10px,1.6vw,20px)' }}
        src={withBase('/video/iya25-award.mp4')} poster={withBase('/video/iya25-award-poster.webp')}
        muted loop playsInline preload="metadata" width="1024" height="576"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={toggle} aria-label={caption} />
      <button type="button" onClick={toggle} aria-label={playing ? 'pause' : 'play'}
        className={`absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-2xl text-jade shadow-xl transition ${playing ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>▶</button>
      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">🎬 {caption}</span>
    </figure>
  );
}
