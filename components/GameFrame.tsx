'use client';

import { HelpCircle, Home, LogOut, ChevronDown } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

/** JSX 屬性字串裡的 `\n` 有時會變成字面「\n」兩字元，一併轉成真正換行 */
function normalizeHelpNewlines(text: string): string {
  return text.replace(/\\n/g, '\n');
}

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
  /** 右下求助按鈕；若同時設定 helpModalMessage 則以對話框為優先 */
  onHelp?: () => void;
  /** 點擊求助時先執行（用來寫 log） */
  onHelpLog?: () => void;
  /** 若有設定：求助改為開啟內建對話框（避免手機瀏覽器擋 alert） */
  helpModalMessage?: string;
  /** 手機底部「返回／求助」列較小（表單等） */
  denseMobileDock?: boolean;
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
  helpModalMessage,
  denseMobileDock = false,
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
    if (helpModalMessage) {
      setHelpOpen(true);
      return;
    }
    if (onHelp) {
      onHelp();
      return;
    }
    setHelpOpen(true);
  };

  const showDock = (effectiveShowBack && !!onBack) || showHelp;
  /** 直式／橫式小螢幕共用：等高、flex-1；denseMobileDock 時表單頁用較小按鈕省空間 */
  const dockBtnClass = denseMobileDock
    ? 'inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold shadow-sm transition active:scale-[0.98] sm:min-h-[36px] sm:text-xs lg:min-h-[48px] lg:gap-2 lg:rounded-xl lg:px-4 lg:text-sm lg:shadow-md landscape:min-h-[32px] landscape:text-[11px]'
    : 'inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold shadow-md transition active:scale-[0.98] sm:min-h-[48px] sm:gap-2 sm:px-4 landscape:min-h-[40px] landscape:max-h-[44px] landscape:py-0 landscape:px-3 landscape:text-[13px]';

  const FooterInner = (
    <div className="space-y-0.5 text-center text-sm text-gray-500">
      <p>教育部帶動中小學計畫</p>
      <p>Google Developer Groups on Campus NTUB</p>
      <p className="text-xs text-gray-400">© 2026</p>
    </div>
  );

  return (
    <div className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[#FDFBF7]">
      <header className="z-50 flex h-14 shrink-0 items-center justify-between overflow-visible border-b border-gray-200/80 bg-white/95 px-4 shadow-sm backdrop-blur-sm md:px-6">
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
            <div
              className="fixed right-3 top-14 z-[200] w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(70vh,24rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl md:right-6"
              style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
            >
              <div className="border-b border-gray-100 px-4 py-2">
                <div className="break-words text-sm font-medium text-gray-900">{userLabel}</div>
                {userSubLabel && <div className="mt-0.5 break-words text-xs text-gray-500">{userSubLabel}</div>}
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
            ? `flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4 md:p-5 max-lg:overflow-y-auto ${
                showDock
                  ? denseMobileDock
                    ? 'max-lg:pb-[11.5rem] max-lg:landscape:pb-40 lg:pb-32'
                    : 'max-lg:pb-[15.5rem] max-lg:landscape:pb-48 lg:pb-32'
                  : 'max-lg:pb-28 max-lg:landscape:pb-24'
              }`
            : `flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-4 md:p-6 ${showDock ? 'max-lg:pb-52 max-lg:landscape:pb-44 lg:pb-32' : 'max-lg:pb-28 max-lg:landscape:pb-24'}`
        }
      >
        {mainLayout === 'fill' ? (
          <div className="flex min-h-0 w-full max-w-[1600px] flex-1 flex-col self-center overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-lg">
            {/* 子層 flex-1 + min-h-0：直式手機上表單／大區塊才能正確分配高度，避免被 overflow-hidden 裁切 */}
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        ) : (
          <div className="flex min-h-0 w-full max-w-4xl flex-1 flex-col justify-center">
            <div className="aspect-video w-full min-h-0 overflow-hidden rounded-2xl bg-white shadow-lg md:aspect-[16/10]">
              {children}
            </div>
          </div>
        )}
      </main>

      {/* 桌機頁尾：只放頁尾內容（按鈕不鑲在頁尾） */}
      <footer className="shrink-0 border-t border-gray-200/80 bg-white/95 py-2 backdrop-blur-sm max-lg:hidden">
        {FooterInner}
      </footer>

      {/* 桌機：獨立浮動工具列（不鑲在頁尾，也不遮住頁尾） */}
      {showDock && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[6.25rem] z-40 hidden justify-center px-4 lg:flex"
          role="toolbar"
          aria-label="遊戲操作"
        >
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

      {/* 小螢幕：底部固定區（工具列 + 頁尾分開排版），保證不重疊 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/90 bg-white/98 backdrop-blur-sm lg:hidden">
        {showDock && (
          <div className={denseMobileDock ? 'px-1.5 py-1' : 'px-2 py-2'}>
            <div
              className={`mx-auto flex w-full max-w-xl items-stretch gap-1.5 rounded-xl border border-gray-200/90 bg-white/98 shadow-lg lg:gap-2 lg:rounded-2xl lg:p-2 ${denseMobileDock ? 'p-1' : 'p-2'}`}
            >
              {effectiveShowBack && onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className={`${dockBtnClass} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 lg:border-2`}
                  aria-label="返回"
                >
                  <Home
                    className={`shrink-0 ${denseMobileDock ? 'h-3.5 w-3.5 lg:h-5 lg:w-5' : 'h-5 w-5 landscape:h-4 landscape:w-4'}`}
                  />
                  返回
                </button>
              )}
              {showHelp && (
                <button
                  type="button"
                  onClick={handleHelp}
                  className={`${dockBtnClass} bg-amber-500 text-white hover:bg-amber-600`}
                  aria-label="求助"
                  title={helpTip}
                >
                  <HelpCircle
                    className={`shrink-0 ${denseMobileDock ? 'h-3.5 w-3.5 lg:h-5 lg:w-5' : 'h-5 w-5 landscape:h-4 landscape:w-4'}`}
                  />
                  求助
                </button>
              )}
            </div>
          </div>
        )}
        <div
          className={`border-t border-gray-200/70 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${denseMobileDock ? 'py-1' : 'py-2'}`}
        >
          {denseMobileDock ? (
            <p className="text-center text-[10px] leading-tight text-gray-500 lg:hidden">
              教育部帶動中小學計畫 · GDG on Campus NTUB · © 2026
            </p>
          ) : null}
          <div
            className={`text-center leading-tight text-gray-500 ${denseMobileDock ? 'hidden space-y-0.5 text-[12px] lg:block' : 'space-y-0.5 text-[12px]'}`}
          >
            <p>教育部帶動中小學計畫</p>
            <p>Google Developer Groups on Campus NTUB</p>
            <p className="text-[11px] text-gray-400">© 2026</p>
          </div>
        </div>
      </div>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/50 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          onClick={() => setHelpOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[min(85dvh,32rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gameframe-help-title"
          >
            <h3 id="gameframe-help-title" className="text-lg font-bold text-gray-900">
              {helpModalMessage ? '操作說明' : '需要幫忙嗎？'}
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {helpModalMessage
                ? normalizeHelpNewlines(helpModalMessage)
                : '請先舉手問老師。'}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
