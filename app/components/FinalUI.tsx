'use client';

import { useState, useEffect } from 'react';

interface FinalUIProps {
  isVisible: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  mintUrl: string;
  errorMessage?: string;
  onRestart: () => void;
}

export function FinalUI({
  isVisible,
  uploadStatus,
  mintUrl,
  errorMessage,
  onRestart,
}: FinalUIProps) {
  const [showAutoRestart, setShowAutoRestart] = useState(false);

  useEffect(() => {
    if (uploadStatus === 'success') {
      const timer = setTimeout(() => {
        setShowAutoRestart(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);

  useEffect(() => {
    if (showAutoRestart) {
      const timer = setTimeout(() => {
        onRestart();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showAutoRestart, onRestart]);

  if (!isVisible) return null;

  const getTitle = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'WIRD VERARBEITET...';
      case 'success':
        return 'DEIN SOUVENIR IST BEREIT';
      case 'error':
        return 'FEHLER BEIM UPLOAD';
      default:
        return 'DEIN SOUVENIR IST BEREIT';
    }
  };

  const getSubtitle = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Dein Souvenir wird hochgeladen, bitte warten.';
      case 'success':
        return 'Deine Reise durch die Sterne wurde festgehalten.';
      case 'error':
        return `Upload fehlgeschlagen: ${errorMessage || 'Unbekannter Fehler'}`;
      default:
        return 'Deine Reise durch die Sterne wurde festgehalten.';
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-250 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      <div className="absolute inset-0 opacity-60 pointer-events-none art-cube-noise" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none art-cube-grid" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_35%,rgba(255,94,0,0.22),transparent_34%),linear-gradient(to_top,var(--background)_0%,transparent_52%,var(--background)_100%)]" />

      <div className="relative w-full max-w-xl border border-dashed border-border bg-background-secondary/50 backdrop-blur-md p-6 sm:p-10 shadow-2xl">
        <div className="font-mono text-sm uppercase text-foreground-secondary/70 mb-6">
          002 <span className="opacity-50 px-1">///</span> Souvenir
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-thin tracking-tighter text-white mb-5 leading-none uppercase mix-blend-overlay opacity-90">
          {getTitle()}
        </h2>
        <p className="text-foreground-secondary text-sm md:text-base mb-8 max-w-md mx-auto font-light leading-relaxed">
          {getSubtitle()}
        </p>

        {uploadStatus === 'success' && (
          <a
            href={mintUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="art-cube-primary-button cursor-pointer no-underline"
          >
            <span>Jetzt minten</span>
          </a>
        )}

        {uploadStatus === 'error' && (
          <button
            onClick={onRestart}
            className="art-cube-primary-button cursor-pointer border-none"
          >
            <span>Neustart</span>
          </button>
        )}

        <button
          onClick={onRestart}
          className="bg-transparent border-none text-foreground-muted mt-8 cursor-pointer text-xs tracking-[0.18em] uppercase hover:text-foreground-secondary transition-colors"
        >
          Neustart
        </button>

        {showAutoRestart && (
          <p className="text-foreground-muted text-xs mt-4 font-mono">
            Neustart in 2 Sekunden...
          </p>
        )}
      </div>
    </div>
  );
}
