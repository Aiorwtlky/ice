'use client';

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

function optimalSteps(n: number) {
  return Math.pow(2, n) - 1;
}

function discColor(level: number, n: number) {
  const t = n <= 1 ? 0 : (level - 1) / (n - 1);
  const hue = 35 + Math.round(180 * t); // amber -> teal
  return `hsl(${hue} 85% 55%)`;
}

function rainbowDiscColor(level: number, n: number) {
  const t = n <= 1 ? 0 : (level - 1) / (n - 1);
  const hue = Math.round(360 * t);
  return `hsl(${hue} 88% 56%)`;
}

function buildHanoiHelpHint(
  n: number,
  rods: number[][],
  picked: { from: 0 | 1 | 2; disc: number } | null,
  done: boolean,
  steps: number
): string {
  const name = (i: 0 | 1 | 2) => (i === 0 ? '左' : i === 1 ? '中' : '右');
  if (done) {
    return '你已經過關了！想再挑戰可按右上角的「重來」；要離開請用畫面上的「返回」。';
  }
  if (picked) {
    return `你現在拿著盤子 ${picked.disc}（柱子上最上面、最小的那個）。請點「${name(0)}、${name(1)}、${name(2)}」裡的另一根柱子把盤子放過去。若只是誤觸、想先放回去，再點一次「${name(picked.from)}柱」就好，不會算一步喔。`;
  }
  const allOnLeft = rods[0].length === n && rods[1].length === 0 && rods[2].length === 0;
  if (allOnLeft) {
    return '還沒開始搬呢。請先點「左柱」拿起最上面最小的盤子，再點「中柱」或「右柱」放下去。規則是：一次只能動一個盤子，而且大盤不可以壓在小盤上面，最後要全部疊到「右柱」。';
  }
  const onRight = rods[2].length;
  if (onRight >= 1 && onRight < n) {
    return `右柱已經有 ${onRight} 個盤子了，方向正確！繼續搬，目標是右柱疊滿 ${n} 個，而且下面大、上面小。卡住時想想看：有時要先暫時移到中柱「讓路」。`;
  }
  if (rods[0].length === 0 && onRight < n) {
    return '左柱已經空了，盤子在中柱和右柱之間。每一步都要遵守「大不壓小」；可能需要來回調度，慢慢來沒關係。';
  }
  if (steps === 0) {
    return '請點「有盤子的那一柱」拿起最上面一個，再點另一柱完成一步。全部搬到右柱就過關；完整規則可看「規則」按鈕（手機）或右側說明（電腦）。';
  }
  return '點有盤子的柱子會拿起最上面那一個，再點目的地放下。大盤不能蓋小盤；想從頭練習可按「重來」。';
}

const HanoiGame = forwardRef<
  { openHelp: () => void },
  {
    n: number;
    sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
    onExit: () => void;
    /** 班級競賽：深色背景、動態圖案、彩虹盤 */
    competitionMode?: boolean;
    /** 競賽求助文案（不提供盤面提示） */
    competitionHelpMessage?: string;
    rainbowDiscs?: boolean;
    moveLimit?: number | null;
    /** 父層每秒同步；<=0 時鎖定 */
    timeRemainingSec?: number | null;
    onTimeExpired?: () => void;
    /** 通關當下（步數、本局耗時 ms） */
    onCompleted?: (payload: { steps: number; timeMs: number | null }) => void;
  }
