'use client';

import { useMemo, useState } from 'react';

interface Props {
  previewMode?: boolean;
  onComplete?: (payload: { missionsCleared: number; totalActions: number; mistakes: number; durationMs: number }) => void;
}

type ColorTag = '藍色' | '綠色' | '紅色' | '黃色';
type SortKey = 'seat' | 'name' | 'color' | 'height' | 'score';
type SortDirection = 'asc' | 'desc';

interface StudentRow {
  id: string;
  seat: number;
  name: string;
  color: ColorTag;
  height: number;
  score: number;
}

interface SortRule {
  key: SortKey;
  direction: SortDirection;
}

interface Mission {
  title: string;
  description: string;
  requiredRules: SortRule[];
  getTargetId: (rows: StudentRow[]) => string | null;
}

const COLOR_OPTIONS: ColorTag[] = ['藍色', '綠色', '紅色', '黃色'];
const NAME_POOL = ['小安', '小語', '小晴', '小辰', '小樂', '小恩', '小宇', '小海', '小米', '小白', '小彤', '小志'];

const SORT_LABEL: Record<SortKey, string> = {
  seat: '座號',
  name: '姓名',
  color: '衣服顏色',
  height: '身高',
  score: '測驗分數',
};

const SORT_KEYS: SortKey[] = ['seat', 'name', 'color', 'height', 'score'];

function randomFrom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function compareValues(a: StudentRow, b: StudentRow, key: SortKey, direction: SortDirection) {
  const base =
    key === 'name' || key === 'color'
      ? String(a[key]).localeCompare(String(b[key]), 'zh-Hant')
      : Number(a[key]) - Number(b[key]);
  return direction === 'asc' ? base : -base;
}

function applyRules(rows: StudentRow[], rules: SortRule[]) {
  if (rules.length === 0) return [...rows];
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      const diff = compareValues(a, b, rule.key, rule.direction);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

function createRows() {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `R-${i + 1}`,
    seat: i + 1,
    name: `${NAME_POOL[i % NAME_POOL.length]}${i + 1}`,
    color: randomFrom(COLOR_OPTIONS),
    height: 128 + Math.floor(Math.random() * 28),
    score: 60 + Math.floor(Math.random() * 41),
  }));
}

function createMissions(rows: StudentRow[]): Mission[] {
  const colorA = randomFrom(COLOR_OPTIONS);
  const colorB = randomFrom(COLOR_OPTIONS.filter((c) => c !== colorA));
  return [
    {
      title: '任務 1 / 3',
      description: `請建立規則讓「${colorA} 衣服中最矮者」會出現在最前段，並點出該列。`,
      requiredRules: [{ key: 'color', direction: 'asc' }, { key: 'height', direction: 'asc' }],
      getTargetId: (sortedRows) => sortedRows.find((row) => row.color === colorA)?.id ?? null,
    },
    {
      title: '任務 2 / 3',
      description: '請用三層規則，讓「高分優先；同分看身高；再同分看座號」後的第一位被正確定位。',
      requiredRules: [
        { key: 'score', direction: 'desc' },
        { key: 'height', direction: 'desc' },
        { key: 'seat', direction: 'asc' },
      ],
      getTargetId: (sortedRows) => sortedRows[0]?.id ?? null,
    },
    {
      title: '任務 3 / 3',
      description: `請建立規則使「身高高優先、同身高分數高優先；若仍同分，${colorB} 要更前面」。`,
      requiredRules: [
        { key: 'height', direction: 'desc' },
        { key: 'score', direction: 'desc' },
        { key: 'color', direction: 'asc' },
      ],
      getTargetId: (sortedRows) => sortedRows.find((row) => row.color === colorB)?.id ?? null,
    },
  ].filter((mission) => mission.getTargetId(applyRules(rows, mission.requiredRules)) !== null);
}

function sameRules(a: SortRule[], b: SortRule[]) {
  if (a.length !== b.length) return false;
  return a.every((rule, idx) => rule.key === b[idx].key && rule.direction === b[idx].direction);
}

