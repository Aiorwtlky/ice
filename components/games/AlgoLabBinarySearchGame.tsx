'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { attempts: number; durationMs: number; datasetSize: number }) => void;
}

const SIZE_OPTIONS = [32, 64, 128];

type CellState = 'active' | 'excluded' | 'hit';

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export default function AlgoLabBinarySearchGame({ previewMode = false, onComplete }: Props) {
  const [size, setSize] = useState(64);
  const [target, setTarget] = useState(() => randomInt(64) + 1);
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(63);
  const [attempts, setAttempts] = useState(0);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('每回合請點「目前範圍的中位點」。');

  const values = useMemo(() => Array.from({ length: size }, (_, i) => i + 1), [size]);
  const middle = Math.floor((low + high) / 2);
  const excludedCount = low + (size - 1 - high);

  const reset = (nextSize = size) => {
    setSize(nextSize);
    setTarget(randomInt(nextSize) + 1);
    setLow(0);
    setHigh(nextSize - 1);
    setAttempts(0);
    setFinished(false);
    setMessage('新回合開始，先找出目前範圍中間值。');
  };

  const tapCell = (index: number) => {
    if (finished) return;
    if (index < low || index > high) return;

    if (index !== middle) {
      setMessage('這格不是中位點，二分搜尋要先點中間。');
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const value = index + 1;
    if (value === target) {
      setFinished(true);
      setMessage(`命中！${size} 筆資料只用了 ${nextAttempts} 次。`);
      if (!previewMode) {
        onComplete?.({
          attempts: nextAttempts,
          durationMs: 0,
          datasetSize: size,
        });
      }
      return;
    }

    if (value < target) {
      setLow(index + 1);
      setMessage(`點到 ${value}，目標更大，保留右半邊。`);
    } else {
      setHigh(index - 1);
      setMessage(`點到 ${value}，目標更小，保留左半邊。`);
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.4fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗三：切一半的神蹟（Binary Search）</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">在排序好的資料中，每一步都先點中間值，再排除一半範圍。</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => reset(option)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold sm:text-sm ${
                size === option ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {option} 筆
            </button>
          ))}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 sm:text-sm"
          >
            重玩本回合
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">目標值</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{target}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">目前步數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{attempts}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700 sm:text-xs">已排除資料</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{excludedCount}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8 sm:gap-2 lg:grid-cols-16">
          {values.map((value, index) => {
            let state: CellState = 'active';
            if (finished && value === target) state = 'hit';
            else if (index < low || index > high) state = 'excluded';
            const isMiddle = !finished && index === middle;
            return (
              <button
                key={value}
                type="button"
                onClick={() => tapCell(index)}
                disabled={finished || state === 'excluded'}
                className={`h-10 rounded-lg border text-[11px] font-bold transition sm:h-10 sm:text-xs ${
                  state === 'excluded'
                    ? 'border-gray-200 bg-gray-100 text-gray-400'
                    : state === 'hit'
                      ? 'border-emerald-400 bg-emerald-500 text-white'
                      : isMiddle
                        ? 'border-amber-400 bg-amber-100 text-amber-900'
                        : 'border-sky-200 bg-sky-50 text-sky-900'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          目前範圍：{low + 1} ~ {high + 1}，中位點：{middle + 1}
        </div>
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">老師的話</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          這個實驗的重點不是亂點，而是每步都從中位點切半，體會 O(logN) 的速度差。
        </p>
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 sm:text-sm">
          提示公式：中位點 = (下界 + 上界) ÷ 2
        </div>
      </aside>
    </div>
  );
}
