// Audio engine hook with beat detection for art.cube

'use client';

import { useRef, useCallback, useState } from 'react';
import { AUDIO } from '../lib/constants';

export interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
  intensity: number;
}

interface AudioEngineState {
  intensity: number;
  isActive: boolean;
  bands: AudioBands;
}

export function useAudioEngine() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArrayRef = useRef<any>(null);
  const intensityRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const energyHistoryRef = useRef<number[]>([]);
  const dynamicThresholdRef = useRef<number>(AUDIO.DEFAULT_THRESHOLD);
  const [state, setState] = useState<AudioEngineState>({ intensity: 0, isActive: false, bands: { bass: 0, mid: 0, treble: 0, intensity: 0 } });

  const start = useCallback(async (audioUrl: string = '/media/Contrasts-Dryhope.mp3') => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = AUDIO.FFT_SIZE;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;

      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      source.start(0);
      sourceRef.current = source;

      setState(prev => ({ ...prev, isActive: true }));
      await audioCtx.resume();

      return true;
    } catch (error) {
      console.error('Audio engine start failed:', error);
      return false;
    }
  }, []);

  const update = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !state.isActive) {
      return { intensity: 0, threshold: AUDIO.DEFAULT_THRESHOLD, bands: { bass: 0, mid: 0, treble: 0, intensity: 0 } };
    }

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    analyser.getByteFrequencyData(dataArray);

    // Split into frequency bands (128 bins for fftSize=256)
    let bassSum = 0, midSum = 0, trebleSum = 0;
    const bassEnd = 6, midEnd = 30, trebleEnd = dataArray.length;
    for (let i = 0; i < bassEnd; i++) bassSum += dataArray[i];
    for (let i = bassEnd; i < midEnd; i++) midSum += dataArray[i];
    for (let i = midEnd; i < trebleEnd; i++) trebleSum += dataArray[i];

    const bass = (bassSum / bassEnd) / 255;
    const mid = (midSum / (midEnd - bassEnd)) / 255;
    const treble = (trebleSum / (trebleEnd - midEnd)) / 255;

    // Overall intensity from bass+low-mid (same range as before)
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      sum += dataArray[i];
    }
    const intensity = (state.intensity * 0.4) + ((sum / 20) / 255) * 0.6;

    // Smooth bands
    const prevBands = state.bands;
    const smoothBands: AudioBands = {
      bass: prevBands.bass * 0.6 + bass * 0.4,
      mid: prevBands.mid * 0.6 + mid * 0.4,
      treble: prevBands.treble * 0.6 + treble * 0.4,
      intensity,
    };

    // Update energy history for dynamic threshold
    energyHistoryRef.current.push(intensity);
    if (energyHistoryRef.current.length > AUDIO.HISTORY_LIMIT) {
      energyHistoryRef.current.shift();
    }

    let avg = 0;
    for (const e of energyHistoryRef.current) {
      avg += e;
    }
    avg /= energyHistoryRef.current.length;
    const dynamicThreshold = Math.max(AUDIO.MIN_THRESHOLD, avg * 1.3);

    dynamicThresholdRef.current = dynamicThreshold;
    setState(prev => ({ ...prev, intensity, bands: smoothBands }));

    return { intensity, threshold: dynamicThreshold, bands: smoothBands };
  }, [state.isActive, state.intensity, state.bands]);

  const suspend = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.suspend();
    }
  }, []);

  const resume = useCallback(async () => {
    if (audioCtxRef.current) {
      await audioCtxRef.current.resume();
    }
  }, []);

  const getIntensity = useCallback(() => state.intensity, [state.intensity]);
  const getThreshold = useCallback(() => dynamicThresholdRef.current, []);

  return {
    start,
    update,
    suspend,
    resume,
    getIntensity,
    getThreshold,
    isActive: state.isActive,
    intensity: state.intensity,
    bands: state.bands,
  };
}
