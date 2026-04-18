'use client';

import { useEffect, useRef, useState } from 'react';

// Pair of cartoon eyes whose pupils track the mouse cursor. Inspired by
// Mimo's landing page — a cheap "this page has personality" signal that
// reads well at any font size and degrades to static circles without JS.
export function FollowingEyes({ size = 120 }: { size?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [offsets, setOffsets] = useState<Array<{ x: number; y: number }>>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      const eyes = Array.from(el.querySelectorAll<HTMLElement>('[data-eye]'));
      const next = eyes.map((eye) => {
        const rect = eye.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const max = rect.width * 0.22; // how far the pupil can slide
        const angle = Math.atan2(dy, dx);
        const dist = Math.min(Math.hypot(dx, dy) / 6, max);
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
      });
      setOffsets(next);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const pupilSize = size * 0.42;

  return (
    <div ref={containerRef} className="flex gap-4 select-none">
      {[0, 1].map((i) => (
        <div
          key={i}
          data-eye
          className="relative rounded-full border-[3px] border-foreground bg-white shadow-lg"
          style={{ width: size, height: size }}
        >
          <div
            className="absolute rounded-full bg-foreground"
            style={{
              width: pupilSize,
              height: pupilSize,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${offsets[i]?.x ?? 0}px, ${offsets[i]?.y ?? 0}px)`,
              transition: 'transform 80ms ease-out',
            }}
          />
          {/* tiny highlight dot */}
          <div
            className="absolute rounded-full bg-white/80"
            style={{
              width: pupilSize * 0.25,
              height: pupilSize * 0.25,
              left: '34%',
              top: '30%',
            }}
          />
        </div>
      ))}
    </div>
  );
}
