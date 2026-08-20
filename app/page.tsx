'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SakuraCanvas } from './experiences/sakura/SakuraCanvas';

function SakuraAppContent() {
  const searchParams = useSearchParams();

  // URL Params & Room Setup
  const urlRoom = searchParams.get('room');
  const urlHostName = searchParams.get('hostName');
  const isGuest = Boolean(urlRoom);

  const [roomId] = useState(() => urlRoom || `sakura-${Math.floor(1000 + Math.random() * 9000)}`);
  const [hostName, setHostName] = useState(() => (isGuest && urlHostName ? decodeURIComponent(urlHostName) : 'Host'));
  const [guestName, setGuestName] = useState(() => (isGuest ? 'Gast' : 'Gast'));
  const [myInputName, setMyInputName] = useState('');
  
  const [isGuestJoined, setIsGuestJoined] = useState(isGuest);
  const [isArtworkStarted, setIsArtworkStarted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Copy Invite Link to Clipboard
  const handleCopyInvite = useCallback(() => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}&hostName=${encodeURIComponent(hostName)}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast('🔗 Einladungslink in Zwischenablage kopiert!');
      }).catch(() => {
        showToast(`Link: ${inviteUrl}`);
      });
    } else {
      showToast(`Link: ${inviteUrl}`);
    }
  }, [roomId, hostName, showToast]);

  // Join as Guest
  const handleGuestJoin = useCallback(() => {
    const name = myInputName.trim() || 'Gast';
    setGuestName(name);
    setIsGuestJoined(true);
    showToast(`Willkommen, ${name}! Du bist beigetreten.`);
  }, [myInputName, showToast]);

  // Update Host Name
  const handleHostNameChange = (val: string) => {
    setMyInputName(val);
    setHostName(val.trim() || 'Host');
  };

  // Start Artwork Experience
  const handleStartArtwork = useCallback(() => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    setIsArtworkStarted(true);
  }, []);

  // Exit Artwork Experience (Back to Lobby)
  const handleExitArtwork = useCallback(() => {
    setIsArtworkStarted(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#08000c] select-none font-sans text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#120c1c]/90 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full border border-[#4ee2ec]/60 backdrop-blur-md shadow-[0_8px_25px_rgba(0,0,0,0.5)] animate-pulse z-50 pointer-events-none uppercase">
          {toastMessage}
        </div>
      )}

      {/* Mode 1: Full 3D Sakura Artwork Experience */}
      {isArtworkStarted ? (
        <SakuraCanvas
          isRunning={true}
          elapsed={0}
          elapsedRef={{ current: 0 }}
          intensity={0}
          bass={0}
          mid={0}
          treble={0}
          lastBeatTime={0}
          isMobile={false}
          isRecording={false}
          isHost={!isGuest}
          myName={isGuest ? guestName : hostName}
          sendInteraction={() => {}}
          onCanvasesReady={() => {}}
          onRendererReady={() => {}}
          onExit={handleExitArtwork}
        />
      ) : (
        /* Mode 2: Native Sakura V3 Glassmorphic Start Screen Lobby */
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-gradient-to-b from-[#08000c] via-[#12051a] to-[#08000c] z-40">
          <div className="w-full max-w-md bg-[#120c1c]/85 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-6">
            
            {/* Header Brand */}
            <div className="text-center flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-[4px] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-200 to-pink-500 drop-shadow-[0_0_20px_rgba(255,42,157,0.7)]">
                Sakura: Reborn
              </h1>
              <p className="text-[11px] font-medium tracking-[2.5px] uppercase text-pink-200/70">
                Collaborative Artwork Experience
              </p>
            </div>

            {/* Form & Setup */}
            <div className="flex flex-col gap-4">
              {/* Host Name Input */}
              {!isGuest ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-pink-200/80 uppercase">
                    Dein Name (Host)
                  </label>
                  <input
                    type="text"
                    value={myInputName}
                    onChange={(e) => handleHostNameChange(e.target.value)}
                    placeholder="Dein Name"
                    maxLength={18}
                    className="w-full bg-black/50 border border-pink-500/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-400 transition-all placeholder:text-white/30"
                  />
                </div>
              ) : (
                /* Guest Name Input */
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wider text-pink-200/80 uppercase">
                    Dein Name (Gast)
                  </label>
                  <input
                    type="text"
                    value={myInputName}
                    onChange={(e) => setMyInputName(e.target.value)}
                    placeholder="Dein Name"
                    maxLength={18}
                    className="w-full bg-black/50 border border-pink-500/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-400 transition-all placeholder:text-white/30"
                  />
                </div>
              )}

              {/* Invite Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-[11px] font-semibold tracking-wider text-pink-200/80 uppercase">
                  Session & Mitspieler
                </span>
                {!isGuest ? (
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="w-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 hover:from-pink-500/40 hover:to-purple-500/40 border border-pink-400/40 rounded-xl py-3 px-4 text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>🔗 Einladungslink kopieren</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGuestJoin}
                    className={`w-full border rounded-xl py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                      isGuestJoined
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                        : 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 hover:from-cyan-500/50 hover:to-blue-500/50 border-cyan-400/50 text-white'
                    }`}
                  >
                    <span>{isGuestJoined ? '✅ Beigetreten' : '✨ Beitreten'}</span>
                  </button>
                )}
              </div>

              {/* Participants Status List */}
              <div className="flex flex-col gap-2 bg-black/40 border border-white/10 rounded-2xl p-3.5 mt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                    <span className="font-medium text-white/90">{hostName} (Host)</span>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">Bereit</span>
                </div>

                <div className="w-full h-[1px] bg-white/10" />

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isGuestJoined ? 'bg-pink-400 shadow-[0_0_8px_#ff66cc]' : 'bg-white/30'}`} />
                    <span className={`font-medium ${isGuestJoined ? 'text-white/90' : 'text-white/40'}`}>
                      {guestName} (Gast)
                    </span>
                  </div>
                  <span className={`text-[10px] uppercase font-semibold tracking-wider ${isGuestJoined ? 'text-emerald-400' : 'text-white/40'}`}>
                    {isGuestJoined ? 'Bereit (Verbunden)' : 'Warte auf Beitritt...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartArtwork}
              className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_30px_rgba(255,42,157,0.5)] transition-all transform hover:scale-[1.02] text-xs uppercase tracking-[2px] cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <span>✨ Kunstwerk starten</span>
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="w-screen h-screen bg-[#08000c] flex items-center justify-center">
        <div className="font-mono text-pink-400/80 text-sm tracking-widest animate-pulse">SAKURA: REBORN LOADING...</div>
      </div>
    }>
      <SakuraAppContent />
    </Suspense>
  );
}
