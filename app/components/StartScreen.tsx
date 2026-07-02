'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ExperienceSwitcher } from './ExperienceSwitcher';
import type { ExperienceDefinition } from '../lib/experience-types';
import { LuBox } from 'react-icons/lu';
import WalletUnavailableModal from './WalletUnavailableModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StartScreenProps {
  isVisible: boolean;
  isHost: boolean;
  sessionId: string;
  myName: string;
  onNameChange: (name: string) => void;
  onJoin: () => void;
  onStart: () => void;
  isJoined: boolean;
  experiences?: ExperienceDefinition[];
  selectedExperienceId?: string;
  onSelectExperience?: (id: string) => void;
}

export function StartScreen({
  isVisible,
  isHost,
  sessionId,
  myName,
  onNameChange,
  onJoin,
  onStart,
  isJoined,
  experiences,
  selectedExperienceId,
  onSelectExperience,
}: StartScreenProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.href.split('?')[0];
      setShareUrl(`${baseUrl}?sid=${sessionId}`);
    }
  }, [sessionId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      prompt('Link für den Gast (manuell kopieren):', shareUrl);
    }
  }, [shareUrl]);

  const handlePrimaryAction = useCallback(() => {
    if (!myName.trim()) {
      setShowValidation(true);
      setTimeout(() => setShowValidation(false), 1200);
      return;
    }
    if (!isJoined) {
      onJoin();
    }
    if (isHost) {
      onStart();
    }
  }, [myName, isJoined, isHost, onJoin, onStart]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] overflow-hidden text-center text-foreground",
        "bg-background transition-opacity duration-[2000ms]",
        !isVisible && "opacity-0 pointer-events-none"
      )}
    >
      <div className="absolute inset-0 opacity-60 pointer-events-none art-cube-noise" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none art-cube-grid" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,rgba(255,94,0,0.24),transparent_34%),linear-gradient(to_top,var(--background)_0%,transparent_46%,var(--background)_100%)]" />

      <header className="fixed top-0 left-0 right-0 z-10 h-12 border-b border-dashed backdrop-blur-md bg-header-bg border-border">
        <div className="grid grid-cols-12 h-full">
          <div className="hidden md:flex col-span-4 items-center h-full">
            <a href="https://art-box-landing.vercel.app/" target="_blank" rel="noopener noreferrer" className="h-full px-8 flex items-center border-r border-dashed border-border text-xs font-medium tracking-wide text-header-text hover:text-header-text-hover transition-colors duration-300">
              THE EXPERIENCE
            </a>
          </div>
          <div className="col-span-8 md:col-span-4 flex items-center justify-center h-full">
            <div className="font-semibold text-xl tracking-tight whitespace-nowrap flex items-center gap-2 text-foreground">
              <LuBox className="w-7 h-7 relative transition-all duration-300" strokeWidth={1.5} />
              ART.CUBE
            </div>
          </div>
          <div className="col-span-4 flex items-center justify-end h-full">
            <div
              onClick={() => setWalletModalOpen(true)}
              className="hidden md:flex h-full px-8 items-center justify-center gap-2 bg-accent text-accent-foreground text-xs font-medium tracking-wide cursor-pointer hover:bg-accent-hover transition-colors duration-300"
            >
              <span>CONNECT WALLET</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-1 min-h-screen pt-16 flex items-center justify-center px-4 sm:px-6 py-24">
        <div className="w-full max-w-7xl grid grid-cols-12 items-center gap-6 lg:gap-10">
          <div className="col-span-12 lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md border mb-8 bg-white/5 border-white/10">
              <span className="w-2 h-2 rounded-full animate-pulse bg-accent" />
              <span className="text-white/80 text-xs sm:text-sm font-light tracking-widest uppercase">The interactive ART.CUBE demo</span>
              <span className="w-2 h-2 rounded-full animate-pulse bg-accent" />
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-thin tracking-tighter text-white mb-6 leading-none uppercase mix-blend-overlay opacity-90">
              Transform <span className="font-bold">motion</span> into<br />
              <span className="font-bold tracking-tight">digital art</span>
            </h1>

            <p className="max-w-2xl text-base sm:text-lg md:text-2xl text-white/80 font-thin leading-relaxed drop-shadow-lg">
              A digital twin of the ART.CUBE installation. Preview the experiences that await inside the physical cube — touch, drag, and interact with the projections just as you would on the four walls. Your movements become art.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-5 text-left px-10">
            <div className="relative overflow-hidden border border-dashed border-border bg-background-secondary/50 backdrop-blur-md shadow-2xl">
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none art-cube-grid" />
              <div className="relative p-5 sm:p-8 flex flex-col gap-5">

                {experiences && selectedExperienceId && onSelectExperience && (
                  <ExperienceSwitcher
                    experiences={experiences}
                    selectedId={selectedExperienceId}
                    disabled={isJoined}
                    onSelect={onSelectExperience}
                  />
                )}

                <input
                  type="text"
                  value={myName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="ENTER YOUR NAME"
                  maxLength={15}
                  disabled={isJoined}
                  className={cn(
                    "w-full bg-background/60 border border-dashed border-border text-foreground px-4 py-4 text-sm tracking-[0.14em] text-center uppercase",
                    "outline-none placeholder:text-foreground-muted hover:border-border-hover focus:border-accent",
                    "transition-colors duration-300 disabled:opacity-60",
                    showValidation && "border-red-400/70"
                  )}
                />

                {isHost && (
                  <label className="flex items-center justify-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shareEnabled}
                      onChange={(e) => setShareEnabled(e.target.checked)}
                      className="w-4 h-4 accent-accent cursor-pointer"
                    />
                    <span className="text-foreground-secondary text-xs tracking-[0.14em] uppercase">
                      Share session
                    </span>
                  </label>
                )}

                {isHost && shareEnabled && (
                  <div className="p-4 bg-background-elevated border border-dashed border-border">
                    <small className="text-foreground-muted text-[0.65rem] block mb-3 uppercase tracking-widest">
                      Lade jemanden ein:
                    </small>
                    <button
                      onClick={handleCopy}
                      className="text-accent text-[0.75rem] break-all cursor-pointer underline bg-transparent border-none font-sans hover:text-accent-hover"
                    >
                      {copied ? 'KOPIERT!' : 'Link kopieren'}
                    </button>
                    <small className="text-accent/60 text-[0.6rem] block mt-3 break-all leading-relaxed font-mono">
                      {shareUrl}
                    </small>
                  </div>
                )}

                <button
                  onClick={handlePrimaryAction}
                  className="art-cube-primary-button w-full cursor-pointer border-none"
                >
                  <span>
                    {isHost
                      ? (shareEnabled ? 'Start Shared Experience' : 'Start Experience')
                      : 'Join Session'}
                  </span>
                </button>

                {!isHost && isJoined && (
                  <p className="text-foreground-secondary/70 text-xs tracking-[0.14em] text-center uppercase">
                    Warte auf den Host...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <WalletUnavailableModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