export default function AlgoLabSpreadsheetSortGame({ previewMode = false, onComplete }: Props) {
  const [baseRows, setBaseRows] = useState<StudentRow[]>(() => createRows());
  const [missions, setMissions] = useState<Mission[]>(() => createMissions(baseRows));
  const [missionIndex, setMissionIndex] = useState(0);
  const [rules, setRules] = useState<SortRule[]>([{ key: 'seat', direction: 'asc' }]);
  const [viewRows, setViewRows] = useState<StudentRow[]>(() => [...baseRows]);
  const [phase, setPhase] = useState<'configure' | 'pick' | 'done'>('configure');
  const [actions, setActions] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [message, setMessage] = useState('請閱讀任務，自行建立排序層級後套用。');

  const currentMission = missions[missionIndex];

  const targetId = useMemo(() => {
    if (!currentMission) return null;
    const correctlySorted = applyRules(baseRows, currentMission.requiredRules);
    return currentMission.getTargetId(correctlySorted);
  }, [baseRows, currentMission]);

  const handleRuleChange = (index: number, patch: Partial<SortRule>) => {
    setRules((prev) => {
      const next = prev.map((rule) => ({ ...rule }));
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addRule = () => {
    setRules((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, { key: 'name', direction: 'asc' }];
    });
  };

  const removeRule = (index: number) => {
    setRules((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const applySort = () => {
    if (!currentMission) return;
    const nextActions = actions + 1;
    setActions(nextActions);
    const sorted = applyRules(baseRows, rules);
    setViewRows(sorted);
    if (!sameRules(rules, currentMission.requiredRules)) {
      setMistakes((v) => v + 1);
      setPhase('configure');
      setMessage('規則層級或順序與題目不符，請調整後再試。');
      return;
    }
    setPhase('pick');
    setMessage('排序正確！請在表格中點選符合線索的那一列。');
  };

  const pickRow = (id: string) => {
    if (phase !== 'pick' || !currentMission || !targetId) return;
    const nextActions = actions + 1;
    setActions(nextActions);
    if (id !== targetId) {
      setMistakes((v) => v + 1);
      setMessage('這列不是正解，請依任務描述重新判斷。');
      return;
    }

    if (missionIndex >= missions.length - 1) {
      setPhase('done');
      setMessage('實驗五完成！你已成功使用正式多欄位排序流程。');
      if (!previewMode) {
        onComplete?.({
          missionsCleared: missions.length,
          totalActions: nextActions,
          mistakes,
          durationMs: 0,
        });
      }
      return;
    }

    setMissionIndex((prev) => prev + 1);
    setRules([{ key: 'seat', direction: 'asc' }]);
    setViewRows([...baseRows]);
    setPhase('configure');
    setMessage('本任務成功！下一題請自行決定需要幾層排序。');
  };

  const resetGame = () => {
    const nextRows = createRows();
    setBaseRows(nextRows);
    setMissions(createMissions(nextRows));
    setMissionIndex(0);
    setRules([{ key: 'seat', direction: 'asc' }]);
    setViewRows([...nextRows]);
    setPhase('configure');
    setActions(0);
    setMistakes(0);
    setMessage('已重新產生資料，從任務 1 開始。');
  };

  if (!currentMission) {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center p-6 text-gray-600">
        無法建立任務，請重新整理。
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,1fr)]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:rounded-3xl lg:p-6">
        <h2 className="text-lg font-black text-gray-900 sm:text-2xl">實驗五：試算表正式排序（Excel Sort Lab）</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          依題目自行建立排序層級（主排序、次排序、第 3 層...），完成正式資料處理流程。
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-indigo-50 px-3 py-2">
            <p className="text-[11px] text-indigo-700 sm:text-xs">任務進度</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">
              {missionIndex + 1} / {missions.length}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-700 sm:text-xs">操作次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{actions}</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-3 py-2">
            <p className="text-[11px] text-rose-700 sm:text-xs">失誤次數</p>
            <p className="text-xl font-black text-gray-900 sm:text-2xl">{mistakes}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="text-[11px] text-emerald-700 sm:text-xs">目前階段</p>
            <p className="text-sm font-black text-gray-900 sm:text-base">
              {phase === 'configure' ? '設定排序' : phase === 'pick' ? '點選目標列' : '已完成'}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          <span className="font-bold text-gray-900">{currentMission.title}</span>：{currentMission.description}
        </div>

        <div className="mt-3 max-h-[min(42vh,20rem)] space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3">
          {rules.map((rule, idx) => (
            <div key={`rule-${idx}-${rule.key}-${rule.direction}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-700">{idx === 0 ? '主要排序' : `第 ${idx + 1} 排序`}</p>
                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  disabled={rules.length <= 1}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-600 disabled:opacity-50"
                >
                  移除
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={rule.key}
                  onChange={(e) => handleRuleChange(idx, { key: e.target.value as SortKey })}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-800 sm:text-sm"
                >
                  {SORT_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABEL[key]}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.direction}
                  onChange={(e) => handleRuleChange(idx, { direction: e.target.value as SortDirection })}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-800 sm:text-sm"
                >
                  <option value="asc">升冪</option>
                  <option value="desc">降冪</option>
                </select>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRule}
            disabled={rules.length >= 4}
            className="w-full rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50 sm:text-sm"
          >
            新增排序層級（最多 4 層）
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applySort}
            disabled={phase === 'done'}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 sm:text-sm"
          >
            套用排序
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 sm:text-sm"
          >
            重置資料
          </button>
        </div>

        <div className="mt-3 min-h-[220px] flex-1 overflow-auto rounded-2xl border border-gray-200">
          <table className="min-w-[640px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-200 px-2 py-2 text-center font-black text-gray-700">#</th>
                <th className="border border-gray-200 px-3 py-2 font-black text-gray-700">座號</th>
                <th className="border border-gray-200 px-3 py-2 font-black text-gray-700">姓名</th>
                <th className="border border-gray-200 px-3 py-2 font-black text-gray-700">衣服顏色</th>
                <th className="border border-gray-200 px-3 py-2 font-black text-gray-700">身高</th>
                <th className="border border-gray-200 px-3 py-2 font-black text-gray-700">測驗分數</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => pickRow(row.id)}
                  className={`${
                    phase === 'pick' ? 'cursor-pointer hover:bg-amber-50' : ''
                  } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}`}
                >
                  <td className="border border-gray-200 px-2 py-2 text-center font-semibold text-gray-500">{index + 1}</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-800">{row.seat}</td>
                  <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-900">{row.name}</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-800">{row.color}</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-800">{row.height} cm</td>
                  <td className="border border-gray-200 px-3 py-2 text-gray-800">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 sm:text-sm">
          {message}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-sm sm:p-5 lg:min-h-0 lg:overflow-y-auto lg:rounded-3xl lg:p-6">
        <h3 className="text-base font-black text-gray-900 sm:text-lg">實驗重點</h3>
        <p className="mt-2 text-xs leading-5 text-gray-600 sm:text-sm">
          這是正式資料處理流程：設定多欄排序規則、套用、再從排序後結果精準定位。
        </p>
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 sm:text-sm">
          技巧：先用主要排序分群，再用次要排序在群內定位，效率更高。
        </div>
        {phase === 'done' && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:text-sm">
            恭喜完成進階排序任務！你已具備試算表排序實戰能力。
          </div>
        )}
      </aside>
    </div>
  );
}
