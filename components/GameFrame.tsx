'use client';

import { HelpCircle, Home, LogOut, ChevronDown } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

export interface GameFrameProps {
  /** 左上角固定標題 */
  headerTitle?: string;
  /** 左側副標（可選） */
  headerSubtitle?: string;
  /** 右側顯示，例：學員 ST-01 或 講師 TC-ML01 */
  userLabel?: string;
  /** 右側第二行（可選），例：三潭國小 */
  userSubLabel?: string;
  /** 頭像縮寫，例：ST、TC */
  userAvatar?: string;
  /** 右上角選單：登出（可選） */
  onLogout?: () => void | Promise<void>;
  /** 左下按鈕：返回（可選；未提供就不顯示） */
  onBack?: () => void;
  /** 是否顯示返回按鈕（預設：onBack 有提供才顯示） */
  showBack?: boolean;
  /** 右下求助按鈕，可傳當前遊戲的提示；不傳則顯示預設對話框 */
  onHelp?: () => void;
  /** 點擊求助時先執行（用來寫 log；不影響預設彈窗） */
  onHelpLog?: () => void;
  /** 是否顯示求助按鈕（預設：true） */
  showHelp?: boolean;
  helpTip?: string;
  /** aspect 適合小遊戲；fill 佔滿頁首頁尾之間（例：河內塔大畫面） */
  mainLayout?: 'aspect' | 'fill';
  children: React.ReactNode;
}

