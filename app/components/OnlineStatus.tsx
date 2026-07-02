'use client';

import type { User } from '../lib/types';

interface OnlineStatusProps {
  host: User;
  guest: User;
  isVisible: boolean;
}

export function OnlineStatus({ host, guest, isVisible }: OnlineStatusProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] left-[max(1.5rem,env(safe-area-inset-left,1.5rem))] flex flex-col gap-2 text-left pointer-events-none z-110 border border-dashed border-border bg-background/40 backdrop-blur-md p-3">
      {/* Host */}
      <div className={`flex items-center gap-2 transition-opacity duration-500 ${host.name ? 'opacity-100' : 'opacity-0'}`}>
        <div
          className={`w-[7px] h-[7px] rounded-full shrink-0 ${
            host.status === 'online'
              ? 'bg-accent shadow-[0_0_8px_var(--accent)]'
              : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'
          }`}
        />
        <div className="text-[clamp(0.65rem,2vw,0.8rem)] tracking-[0.12em] text-foreground-secondary/75 uppercase">
          <span>{host.name || 'Host'}</span>{' '}
          <span className="text-foreground-muted">{host.status === 'online' ? '' : 'offline'}</span>
        </div>
      </div>

      {/* Guest */}
      <div className={`flex items-center gap-2 transition-opacity duration-500 ${guest.name ? 'opacity-100' : 'opacity-0'}`}>
        <div
          className={`w-[7px] h-[7px] rounded-full shrink-0 ${
            guest.status === 'online'
              ? 'bg-accent shadow-[0_0_8px_var(--accent)]'
              : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'
          }`}
        />
        <div className="text-[clamp(0.65rem,2vw,0.8rem)] tracking-[0.12em] text-foreground-secondary/75 uppercase">
          <span>{guest.name || 'Gast'}</span>{' '}
          <span className="text-foreground-muted">{guest.status === 'online' ? '' : 'offline'}</span>
        </div>
      </div>
    </div>
  );
}
