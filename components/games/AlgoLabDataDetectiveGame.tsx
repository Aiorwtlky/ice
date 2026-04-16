'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { clearedCases: number; totalActions: number; mistakes: number; durationMs: number }) => void;
}

type ColorType = '藍色' | '綠色' | '紅色' | '黃色';
type ParityType = '奇數' | '偶數';
type Phase = 'color' | 'parity' | 'sort' | 'pick' | 'done';

interface RecordItem {
  id: string;
  name: string;
  color: ColorType;
  height: number;
  seat: number;
}

interface DetectiveCase {
  records: RecordItem[];
  targetId: string;
  colorClue: ColorType;
  parityClue: ParityType;
  rankClue: number;
}

const COLORS: ColorType[] = ['藍色', '綠色', '紅色', '黃色'];
const NAMES = ['小海', '小晴', '小宇', '小楷', '小語', '小安', '小樂', '小恩', '小白', '小凡', '小夏', '小周'];

function randomFrom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createCase(): DetectiveCase {
  for (let tryCount = 0; tryCount < 20; tryCount += 1) {
    const records: RecordItem[] = Array.from({ length: 18 }, (_, i) => ({
      id: `R-${i + 1}`,
      name: `${NAMES[i % NAMES.length]}${i + 1}`,
      color: randomFrom(COLORS),
      height: 125 + Math.floor(Math.random() * 31),
      seat: i + 1,
    }));
    const target = randomFrom(records);
    const colorClue = target.color;
    const parityClue: ParityType = target.seat % 2 === 0 ? '偶數' : '奇數';
    const filtered = records
      .filter((r) => r.color === colorClue && (parityClue === '奇數' ? r.seat % 2 === 1 : r.seat % 2 === 0))
      .sort((a, b) => a.height - b.height);
    if (filtered.length < 2) continue;
    const rankClue = filtered.findIndex((r) => r.id === target.id) + 1;
    if (rankClue < 1) continue;
    return { records, targetId: target.id, colorClue, parityClue, rankClue };
  }
  return createCase();
}

function createCases(count = 5) {
  return Array.from({ length: count }, () => createCase());
}

