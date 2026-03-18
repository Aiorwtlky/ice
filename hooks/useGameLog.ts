'use client';

import { useRef, useEffect, useCallback } from 'react';

export function useGameLog(gameModuleId: string | null, sessionId?: string | null) {
  const lastTimeRef = useRef<number>(Date.now());

  const sendLog = useCallback(
    async (
      action: string,
      opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }
    ) => {
      const now = Date.now();
      const timeDiffMs = opts?.timeDiffMs ?? now - lastTimeRef.current;
      lastTimeRef.current = now;
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          gameModuleId: gameModuleId || undefined,
          sessionId: sessionId || undefined,
          isCorrect: opts?.isCorrect,
          timeDiffMs,
          payload: opts?.payload,
        }),
      });
    },
    [gameModuleId, sessionId]
  );

  useEffect(() => {
    if (!gameModuleId) return;
    const onVisibility = () => {
      const action = document.visibilityState === 'hidden' ? 'TAB_LEAVE' : 'TAB_ENTER';
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, gameModuleId, sessionId: sessionId || undefined }),
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [gameModuleId, sessionId]);

  useEffect(() => {
    if (!gameModuleId) return;
    const id = setInterval(() => {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PING', gameModuleId, sessionId: sessionId || undefined }),
      });
    }, 30000);
    return () => clearInterval(id);
  }, [gameModuleId, sessionId]);

  return { sendLog };
}
