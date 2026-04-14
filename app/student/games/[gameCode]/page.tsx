'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import GameFrame from '@/components/GameFrame';
import { HanoiGame, Click1Game, Click2Game, MonsterGobblerGame, BubbleTeaMasterGame, MagicPancakeTowerGame } from '@/components/games/StudentGameViews';
import SearchChallengeGame from '@/components/games/SearchChallengeGame';
import SortBubbleGame from '@/components/games/SortBubbleGame';
import PathDijkstraGame from '@/components/games/PathDijkstraGame';
import { TeachingStack, TeachingQueue, TeachingHanoiRecursive, TeachingModuleShell } from '@/components/teaching';
import FormActivityPlayer from '@/components/forms/FormActivityPlayer';
import { useGameLog } from '@/hooks/useGameLog';

interface UnlockItem {
  gameModuleId: string;
  gameCode: string;
  gameName: string;
}

interface StatusData {
  classGroup?: { name: string };
  session?: { id: string; name: string };
  unlocks: UnlockItem[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SEARCH_GAME_CONFIG: Record<
  string,
  {
    mode: 'LINEAR' | 'BINARY';
    rangeMax: number;
    hintEnabled: boolean;
    helpTip: string;
    helpText: string;
  }
> = {
  SEARCH_LINEAR_100: {
    mode: 'LINEAR',
    rangeMax: 100,
    hintEnabled: false,
    helpTip: '線性搜尋：逐步嘗試',
    helpText:
      '線性搜尋會從前往後慢慢找。你可以觀察次數如何隨範圍增加而變大。',
  },
  SEARCH_BINARY_100_RAW: {
    mode: 'BINARY',
    rangeMax: 100,
    hintEnabled: false,
    helpTip: '二元搜尋（無提示）',
    helpText:
      '先自己嘗試，不提供中間值提示。完成後再切到有提示版比較效率。',
  },
  SEARCH_BINARY_100_GUIDE: {
    mode: 'BINARY',
    rangeMax: 100,
    hintEnabled: true,
    helpTip: '二元搜尋（有提示）',
    helpText:
      '提示區會顯示 (下界 + 上界) ÷ 2，幫助你練習怎麼選中間數。',
  },
  SEARCH_BINARY_1000_RAW: {
    mode: 'BINARY',
    rangeMax: 1000,
    hintEnabled: false,
    helpTip: '二元搜尋 1000（無提示）',
    helpText:
      '中範圍無提示版，先挑戰自己是否能用切半策略快速完成。',
  },
  SEARCH_BINARY_1000_GUIDE: {
    mode: 'BINARY',
    rangeMax: 1000,
    hintEnabled: true,
    helpTip: '二元搜尋 1000（有提示）',
    helpText:
      '提示區會顯示切半公式，幫你把策略固定下來。',
  },
  SEARCH_BINARY_4B_RAW: {
    mode: 'BINARY',
    rangeMax: 4_000_000_000,
    hintEnabled: false,
    helpTip: '二元搜尋 40 億（無提示）',
    helpText:
      '超大範圍無提示，檢驗你是否真正掌握二元搜尋。',
  },
  SEARCH_BINARY_4B_GUIDE: {
    mode: 'BINARY',
    rangeMax: 4_000_000_000,
    hintEnabled: true,
    helpTip: '二元搜尋 40 億（有提示）',
    helpText:
      '超大範圍搭配公式提示，觀察次數與理論值差距。',
  },
};

const SORT_GAME_CONFIG: Record<string, { guideEnabled: boolean; helpTip: string; helpText: string }> = {
  SORT_BUBBLE_RAW: {
    guideEnabled: false,
    helpTip: '泡泡排序（無提示）',
    helpText: '請自行判斷每一組相鄰數字是否要交換。',
  },
  SORT_BUBBLE_GUIDE: {
    guideEnabled: true,
    helpTip: '泡泡排序（有提示）',
    helpText: '提示區會告訴你該組建議交換或不交換。',
  },
};

const PATH_GAME_CONFIG: Record<string, { guideEnabled: boolean; helpTip: string; helpText: string }> = {
  PATH_DIJKSTRA_RAW: {
    guideEnabled: false,
    helpTip: '最短路徑（無提示）',
    helpText: '請自行判斷下一個距離最小的節點。',
  },
  PATH_DIJKSTRA_GUIDE: {
    guideEnabled: true,
    helpTip: '最短路徑（有提示）',
    helpText: '提示區會顯示下一個建議選擇節點。',
  },
};

export default function StudentGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameCode = typeof params.gameCode === 'string' ? params.gameCode : '';
  const [user, setUser] = useState<{ account: string; studentGroup?: { activeTerm?: { name: string } } } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const { data: statusData } = useSWR<StatusData & { error?: string }>('/api/games/status', fetcher);
  const unlock = statusData?.unlocks?.find((u) => u.gameCode === gameCode);
  const gameName = unlock?.gameName ?? (gameCode || '遊戲');
  const gameModuleId = unlock?.gameModuleId ?? null;
  const sessionId = statusData?.session?.id ?? null;
  const searchConfig = SEARCH_GAME_CONFIG[gameCode];
  const sortConfig = SORT_GAME_CONFIG[gameCode];
  const pathConfig = PATH_GAME_CONFIG[gameCode];
  const isSummaryOnlyGame = Boolean(searchConfig || sortConfig || pathConfig);

  const { sendLog } = useGameLog(gameModuleId, sessionId, !isSummaryOnlyGame);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (!res.user) { router.replace('/'); return; }
        if (res.user.role !== 'STUDENT') { router.replace('/dashboard'); return; }
        setUser(res.user);
        setAuthChecked(true);
      })
      .catch(() => router.replace('/'));
  }, [router]);

  const startSentRef = useRef(false);
  const hanoiHelpRef = useRef<{ openHelp: () => void } | null>(null);
  useEffect(() => {
    if (!isSummaryOnlyGame && authChecked && gameModuleId && !startSentRef.current) {
      startSentRef.current = true;
      sendLog('START');
    }
  }, [authChecked, gameModuleId, isSummaryOnlyGame, sendLog]);

  const headerTitle = 'NovaInsight 資訊科普教育平台';
  const headerMenuLinks = [{ label: '📢 班級公告', href: '/student/announcements' }];

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">驗證身分中...</p>
      </div>
    );
  }

  const handleBack = () => {
    if (!isSummaryOnlyGame) sendLog('BACK');
    router.push('/dashboard/student');
  };
  const handleLogout = async () => {
    if (!isSummaryOnlyGame) sendLog('LOGOUT');
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  };

  const sendSearchCompleteLog = async (payload: {
    attempts: number;
    durationMs: number;
    mode: 'LINEAR' | 'BINARY';
    rangeMax: number;
  }) => {
    if (!gameModuleId) return;
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'COMPLETE',
        gameModuleId,
        sessionId: sessionId || undefined,
        isCorrect: true,
        timeDiffMs: payload.durationMs,
        payload: {
          mode: payload.mode,
          rangeMax: payload.rangeMax,
          attempts: payload.attempts,
        },
      }),
    });
  };

  if (searchConfig) {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelp={() => {
          alert(searchConfig.helpText);
        }}
        helpTip={searchConfig.helpTip}
        mainLayout="fill"
      >
        <SearchChallengeGame
          mode={searchConfig.mode}
          rangeMin={0}
          rangeMax={searchConfig.rangeMax}
          hintEnabled={searchConfig.hintEnabled}
          onComplete={sendSearchCompleteLog}
        />
      </GameFrame>
    );
  }

  if (sortConfig) {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelp={() => {
          alert(sortConfig.helpText);
        }}
        helpTip={sortConfig.helpTip}
        mainLayout="fill"
      >
        <SortBubbleGame
          guideEnabled={sortConfig.guideEnabled}
          onComplete={async ({ swaps, decisions, durationMs }) => {
            if (!gameModuleId) return;
            await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'COMPLETE',
                gameModuleId,
                sessionId: sessionId || undefined,
                isCorrect: true,
                timeDiffMs: durationMs,
                payload: { kind: 'SORT_BUBBLE', swaps, decisions },
              }),
            });
          }}
        />
      </GameFrame>
    );
  }

  if (pathConfig) {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelp={() => {
          alert(pathConfig.helpText);
        }}
        helpTip={pathConfig.helpTip}
        mainLayout="fill"
      >
        <PathDijkstraGame
          guideEnabled={pathConfig.guideEnabled}
          onComplete={async ({ correctSteps, wrongChoices, durationMs }) => {
            if (!gameModuleId) return;
            await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'COMPLETE',
                gameModuleId,
                sessionId: sessionId || undefined,
                isCorrect: true,
                timeDiffMs: durationMs,
                payload: { kind: 'PATH_DIJKSTRA', correctSteps, wrongChoices },
              }),
            });
          }}
        />
      </GameFrame>
    );
  }

  if (gameCode === 'CLICK_1') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelp={() => {
          sendLog('HELP');
          alert('請點擊中間按鈕 1 次');
        }}
        helpTip="請點擊中間按鈕 1 次"
      >
        <Click1Game sendLog={sendLog} onSuccess={handleBack} />
      </GameFrame>
    );
  }

  if (gameCode === 'CLICK_2') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelp={() => {
          sendLog('HELP');
          alert('請『連續』點擊中間按鈕 2 次喔！');
        }}
        helpTip="請連續點擊中間按鈕 2 次"
      >
        <Click2Game sendLog={sendLog} onSuccess={handleBack} />
      </GameFrame>
    );
  }

  const hanoiN =
    gameCode === 'HANOI_3' ? 3 :
    gameCode === 'HANOI_4' ? 4 :
    gameCode === 'HANOI_5' ? 5 :
    gameCode === 'HANOI_6' ? 6 :
    gameCode === 'HANOI_7' ? 7 :
    gameCode === 'HANOI_8' ? 8 :
    null;

  if (hanoiN) {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => {
          sendLog('HELP');
        }}
        onHelp={() => {
          hanoiHelpRef.current?.openHelp();
        }}
        helpTip="依你現在的盤面給你提示"
        mainLayout="fill"
      >
        <HanoiGame ref={hanoiHelpRef} n={hanoiN} sendLog={sendLog} onExit={handleBack} />
      </GameFrame>
    );
  }

  if (gameCode === 'MONSTER_GOBBLER') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => {
          sendLog('HELP');
        }}
        onHelp={() => {
          alert('先狂點食物餵牠（push）。再切換模式：💩=shift（先進先出）、🤮=pop（後進先出）。');
        }}
        helpTip="餵食 push；💩=shift；🤮=pop"
        mainLayout="fill"
      >
        <MonsterGobblerGame sendLog={sendLog} />
      </GameFrame>
    );
  }

  if (gameCode === 'BUBBLE_TEA_MASTER') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => {
          sendLog('HELP');
        }}
        onHelp={() => {
          alert('玩法：一直加配料（push）。切換模式後「用力吸！」= shift（佇列：最早加入先被吸走）；「從上面挖！」= pop（堆疊：最後加入先被挖走）。');
        }}
        helpTip="push / shift（佇列）/ pop（堆疊）"
        mainLayout="fill"
      >
        <BubbleTeaMasterGame sendLog={sendLog} />
      </GameFrame>
    );
  }

  if (gameCode === 'MAGIC_PANCAKE_TOWER') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => {
          sendLog('HELP');
        }}
        onHelp={() => {
          alert('玩法：Stack（後進先出）。只能從最上面拿（pop）。Level 2 用「備用盤」把上面的先移走，才能拿到被壓在底下的巧克力。');
        }}
        helpTip="只能操作頂部：push / pop（LIFO）"
        mainLayout="fill"
      >
        <MagicPancakeTowerGame sendLog={sendLog} />
      </GameFrame>
    );
  }

  if (gameCode === 'TEACH_STACK') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => sendLog('HELP')}
        helpTip="Push 放入、Pop 取出；紅箭頭為 Top"
        mainLayout="fill"
        headerSubtitle="教學模組 · Stack"
      >
        <TeachingModuleShell title="Stack（堆疊）教學" subtitle="後進先出（LIFO）">
          <TeachingStack />
        </TeachingModuleShell>
      </GameFrame>
    );
  }

  if (gameCode === 'TEACH_QUEUE') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => sendLog('HELP')}
        helpTip="Enqueue 從右進、Dequeue 從左出"
        mainLayout="fill"
        headerSubtitle="教學模組 · Queue"
      >
        <TeachingModuleShell title="Queue（佇列）教學" subtitle="先進先出（FIFO）">
          <TeachingQueue />
        </TeachingModuleShell>
      </GameFrame>
    );
  }

  if (gameCode === 'TEACH_HANOI_RECURSION') {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => sendLog('HELP')}
        helpTip="播放／單步觀察盤子移動與右側 Call Stack"
        mainLayout="fill"
        headerSubtitle="教學模組 · 河內塔與遞迴"
      >
        <TeachingModuleShell title="河內塔（遞迴）教學" subtitle="盤子移動動畫 + 遞迴呼叫堆疊">
          <TeachingHanoiRecursive />
        </TeachingModuleShell>
      </GameFrame>
    );
  }

  if (gameCode.startsWith('FORM_')) {
    return (
      <GameFrame
        headerMenuLinks={headerMenuLinks}
        headerTitle={headerTitle}
        userLabel={user?.account}
        userAvatar={user?.account?.slice(0, 2).toUpperCase()}
        onBack={handleBack}
        onLogout={handleLogout}
        onHelpLog={() => {
          sendLog('HELP');
        }}
        helpModalMessage={`一次看一題，答案寫在畫面中間。

可先按「儲存草稿」暫存進度，全部填完後按「送出表單」。

若老師有開放，送出後仍可查看或修改。`}
        helpTip="一次看一題，可暫存、送出"
        denseMobileDock
        mainLayout="fill"
      >
        <FormActivityPlayer gameCode={gameCode} sendLog={sendLog} />
      </GameFrame>
    );
  }

  return (
    <GameFrame
      headerMenuLinks={headerMenuLinks}
      headerTitle={headerTitle}
      userLabel={user?.account}
      userAvatar={user?.account?.slice(0, 2).toUpperCase()}
      onBack={handleBack}
      onLogout={handleLogout}
    >
      <div className="flex h-full flex-col items-center justify-center p-6">
        <h1 className="text-xl font-bold text-gray-900">{gameName} 載入中...</h1>
        <p className="mt-2 text-sm text-gray-500">這裡之後會放真正的遊戲畫布</p>
      </div>
    </GameFrame>
  );
}
