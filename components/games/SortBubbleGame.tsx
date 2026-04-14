'use client';

import { useMemo, useState } from 'react';

interface Props {
  guideEnabled?: boolean;
  previewMode?: boolean;
  onComplete?: (payload: { swaps: number; decisions: number; durationMs: number }) => void;
}

function createArray() {
  const base = Array.from({ length: 6 }, (_, i) => i + 1);
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}

function isSortedAsc(arr: number[]) {
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i - 1] > arr[i]) return false;
  }
  return true;
}

export default function SortBubbleGame({ guideEnabled = false, previewMode = false, onComplete }: Props) {
  const [arr, setArr] = useState<number[]>(() => createArray());
  const [index, setIndex] = useState(0);
  const [passEnd, setPassEnd] = useState(5);
  const [swaps, setSwaps] = useState(0);
  const [decisions, setDecisions] = useState(0);
  const [message, setMessage] = useState('從左到右比較相鄰數字，決定是否交換。');
  const [done, setDone] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const shouldSwap = useMemo(() => arr[index] > arr[index + 1], [arr, index]);

  const nextStep = (didSwap: boolean) => {
    const now = Date.now();
    if (!startedAt) setStartedAt(now);

    const nextDecisions = decisions + 1;
    setDecisions(nextDecisions);

    let working = arr;
    if (didSwap) {
      const next = [...arr];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      working = next;
      setArr(next);
      setSwaps((s) => s + 1);
    }

    if (isSortedAsc(working)) {
      setDone(true);
      const durationMs = startedAt ? now - startedAt : 0;
      setMessage(`排序完成！比較決策 ${nextDecisions} 次，交換 ${didSwap ? swaps + 1 : swaps} 次。`);
      if (!previewMode) onComplete?.({ swaps: didSwap ? swaps + 1 : swaps, decisions: nextDecisions, durationMs });
      return;
    }

    if (index >= passEnd - 1) {
      setIndex(0);
      setPassEnd((p) => Math.max(1, p - 1));
    } else {
      setIndex((i) => i + 1);
    }

    setMessage(didSwap ? '已交換，繼續下一組。' : '不交換，繼續下一組。');
  };

  const reset = () => {
    setArr(createArray());
    setIndex(0);
    setPassEnd(5);
    setSwaps(0);
    setDecisions(0);
    setMessage('已重置，從第一組開始。');
    setDone(false);
    setStartedAt(null);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 p-2 sm:p-4 lg:grid lg:grid-cols-[1.25fr_1fr]">
      <section className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-xl font-black text-gray-900 sm:text-2xl">泡泡排序挑戰</h2>
        <p className="mt-2 text-sm text-gray-600">每次比較相鄰兩個數字，若左邊較大就交換。</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {arr.map((n, i) => {
            const active = i === index || i === index + 1;
            return (
              <div
                key={`${i}-${n}`}
                className={`min-w-11 rounded-xl px-4 py-3 text-center text-lg font-black ${
                  active ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-900'
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          目前比較：第 {index + 1} 與第 {index + 2} 個（{arr[index]} / {arr[index + 1]}）
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={done}
            onClick={() => nextStep(true)}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            交換
          </button>
          <button
            type="button"
            disabled={done}
            onClick={() => nextStep(false)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 disabled:opacity-50"
          >
            不交換
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700"
          >
            重新開始
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">教學重點</h3>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p>決策次數：<span className="font-bold">{decisions}</span></p>
          <p>交換次數：<span className="font-bold">{swaps}</span></p>
          <p>本輪終點：第 <span className="font-bold">{passEnd + 1}</span> 個</p>
        </div>

        {guideEnabled ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            提示：這一組建議「{shouldSwap ? '交換' : '不交換'}」。
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
            無提示模式：請自行判斷是否交換。
          </div>
        )}
      </aside>
    </div>
  );
}