>(function HanoiGame(
  {
    n,
    sendLog,
    onExit,
    competitionMode = false,
    competitionHelpMessage,
    rainbowDiscs = false,
    moveLimit = null,
    timeRemainingSec = null,
    onTimeExpired,
    onCompleted,
  },
  ref
) {
  const [rods, setRods] = useState<number[][]>(() => [Array.from({ length: n }, (_, i) => n - i), [], []]);
  const [picked, setPicked] = useState<{ from: 0 | 1 | 2; disc: number } | null>(null);
  const [steps, setSteps] = useState(0);
  const successSentRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpHint, setHelpHint] = useState('');
  const done = rods[2].length === n;
  const playStartedAtRef = useRef<number | null>(null);
  const timeExpiredSentRef = useRef(false);
  const moveLimitLogSentRef = useRef(false);
  const completedCallbackRef = useRef(false);

  const moveExceeded =
    competitionMode && moveLimit != null && moveLimit > 0 && !done && steps > moveLimit;
  const timeUp = competitionMode && timeRemainingSec != null && timeRemainingSec <= 0 && !done;

  const colorAt = (level: number) => (rainbowDiscs ? rainbowDiscColor(level, n) : discColor(level, n));

  useImperativeHandle(
    ref,
    () => ({
      openHelp: () => {
        if (competitionHelpMessage) {
          setHelpHint(competitionHelpMessage);
        } else {
          setHelpHint(buildHanoiHelpHint(n, rods, picked, done, steps));
        }
        setHelpOpen(true);
      },
    }),
    [n, rods, picked, done, steps, competitionHelpMessage]
  );

  useEffect(() => {
    if (competitionMode && playStartedAtRef.current === null && !done) {
      playStartedAtRef.current = Date.now();
    }
  }, [competitionMode, done]);

  useEffect(() => {
    if (!moveExceeded) return;
    if (moveLimitLogSentRef.current) return;
    moveLimitLogSentRef.current = true;
    sendLog('MOVE_LIMIT_EXCEEDED', { isCorrect: false, payload: { steps, moveLimit, discs: n } });
  }, [moveExceeded, sendLog, steps, moveLimit, n]);

  useEffect(() => {
    if (!timeUp) return;
    if (timeExpiredSentRef.current) return;
    timeExpiredSentRef.current = true;
    onTimeExpired?.();
    sendLog('TIME_UP', { payload: { steps, done } });
  }, [timeUp, onTimeExpired, sendLog, steps, done]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(id);
  }, [toast]);

  const tryPickOrDrop = (rodIdx: 0 | 1 | 2) => {
    if (done) return;
    if (competitionMode && timeRemainingSec != null && timeRemainingSec <= 0) return;
    if (competitionMode && moveExceeded) return;

    // pick
    if (!picked) {
      const stack = rods[rodIdx];
      if (!stack.length) return;
      const disc = stack[stack.length - 1];
      setPicked({ from: rodIdx, disc });
      sendLog('PICK', { payload: { discLevel: disc, fromRod: rodIdx } });
      return;
    }

    // drop
    const disc = picked.disc;
    const from = picked.from;
    // 點回原柱：取消拿起，不計步（尚未完成一次移動）
    if (rodIdx === from) {
      setPicked(null);
      return;
    }

    const destStack = rods[rodIdx];
    const top = destStack[destStack.length - 1];
    const legal = top === undefined || disc < top;
    sendLog('DROP', { payload: { discLevel: disc, fromRod: from, toRod: rodIdx, legal } });

    if (!legal) {
      setToast('不行喔！大盤子不能放在小盤子上');
      return;
    }

    setRods((prev) => {
      const next = prev.map((r) => [...r]) as [number[], number[], number[]];
      next[from].pop();
      next[rodIdx].push(disc);
      return next;
    });
    setPicked(null);
    setSteps((s) => s + 1);
  };

  useEffect(() => {
    if (!done) return;
    if (successSentRef.current) return;
    if (competitionMode && moveExceeded) return;
    successSentRef.current = true;
    const timeMs = playStartedAtRef.current ? Date.now() - playStartedAtRef.current : null;
    sendLog('SUCCESS', { isCorrect: true, payload: { steps, optimal: optimalSteps(n), discs: n, timeMs } });
    if (!completedCallbackRef.current && onCompleted) {
      completedCallbackRef.current = true;
      onCompleted({ steps, timeMs });
    }
  }, [done, sendLog, steps, n, competitionMode, onCompleted, moveExceeded]);

  const reset = () => {
    setRods([Array.from({ length: n }, (_, i) => n - i), [], []]);
    setPicked(null);
    setSteps(0);
    successSentRef.current = false;
    moveLimitLogSentRef.current = false;
    completedCallbackRef.current = false;
    if (competitionMode) playStartedAtRef.current = Date.now();
    sendLog('RESET', { payload: { discs: n } });
  };

  const optimal = optimalSteps(n);

  const discHClass =
    n >= 9
      ? 'h-[0.45rem] min-h-[7px] sm:h-5 lg:h-9'
      : n >= 7
        ? 'h-[0.52rem] min-h-[8px] sm:h-6 lg:h-10'
        : n === 6
          ? 'h-[0.55rem] min-h-[9px] sm:h-6 lg:h-11'
          : n >= 5
            ? 'h-[0.62rem] min-h-[10px] sm:h-7 lg:h-12'
            : n === 4
              ? 'h-5 sm:h-8 lg:h-12'
              : 'h-6 sm:h-9 lg:h-12';
  const discGapClass =
    n >= 9 ? 'gap-px sm:gap-0.5 lg:gap-1' : n >= 6 ? 'gap-px sm:gap-1 lg:gap-1.5' : n >= 5 ? 'gap-px sm:gap-1 lg:gap-2' : 'gap-1 sm:gap-1.5 lg:gap-2';

  const rulesCardInner = (
    <>
      <h2 className="text-base font-extrabold tracking-tight text-gray-900 sm:text-lg">
        河內塔（{n} 層）{competitionMode ? <span className="ml-2 text-xs font-bold text-violet-600">競賽</span> : null}
      </h2>
      <p className="mt-1 text-xs text-gray-600 sm:text-sm">
        把所有盤子搬到<span className="font-semibold text-amber-700">最右邊</span>就過關。
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 sm:text-xs">目前步數</div>
          <div className="text-xl font-extrabold tabular-nums text-gray-900 sm:text-2xl">{steps}</div>
        </div>
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 sm:text-xs">最佳步數</div>
          <div className="text-xl font-extrabold tabular-nums text-gray-900 sm:text-2xl">{optimal}</div>
        </div>
      </div>
      {competitionMode &&
        (timeRemainingSec != null || (moveLimit != null && moveLimit !== optimal)) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {moveLimit != null && moveLimit !== optimal ? (
            <div className="rounded-xl border border-violet-200/90 bg-violet-50/90 px-3 py-2">
              <div className="text-[10px] font-bold text-violet-800 sm:text-xs">計次上限</div>
              <div className="text-lg font-extrabold tabular-nums text-violet-950">{moveLimit}</div>
            </div>
          ) : null}
          {timeRemainingSec != null ? (
            <div className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 py-2">
              <div className="text-[10px] font-bold text-sky-800 sm:text-xs">剩餘時間</div>
              <div className="text-lg font-extrabold tabular-nums text-sky-950">{Math.max(0, timeRemainingSec)} 秒</div>
            </div>
          ) : null}
        </div>
      )}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs font-bold text-gray-500">遊戲規則</p>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-gray-600 sm:text-sm">
          <li className="flex gap-2"><span className="font-bold text-amber-600">①</span>一次只能移動一個盤子</li>
          <li className="flex gap-2"><span className="font-bold text-amber-600">②</span>大盤子不能放在小盤子上面</li>
          <li className="flex gap-2"><span className="font-bold text-amber-600">③</span>盤子要整疊移到右柱</li>
        </ul>
      </div>
    </>
  );

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col lg:flex-row lg:gap-5 lg:p-1 ${competitionMode ? 'text-white' : ''}`}
    >
      {competitionMode && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[#070b14]"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.22] hanoi-tech-grid" aria-hidden />
        </>
      )}
      {/* 小螢幕：頂列分數 + 規則（電腦 lg+ 維持右側完整卡） */}
      <div
        className={`relative z-10 flex shrink-0 items-center gap-2 border-b px-2 py-2 lg:hidden ${
          competitionMode ? 'border-white/10 bg-black/40' : 'border-gray-100 bg-white/95'
        }`}
      >
        <span className={`shrink-0 text-xs font-extrabold ${competitionMode ? 'text-white' : 'text-gray-800'}`}>
          河內塔 {n} 層
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <div
            className={`rounded-lg border px-2 py-1 text-center ${competitionMode ? 'border-amber-400/40 bg-amber-500/20' : 'border-amber-200 bg-amber-50'}`}
          >
            <div className={`text-[9px] font-bold ${competitionMode ? 'text-amber-100' : 'text-amber-800'}`}>步數</div>
            <div className={`text-sm font-extrabold tabular-nums ${competitionMode ? 'text-white' : ''}`}>{steps}</div>
          </div>
          <div
            className={`rounded-lg border px-2 py-1 text-center ${competitionMode ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-emerald-200 bg-emerald-50'}`}
          >
            <div className={`text-[9px] font-bold ${competitionMode ? 'text-emerald-100' : 'text-emerald-800'}`}>最佳</div>
            <div className={`text-sm font-extrabold tabular-nums ${competitionMode ? 'text-white' : ''}`}>{optimal}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className={`shrink-0 rounded-xl border-2 px-3 py-2 text-xs font-bold active:scale-[0.98] ${
            competitionMode
              ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-50'
              : 'border-amber-400 bg-amber-50 text-amber-900'
          }`}
        >
          規則
        </button>
      </div>

      <div
        className={`relative z-10 order-1 flex min-h-0 min-w-0 flex-1 flex-col p-1.5 sm:p-4 lg:order-1 lg:rounded-l-2xl lg:p-5 ${
          competitionMode ? 'bg-transparent' : 'bg-gradient-to-b from-[#FDFBF7] to-white'
        }`}
      >
        <button
          type="button"
          onClick={reset}
          className={`absolute right-2 top-2 z-20 rounded-xl border-2 px-3 py-2 text-xs font-bold shadow-sm sm:right-3 sm:top-3 sm:px-4 sm:text-sm ${
            competitionMode
              ? 'border-white/30 bg-white/10 text-white hover:bg-white/15'
              : 'border-gray-300 bg-white/95 text-gray-800 hover:bg-gray-50'
          }`}
        >
          重來
        </button>
        <div className="grid min-h-[42vh] flex-1 grid-cols-3 gap-1.5 pt-10 sm:min-h-[min(52vh,420px)] sm:gap-3 sm:pt-11 lg:min-h-[320px] lg:gap-5 lg:pt-5">
          {([0, 1, 2] as const).map((i) => {
            const stack = rods[i];
            const top = stack[stack.length - 1];
            const isPickable = !done && !picked && top !== undefined;
            const isTarget = !!picked;
            const label = i === 0 ? '左' : i === 1 ? '中' : '右';
            return (
              <button
                key={i}
                type="button"
                onClick={() => tryPickOrDrop(i)}
                className={`relative flex min-h-[120px] flex-col rounded-xl border-2 p-1.5 text-left shadow-sm transition sm:min-h-[200px] sm:rounded-2xl sm:p-3 lg:min-h-0 ${
                  competitionMode
                    ? isPickable
                      ? 'border-amber-400/90 bg-white/10 ring-2 ring-amber-400/30 hover:border-amber-300'
                      : isTarget
                        ? 'border-sky-400/50 bg-white/5 hover:border-sky-300/80'
                        : 'border-white/15 bg-white/5'
                    : isPickable
                      ? 'border-amber-400 bg-white ring-2 ring-amber-100 hover:border-amber-500'
                      : isTarget
                        ? 'border-sky-200 bg-white hover:border-sky-300'
                        : 'border-gray-200/90 bg-white'
                }`}
                aria-label={`柱子${label}`}
              >
                <div className="relative z-10 flex shrink-0 items-center justify-between gap-1">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest sm:text-xs ${competitionMode ? 'text-white/70' : 'text-gray-500'}`}
                  >
                    柱 {label}
                  </span>
                  {picked?.from === i && (
                    <span className="rounded-full bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white sm:px-2 sm:text-xs">已拿起</span>
                  )}
                </div>
                <div className="pointer-events-none absolute bottom-[12%] left-1/2 top-[16%] w-1.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-gray-400 to-gray-300 sm:bottom-[14%] sm:top-[18%] sm:w-2.5" />
                <div className="pointer-events-none absolute bottom-[8%] left-1/2 h-2.5 w-[88%] -translate-x-1/2 rounded-md bg-gray-400/90 sm:bottom-[10%] sm:h-3 lg:h-4" />
                <div
                  className={`absolute bottom-[12%] left-1 right-1 top-[20%] flex flex-col-reverse items-center justify-start sm:left-2 sm:right-2 sm:bottom-[14%] sm:top-[22%] ${discGapClass}`}
                >
                  {stack.map((disc) => {
                    const pickedHere = picked && picked.from === i && picked.disc === disc && disc === top;
                    const widthPct = 38 + ((disc - 1) / Math.max(1, n - 1)) * 52;
                    return (
                      <div
                        key={disc}
                        className={`max-w-full shrink-0 rounded-lg border border-black/10 shadow-md transition sm:rounded-xl ${discHClass} ${pickedHere ? '-translate-y-1 ring-2 ring-amber-300 sm:-translate-y-2 sm:ring-4 lg:-translate-y-3' : ''}`}
                        style={{ width: `${widthPct}%`, background: colorAt(disc) }}
                        title={`盤子 ${disc}`}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside
        className={`order-2 hidden w-[min(18rem,28vw)] max-w-xs shrink-0 flex-col gap-3 lg:flex lg:self-stretch lg:border-l lg:rounded-r-2xl lg:p-5 ${
          competitionMode
            ? 'border-white/10 bg-black/20 bg-gradient-to-b from-black/30 to-[#0a0f1a]'
            : 'border-gray-100 bg-gradient-to-b from-white to-[#FDFBF7]'
        }`}
      >
        <div
          className={`rounded-2xl border p-4 shadow-sm backdrop-blur-sm ${
            competitionMode ? 'border-white/15 bg-white/10 text-white' : 'border-gray-200/80 bg-white/95'
          }`}
        >
          <div className={competitionMode ? '[&_h2]:text-white [&_p]:text-gray-200 [&_li]:text-gray-200 [&_.text-gray-900]:text-white [&_.text-gray-600]:text-gray-300 [&_.text-gray-500]:text-gray-400 [&_.text-amber-700]:text-amber-200 [&_.border-gray-100]:border-white/10' : ''}>
            {rulesCardInner}
          </div>
        </div>
      </aside>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[46] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setHelpOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="hanoi-help-title"
          >
            <h3 id="hanoi-help-title" className="text-lg font-extrabold text-amber-700">
              {competitionHelpMessage ? '競賽說明' : '老師的小提示'}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-700">{helpHint}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600"
              onClick={() => setHelpOpen(false)}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div
          className="fixed inset-0 z-[45] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4 lg:hidden"
          onClick={() => setRulesOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="hanoi-rules-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <span id="hanoi-rules-title" className="text-lg font-extrabold text-gray-900">遊戲說明</span>
              <button type="button" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100" onClick={() => setRulesOpen(false)}>關閉</button>
            </div>
            {rulesCardInner}
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>
        </div>
      )}

      {timeUp && !done && competitionMode && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-gray-900 p-6 text-center text-white shadow-xl">
            <div className="text-2xl font-extrabold text-amber-400">時間到</div>
            <p className="mt-2 text-sm text-gray-300">限時模式已結束，無法繼續操作。</p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onExit}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}

      {moveExceeded && !done && competitionMode && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-gray-900 p-6 text-center text-white shadow-xl">
            <div className="text-2xl font-extrabold text-violet-400">超過計次</div>
            <p className="mt-2 text-sm text-gray-300">
              目前步數 {steps}
              {moveLimit != null && moveLimit !== optimalSteps(n)
                ? `，計次上限 ${moveLimit} 步`
                : `，已超過最少步數（${optimalSteps(n)} 步）`}
              。請按「重來」再挑戰。
            </p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={reset} className="flex-1 rounded-xl border border-white/30 py-2.5 text-sm font-bold text-white">
                重來
              </button>
              <button type="button" onClick={onExit} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white">
                返回
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl text-gray-900">
            <div className="text-2xl font-extrabold text-amber-600">過關！</div>
            <div className="mt-2 text-sm text-gray-700">你的步數：<span className="font-bold">{steps}</span></div>
            <div className="text-sm text-gray-700">最佳步數：<span className="font-bold">{optimalSteps(n)}</span></div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800"
              >
                再玩一次
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-600"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

HanoiGame.displayName = 'HanoiGame';

function Click1Game({
  sendLog,
  onSuccess,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
  onSuccess: () => void;
}) {
  const [done, setDone] = useState(false);

  const handleClick = () => {
    if (done) return;
    sendLog('CLICK', { payload: { button: 'center', count: 1 } });
    sendLog('SUCCESS', { isCorrect: true, payload: { button: 'center' } });
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-2xl font-bold text-amber-600">過關！</p>
        <p className="text-sm text-gray-600">請點擊左下角「返回」離開</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl bg-amber-500 px-12 py-8 text-xl font-bold text-white shadow-lg hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-300"
      >
        點我 1 次
      </button>
    </div>
  );
}

function Click2Game({
  sendLog,
  onSuccess,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
  onSuccess: () => void;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setCount(0);
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleClick = () => {
    if (done) return;
    if (count === 0) {
      setCount(1);
      sendLog('CLICK', { payload: { button: 'center', count: 1 } });
      timeoutRef.current = setTimeout(() => {
        sendLog('ERROR', { isCorrect: false, payload: { reason: 'timeout_3s' } });
        reset();
      }, 3000);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    sendLog('CLICK', { payload: { button: 'center', count: 2 } });
    sendLog('SUCCESS', { isCorrect: true, payload: { button: 'center', clicks: 2 } });
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-2xl font-bold text-amber-600">過關！</p>
        <p className="text-sm text-gray-600">請點擊左下角「返回」離開</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-2xl bg-amber-500 px-12 py-8 text-xl font-bold text-white shadow-lg hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-300"
      >
        連續點我 2 次
      </button>
      {count === 1 && <p className="mt-4 text-sm text-gray-500">再點 1 次（3 秒內）</p>}
    </div>
  );
}

function MonsterGobblerGame({
  sendLog,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
}) {
  type Mode = 'QUEUE' | 'STACK';
  const [foods, setFoods] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('QUEUE');
  const [toast, setToast] = useState<string | null>(null);
  /** 切換模式後大字提示（1.5s） */
  const [modeFlash, setModeFlash] = useState<Mode | null>(null);
  const [shake, setShake] = useState<'none' | 'poop' | 'vomit'>('none');
  const [lastOut, setLastOut] = useState<{ kind: 'poop' | 'vomit'; food: string; id: number } | null>(null);
  const outIdRef = useRef(1);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!modeFlash) return;
    const id = setTimeout(() => setModeFlash(null), 1500);
    return () => clearTimeout(id);
  }, [modeFlash]);

  useEffect(() => {
    if (shake === 'none') return;
    const id = setTimeout(() => setShake('none'), 420);
    return () => clearTimeout(id);
  }, [shake]);

  const feed = (emoji: string) => {
    setFoods((prev) => [...prev, emoji]);
    sendLog('FEED', { payload: { food: emoji, size: foods.length + 1 } });
  };

  const toggleMode = () => {
    const next: Mode = mode === 'QUEUE' ? 'STACK' : 'QUEUE';
    setMode(next);
    setModeFlash(next);
    sendLog('MODE', { payload: { mode: next, size: foods.length } });
  };

  const act = () => {
    if (foods.length === 0) {
      setToast('肚子是空的，先餵牠吃點東西吧！');
      sendLog('EMPTY', { payload: { mode } });
      return;
    }
    if (mode === 'QUEUE') {
      const first = foods[0];
      setFoods((prev) => prev.slice(1));
      setShake('poop');
      setLastOut({ kind: 'poop', food: first, id: outIdRef.current++ });
      sendLog('SHIFT', { payload: { out: first, mode, sizeAfter: foods.length - 1 } });
      return;
    }
    const last = foods[foods.length - 1];
    setFoods((prev) => prev.slice(0, -1));
    setShake('vomit');
    setLastOut({ kind: 'vomit', food: last, id: outIdRef.current++ });
    sendLog('POP', { payload: { out: last, mode, sizeAfter: foods.length - 1 } });
  };

  const modeLabel = mode === 'QUEUE' ? '💩 腸胃順暢（佇列）' : '🤮 反芻模式（堆疊）';
  const actionLabel = mode === 'QUEUE' ? '噗噗拉出來！' : '嘔嘔吐出來！';

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-[#FDFBF7] to-white p-3 sm:p-5">
      <style jsx>{`
        @keyframes shakePoop {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-2px, 1px) rotate(-1deg); }
          50% { transform: translate(2px, -1px) rotate(1deg); }
          75% { transform: translate(-2px, -1px) rotate(-1deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes shakeVomit {
          0% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(2px, 0) rotate(1deg); }
          40% { transform: translate(-2px, 0) rotate(-1deg); }
          60% { transform: translate(2px, 0) rotate(1deg); }
          80% { transform: translate(-2px, 0) rotate(-1deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes dropOut {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 120px); opacity: 0; }
        }
        @keyframes flyOut {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          100% { transform: translate(120px, -90px) scale(1.2); opacity: 0; }
        }
      `}</style>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* 左：怪獸（肚子 flex-1 盡量用到可視區高度，滿了才內捲） */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className="relative flex h-full min-h-0 w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[2.25rem] border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm sm:mx-auto lg:mx-0 lg:max-w-none"
            style={{
              animation:
                shake === 'poop' ? 'shakePoop 0.4s ease-in-out' : shake === 'vomit' ? 'shakeVomit 0.4s ease-in-out' : undefined,
            }}
          >
            <div className="flex shrink-0 items-center justify-between">
              <div className="text-sm font-extrabold text-gray-900">怪獸大胃王</div>
              <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                肚子：{foods.length}
              </div>
            </div>

            {/* 頭/嘴 */}
            <div className="mt-3 flex shrink-0 items-center justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg">
                <div className="absolute -left-2 top-8 h-5 w-5 rounded-full bg-white/90" />
                <div className="absolute -right-2 top-8 h-5 w-5 rounded-full bg-white/90" />
                <div className="absolute bottom-4 h-8 w-14 rounded-b-[999px] rounded-t-[999px] bg-gray-900/90" />
              </div>
            </div>

            {/* 透明肚子：flex-1 吃滿外卡剩餘高度 */}
            <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-emerald-200 bg-emerald-50/50 p-3 sm:p-4">
              <div className="shrink-0 text-xs font-bold text-emerald-900/80">透明肚子（食物進來會排隊）</div>
              <div className="mt-2 flex shrink-0 items-center justify-between text-[11px] text-emerald-900/70">
                <span className="font-bold">新吃的在上面</span>
                <span className="font-bold">先吃的在下面</span>
              </div>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-emerald-200 bg-white/70 p-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] min-h-[4.5rem] pb-1">
                {foods.length === 0 ? (
                  <span className="text-sm text-gray-500">還沒吃到東西，快餵牠！</span>
                ) : (
                  <div className="flex flex-col gap-2">
                    {[...foods].reverse().map((f, revIdx) => {
                      const idx = foods.length - 1 - revIdx; // 原始順序 index
                      const isNewest = idx === foods.length - 1;
                      const isOldest = idx === 0;
                      return (
                      <div
                        key={`${f}-${idx}-${foods.length}`}
                        className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
                        title={`第 ${idx + 1} 個`}
                      >
                        <span className="w-10 text-center text-2xl">{f}</span>
                        <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                        <div className="ml-auto text-xs font-bold text-emerald-800">
                          {isOldest ? '佇列先出' : isNewest ? '堆疊先出' : ''}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 吐/拉動畫 */}
            {lastOut && (
              <>
                {lastOut.kind === 'vomit' && (
                  <div
                    key={lastOut.id}
                    className="pointer-events-none absolute left-1/2 top-[92px] text-4xl"
                    style={{ animation: 'flyOut 0.75s ease-out forwards' }}
                    aria-hidden
                  >
                    {lastOut.food}
                  </div>
                )}
                {lastOut.kind === 'poop' && (
                  <div
                    key={lastOut.id}
                    className="pointer-events-none absolute left-1/2 bottom-[22px] text-3xl"
                    style={{ animation: 'dropOut 0.75s ease-out forwards' }}
                    aria-hidden
                  >
                    💩
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 右：操作面板 */}
        <div className="w-full shrink-0 lg:w-[22rem]">
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-gray-900">操作區</div>
                <div className="mt-1 text-xs font-bold text-gray-500">模式：{modeLabel}</div>
              </div>
              <button
                type="button"
                onClick={toggleMode}
                className="shrink-0 rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
              >
                切換模式
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { e: '🍎', label: '蘋果' },
                { e: '🍔', label: '漢堡' },
                { e: '🌶️', label: '辣椒' },
                { e: '🐟', label: '魚' },
              ].map((x) => (
                <button
                  key={x.e}
                  type="button"
                  onClick={() => feed(x.e)}
                  className="rounded-2xl border border-gray-200 bg-white py-3 text-2xl shadow-sm transition hover:border-amber-300 hover:bg-amber-50 active:scale-[0.98]"
                  aria-label={`餵 ${x.label}`}
                  title={`餵 ${x.label}`}
                >
                  {x.e}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={act}
              className={`mt-4 w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white shadow-md transition active:scale-[0.99] ${
                mode === 'QUEUE' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-fuchsia-600 hover:bg-fuchsia-700'
              }`}
            >
              {actionLabel}
            </button>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="text-xs font-bold text-gray-500">教學（超簡單）</div>
              <div className="mt-1 leading-relaxed">
                餵食＝<span className="font-mono font-bold">push</span>。<br />
                {mode === 'QUEUE' ? (
                  <span>拉出來＝<span className="font-mono font-bold">shift</span>（佇列：先進先出）。</span>
                ) : (
                  <span>吐出來＝<span className="font-mono font-bold">pop</span>（堆疊：後進先出）。</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>
        </div>
      )}

      {modeFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
          aria-live="polite"
        >
          <div className="max-w-[min(96vw,28rem)] rounded-3xl border-2 border-white/80 bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-8 text-center shadow-2xl sm:px-10 sm:py-10">
            <p className="text-balance text-3xl font-black tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
              {modeFlash === 'QUEUE' ? '佇列' : '堆疊'}
            </p>
            <p className="mt-2 text-balance text-2xl font-bold leading-snug text-white/95 drop-shadow sm:mt-3 sm:text-3xl md:text-4xl">
              {modeFlash === 'QUEUE' ? '（先進先出）' : '（後進先出）'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BubbleTeaMasterGame({
  sendLog,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
}) {
  type Mode = 'QUEUE' | 'STACK';
  type Base = '🍵' | '🧋';
  // 目前先固定基底；之後若要做「奶茶/紅茶」再打開 UI
  const base: Base = '🧋';
  // toppings：由下往上（index 0 是最底部、最後一個是最上面）
  const [toppings, setToppings] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('QUEUE');
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState<'none' | 'sip' | 'scoop'>('none');
  const [outFx, setOutFx] = useState<{ kind: 'sip' | 'scoop'; emoji: string; id: number } | null>(null);
  const outIdRef = useRef(1);
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomItemRef = useRef<HTMLDivElement | null>(null);
  const topItemRef = useRef<HTMLDivElement | null>(null);
  const lastActionRef = useRef<'ADD' | 'SHIFT' | 'POP' | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (shake === 'none') return;
    const id = setTimeout(() => setShake('none'), 420);
    return () => clearTimeout(id);
  }, [shake]);

  useEffect(() => {
    // 新增/吸走/挖走後，自動把杯內捲軸對準「那一層」
    // - ADD / POP：焦點在最上面（最新）
    // - SHIFT：焦點在杯底（最早）
    const a = lastActionRef.current;
    if (!a) return;
    const target = a === 'SHIFT' ? bottomItemRef.current : topItemRef.current;
    if (!target) return;
    // 等 layout 穩定再捲動，避免偶發不生效
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: a === 'SHIFT' ? 'end' : 'start' });
    });
  }, [toppings.length]);

  const addTopping = (emoji: string) => {
    lastActionRef.current = 'ADD';
    setToppings((prev) => [...prev, emoji]);
    sendLog('ADD', { payload: { topping: emoji, size: toppings.length + 1 } });
  };

  const toggleMode = () => {
    const next: Mode = mode === 'QUEUE' ? 'STACK' : 'QUEUE';
    setMode(next);
    sendLog('MODE', { payload: { mode: next, size: toppings.length } });
    setToast(next === 'QUEUE' ? '切換：粗吸管（佇列）先進先出' : '切換：長湯匙（堆疊）後進先出');
  };

  const drinkAction = () => {
    if (toppings.length === 0) {
      setToast('杯子是空的，先加配料吧！');
      sendLog('EMPTY', { payload: { mode } });
      return;
    }
    if (mode === 'QUEUE') {
      lastActionRef.current = 'SHIFT';
      const bottom = toppings[0];
      setToppings((prev) => prev.slice(1));
      setShake('sip');
      setOutFx({ kind: 'sip', emoji: bottom, id: outIdRef.current++ });
      sendLog('SHIFT', { payload: { out: bottom, mode, sizeAfter: toppings.length - 1 } });
      return;
    }
    lastActionRef.current = 'POP';
    const top = toppings[toppings.length - 1];
    setToppings((prev) => prev.slice(0, -1));
    setShake('scoop');
    setOutFx({ kind: 'scoop', emoji: top, id: outIdRef.current++ });
    sendLog('POP', { payload: { out: top, mode, sizeAfter: toppings.length - 1 } });
  };

  const modeLabel = mode === 'QUEUE' ? '🥤 粗吸管（佇列）' : '🥄 長湯匙（堆疊）';
  const actionLabel = mode === 'QUEUE' ? '用力吸！' : '從上面挖！';

  return (
    <div className="relative h-full min-h-0 bg-gradient-to-b from-[#FDFBF7] to-white p-3 sm:p-5">
      <style jsx>{`
        @keyframes cupShake {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-2px, 0) rotate(-0.6deg); }
          50% { transform: translate(2px, 0) rotate(0.6deg); }
          75% { transform: translate(-2px, 0) rotate(-0.6deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes sipUp {
          0% { transform: translate(-50%, 10px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -120px) scale(0.9); opacity: 0; }
        }
        @keyframes scoopOut {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          100% { transform: translate(120px, -90px) scale(1.1); opacity: 0; }
        }
      `}</style>

      <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col gap-4 lg:flex-row lg:items-start">
        {/* 左：杯子 */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center">
          <div
            className="relative w-full max-w-[520px] rounded-[2.25rem] border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm"
            style={{
              animation: shake === 'none' ? undefined : 'cupShake 0.4s ease-in-out',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-gray-900">手搖飲大師</div>
                <div className="mt-1 text-xs font-bold text-gray-500">模式：{modeLabel}</div>
              </div>
              <div className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                配料：{toppings.length}
              </div>
            </div>

            {/* 杯子本體 */}
            <div className="mt-4 flex items-start justify-center gap-4">
              {/* 增加左右「外側空間」讓吸管/湯匙不壓到杯內或標題 */}
              <div className="relative isolate w-[280px] sm:w-[320px]">
                {/* 器具錨點：偏上，避免與右側操作欄視覺重疊；長湯匙在上半部以掩飾堆疊頂層 */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[min(58vh,520px)]" aria-hidden>
                  {mode === 'QUEUE' ? (
                    <div className="absolute left-2 top-2 h-[min(78%,300px)] w-[14px] -rotate-6 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 opacity-95 shadow-md">
                      <div className="absolute -left-1 top-6 h-7 w-7 rounded-full bg-amber-200/80 blur-[10px]" />
                      <div className="absolute bottom-10 left-1/2 h-7 w-7 -translate-x-1/2 rounded-full bg-amber-300/60 blur-lg" />
                      <div className="absolute bottom-3 left-1/2 h-5 w-8 -translate-x-1/2 rounded-full bg-amber-400/80 shadow-inner" />
                    </div>
                  ) : (
                    <div className="absolute right-1 top-3 h-[min(46%,240px)] min-h-[120px] max-h-[260px] w-[12px] rotate-[12deg]">
                      <div className="relative h-full w-[10px] rounded-full bg-gradient-to-b from-gray-100 to-gray-400 shadow-md">
                        <div className="absolute -right-2 top-5 h-7 w-7 rounded-full bg-gray-200/80 blur-[10px]" />
                        <div className="absolute bottom-0 left-1/2 h-11 w-11 -translate-x-1/2 translate-y-1/4 rounded-full bg-gray-200 shadow-inner" />
                        <div className="absolute bottom-1 left-1/2 h-7 w-7 -translate-x-1/2 rounded-full bg-white/75 shadow-sm" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 透明杯：高度改成吃滿畫面，配料區能長就長 */}
                <div className="relative z-0 mx-auto h-[min(52vh,480px)] w-[260px] sm:h-[min(54vh,500px)] sm:w-[280px] overflow-hidden rounded-b-[2.5rem] rounded-t-[1.5rem] border-2 border-sky-200 bg-sky-50/40 shadow-inner">
                  {/* 杯口 */}
                  <div className="absolute inset-x-0 top-0 h-8 bg-white/40" />
                  {/* 飲料底色 */}
                  <div className="absolute inset-x-0 bottom-0 h-[76%] bg-gradient-to-t from-amber-100/60 to-white/10" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.65),transparent_40%)]" />

                  {/* 杯中配料：由下往上堆疊 */}
                  {/* 真的塞滿才在杯內捲動；平常優先用掉上下空間 */}
                  <div
                    ref={listRef}
                    className={`absolute inset-x-0 bottom-3 top-14 z-[1] flex items-center gap-1.5 overflow-y-auto px-4 pr-2 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-sky-100/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sky-300/80 hover:[&::-webkit-scrollbar-thumb]:bg-sky-400 ${
                      toppings.length === 0 ? 'justify-center' : 'flex-col-reverse justify-start'
                    }`}
                  >
                    {toppings.length === 0 ? (
                      <div className="text-center text-sm text-gray-500">先加配料！</div>
                    ) : (
                      toppings.map((t, idx) => (
                        <div
                          key={`${t}-${idx}-${toppings.length}`}
                          ref={(el) => {
                            // idx 0 = 杯底（最早）；idx last = 最上（最新）
                            if (idx === 0) bottomItemRef.current = el;
                            if (idx === toppings.length - 1) topItemRef.current = el;
                          }}
                          className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white/85 px-3 py-1.5 shadow-sm"
                          title={`第 ${idx + 1} 個（底→上）`}
                        >
                          <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                          <span className="text-2xl">{t}</span>
                          <span className="text-[11px] font-bold text-sky-800">
                            {idx === 0 ? '佇列先出' : idx === toppings.length - 1 ? '堆疊先出' : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 杯底 */}
                  <div className="absolute inset-x-0 bottom-0 h-3 bg-sky-200/80" />

                  {/* 飛出/吸走特效 */}
                  {outFx && outFx.kind === 'sip' && (
                    <div
                      key={outFx.id}
                      className="pointer-events-none absolute left-1/2 bottom-[46px] z-30 text-4xl"
                      style={{ animation: 'sipUp 0.75s ease-out forwards' }}
                      aria-hidden
                    >
                      {outFx.emoji}
                    </div>
                  )}
                  {outFx && outFx.kind === 'scoop' && (
                    <div
                      key={outFx.id}
                      className="pointer-events-none absolute left-1/2 top-[38px] z-30 text-4xl"
                      style={{ animation: 'scoopOut 0.75s ease-out forwards' }}
                      aria-hidden
                    >
                      {outFx.emoji}
                    </div>
                  )}
                </div>

                {/* 杯底座 */}
                <div className="mx-auto mt-3 h-3 w-[80%] rounded-full bg-sky-200/80" />
              </div>

            </div>
          </div>
        </div>

        {/* 右：操作面板 */}
        <div className="w-full min-w-0 shrink-0 lg:w-[22rem]">
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-gray-900">狂加配料</div>
                <div className="mt-1 text-xs font-bold text-gray-500">點越快越好！配料會由下往上堆</div>
              </div>
              <button
                type="button"
                onClick={toggleMode}
                className="shrink-0 rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
              >
                切換模式
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { e: '⚫', label: '珍珠' },
                { e: '🍮', label: '布丁' },
                { e: '🧊', label: '冰塊' },
                { e: base, label: '茶' },
              ].map((x) => (
                <button
                  key={x.e}
                  type="button"
                  onClick={() => addTopping(x.e)}
                  className="rounded-2xl border border-gray-200 bg-white py-3 text-2xl shadow-sm transition hover:border-amber-300 hover:bg-amber-50 active:scale-[0.98]"
                  aria-label={`加 ${x.label}`}
                  title={`加 ${x.label}`}
                >
                  {x.e}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={drinkAction}
              className={`mt-4 w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white shadow-md transition active:scale-[0.99] ${
                mode === 'QUEUE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-fuchsia-600 hover:bg-fuchsia-700'
              }`}
            >
              {actionLabel}
            </button>

            <div className="mt-4 rounded-xl border border-gray-200 bg-white/90 p-3 text-sm text-gray-700 shadow-sm">
              <div className="text-xs font-bold text-gray-500">快速記法（考前 10 秒）</div>
              <div className="mt-1 leading-relaxed">
                加配料＝<span className="font-mono font-bold">push</span><br />
                粗吸管＝<span className="font-mono font-bold">shift</span>（佇列）<br />
                長湯匙＝<span className="font-mono font-bold">pop</span>（堆疊）
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="text-xs font-bold text-gray-500">教學</div>
              <div className="mt-1 leading-relaxed">
                佇列（粗吸管）：<span className="font-mono font-bold">shift</span>（底部先出）<br />
                堆疊（長湯匙）：<span className="font-mono font-bold">pop</span>（頂部先出）
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-gray-900/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

function MagicPancakeTowerGame({
  sendLog,
}: {
  sendLog: (action: string, opts?: { isCorrect?: boolean; timeDiffMs?: number; payload?: Record<string, unknown> }) => Promise<void>;
}) {
  type Flavor = 'STRAWBERRY' | 'CHOCOLATE' | 'VANILLA';
  const flavorMeta: Record<
    Flavor,
    { name: string; emoji: string; crust: string; syrup: string; accent: string }
  > = {
    STRAWBERRY: {
      name: '草莓',
      emoji: '🍓',
      crust: 'from-amber-100 to-amber-50',
      syrup: 'from-rose-200 to-rose-400',
      accent: 'text-rose-700',
    },
    CHOCOLATE: {
      name: '巧克力',
      emoji: '🍫',
      crust: 'from-amber-200 to-amber-100',
      syrup: 'from-amber-700 to-stone-800',
      accent: 'text-amber-800',
    },
    VANILLA: {
      name: '香草',
      emoji: '🍦',
      crust: 'from-amber-100 to-amber-50',
      syrup: 'from-amber-200 to-amber-100',
      accent: 'text-amber-700',
    },
  };

  type Snapshot = { level: 1 | 2; main: Flavor[]; spare: Flavor[]; fed: number; msg: string };
  const historyRef = useRef<Snapshot[]>([]);

  const [level, setLevel] = useState<1 | 2>(1);
  const [main, setMain] = useState<Flavor[]>([]);
  const [spare, setSpare] = useState<Flavor[]>([]);
  const [fed, setFed] = useState(0);
  const [msg, setMsg] = useState('Level 1：先按「加入鬆餅（push）」疊起來，再按「餵怪物（pop）」吃最上面那片。');
  const [successOpen, setSuccessOpen] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');

  const target: Flavor = 'CHOCOLATE';
  const top = main[main.length - 1];

  const pushHistory = (nextMsg: string) => {
    historyRef.current.push({ level, main: [...main], spare: [...spare], fed, msg: nextMsg });
    // 避免無限成長（小學生操作也不會太多步）
    if (historyRef.current.length > 40) historyRef.current.shift();
  };

  const resetToLevel = (lv: 1 | 2) => {
    historyRef.current = [];
    setSuccessOpen(false);
    setGameOver(false);
    setGameOverReason('');
    setFed(0);
    if (lv === 1) {
      setLevel(1);
      setMain([]);
      setSpare([]);
      setMsg('Level 1：按「加入鬆餅（push）」疊起來，再按「餵怪物（pop）」吃最上面那片。目標：餵 3 片。');
      sendLog('START', { payload: { level: 1 } });
    } else {
      setLevel(2);
      // 底→上：巧克力在最底
      setMain(['CHOCOLATE', 'VANILLA', 'STRAWBERRY']);
      setSpare([]);
      setMsg('Level 2：怪物指定要吃「巧克力」。它在最底下！請用「移到備用盤（pop）」把上面兩片先移走。');
      sendLog('START', { payload: { level: 2 } });
    }
  };

  // 初次進入
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    resetToLevel(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFlavor = (f: Flavor) => {
    if (gameOver) return;
    if (level === 2) {
      setMsg('Level 2 不用再加入鬆餅：你要做的是把「頂部」一直移到備用盤，直到目標口味到頂部再餵怪物。');
      return;
    }
    const nextMsg = `你加入了一片「${flavorMeta[f].name}」（push）。現在最上面是「${flavorMeta[f].name}」。`;
    pushHistory(msg);
    setMain((prev) => [...prev, f]);
    setMsg(nextMsg);
    sendLog('PUSH', { payload: { level, flavor: f, sizeAfter: main.length + 1 } });
  };

  const popToMonster = () => {
    if (gameOver) return;
    if (main.length === 0) {
      setMsg('主盤子是空的。先用 push 加入幾片鬆餅吧。');
      return;
    }
    const t = main[main.length - 1]!;
    if (level === 2 && t !== target) {
      setMsg(`怪物要吃「${flavorMeta[target].name}」。但最上面是「${flavorMeta[t].name}」。先把上面移到備用盤。`);
      return;
    }
    pushHistory(msg);
    const nextFed = fed + 1;
    setMain((prev) => prev.slice(0, -1));
    setFed(() => nextFed);
    setMsg(`你餵了「${flavorMeta[t].name}」（pop）。很好！`);
    sendLog('POP', { payload: { level, flavor: t, sizeAfter: main.length - 1 } });

    if (level === 1 && nextFed >= 3) {
      sendLog('SUCCESS', { isCorrect: true, payload: { level: 1, fed: fed + 1 } });
      setSuccessOpen(true);
    }
    if (level === 2 && t === target) {
      sendLog('SUCCESS', { isCorrect: true, payload: { level: 2, fedTarget: target } });
      setSuccessOpen(true);
    }
  };

  const moveToSpare = () => {
    if (gameOver) return;
    if (level !== 2) {
      setMsg('這是 Level 2 才會用到的備用盤功能。');
      return;
    }
    if (main.length === 0) {
      setMsg('主盤子已經空了，沒有可以移走的鬆餅。');
      return;
    }
    const t = main[main.length - 1]!;
    pushHistory(msg);
    setMain((prev) => prev.slice(0, -1));
    setSpare((prev) => [...prev, t]);
    setMsg(`你把最上面的「${flavorMeta[t].name}」移到備用盤（pop）。現在再看主盤頂部是誰。`);
    sendLog('MOVE_SPARE', { payload: { flavor: t, mainAfter: main.length - 1, spareAfter: spare.length + 1 } });
  };

  const undo = () => {
    if (gameOver) setGameOver(false);
    const last = historyRef.current.pop();
    if (!last) {
      setMsg('沒有可以復原的步驟了。');
      return;
    }
    setLevel(last.level);
    setMain(last.main);
    setSpare(last.spare);
    setFed(last.fed);
    setMsg(`已復原一步（Ctrl+Z）：${last.msg}`);
    setSuccessOpen(false);
    sendLog('UNDO', { payload: { level: last.level } });
  };

  // 錯誤操作：點到非頂部會倒塔 Game Over（教「只能頂部 pop」）
  const clickMainTower = (idx: number) => {
    if (gameOver) return;
    if (main.length === 0) return;
    const topIdx = main.length - 1;
    if (idx !== topIdx) {
      pushHistory(msg);
      const clicked = main[idx]!;
      setGameOver(true);
      setGameOverReason('你點到「中間」那片了！只能從最上面拿（LIFO）。');
      setMsg('倒塔了。按「復原一步（Ctrl+Z）」回到上一步。');
      sendLog('GAME_OVER', { isCorrect: false, payload: { level, reason: 'click_not_top', clickedFlavor: clicked } });
      return;
    }
    popToMonster();
  };

  // Ctrl+Z 復原（對齊你教學文）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  const primaryHint =
    level === 1
      ? `目標：餵 3 片（目前 ${fed}/3）\n規則：只能拿最上面那片（pop）\n怪物：我全都吃！`
      : `目標：吃到「${flavorMeta[target].name}」（只能拿頂部）\nLevel 2：先把上面移到備用盤（pop），直到目標到頂部再餵怪物（pop）。`;

  const topFlavor = main.length ? main[main.length - 1] : null;
  const suggestAdd = level === 1 && !topFlavor;
  const suggestMove = level === 2 && topFlavor !== null && topFlavor !== target;
  const suggestPop = main.length > 0 && (level === 1 || topFlavor === target);

  return (
    <div className="relative h-full min-h-0 bg-gradient-to-b from-[#FDFBF7] to-white p-3 sm:p-5">
      <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col gap-4 lg:flex-row lg:items-start">
        {/* 左：主要遊戲 */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-gray-900">魔法鬆餅塔（Stack / LIFO）</div>
              <div className="mt-1 text-xs font-bold text-gray-500">Level {level} · 只能從頂部操作（後進先出）</div>
            </div>
            <button
              type="button"
              onClick={() => resetToLevel(level)}
              className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
            >
              重來
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-base font-extrabold text-amber-900 leading-relaxed">
            {primaryHint.split('\n').map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
            {level === 1 ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-500">貪吃怪</div>
                  <div className="mt-1 flex items-center gap-2 text-base font-extrabold text-gray-900">
                    <span aria-hidden className="text-lg">👾</span> 要吃到 {fed}/3 片
                  </div>
                </div>
                <div className="flex items-center gap-1" aria-label="進度">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`h-3 w-3 rounded-full ${
                        i < fed ? 'bg-emerald-500' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-500">貪吃怪</div>
                  <div className="mt-1 text-base font-extrabold text-gray-900">
                    我要吃：{flavorMeta[target].emoji} {flavorMeta[target].name}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-500">它在最底下，你要先用「備用盤」把上層移走</div>
                </div>
                <div className="shrink-0 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-900">
                  只准頂部操作
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
            {/* 主盤 */}
            <div className="min-h-0 min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-gray-900">主盤（Stack）</div>
                <div className="text-xs font-bold text-gray-600">數量：{main.length}</div>
              </div>
              <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                <div className="text-xs font-bold text-gray-500">最上面（只能點這片）</div>
                <div className="mt-1 text-base font-extrabold text-gray-900">
                  {topFlavor ? `${flavorMeta[topFlavor].emoji} ${flavorMeta[topFlavor].name}` : '（空）'}
                </div>
              </div>

              <div className="mt-3 mx-auto h-[min(32vh,320px)] w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
                {main.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-base font-semibold text-gray-500">
                    先按右邊「加入鬆餅（push）」
                  </div>
                ) : (
                  <div className="flex h-full flex-col-reverse items-stretch gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2">
                    {main.map((f, idx) => {
                      const isTop = idx === main.length - 1;
                      const meta = flavorMeta[f];
                      return (
                        <button
                          key={`${f}-${idx}-${main.length}`}
                          type="button"
                          onClick={() => clickMainTower(idx)}
                          className={`w-full rounded-[999px] border px-3 py-2 text-left shadow-sm transition ${
                            isTop ? 'border-emerald-300 bg-white ring-4 ring-emerald-100' : 'border-gray-200 bg-white/90'
                          }`}
                          title={isTop ? '點我：pop' : '只能拿頂部（點中間會倒塔）'}
                        >
                          <div className="relative isolate flex items-center justify-between">
                            {/* 鬆餅外殼（避免 -z 穿透到鄰欄造成重疊） */}
                            <div className={`absolute inset-x-0 top-0 bottom-0 z-0 rounded-[999px] bg-gradient-to-b ${meta.crust}`} />
                            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[999px] border border-black/5" />
                            {/* 糖霜 */}
                            <div className={`pointer-events-none absolute left-3 right-3 top-1.5 z-[1] h-5 rounded-[999px] bg-gradient-to-b ${meta.syrup} opacity-90`} />
                            {/* 光澤 */}
                            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[999px] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.65),transparent_45%)] opacity-70" />

                            <div className="relative z-[2] flex w-full items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className={`truncate text-base font-extrabold text-gray-900 ${meta.accent}`}>
                                  {meta.emoji} {meta.name}
                                </div>
                              </div>
                              <div className={`shrink-0 text-[11px] font-extrabold ${isTop ? 'text-emerald-700' : 'text-gray-400'}`}>
                                {isTop ? '頂部 pop' : '中間'}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 備用盤（Level2） */}
            <div className="min-h-0 min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-gray-900">備用盤（Level 2）</div>
                <div className="text-xs font-bold text-gray-600">數量：{spare.length}</div>
              </div>
              <div className="mt-2 mx-auto h-[min(32vh,320px)] w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
                {level !== 2 ? (
                  <div className="flex h-full items-center justify-center text-base font-semibold text-gray-500">
                    Level 2 才會用到備用盤
                  </div>
                ) : spare.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-base font-semibold text-sky-700/70">
                    先把主盤頂部移到這裡
                  </div>
                ) : (
                  <div className="flex h-full flex-col-reverse items-stretch gap-2 overflow-y-auto pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2">
                    {spare.map((f, idx) => {
                      const meta = flavorMeta[f];
                      return (
                        <div
                          key={`${f}-${idx}-${spare.length}`}
                          className="w-full rounded-[999px] border border-sky-200 bg-sky-50 px-3 py-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate text-base font-extrabold text-gray-900 ${meta.accent}`}>
                                {meta.emoji} {meta.name}
                              </div>
                            </div>
                            <div className="shrink-0 text-[11px] font-extrabold text-sky-700">暫放</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-bold text-gray-500">現在該做什麼</div>
            <div className="mt-1 text-sm font-semibold text-gray-800">{msg}</div>
          </div>
        </div>

        {/* 右：操作區（只保留重點） */}
        <div className="w-full min-w-0 shrink-0 lg:w-[22rem]">
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
            <div className="text-sm font-extrabold text-gray-900">操作</div>
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-extrabold text-gray-500">下一步（照做就好）</div>
              <div className="mt-1 text-base font-extrabold text-gray-900">
                {level === 1
                  ? main.length === 0
                    ? '加入鬆餅（push）'
                    : '餵怪物（pop）'
                  : main.length === 0
                    ? '先看主盤頂部（應該有東西）'
                    : suggestMove
                      ? '先把最上面放到旁邊'
                      : '餵怪物（pop）'}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['STRAWBERRY', 'VANILLA', 'CHOCOLATE'] as Flavor[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => addFlavor(f)}
                  disabled={level === 2 || gameOver}
                  className={`rounded-2xl border border-gray-200 bg-white py-3 text-sm font-extrabold text-gray-900 shadow-sm hover:bg-gray-50 active:scale-[0.99] disabled:opacity-50 disabled:hover:bg-white ${
                    suggestAdd ? 'ring-4 ring-amber-100' : ''
                  }`}
                  title="push"
                >
                  {flavorMeta[f].emoji} {flavorMeta[f].name}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={popToMonster}
                disabled={main.length === 0 || gameOver}
                className={`rounded-2xl px-4 py-3 text-sm font-extrabold text-white shadow-md active:scale-[0.99] ${
                  suggestPop && !gameOver ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-100' : 'bg-emerald-600 hover:bg-emerald-700'
                } disabled:opacity-40`}
              >
                👾 餵怪物（pop）
              </button>
              <button
                type="button"
                onClick={moveToSpare}
                disabled={level !== 2}
                className={`rounded-2xl px-4 py-3 text-sm font-extrabold text-white shadow-md hover:bg-sky-700 active:scale-[0.99] disabled:opacity-40 ${
                  suggestMove && !gameOver ? 'ring-4 ring-sky-100' : ''
                }`}
              >
                <span className="block text-base">🍽️ 先把最上面放到旁邊</span>
                <span className="mt-0.5 block text-xs font-bold text-sky-100">放到備用盤，等等再回來拿下面那片</span>
              </button>
              <button
                type="button"
                onClick={undo}
                className={`rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-extrabold text-gray-900 shadow-sm hover:bg-gray-50 active:scale-[0.99] ${
                  gameOver ? 'ring-4 ring-amber-100' : ''
                }`}
              >
                ↩️ 復原一步（Ctrl+Z）
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="text-xs font-extrabold">超簡單記法</div>
              <div className="mt-1 leading-relaxed">
                疊上去＝<span className="font-mono font-extrabold">push</span><br />
                拿走頂部＝<span className="font-mono font-extrabold">pop</span><br />
                復原＝一直把「最後做的」拿掉（也是 LIFO）
              </div>
            </div>
          </div>
        </div>
      </div>

      {successOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="text-2xl font-extrabold text-emerald-600">過關！</div>
            <div className="mt-2 text-sm text-gray-700">
              {level === 1 ? '你已經掌握：只能從頂部 pop（LIFO）' : '你成功拿到被壓在底下的巧克力！'}
            </div>
            <div className="mt-5 grid gap-2">
              {level === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSuccessOpen(false);
                    resetToLevel(2);
                  }}
                  className="rounded-2xl bg-amber-500 py-3 text-sm font-extrabold text-white hover:bg-amber-600"
                >
                  進入 Level 2
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSuccessOpen(false);
                    resetToLevel(2);
                  }}
                  className="rounded-2xl bg-amber-500 py-3 text-sm font-extrabold text-white hover:bg-amber-600"
                >
                  再玩一次 Level 2
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSuccessOpen(false);
                  resetToLevel(1);
                }}
                className="rounded-2xl border-2 border-gray-200 bg-white py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50"
              >
                回到 Level 1
              </button>
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="text-2xl font-extrabold text-red-600">倒塔了</div>
            <div className="mt-2 text-sm text-gray-700">{gameOverReason}</div>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  undo();
                }}
                className="rounded-2xl border-2 border-gray-200 bg-white py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50"
              >
                ↩︎ 復原一步（Ctrl+Z）
              </button>
              <button
                type="button"
                onClick={() => resetToLevel(level)}
                className="rounded-2xl bg-amber-500 py-3 text-sm font-extrabold text-white hover:bg-amber-600"
              >
                回到本關重來
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { HanoiGame, Click1Game, Click2Game, MonsterGobblerGame, BubbleTeaMasterGame, MagicPancakeTowerGame };
