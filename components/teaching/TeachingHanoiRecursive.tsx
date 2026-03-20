'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Ev =
  | { type: 'call'; n: number; from: string; aux: string; to: string }
  | { type: 'move'; disk: number; from: string; to: string }
  | { type: 'return'; n: number };

function buildEvents(n: number): Ev[] {
  const events: Ev[] = [];
  function walk(nn: number, from: string, aux: string, to: string) {
    if (nn === 0) return;
    events.push({ type: 'call', n: nn, from, aux, to });
    walk(nn - 1, from, to, aux);
    events.push({ type: 'move', disk: nn, from, to });
    walk(nn - 1, aux, from, to);
    events.push({ type: 'return', n: nn });
  }
  walk(n, 'A', 'B', 'C');
  return events;
}

function initRods(n: number): Record<string, number[]> {
  return {
    A: Array.from({ length: n }, (_, i) => n - i),
    B: [],
    C: [],
  };
}

function applyMove(rods: Record<string, number[]>, disk: number, from: string, to: string): Record<string, number[]> {
  const next: Record<string, number[]> = {
    A: [...rods.A],
    B: [...rods.B],
    C: [...rods.C],
  };
  const top = next[from][next[from].length - 1];
  if (top !== disk) return rods;
  next[from].pop();
  next[to].push(disk);
  return next;
}

/** 較慢步進，方便學生跟上遞迴與呼叫堆疊 */
const DURATION_MS = 1550;

const DISK_LAYOUT = {
  type: 'spring' as const,
  stiffness: 52,
  damping: 19,
  mass: 1.2,
};

export function TeachingHanoiRecursive() {
  const [n, setN] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rods, setRods] = useState<Record<string, number[]>>(() => initRods(3));
  const [stack, setStack] = useState<{ n: number; from: string; aux: string; to: string }[]>([]);
  const [poppingId, setPoppingId] = useState<number | null>(null);

  const events = useMemo(() => buildEvents(n), [n]);

  const reset = useCallback(() => {
    setPlaying(false);
    setIdx(0);
    setRods(initRods(n));
    setStack([]);
    setPoppingId(null);
  }, [n]);

  useEffect(() => {
    reset();
  }, [n, reset]);

  const stepAt = useCallback(
    (i: number) => {
      if (i >= events.length) return;
      const ev = events[i];
      if (ev.type === 'call') {
        setStack((s) => [...s, { n: ev.n, from: ev.from, aux: ev.aux, to: ev.to }]);
      } else if (ev.type === 'move') {
        setRods((r) => applyMove(r, ev.disk, ev.from, ev.to));
      } else if (ev.type === 'return') {
        setPoppingId(ev.n);
        setStack((s) => s.slice(0, -1));
        window.setTimeout(() => setPoppingId(null), 580);
      }
      setIdx(i + 1);
    },
    [events]
  );

  useEffect(() => {
    if (!playing) return;
    if (idx >= events.length) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => {
      stepAt(idx);
    }, DURATION_MS);
    return () => clearTimeout(t);
  }, [playing, idx, events.length, stepAt]);

  const canStep = idx < events.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-[320px] flex-1 flex-col rounded-2xl border-2 border-violet-300 bg-gradient-to-b from-violet-50/80 to-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-violet-900">盤數 N</label>
          <select
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-sm font-bold text-violet-950"
          >
            {[1, 2, 3, 4].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              reset();
              setPlaying(true);
            }}
            className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-800"
          >
            播放
          </button>
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="rounded-lg border border-violet-400 bg-white px-3 py-1.5 text-xs font-bold text-violet-900"
          >
            暫停
          </button>
          <button
            type="button"
            disabled={!canStep}
            onClick={() => {
              setPlaying(false);
              stepAt(idx);
            }}
            className="rounded-lg border border-violet-400 bg-white px-3 py-1.5 text-xs font-bold text-violet-900 disabled:opacity-40"
          >
            單步
          </button>
          <button type="button" onClick={reset} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">
            重設
          </button>
        </div>

        <div className="relative mx-auto flex min-h-[220px] w-full max-w-xl flex-1 items-end justify-between gap-2 px-2 pb-2">
          {(['A', 'B', 'C'] as const).map((label) => (
            <div key={label} className="flex h-[min(38vh,280px)] w-1/3 flex-col items-center justify-end">
              <div className="relative flex w-full flex-1 flex-col items-center justify-end">
                <div className="absolute bottom-8 left-1/2 h-[88%] w-3 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-700 to-amber-900 shadow-inner" />
                <div className="relative z-[1] flex w-[90%] flex-col-reverse items-center gap-1 pb-8">
                  {rods[label].map((disk, di) => {
                    const w = 28 + disk * 14;
                    return (
                      <motion.div
                        key={`${label}-${disk}-${di}-${rods[label].join(',')}}`}
                        layout
                        layoutId={`hanoi-disk-${disk}`}
                        transition={{ layout: DISK_LAYOUT }}
                        className="rounded-lg border-2 border-amber-900/30 shadow-md"
                        style={{
                          width: `${Math.min(w, 100)}%`,
                          height: 22,
                          background: `hsl(${30 + disk * 18} 85% 52%)`,
                          transformOrigin: '50% 100%',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <span className="mt-1 text-sm font-black text-violet-900">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-violet-700">
          步驟 {Math.min(idx, events.length)} / {events.length}
          {idx >= events.length ? ' · 播放完畢' : ''}
        </p>
      </div>

      <div className="flex w-full max-w-md shrink-0 flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/90 p-4">
        <h3 className="text-sm font-extrabold text-violet-950">Call Stack（遞迴呼叫堆疊）</h3>
        <p className="text-xs leading-relaxed text-violet-900/85">
          每次進入 <code className="rounded bg-white/80 px-1">hanoi(n, …)</code> 會推入一層；該層結束時會變色並{' '}
          <strong>Pop</strong>，回到上一層。
        </p>
        <div className="flex min-h-[200px] max-h-[min(40vh,320px)] flex-col-reverse gap-2 overflow-y-auto overscroll-contain rounded-xl border border-violet-200 bg-white/90 p-3 [scrollbar-gutter:stable]">
          <AnimatePresence initial={false}>
            {stack.map((frame, fi) => {
              const isTop = fi === stack.length - 1;
              const highlight = poppingId === frame.n && isTop;
              return (
                <motion.div
                  key={`${fi}-${frame.n}-${frame.from}-${frame.to}-${stack.length}`}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{
                    opacity: highlight ? 0.45 : 1,
                    y: 0,
                    scale: 1,
                    backgroundColor: highlight ? 'rgb(196 181 253)' : 'rgb(245 243 255)',
                  }}
                  exit={{ opacity: 0, y: -28, scale: 0.9 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="rounded-lg border-2 border-violet-400 px-3 py-2 text-left text-xs font-mono text-violet-950 shadow-sm"
                >
                  <div className="font-bold">
                    hanoi({frame.n}, {frame.from}, {frame.aux}, {frame.to})
                  </div>
                  <div className="mt-1 text-[10px] text-violet-800">
                    n={frame.n} · start={frame.from} · aux={frame.aux} · end={frame.to}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {stack.length === 0 && <p className="text-center text-xs text-violet-500">（堆疊空）</p>}
        </div>
      </div>
    </div>
  );
}
