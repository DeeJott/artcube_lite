'use client';

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StartScreen } from './components/StartScreen';
import { FinalUI } from './components/FinalUI';
import { Timer } from './components/Timer';
import { OnlineStatus } from './components/OnlineStatus';
import { OrientationOverlay } from './components/OrientationOverlay';
import { ExperienceBar } from './components/ExperienceBar';
import { usePeerJS } from './hooks/usePeerJS';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { EXPERIENCES, DEFAULT_EXPERIENCE_ID } from './experiences';
import type { User, PeerMessage } from './lib/types';
import type { ExperienceRendererAPI } from './lib/experience-types';

function ArtCubeApp() {
  const searchParams = useSearchParams();

  // Session state
  const urlSessionId = searchParams.get('sid');
  const [sessionId] = useState(() => urlSessionId || `artcube-${Math.random().toString(36).substring(2, 8)}`);
  const [isHost] = useState(() => !urlSessionId);
  const [myName, setMyName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [host, setHost] = useState<User>({ name: 'Host', status: 'offline' });
  const [guest, setGuest] = useState<User>({ name: 'Gast', status: 'offline' });

  // Experience selection
  const [selectedExperienceId, setSelectedExperienceId] = useState(DEFAULT_EXPERIENCE_ID);
  const selectedExperience = useMemo(
    () => EXPERIENCES.find((e) => e.id === selectedExperienceId) ?? EXPERIENCES[0],
    [selectedExperienceId]
  );

  // Experience lifecycle state
  const [isRunning, setIsRunning] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const shellStartTimeRef = useRef<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string>('');
  const [showFinalUI, setShowFinalUI] = useState(false);
  const [fadeOverlay, setFadeOverlay] = useState(false);

  // Audio reactive state (passed to experience component)
  const [lastBeatTime, setLastBeatTime] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1000);
  }, []);

  // Experience bridge refs — populated by callbacks the experience component calls
  const experienceRendererRef = useRef<ExperienceRendererAPI | null>(null);
  const flareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const needsStartRef = useRef(false);

  const handleCanvasesReady = useCallback((flare: HTMLCanvasElement, star: HTMLCanvasElement) => {
    flareCanvasRef.current = flare;
    starCanvasRef.current = star;
  }, []);

  const handleRendererReady = useCallback((api: ExperienceRendererAPI) => {
    experienceRendererRef.current = api;
  }, []);

  // Hooks
  const { isRecording, startRecording, stopRecording } = useMediaRecorder();
  const { start: startAudio, update: updateAudio, suspend: suspendAudio } = useAudioEngine();

  const { sendInteraction, sendStartExperience, sendSyncTime } = usePeerJS({
    sessionId,
    isHost,
    myName,
    onMessage: (data: PeerMessage) => {
      if (data.type === 'STATUS' && data.name && data.role) {
        if (data.role === 'host') {
          setHost({ name: data.name, status: data.status || 'offline' });
        } else if (data.role === 'guest') {
          setGuest({ name: data.name, status: data.status || 'offline' });
        }
      }
      if (data.type === 'START_EXPERIENCE') {
        startExperience(true, data.elapsed || 0);
      }
      if (data.type === 'SYNC_TIME' && data.elapsed !== undefined) {
        // Sync time from host
      }
      if (data.type === 'INTERACTION') {
        experienceRendererRef.current?.handlePeerMessage?.(data);
      }
    },
  });

  // Generic sendInteraction wrapper for the experience component
  const handleSendInteraction = useCallback((kind: string, data: Record<string, unknown>) => {
    sendInteraction(kind as 'SHOOTING_STAR' | 'NEBULA_GAS', data as Parameters<typeof sendInteraction>[1]);
  }, [sendInteraction]);

  // Upload video to Cloudinary
  const uploadVideo = useCallback(async (blob: Blob) => {
    setUploadStatus('uploading');

    try {
      const safeName = myName.replace(/[^a-z0-9]/gi, '_') || 'guest';
      const publicId = `${sessionId}_${safeName}`;
      const timestamp = Math.round(new Date().getTime() / 1000);

      // Get signed upload params
      const signRes = await fetch('/api/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId, timestamp }),
      });

      if (!signRes.ok) {
        throw new Error('Failed to get upload signature');
      }

      const { signature, apiKey, cloudName, uploadPreset } = await signRes.json();

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('upload_preset', uploadPreset);
      formData.append('public_id', publicId);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await uploadRes.json();

      if (!uploadRes.ok || !data.secure_url) {
        throw new Error(data.error?.message || 'Upload failed');
      }

      setUploadStatus('success');
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      setUploadError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [myName, sessionId]);

  // Animation loop — audio, elapsed tracking, recording, end detection
  useEffect(() => {
    if (!isRunning) return;

    let rafId: number;
    const loop = () => {
      const { intensity: audioIntensity, threshold, bands } = updateAudio();
      setIntensity(audioIntensity);
      setBass(bands.bass);
      setMid(bands.mid);
      setTreble(bands.treble);
      if (audioIntensity > threshold) setLastBeatTime(performance.now());

      if (shellStartTimeRef.current) {
        const newElapsed = (performance.now() - shellStartTimeRef.current) / 1000;
        setElapsed(newElapsed);
        elapsedRef.current = newElapsed;

        const recordingStart = selectedExperience.duration - 10;
        const endTime = selectedExperience.duration;

        if (newElapsed >= recordingStart && newElapsed < endTime && !isRecording && flareCanvasRef.current && starCanvasRef.current) {
          startRecording(flareCanvasRef.current, starCanvasRef.current);
        }

        if (newElapsed >= endTime && !showFinalUI) {
          setShowFinalUI(true);
          setFadeOverlay(true);
          if (isRecording) {
            stopRecording().then((blob) => { if (blob) uploadVideo(blob); });
            suspendAudio();
          }
        }
      }

      if (isHost && Math.floor(elapsed) % 5 === 0) {
        sendSyncTime(elapsed);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning, isRecording, elapsed, isHost, selectedExperience, updateAudio, suspendAudio, startRecording, stopRecording, sendSyncTime, showFinalUI, uploadVideo]);

  // Start experience
  const startExperience = useCallback(async (asGuest = false, initialElapsed = 0) => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen) {
        await (el as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
      }
    } catch {
      // Ignore fullscreen errors
    }

    setShowStartScreen(false);
    await startAudio();

    shellStartTimeRef.current = performance.now();
    experienceRendererRef.current?.start();

    setIsRunning(true);

    if (!asGuest) {
      sendStartExperience(initialElapsed);
    }
  }, [startAudio, sendStartExperience]);

  // Handle join
  const handleJoin = useCallback(() => {
    setIsJoined(true);
    if (isHost) {
      setHost({ name: myName, status: 'online' });
    } else {
      setGuest({ name: myName, status: 'online' });
    }
  }, [isHost, myName]);

  // Handle restart & exit
  const handleRestart = useCallback(() => {
    window.location.reload();
  }, []);

  const handleExitToStart = useCallback(() => {
    setIsRunning(false);
    setShowStartScreen(true);
    setShowFinalUI(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const showParentExperienceBar = isRunning && !showStartScreen && !showFinalUI && selectedExperienceId !== 'sakura';

  // Handle switching experience during runtime
  const handleSwitchExperience = useCallback((newId: string) => {
    if (newId === selectedExperienceId) return;
    if (isRecording) {
      stopRecording();
    }
    setElapsed(0);
    elapsedRef.current = 0;
    setFadeOverlay(false);
    setShowFinalUI(false);
    setSelectedExperienceId(newId);
    needsStartRef.current = true;
  }, [selectedExperienceId, isRecording, stopRecording]);

  // Start newly switched experience after component mounts
  useEffect(() => {
    if (needsStartRef.current && isRunning) {
      needsStartRef.current = false;
      shellStartTimeRef.current = performance.now();
      const id = setTimeout(() => {
        experienceRendererRef.current?.start();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [selectedExperienceId, isRunning]);

  // Handle exit — stop experience and return to start screen
  const handleExit = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    suspendAudio();
    setIsRunning(false);
    setShowFinalUI(false);
    setFadeOverlay(false);
    setElapsed(0);
    elapsedRef.current = 0;
    shellStartTimeRef.current = null;
    setShowStartScreen(true);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isRecording, stopRecording, suspendAudio]);

  const mintUrl = `https://art-box-beta.vercel.app/mint?nft=${sessionId}_${myName.replace(/[^a-z0-9]/gi, '_') || 'guest'}`;
  const hudText = isRunning && elapsed < selectedExperience.duration
    ? (selectedExperience.getHUDText?.(elapsed) ?? null)
    : null;
  const ExperienceComponent = selectedExperience.Component;

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden flex items-center justify-center">
      {/* Fade Overlay */}
      <div
        className={`fixed inset-0 bg-black z-200 pointer-events-none transition-opacity duration-3000 ${fadeOverlay ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Orientation Overlay */}
      <OrientationOverlay />

      {/* Timer */}
      <Timer elapsed={elapsed} isVisible={isRunning} />

      {/* Exit button — visible during experience */}
      {isRunning && !showStartScreen && !showFinalUI && (
        <button
          onClick={handleExit}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 border border-dashed border-border bg-background/60 backdrop-blur-md text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors duration-300 text-xs tracking-[0.14em] uppercase font-light cursor-pointer"
        >
          <span className="text-base leading-none">&times;</span>
          <span>Exit</span>
        </button>
      )}

      {/* Action HUD — text comes from the active experience definition */}
      {hudText && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10 select-none animate-pulse">
          <p className="text-[10px] md:text-xs tracking-[0.25em] text-foreground-secondary/60 uppercase font-light">
            {hudText}
          </p>
        </div>
      )}

      {/* Online Status */}
      <OnlineStatus host={host} guest={guest} isVisible={isRunning && isJoined} />

      {/* Start Screen */}
      <StartScreen
        isVisible={showStartScreen}
        isHost={isHost}
        sessionId={sessionId}
        myName={myName}
        onNameChange={setMyName}
        onJoin={handleJoin}
        onStart={() => startExperience(false, 0)}
        isJoined={isJoined}
        experiences={EXPERIENCES}
        selectedExperienceId={selectedExperienceId}
        onSelectExperience={setSelectedExperienceId}
      />

      {/* Final UI */}
      <FinalUI
        isVisible={showFinalUI}
        uploadStatus={uploadStatus}
        mintUrl={mintUrl}
        errorMessage={uploadError}
        onRestart={handleRestart}
      />



      {showParentExperienceBar && (
        <ExperienceBar
          experiences={EXPERIENCES}
          selectedId={selectedExperienceId}
          onSelect={handleSwitchExperience}
        />
      )}

      {/* Active experience canvas */}
      <ExperienceComponent
        key={selectedExperienceId}
        isRunning={isRunning}
        elapsed={elapsed}
        elapsedRef={elapsedRef}
        intensity={intensity}
        bass={bass}
        mid={mid}
        treble={treble}
        lastBeatTime={lastBeatTime}
        isMobile={isMobile}
        isRecording={isRecording}
        isHost={isHost}
        myName={myName}
        sendInteraction={handleSendInteraction}
        onCanvasesReady={handleCanvasesReady}
        onRendererReady={handleRendererReady}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="w-screen h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-foreground-secondary/60 text-sm tracking-widest">LOADING...</div>
      </div>
    }>
      <ArtCubeApp />
    </Suspense>
  );
}
