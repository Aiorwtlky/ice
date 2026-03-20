'use client';

import { useCallback } from 'react';

export function useCompetitionLog(competitionId: string) {
  return useCallback(
    async (
      action: string,
      opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }
    ) => {
      try {
        await fetch(`/api/class-competitions/${competitionId}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            isCorrect: opts?.isCorrect,
            timeDiffMs: opts?.timeDiffMs,
            payload: opts?.payload ?? {},
          }),
        });
      } catch {
        /* 競賽 log 失敗不阻斷遊戲 */
      }
    },
    [competitionId]
  );
}