export default function GameFrame({
  headerTitle = 'NovaInsight 資訊科普教育平台',
  headerSubtitle,
  userLabel,
  userSubLabel,
  userAvatar,
  onLogout,
  onBack,
  showBack,
  onHelp,
  onHelpLog,
  showHelp = true,
  helpTip,
  mainLayout = 'aspect',
  children,
}: GameFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const effectiveShowBack = typeof showBack === 'boolean' ? showBack : typeof onBack === 'function';
  const handleHelp = () => {
    onHelpLog?.();
    if (onHelp) return onHelp();
    setHelpOpen(true);
  };

  const showDock = (effectiveShowBack && !!onBack) || showHelp;
  /** 直式／橫式小螢幕共用：等高、flex-1；橫式時略縮高度省垂直空間 */
  const dockBtnClass =
    'inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold shadow-md transition active:scale-[0.98] sm:min-h-[48px] sm:gap-2 sm:px-4 landscape:min-h-[40px] landscape:max-h-[44px] landscape:py-0 landscape:px-3 landscape:text-[13px]';

  const FooterInner = (
    <div className="space-y-0.5 text-center text-sm text-gray-500">
      <p>教育部帶動中小學計畫</p>
      <p>Google Developer Groups on Campus NTUB</p>
      <p className="text-xs text-gray-400">© 2026</p>
    </div>
  );

  return (
    <div className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[#FDFBF7]">
      <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-gray-200/80 bg-white/95 px-4 shadow-sm backdrop-blur-sm md:px-6">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900 md:text-base">{headerTitle}</div>
          {headerSubtitle && <div className="truncate text-xs text-gray-500 md:text-sm">{headerSubtitle}</div>}
        </div>
        <div className="relative flex items-center gap-2" ref={menuRef}>
          {userLabel && (
            <button
              type="button"
              onClick={() => (onLogout ? setMenuOpen((v) => !v) : undefined)}
              className={onLogout ? 'flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100' : 'flex items-center gap-2'}
              aria-label="使用者選單"
            >
              <div className="hidden min-w-0 flex-col items-end md:flex">
                <span className="max-w-[12rem] truncate text-sm text-gray-700">{userLabel}</span>
                {userSubLabel && <span className="max-w-[12rem] truncate text-xs text-gray-500">{userSubLabel}</span>}
              </div>
              {userAvatar && (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-medium text-amber-800 md:h-10 md:w-10">
                  {userAvatar}
                </div>
              )}
              {onLogout && <ChevronDown className="h-4 w-4 text-gray-500" />}
            </button>
          )}
          {menuOpen && onLogout && (
            <div className="absolute right-0 top-12 z-50 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2">
                <div className="text-sm font-medium text-gray-900">{userLabel}</div>
                {userSubLabel && <div className="text-xs text-gray-500">{userSubLabel}</div>}
              </div>
              <button
                type="button"
                onClick={async () => { setMenuOpen(false); await onLogout(); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> 登出
              </button>
            </div>
          )}
        </div>
      </header>

      <main
        className={
          mainLayout === 'fill'
            ? `flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:p-5 ${showDock ? 'max-lg:pb-32 max-lg:landscape:pb-28 lg:pb-28' : ''}`
            : `flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-4 md:p-6 ${showDock ? 'max-lg:pb-32 max-lg:landscape:pb-28 lg:pb-28' : ''}`
        }
      >
        {mainLayout === 'fill' ? (
          <div className="flex min-h-0 w-full max-w-[1600px] flex-1 flex-col self-center overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-lg">
            {children}
          </div>
        ) : (
          <div className="flex min-h-0 w-full max-w-4xl flex-1 flex-col justify-center">
            <div className="aspect-video w-full min-h-0 overflow-hidden rounded-2xl bg-white shadow-lg md:aspect-[16/10]">
              {children}
            </div>
          </div>
        )}
      </main>

      {/* 桌機：一般頁尾（底部工具列置中浮動） */}
      <footer className="shrink-0 border-t border-gray-200/80 bg-white/95 py-2 backdrop-blur-sm max-lg:hidden">
        {FooterInner}
      </footer>

      {/* 小螢幕：底部固定區（工具列 + 頁尾）一起，避免互相壓到 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/90 bg-white/98 backdrop-blur-sm lg:hidden">
        {showDock && (
          <div className="flex items-stretch gap-2 px-2 py-2">
            {effectiveShowBack && onBack && (
              <button type="button" onClick={onBack} className={`${dockBtnClass} border-2 border-gray-300 bg-white text-gray-800 hover:bg-gray-50`} aria-label="返回">
                <Home className="h-5 w-5 shrink-0 landscape:h-4 landscape:w-4" />
                返回
              </button>
            )}
            {showHelp && (
              <button type="button" onClick={handleHelp} className={`${dockBtnClass} bg-amber-500 text-white hover:bg-amber-600`} aria-label="求助" title={helpTip}>
                <HelpCircle className="h-5 w-5 shrink-0 landscape:h-4 landscape:w-4" />
                求助
              </button>
            )}
          </div>
        )}
        <div className="border-t border-gray-200/70 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="space-y-0.5 text-center text-[12px] leading-tight text-gray-500">
            <p>教育部帶動中小學計畫</p>
            <p>Google Developer Groups on Campus NTUB</p>
            <p className="text-[11px] text-gray-400">© 2026</p>
          </div>
        </div>
      </div>

      {/* 桌機寬螢：置中工具列 */}
      {showDock && (
        <div className="pointer-events-none fixed inset-x-0 bottom-14 z-40 hidden justify-center px-4 lg:flex">
          <div className="pointer-events-auto flex items-stretch gap-3 rounded-2xl border border-gray-200/90 bg-white/98 p-2 shadow-lg backdrop-blur-sm">
            {effectiveShowBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-12 min-h-[48px] min-w-[7rem] items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-6 text-base font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                aria-label="返回"
              >
                <Home className="h-5 w-5 shrink-0" />
                返回
              </button>
            )}
            {showHelp && (
              <button
                type="button"
                onClick={handleHelp}
                className="inline-flex h-12 min-h-[48px] min-w-[7rem] items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-amber-600"
                aria-label="求助"
                title={helpTip}
              >
                <HelpCircle className="h-5 w-5 shrink-0" />
                求助
              </button>
            )}
          </div>
        </div>
      )}

      {helpOpen && !onHelp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setHelpOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">需要幫忙嗎？</h3>
            <p className="mt-2 text-sm text-gray-600">請先舉手問老師。</p>
            <div className="mt-6">
              <button type="button" onClick={() => setHelpOpen(false)} className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600">
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
