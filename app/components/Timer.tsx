'use client';

interface TimerProps {
  elapsed: number;
  isVisible: boolean;
}

export function Timer({ elapsed, isVisible }: TimerProps) {
  if (!isVisible) return null;

  const displayTime = Math.floor(Math.min(60, elapsed));
  const opacity = elapsed < 10 ? (elapsed / 10) * 0.2 : 0.3;

  return (
    <div
      className="absolute top-5 left-1/2 -translate-x-1/2 text-xl tracking-[0.2em] pointer-events-none z-10 font-mono text-accent"
      style={{ opacity }}
    >
      {displayTime}s
    </div>
  );
}
