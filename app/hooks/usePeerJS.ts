// PeerJS multiplayer hook for art.cube

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { DataConnection } from 'peerjs';
import type { PeerMessage, UserRole, OwnerId } from '../lib/types';

interface PeerState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface UsePeerJSOptions {
  sessionId: string;
  isHost: boolean;
  myName: string;
  onMessage?: (data: PeerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function usePeerJS({
  sessionId,
  isHost,
  myName,
  onMessage,
  onConnect,
  onDisconnect,
}: UsePeerJSOptions) {
  const [state, setState] = useState<PeerState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const peerRef = useRef<import('peerjs').default | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const handledClickIdsRef = useRef<Set<number>>(new Set());
  const handledNebulaIdsRef = useRef<Set<number>>(new Set());

  // Store callbacks in refs to avoid dependency changes triggering re-init
  const callbacksRef = useRef({ onMessage, onConnect, onDisconnect });
  callbacksRef.current = { onMessage, onConnect, onDisconnect };

  // Initialize PeerJS
  useEffect(() => {
    let isMounted = true;

    const initPeer = async () => {
      try {
        setState(prev => ({ ...prev, isConnecting: true }));

        // Dynamic import to avoid SSR issues
        const PeerJS = (await import('peerjs')).default;

        if (!isMounted) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const peer = new (PeerJS as any)(isHost ? (sessionId || 'artcube-host') : undefined, {
          debug: 1,
        });

        peerRef.current = peer;

        peer.on('open', () => {
          if (!isHost) {
            connectToHost(peer);
          }
        });

        peer.on('connection', (conn: DataConnection) => {
          connRef.current = conn;
          setupConnection(conn);
        });

        peer.on('error', (err: Error) => {
          console.error('PeerJS Error:', err);
          setState(prev => ({ ...prev, error: err.message, isConnecting: false }));
        });
      } catch (error) {
        console.error('PeerJS init failed:', error);
        setState(prev => ({ ...prev, error: 'Failed to initialize', isConnecting: false }));
      }
    };

    const connectToHost = (peer: import('peerjs').default) => {
      const conn = peer.connect(sessionId || 'default', { reliable: true });
      connRef.current = conn;
      setupConnection(conn);

      // Retry connection after 5 seconds if not connected
      setTimeout(() => {
        if (!conn.open && isMounted) {
          connectToHost(peer);
        }
      }, 5000);
    };

    const setupConnection = (conn: DataConnection) => {
      conn.on('open', () => {
        setState({ isConnected: true, isConnecting: false, error: null });
        callbacksRef.current.onConnect?.();

        // Send initial status
        if (myName) {
          const statusMsg = {
            type: 'STATUS' as const,
            name: myName,
            status: 'online' as const,
            role: (isHost ? 'host' : 'guest') as UserRole,
          };
          const conn = connRef.current;
          if (conn && conn.open) {
            conn.send(statusMsg);
          }
        }
      });

      conn.on('data', (data: unknown) => {
        const message = data as PeerMessage;

        // Handle deduplication for interactions
        if (message.type === 'INTERACTION') {
          if (message.kind === 'SHOOTING_STAR' && message.cid !== undefined) {
            if (handledClickIdsRef.current.has(message.cid)) return;
            handledClickIdsRef.current.add(message.cid);
            setTimeout(() => { if (message.cid !== undefined) handledClickIdsRef.current.delete(message.cid); }, 2000);
          }
          if (message.kind === 'NEBULA_GAS' && message.nid !== undefined) {
            if (handledNebulaIdsRef.current.has(message.nid)) return;
            handledNebulaIdsRef.current.add(message.nid);
            setTimeout(() => { if (message.nid !== undefined) handledNebulaIdsRef.current.delete(message.nid); }, 15000);
          }
        }

        callbacksRef.current.onMessage?.(message);
      });

      conn.on('close', () => {
        setState(prev => ({ ...prev, isConnected: false }));
        callbacksRef.current.onDisconnect?.();
      });

      conn.on('error', () => {
        setState(prev => ({ ...prev, isConnected: false }));
        callbacksRef.current.onDisconnect?.();
      });
    };

    initPeer();

    return () => {
      isMounted = false;
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, [sessionId, isHost, myName]);

  const sendMessage = useCallback((message: PeerMessage) => {
    const conn = connRef.current;
    if (conn && conn.open) {
      conn.send(message);
      return true;
    }
    return false;
  }, []);

  const sendStatus = useCallback((status: 'online' | 'offline') => {
    if (myName) {
      return sendMessage({
        type: 'STATUS',
        name: myName,
        status,
        role: isHost ? 'host' : 'guest',
      });
    }
    return false;
  }, [myName, isHost, sendMessage]);

  const sendStartExperience = useCallback((elapsed: number) => {
    return sendMessage({
      type: 'START_EXPERIENCE',
      elapsed,
    });
  }, [sendMessage]);

  const sendSyncTime = useCallback((elapsed: number) => {
    return sendMessage({
      type: 'SYNC_TIME',
      elapsed,
    });
  }, [sendMessage]);

  const sendInteraction = useCallback((
    kind: 'SHOOTING_STAR' | 'NEBULA_GAS',
    data: {
      rx: number;
      ry: number;
      ownerName: string;
      vx?: number;
      vy?: number;
      w?: number;
      d?: number;
      cid?: number;
      dir?: number;
      born?: number;
      palette?: { base: string; bright: string };
      nid?: number;
      size?: number;
    }
  ) => {
    return sendMessage({
      type: 'INTERACTION',
      kind,
      ...data,
      ownerId: isHost ? 'host' : 'guest',
    });
  }, [isHost, sendMessage]);

  return {
    ...state,
    sendMessage,
    sendStatus,
    sendStartExperience,
    sendSyncTime,
    sendInteraction,
  };
}
