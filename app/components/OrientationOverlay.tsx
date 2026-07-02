'use client';

export function OrientationOverlay() {
  return (
    <div className="fixed inset-0 bg-black z-[200] hidden flex-col items-center justify-center text-center p-8 portrait:flex">
      <svg
        className="w-[50px] h-[50px] fill-white mb-6 animate-[rotate_2s_infinite_ease-in-out]"
        viewBox="0 0 24 24"
      >
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
      </svg>
      <p className="text-white">Bitte drehe dein Gerät ins Querformat.</p>
    </div>
  );
}
