'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';
import GameFrame from '@/components/GameFrame';
import { HanoiGame, Click1Game, Click2Game, MonsterGobblerGame, BubbleTeaMasterGame, MagicPancakeTowerGame } from '@/components/games/StudentGameViews';
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

  const { sendLog } = useGameLog(gameModuleId, sessionId);

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
    if (authChecked && gameModuleId && !startSentRef.current) {
      startSentRef.current = true;
      sendLog('START');
    }
  }, [authChecked, gameModuleId, sendLog]);

  const headerTitle = 'NovaInsight 資訊科普教育平台';

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-gray-600">驗證身分中...</p>
      </div>
    );
  }

  const handleBack = () => {
    sendLog('BACK');
    router.push('/dashboard/student');
  };
  const handleLogout = async () => {
    sendLog('LOGOUT');
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  };

  if (gameCode === 'CLICK_1') {
    return (
      <GameFrame
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

  if (gameCode.startsWith('FORM_')) {
    return (
      <GameFrame
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
    <GameFrame headerTitle={headerTitle} userLabel={user?.account} userAvatar={user?.account?.slice(0, 2).toUpperCase()} onBack={handleBack} onLogout={handleLogout}>
      <div className="flex h-full flex-col items-center justify-center p-6">
        <h1 className="text-xl font-bold text-gray-900">{gameName} 載入中...</h1>
        <p className="mt-2 text-sm text-gray-500">這裡之後會放真正的遊戲畫布</p>
      </div>
    </GameFrame>
  );
}
