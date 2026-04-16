'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { comparisons: number; swaps: number; durationMs: number }) => void;
}

function createArray(len = 8) {
  const base = Array.from({ length: len }, (_, i) => i + 2);
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}

function isSorted(arr: number[]) {
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i - 1] > arr[i]) return false;
  }
  return true;
}

export default function AlgoLabBubbleSortGame({ previewMode = false, onComplete }: Props) {
  const [arr, setArr] = useState(() => createArray());
  const [idx, setIdx] = useState(0);
  const [sortedTail, setSortedTail] = useState(arr.length - 1);
  const [comparisons, setComparisons] = useState(0);
  const [swaps, setSwaps] = useState(0);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('觀察高低柱狀圖，判斷相鄰兩柱是否要交換。');
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const activePair = useMemo(() => [idx, idx + 1], [idx]);
  const shouldSwap = arr[idx] > arr[idx + 1];

  const reset = () => {
    const next = createArray();
    setArr(next);
    setIdx(0);
    setSortedTail(next.length - 1);
    setComparisons(0);
    setSwaps(0);
    setFinished(false);
    setStartedAt(null);
    setMessage('新回合開始，最大的值會像氣泡一樣往右移動。');
  };

  const decide = (doSwap: boolean) => {
    if (finished) return;
    const now = Date.now();
    if (!startedAt) setStartedAt(now);

    const nextComparisons = comparisons + 1;
    setComparisons(nextComparisons);
    let nextArray = arr;
    let nextSwaps = swaps;

    if (doSwap) {
      nextArray = [...arr];
      [nextArray[idx], nextArray[idx + 1]] = [nextArray[idx + 1], nextArray[idx]];
      nextSwaps += 1;
      setArr(nextArray);
      setSwaps(nextSwaps);
    }

    const correct = shouldSwap === doSwap;
    setMessage(
      correct
        ? doSwap
          ? '判斷正確，已交換。'
          : '判斷正確，這組不用交換。'
        : '這步判斷不理想，先繼續完成排序再回顧。'
    );

    if (isSorted(nextArray)) {
      setFinished(true);
      setMessage(`排序完成！比較 ${nextComparisons} 次、交換 ${nextSwaps} 次。`);
      if (!previewMode) {
        onComplete?.({
          comparisons: nextComparisons,
          swaps: nextSwaps,
          durationMs: startedAt ? now - startedAt : 0,
        });
      }
      return;
    }

    if (idx + 1 >= sortedTail) {
      setIdx(0);
      setSortedTail((tail) => Math.max(1, tail - 1));
    } else {
      setIdx((prev) => prev + 1);
    }
  };

  const maxValue = Math.max(...arr);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.35fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗二：建立秩序（Bubble Sort）</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">每次只比較相鄰兩柱，用交換把大值慢慢推到右側。</p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">比較次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{comparisons}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">交換次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{swaps}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700 sm:text-xs">已定位尾端</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{arr.length - 1 - sortedTail}</p>
          </div>
        </div>

        <div className="mt-3 flex h-36 items-end gap-2 rounded-2xl border border-gray-200 bg-gradient-to-b from-sky-50 to-white p-3 sm:h-56">
          {arr.map((n, i) => {
            const active = activePair.includes(i);
            const locked = i > sortedTail;
            const heightPercent = Math.max(14, Math.round((n / maxValue) * 100));
            return (
              <div key={`${n}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={`w-full rounded-t-xl transition-all duration-300 ${
                    locked ? 'bg-emerald-400' : active ? 'bg-amber-400' : 'bg-sky-400'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-xs font-bold text-gray-700 sm:text-sm">{n}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          目前比較第 {idx + 1} 與第 {idx + 2} 柱（{arr[idx]} / {arr[idx + 1]}）
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={finished}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 sm:flex-none sm:text-sm"
          >
            交換
          </button>
          <button
            type="button"
            disabled={finished}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 disabled:opacity-50 sm:flex-none sm:text-sm"
          >
            不交換
          </button>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 sm:w-auto sm:text-sm"
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
          排序很花力氣，但完成後能讓後續搜尋大幅加速。先整理，再搜尋，才是資料處理的關鍵流程。
        </p>
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:text-sm">
          提示：若左柱比右柱高，通常就該交換。
        </div>
      </aside>
    </div>
  );
}
