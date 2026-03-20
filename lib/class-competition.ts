import { CompetitionStatus } from '@prisma/client';

export type CompetitionTimingFields = {
  status: CompetitionStatus;
  openedAt: Date | null;
  pauseStartedAt: Date | null;
  totalPausedMs: number;
  timeLimitSec: number | null;
};

/** 進行中（含暫停）的「有效已用時間」毫秒：從 openedAt 起算，扣除累計暫停；若正在暫停則扣掉本段暫停尚未結算的部分 */
export function getActiveElapsedMs(c: CompetitionTimingFields, nowMs: number): number {
  if (!c.openedAt || c.status === 'DRAFT') return 0;
  const opened = new Date(c.openedAt).getTime();
  let pausedExtra = c.totalPausedMs;
  if (c.status === 'PAUSED' && c.pauseStartedAt) {
    pausedExtra += nowMs - new Date(c.pauseStartedAt).getTime();
  }
  return Math.max(0, nowMs - opened - pausedExtra);
}

export function getRemainingTimeMs(c: CompetitionTimingFields, nowMs: number): number | null {
  if (c.timeLimitSec == null) return null;
  const limitMs = c.timeLimitSec * 1000;
  const used = getActiveElapsedMs(c, nowMs);
  return Math.max(0, limitMs - used);
}

export function isCompetitionPlayableStatus(status: CompetitionStatus): boolean {
  return status === 'OPEN' || status === 'PAUSED';
}
