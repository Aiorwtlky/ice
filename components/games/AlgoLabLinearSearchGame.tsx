'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { attempts: number; durationMs: number; datasetSize: number }) => void;
}

type ProbeState = 'idle' | 'miss' | 'hit';

const DATASET_OPTIONS = [10, 20, 40, 80];

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function createDataset(size: number) {
  const values = Array.from({ length: size }, (_, i) => i + 1);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export default function AlgoLabLinearSearchGame({ previewMode = false, onComplete }: Props) {
  const [datasetSize, setDatasetSize] = useState(20);
  const [dataset, setDataset] = useState<number[]>(() => createDataset(20));
  const [target, setTarget] = useState(() => dataset[randomInt(dataset.length)]);
  const [probes, setProbes] = useState<ProbeState[]>(() => Array.from({ length: 20 }, () => 'idle'));
  const [attempts, setAttempts] = useState(0);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('先觀察目標數字，再逐格翻開資料盒。');
  const [history, setHistory] = useState<Array<{ size: number; attempts: number }>>([]);

  const theoreticalMid = useMemo(() => Math.ceil(datasetSize / 2), [datasetSize]);

  const reset = (size = datasetSize) => {
    const next = createDataset(size);
    setDatasetSize(size);
    setDataset(next);
    setTarget(next[randomInt(next.length)]);
    setProbes(Array.from({ length: size }, () => 'idle'));
    setAttempts(0);
    setFinished(false);
    setMessage('新回合開始，試著用最少步數找出目標。');
  };

  const probe = (idx: number) => {
    if (finished || probes[idx] !== 'idle') return;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const isHit = dataset[idx] === target;
    const nextProbe = [...probes];
    nextProbe[idx] = isHit ? 'hit' : 'miss';
    setProbes(nextProbe);

    if (isHit) {
      setFinished(true);
      setMessage(`找到目標！你用了 ${nextAttempts} 次點擊。`);
      setHistory((prev) => [{ size: datasetSize, attempts: nextAttempts }, ...prev].slice(0, 8));
      if (!previewMode) {
        onComplete?.({
          attempts: nextAttempts,
          durationMs: 0,
          datasetSize,
        });
      }
      return;
    }
    setMessage(`第 ${nextAttempts} 次：這格不是目標，繼續搜尋。`);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.35fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗一：搜尋的苦勞（Linear Search）</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          在無序資料中逐格翻找目標。資料量越大，通常要點擊越多次才找到答案。
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {DATASET_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => reset(size)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold sm:text-sm ${
                datasetSize === size ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {size} 筆
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
            <p className="text-[11px] text-indigo-700 sm:text-xs">目標數字</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{target}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">目前步數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{attempts}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700 sm:text-xs">理論平均</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">約 {theoreticalMid} 步</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {dataset.map((value, idx) => {
            const state = probes[idx];
            return (
              <button
                key={`${value}-${idx}`}
                type="button"
                onClick={() => probe(idx)}
                disabled={state !== 'idle' || finished}
                className={`h-11 min-w-0 rounded-xl border text-xs font-black transition sm:h-14 sm:text-base ${
                  state === 'idle'
                    ? 'border-gray-200 bg-gray-100 text-gray-500 hover:border-amber-300 hover:bg-amber-50'
                    : state === 'miss'
                      ? 'border-gray-200 bg-gray-200 text-gray-600'
                      : 'border-emerald-300 bg-emerald-500 text-white'
                }`}
              >
                {state === 'idle' ? '?' : value}
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">實驗紀錄</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          觀察資料量增加時，步數是否也跟著上升，體會 O(N) 的搜尋成本。
        </p>
        <ul className="mt-3 max-h-[30vh] space-y-2 overflow-y-auto lg:max-h-none">
          {history.length === 0 && <li className="text-xs text-gray-500 sm:text-sm">尚無完成紀錄。</li>}
          {history.map((item, idx) => (
            <li key={`${item.size}-${item.attempts}-${idx}`} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs sm:text-sm">
              <span className="font-bold text-gray-900">{item.size}</span> 筆資料，找到答案用了{' '}
              <span className="font-bold text-amber-700">{item.attempts}</span> 步
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
