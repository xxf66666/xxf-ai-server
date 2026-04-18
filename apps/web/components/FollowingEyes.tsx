'use client';

import { useEffect, useRef, useState } from 'react';

// Pair of cartoon eyes with three layers of personality:
//   1. pupils track the cursor (same as before)
//   2. when cursor is still for 1.5 s, eyes drift along a gentle
//      Lissajous curve so the page never feels frozen
//   3. both blink together every 4-8 s, and pupils dilate a bit when
//      the cursor is close enough to feel "interested"
export function FollowingEyes({ size = 120 }: { size?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [offsets, setOffsets] = useState<Array<{ x: number; y: number; scale: number }>>([
    { x: 0, y: 0, scale: 1 },
    { x: 0, y: 0, scale: 1 },
  ]);
  const [blinking, setBlinking] = useState(false);
  const mouseRef = useRef<{ x: number; y: number; lastMoveTs: number }>({
    x: -1,
    y: -1,
    lastMoveTs: 0,
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, lastMoveTs: performance.now() };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const el = containerRef.current;
      if (el) {
        const eyes = Array.from(el.querySelectorAll<HTMLElement>('[data-eye]'));
        const { x: mx, y: my, lastMoveTs } = mouseRef.current;
        const idle = t - lastMoveTs > 1500 || mx < 0;

        const next = eyes.map((eye, i) => {
          const rect = eye.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const max = rect.width * 0.22;
          if (idle) {
            // Each eye rides a slightly different Lissajous phase so they
            // don't look like one synchronized robot.
            const speed = 0.0004;
            const ax = Math.cos(t * speed + i * 0.8);
            const ay = Math.sin(t * speed * 1.3 + i * 0.8);
            return { x: ax * max * 0.6, y: ay * max * 0.5, scale: 1 };
          }
          const dx = mx - cx;
          const dy = my - cy;
          const angle = Math.atan2(dy, dx);
          const euclid = Math.hypot(dx, dy);
          const dist = Math.min(euclid / 6, max);
          // Pupil dilation: gradually bigger within ~400 px.
          const closeness = Math.max(0, 1 - euclid / 400);
          const scale = 1 + closeness * 0.28;
          return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale };
        });
        setOffsets(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Blink scheduler: 4-8 s between blinks, ~140 ms closure each. Recursive
  // setTimeout (not setInterval) so we can randomize every cycle.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 4000 + Math.random() * 4000;
      timer = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 140);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const pupilSize = size * 0.42;
  const highlightSize = pupilSize * 0.25;

  return (
    <div ref={containerRef} className="flex gap-4 select-none">
      {[0, 1].map((i) => {
        const off = offsets[i] ?? { x: 0, y: 0, scale: 1 };
        return (
          <div
            key={i}
            data-eye
            className="relative overflow-hidden rounded-full border-[3px] border-foreground bg-white shadow-lg"
            style={{
              width: size,
              height: size,
              transform: blinking ? 'scaleY(0.08)' : 'scaleY(1)',
              transition: 'transform 140ms cubic-bezier(0.2, 0.9, 0.25, 1)',
              willChange: 'transform',
            }}
          >
            <div
              className="absolute rounded-full bg-foreground"
              style={{
                width: pupilSize,
                height: pupilSize,
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) scale(${off.scale})`,
                transition: 'transform 120ms ease-out',
                willChange: 'transform',
              }}
            />
            <div
              className="absolute rounded-full bg-white/80"
              style={{
                width: highlightSize,
                height: highlightSize,
                left: `calc(34% + ${off.x * 0.35}px)`,
                top: `calc(30% + ${off.y * 0.35}px)`,
                transition: 'left 120ms ease-out, top 120ms ease-out',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