export default function AlgoLabDataDetectiveGame({ previewMode = false, onComplete }: Props) {
  const [cases, setCases] = useState<DetectiveCase[]>(() => createCases(5));
  const [caseIndex, setCaseIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('color');
  const [chosenColor, setChosenColor] = useState<ColorType | null>(null);
  const [chosenParity, setChosenParity] = useState<ParityType | null>(null);
  const [isSorted, setIsSorted] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [actions, setActions] = useState(0);
  const [message, setMessage] = useState('先依顏色縮小範圍，再進一步鎖定目標。');

  const currentCase = cases[caseIndex];

  const candidates = useMemo(() => {
    let list = currentCase.records;
    if (chosenColor) list = list.filter((r) => r.color === chosenColor);
    if (chosenParity) list = list.filter((r) => (chosenParity === '奇數' ? r.seat % 2 === 1 : r.seat % 2 === 0));
    if (isSorted) list = [...list].sort((a, b) => a.height - b.height);
    return list;
  }, [currentCase.records, chosenColor, chosenParity, isSorted]);

  const targetRecord = currentCase.records.find((r) => r.id === currentCase.targetId);

  const startAction = () => {
    setActions((v) => v + 1);
  };

  const handleColor = (color: ColorType) => {
    if (phase !== 'color') return;
    startAction();
    if (color !== currentCase.colorClue) {
      setMistakes((v) => v + 1);
      setMessage('這個顏色不符合線索，再觀察一次。');
      return;
    }
    setChosenColor(color);
    setPhase('parity');
    setMessage('顏色正確！下一步請根據座號奇偶線索篩選。');
  };

  const handleParity = (parity: ParityType) => {
    if (phase !== 'parity') return;
    startAction();
    if (parity !== currentCase.parityClue) {
      setMistakes((v) => v + 1);
      setMessage('奇偶線索不吻合，請再判斷一次。');
      return;
    }
    setChosenParity(parity);
    setPhase('sort');
    setMessage('篩選完成！現在把候選資料依身高由矮到高排序。');
  };

  const applySort = () => {
    if (phase !== 'sort') return;
    startAction();
    setIsSorted(true);
    setPhase('pick');
    setMessage(`排序完成，請找出「第 ${currentCase.rankClue} 矮」的學生。`);
  };

  const pickRecord = (id: string) => {
    if (phase !== 'pick') return;
    startAction();
    if (id !== currentCase.targetId) {
      setMistakes((v) => v + 1);
      setMessage('這位不是正確對象，請根據排名線索再選一次。');
      return;
    }
    setPhase('done');
    setMessage('案件破解成功！可以進入下一案。');
  };

  const goNextCase = () => {
    if (phase !== 'done') return;
    if (caseIndex >= cases.length - 1) {
      setMessage('全部案件完成，做得很好！');
      if (!previewMode) {
        onComplete?.({
          clearedCases: cases.length,
          totalActions: actions,
          mistakes,
          durationMs: 0,
        });
      }
      return;
    }
    setCaseIndex((v) => v + 1);
    setPhase('color');
    setChosenColor(null);
    setChosenParity(null);
    setIsSorted(false);
    setMessage('新案件開始：先做第一層篩選（顏色）。');
  };

  const resetAll = () => {
    setCases(createCases(5));
    setCaseIndex(0);
    setPhase('color');
    setChosenColor(null);
    setChosenParity(null);
    setIsSorted(false);
    setMistakes(0);
    setActions(0);
    setMessage('已重置所有案件，從第一案重新開始。');
  };

  const isFinalDone = phase === 'done' && caseIndex === cases.length - 1;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[1.45fr_1fr]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗四：綜合任務・資料偵探</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          連續 5 個案件，依序完成「篩選 → 排序 → 定位」，學會用流程解複雜問題。
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-sky-50 px-3 py-2">
            <p className="text-[11px] text-sky-700 sm:text-xs">案件進度</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{caseIndex + 1} / {cases.length}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">候選人數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{candidates.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">操作次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{actions}</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-3 py-2">
            <p className="text-[11px] text-rose-700 sm:text-xs">失誤次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{mistakes}</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          線索：{currentCase.colorClue}衣服、座號{currentCase.parityClue}、在候選清單中是第 {currentCase.rankClue} 矮
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColor(color)}
              disabled={phase !== 'color'}
              className={`rounded-xl border px-3 py-2 text-xs font-bold sm:text-sm ${
                chosenColor === color ? 'border-sky-500 bg-sky-500 text-white' : 'border-gray-200 bg-white text-gray-700'
              } disabled:opacity-50`}
            >
              篩 {color}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleParity('奇數')}
            disabled={phase !== 'parity'}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50 sm:text-sm"
          >
            篩奇數座號
          </button>
          <button
            type="button"
            onClick={() => handleParity('偶數')}
            disabled={phase !== 'parity'}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50 sm:text-sm"
          >
            篩偶數座號
          </button>
          <button
            type="button"
            onClick={applySort}
            disabled={phase !== 'sort'}
            className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 sm:text-sm"
          >
            依身高排序
          </button>
        </div>

        <div className="mt-3 grid max-h-[38vh] grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-2 sm:max-h-[320px] sm:grid-cols-3">
          {candidates.map((record, idx) => (
            <button
              key={record.id}
              type="button"
              onClick={() => pickRecord(record.id)}
              disabled={phase !== 'pick'}
              className={`rounded-xl border bg-white px-2 py-2 text-left text-xs text-gray-700 transition sm:text-sm ${
                phase === 'pick'
                  ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-bold text-gray-900">{record.name}</div>
              <div>{record.color} · {record.height} cm</div>
              <div>座號 {record.seat}</div>
              {isSorted && <div className="mt-1 text-[11px] text-indigo-700">排序名次：第 {idx + 1}</div>}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goNextCase}
            disabled={phase !== 'done'}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 sm:text-sm"
          >
            {isFinalDone ? '完成全部案件' : '下一案件'}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 sm:text-sm"
          >
            全部重置
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">老師的話</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          你正在做的不是猜答案，而是設計流程：先縮小範圍，再排序定位，最後精準命中。
        </p>
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:text-sm">
          目標：用更少操作與更少失誤完成 5 個案件。
        </div>
        {targetRecord && phase === 'done' && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 sm:text-sm">
            本案正解：{targetRecord.name}（{targetRecord.color}，{targetRecord.height}cm，座號 {targetRecord.seat}）
          </div>
        )}
      </aside>
    </div>
  );
}
