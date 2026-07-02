// Media recorder hook for video capture

'use client';

import { useRef, useCallback, useState } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RECORDING_SIZE } from '../lib/constants';

interface RecorderState {
  isRecording: boolean;
  chunks: Blob[];
}

interface UseMediaRecorderReturn {
  isRecording: boolean;
  startRecording: (flareCanvas: HTMLCanvasElement, starCanvas: HTMLCanvasElement) => void;
  stopRecording: () => Promise<Blob | null>;
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    chunks: [],
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const flareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawToCropCanvas = useCallback(() => {
    if (!cropCtxRef.current || !flareCanvasRef.current || !starCanvasRef.current) return;

    const cropCtx = cropCtxRef.current;
    const cropX = (CANVAS_WIDTH - RECORDING_SIZE) / 2;

    // Fill black background
    cropCtx.fillStyle = '#000';
    cropCtx.fillRect(0, 0, RECORDING_SIZE, RECORDING_SIZE);

    // Draw flare canvas (cropped to square)
    cropCtx.drawImage(
      flareCanvasRef.current,
      cropX, 0, RECORDING_SIZE, RECORDING_SIZE,
      0, 0, RECORDING_SIZE, RECORDING_SIZE
    );

    // Draw star canvas on top
    cropCtx.drawImage(
      starCanvasRef.current,
      cropX, 0, RECORDING_SIZE, RECORDING_SIZE,
      0, 0, RECORDING_SIZE, RECORDING_SIZE
    );
  }, []);

  const startRecording = useCallback((flareCanvas: HTMLCanvasElement, starCanvas: HTMLCanvasElement) => {
    // Store canvas references
    flareCanvasRef.current = flareCanvas;
    starCanvasRef.current = starCanvas;

    // Initialize crop canvas if needed
    if (!cropCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = RECORDING_SIZE;
      canvas.height = RECORDING_SIZE;
      cropCanvasRef.current = canvas;
      cropCtxRef.current = canvas.getContext('2d');
    }

    // Get stream from crop canvas
    const stream = cropCanvasRef.current!.captureStream(30);

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000,
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      // Stop the animation loop
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    recorderRef.current = recorder;

    // Start animation loop to keep drawing to crop canvas
    const animate = () => {
      drawToCropCanvas();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    recorder.start();
    setState({ isRecording: true, chunks });
  }, [drawToCropCanvas]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setState(prev => ({ ...prev, isRecording: false }));
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        // Stop the animation loop
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        const blob = new Blob(state.chunks, { type: 'video/webm' });
        setState({ isRecording: false, chunks: [] });
        resolve(blob);
      };

      recorder.stop();
    });
  }, [state.chunks]);

  return {
    isRecording: state.isRecording,
    startRecording,
    stopRecording,
  };
}
