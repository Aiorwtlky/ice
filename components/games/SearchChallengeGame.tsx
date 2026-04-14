'use client';

import { useMemo, useState } from 'react';

type SearchMode = 'LINEAR' | 'BINARY';

interface Props {
  mode: SearchMode;
  rangeMin?: number;
  rangeMax: number;
  hintEnabled?: boolean;
  previewMode?: boolean;
  onComplete?: (payload: { attempts: number; durationMs: number; mode: SearchMode; rangeMax: number }) => void;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function theoreticalAttempts(rangeMin: number, rangeMax: number) {
  return Math.ceil(Math.log2(rangeMax - rangeMin + 1));
}

export default function SearchChallengeGame({
  mode,
  rangeMin = 0,
  rangeMax,
  hintEnabled = true,
  previewMode = false,
  onComplete,
}: Props) {
  const [target, setTarget] = useState(() => randomInt(rangeMin, rangeMax));
  const [inputValue, setInputValue] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState('請先輸入一個數字開始挑戰。');
  const [finished, setFinished] = useState(false);
  const [lowerBound, setLowerBound] = useState(rangeMin);
  const [upperBound, setUpperBound] = useState(rangeMax);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [linearCursor, setLinearCursor] = useState(rangeMin);
  const [linearCanStep, setLinearCanStep] = useState(false);
  const [showTheory, setShowTheory] = useState(true);

  const theory = useMemo(() => theoreticalAttempts(rangeMin, rangeMax), [rangeMin, rangeMax]);
  const recommendedGuess = useMemo(
    () => Math.floor((lowerBound + upperBound) / 2),
    [lowerBound, upperBound]
  );

  const resetGame = () => {
    setTarget(randomInt(rangeMin, rangeMax));
    setInputValue('');
    setAttempts(0);
    setMessage(mode === 'LINEAR' ? '已重新開始，從 0 開始一步一步猜。' : '已重新開始，請輸入第一個數字。');
    setFinished(false);
    setLowerBound(rangeMin);
    setUpperBound(rangeMax);
    setStartedAt(null);
    setLinearCursor(rangeMin);
    setLinearCanStep(false);
  };

  const commitComplete = (nextAttempts: number, now: number) => {
    const durationMs = startedAt ? now - startedAt : 0;
    setMessage(`答對了！你用了 ${nextAttempts} 次。${mode === 'BINARY' ? `理論約 ${theory} 次。` : ''}`);
    if (!previewMode) {
      onComplete?.({ attempts: nextAttempts, durationMs, mode, rangeMax });
    }
  };

  const submitBinaryGuess = () => {
    if (finished) return;
    const guess = Number(inputValue);
    if (!Number.isInteger(guess)) {
      setMessage('請輸入整數。');
      return;
    }
    if (guess < rangeMin || guess > rangeMax) {
      setMessage(`範圍是 ${rangeMin} 到 ${rangeMax}。`);
      return;
    }

    const now = Date.now();
    if (!startedAt) setStartedAt(now);

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (guess === target) {
      setFinished(true);
      commitComplete(nextAttempts, now);
      return;
    }

    if (guess < target) {
      setLowerBound((prev) => Math.max(prev, guess + 1));
      setMessage(
        hintEnabled
          ? `太小了。答案在 ${Math.max(lowerBound, guess + 1)} 到 ${upperBound}。`
          : '還沒猜中，再試一次。'
      );
    } else {
      setUpperBound((prev) => Math.min(prev, guess - 1));
      setMessage(
        hintEnabled
          ? `太大了。答案在 ${lowerBound} 到 ${Math.min(upperBound, guess - 1)}。`
          : '還沒猜中，再試一次。'
      );
    }
  };

  const submitLinearGuess = () => {
    if (finished || linearCanStep) return;
    const now = Date.now();
    if (!startedAt) setStartedAt(now);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (linearCursor === target) {
      setFinished(true);
      setLinearCanStep(false);
      commitComplete(nextAttempts, now);
      return;
    }
    setLinearCanStep(true);
    setMessage(`第 ${nextAttempts} 次：${linearCursor} 不是答案。請按「下一個數」繼續。`);
  };

  const moveLinearNext = () => {
    if (finished || !linearCanStep) return;
    const next = Math.min(rangeMax, linearCursor + 1);
    if (next === linearCursor) {
      setMessage('已到範圍上限，請重新開始。');
      return;
    }
    setLinearCursor(next);
    setLinearCanStep(false);
    setMessage(`目前準備猜 ${next}，請按「猜這個數」。`);
  };

  const modeLabel = mode === 'BINARY' ? '二元搜尋' : '線性搜尋（強制逐步）';
  const questionMask = finished ? String(target) : '?????';
  const binaryFormula = `(${lowerBound} + ${upperBound}) ÷ 2 = ${recommendedGuess}`;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 p-2 sm:p-4 lg:grid lg:grid-cols-[1.3fr_1fr] lg:gap-4">
      <section className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-xl font-black text-gray-900 sm:text-2xl">{modeLabel}：猜數字挑戰</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          請在 <span className="font-bold text-amber-700">{rangeMin}</span> 到{' '}
          <span className="font-bold text-amber-700">{rangeMax}</span> 之間找出隱藏數字。
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">目前次數</p>
            <p className="text-xl font-black text-gray-900">{attempts}</p>
          </div>
          <div className="rounded-xl bg-sky-50 px-3 py-2">
            <p className="text-xs text-sky-800">目前可能範圍</p>
            <p className="text-xl font-black text-gray-900">
              {lowerBound} ~ {upperBound}
            </p>
          </div>
          <div className="rounded-xl bg-violet-50 px-3 py-2">
            <p className="text-xs text-violet-800">神秘數字</p>
            <p className="text-xl font-black tracking-wider text-gray-900">{questionMask}</p>
          </div>
        </div>

        {mode === 'BINARY' ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitBinaryGuess();
              }}
              disabled={finished}
              placeholder={`輸入 ${rangeMin}~${rangeMax} 的整數`}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-2xl font-black tracking-wide outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-gray-50 sm:text-3xl"
            />
            <button
              type="button"
              onClick={submitBinaryGuess}
              disabled={finished}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              送出答案
            </button>
            <button
              type="button"
              onClick={resetGame}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700"
            >
              重新開始
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">
              目前猜測數字：
              <span className="ml-1 align-middle text-3xl font-black leading-none text-gray-900 sm:text-4xl">
                {linearCursor}
              </span>
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={submitLinearGuess}
                disabled={finished || linearCanStep}
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                猜這個數
              </button>
              <button
                type="button"
                onClick={moveLinearNext}
                disabled={finished || !linearCanStep}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 disabled:opacity-50"
              >
                下一個數
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700"
              >
                重新開始
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">教學說明</h3>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showTheory}
              onChange={(e) => setShowTheory(e.target.checked)}
            />
            顯示理論次數比較
          </label>
          {mode === 'BINARY' && hintEnabled && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
              <p className="font-bold">下一步計算（提示區）</p>
              <p className="mt-1 font-mono">{binaryFormula}</p>
            </div>
          )}
          {mode === 'BINARY' && !hintEnabled && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
              這是「無提示版」，不顯示最佳下一步與範圍建議。
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl bg-indigo-50 px-3 py-3 text-sm leading-6 text-indigo-900">
          {mode === 'BINARY' ? (
            <>
              每次切半會更快。這個範圍理論大約 {theory} 次可找到答案。
              {showTheory && attempts > 0 ? ` 你目前用了 ${attempts} 次。` : ''}
            </>
          ) : (
            <>
              線性搜尋是從頭一個一個試。這版會強制你按「猜這個數」後，才能按「下一個數」。
              {showTheory && attempts > 0 ? ` 你目前用了 ${attempts} 次。` : ''}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
