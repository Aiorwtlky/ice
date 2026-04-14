'use client';

import { useRef, useEffect, useCallback } from 'react';

export function useGameLog(gameModuleId: string | null, sessionId?: string | null, enabled = true) {
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    // 避免在 render 階段呼叫 Date.now()（lint: react-hooks/purity）
    lastTimeRef.current = Date.now();
  }, []);

  const sendLog = useCallback(
    async (
      action: string,
      opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }
    ) => {
      if (!enabled) return;
      const now = Date.now();
      const base = lastTimeRef.current || now;
      const timeDiffMs = opts?.timeDiffMs ?? now - base;
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
    [enabled, gameModuleId, sessionId]
  );

  useEffect(() => {
    if (!enabled || !gameModuleId) return;
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
  }, [enabled, gameModuleId, sessionId]);

  useEffect(() => {
    if (!enabled || !gameModuleId) return;
    const id = setInterval(() => {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PING', gameModuleId, sessionId: sessionId || undefined }),
      });
    }, 30000);
    return () => clearInterval(id);
  }, [enabled, gameModuleId, sessionId]);

  return { sendLog };
}
