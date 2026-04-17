'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { swaps: number; bestSwaps: number; durationMs: number }) => void;
}

function shuffle<T>(arr: T[]) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createArray(len = 10) {
  // 故意做得更像「不同高度」的柱子（避免太整齊），但仍容易排序理解
  const base = Array.from({ length: len }, (_, i) => i + 1);
  return shuffle(base);
}

function isSorted(arr: number[]) {
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i - 1] > arr[i]) return false;
  }
  return true;
}

// 任意兩位置交換的最少步數（把 arr 排成升序）
function minSwapsToSort(arr: number[]) {
  const n = arr.length;
  const pairs = arr.map((value, idx) => ({ value, idx }));
  pairs.sort((a, b) => a.value - b.value);

  const visited = Array.from({ length: n }, () => false);
  let swaps = 0;

  for (let i = 0; i < n; i += 1) {
    if (visited[i]) continue;
    if (pairs[i].idx === i) {
      visited[i] = true;
      continue;
    }
    let cycle = 0;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = pairs[j].idx;
      cycle += 1;
    }
    if (cycle > 1) swaps += cycle - 1;
  }
  return swaps;
}

export default function AlgoLabBubbleSortFreeSwapGame({ previewMode = false, onComplete }: Props) {
  const [arr, setArr] = useState(() => createArray());
  const [selected, setSelected] = useState<number[]>([]);
  const [swaps, setSwaps] = useState(0);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('先點兩根柱子（會變色），再按「交換」。不會判斷對錯，交換到排序完成為止。');
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [bestSwaps, setBestSwaps] = useState(() => minSwapsToSort(arr));
  const maxValue = useMemo(() => Math.max(...arr), [arr]);

  const togglePick = (idx: number) => {
    if (finished) return;
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= 2) return [prev[1], idx];
      return [...prev, idx];
    });
  };

  const reset = () => {
    const next = createArray();
    setArr(next);
    setBestSwaps(minSwapsToSort(next));
    setSelected([]);
    setSwaps(0);
    setFinished(false);
    setStartedAt(null);
    setMessage('新回合開始：請自由交換，把柱子排成由小到大。');
  };

  const doSwap = () => {
    if (finished) return;
    if (selected.length !== 2) {
      setMessage('先選兩根柱子再交換。');
      return;
    }
    const now = Date.now();
    if (!startedAt) setStartedAt(now);

    const [a, b] = selected;
    const next = [...arr];
    [next[a], next[b]] = [next[b], next[a]];
    const nextSwaps = swaps + 1;
    setArr(next);
    setSwaps(nextSwaps);
    setSelected([]);

    if (isSorted(next)) {
      setFinished(true);
      setMessage(`完成！你用了 ${nextSwaps} 步。最佳步數是 ${bestSwaps} 步。`);
      if (!previewMode) {
        onComplete?.({
          swaps: nextSwaps,
          bestSwaps,
          durationMs: startedAt ? now - startedAt : 0,
        });
      }
      return;
    }

    setMessage(`已交換。你目前用了 ${nextSwaps} 步（最佳 ${bestSwaps} 步）。`);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.35fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗二之零：自由交換（排序練習）</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          你可以任意選兩根柱子交換。目標是把數字排成 <span className="font-black">由小到大</span>。
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">你的步數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{swaps}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700 sm:text-xs">最佳步數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{bestSwaps}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">已選柱子</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{selected.length} / 2</p>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-gradient-to-b from-sky-50 to-white p-3 [-webkit-overflow-scrolling:touch]">
          <div className="flex h-36 min-w-[560px] items-end gap-2 sm:h-56 sm:min-w-0">
            {arr.map((n, i) => {
              const picked = selected.includes(i);
              const heightPercent = Math.max(14, Math.round((n / maxValue) * 100));
              return (
                <button
                  key={`${n}-${i}`}
                  type="button"
                  onClick={() => togglePick(i)}
                  disabled={finished}
                  className="flex h-full w-12 flex-col items-center justify-end gap-1 rounded-lg disabled:opacity-60 sm:w-auto sm:flex-1"
                >
                  <div
                    className={`w-full rounded-t-xl transition-all duration-200 ${picked ? 'bg-amber-400' : 'bg-sky-400'}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-xs font-bold text-gray-700 sm:text-sm">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={finished || selected.length !== 2}
            onClick={doSwap}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50 sm:flex-none"
          >
            交換
          </button>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 sm:w-auto"
          >
            重新開始
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">老師的話</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          這個版本不會告訴你「這一步對不對」。你要自己嘗試策略，讓步數接近最佳步數。
        </p>
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 sm:text-sm">
          小目標：你的步數越接近「最佳步數」，代表你越會用策略交換。
        </div>
      </aside>
    </div>
  );
}

