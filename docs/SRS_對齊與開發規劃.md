# 資訊科普教育平台 — SRS 對齊與開發規劃

## 一、現況 vs 規格對齊總表

| 規格項目 | 現況 | 待辦 |
|----------|------|------|
| **全域 UI** | 已有 #FDFBF7、flowing-bg、RWD | 統一外層 Layout：Header(期數+身分)、固定 Game Container、左下返回/右下求助、Footer |
| **首頁** | 有登入頁 + 角色儀表板 | 改為「歡迎 + 登入」首頁，登入後依身分唯一入口 |
| **帳號架構** | 單一 Users、role 區分 | 已符合；補：學員不可改帳密、講師可改顯示名與大頭照 |
| **學員首次登入** | 無 | 強制 Onboarding：性別、年級 → 寫入 Users，只出現一次 |
| **Admin 全域** | 有 /dashboard/admin | 期數與班級管理、遊戲模組管理、全站帳號管理 |
| **講師班級控制** | 有 /teacher/dashboard 解鎖 | 補：批次/單一/跨班學員、Login Lock、學生視角預覽、數據面板 |
| **學員首頁** | 解鎖任務大按鈕 | 已接近；確保只在「主畫面框」內切換 |
| **Action_Logs** | SystemLog 表存在 | 欄位對齊 SRS；擴充 action：TAB_LEAVE/TAB_ENTER、PING、教師介入 |
| **MVP 遊戲** | 有 CLICK_1/CLICK_2 模組 | 實作單擊 / 雙擊遊戲邏輯 + 求助 + SUCCESS/ERROR log |
| **專注度 / 心跳** | 無 | 前端 visibilitychange + 每 30 秒 PING |

---

## 二、資料庫需調整處（Prisma）

### 2.1 User 表擴充（Onboarding + 講師）

```prisma
model User {
  // ... 既有欄位
  gender    String?   // 男/女（學員 Onboarding）
  grade     String?   // 三年級～六年級（學員 Onboarding）
  avatarUrl String?  // 講師/Admin 大頭照
  onboardingDone Boolean @default(false)  // 學員是否已填過人口變項
}
```

### 2.2 班級登入鎖（防偷玩）

```prisma
model ClassGroup {
  // ... 既有欄位
  loginLocked Boolean @default(false)  // true = 非上課時間禁止學員登入
}
```

### 2.3 期數與「堂課」結構（三校 × 四堂課）

- 目前：Term → ClassGroup（一班一校）。
- 規格：每校四堂課、不同月份、遊戲按堂課上架。
- **建議**：  
  - **方案 A（最小改動）**：一個 Term = 一學期，ClassGroup 命名或加欄位區分「堂課」，例如 `sessionOrder Int?`（第 1～4 堂），遊戲模組仍掛在 Term，用「解鎖」控制哪一堂能看到。  
  - **方案 B（完整）**：新增 `Session` 表，Term → Session（4 筆），Session → ClassGroup（每校每堂一筆），GameModule 改掛 Session 或保留 Term 用關聯表指定可出現在哪些 Session。  

先採 **方案 A** 即可，之後若要細到「按堂課排程」再引入 Session。

### 2.4 SystemLog 擴充 action 與用途

- 既有：action, isCorrect, timeDiffMs, payload(Json)。
- 對齊 SRS：`action` 支援：`START | MOVE | HELP | ERROR | SUCCESS`，以及 `TAB_LEAVE | TAB_ENTER | PING`；教師操作可加 `UNLOCK_TASK | VIEW_STUDENT_DATA` 等。
- `payload` 即 SRS 的 raw_data（原始點擊、補充欄位）。

---

## 三、開發環境與上線方式（Mac + Cloudflare + 雲端 DB）

### 3.1 環境分離

- **本地 (Mac)**：  
  - `.env.local`：`DATABASE_URL` 指向本地或雲端測試用 PostgreSQL。  
  - 開發時用 `npm run dev`，不提交 `.env*`。
- **Cloudflare 上線**：  
  - 使用 **Cloudflare Pages**（Next.js 需 static export 或 Node 相容的 Workers/Pages Functions）。  
  - 若 Next 用 API Routes，需確認 Cloudflare 支援（或 API 拆到 Cloudflare Workers / 其他後端）。  
  - 上線環境變數在 Cloudflare 後台設 `DATABASE_URL` 指向**雲端資料庫**（如 Neon、Supabase、Railway）。

### 3.2 資料庫建議

- **開發**：本地 PostgreSQL 或同一雲端 DB 的 dev 資料庫。  
- **正式**：同一雲端服務的 production DB，用不同 `DATABASE_URL`。  
- 遷移一律用 Prisma：`npx prisma migrate deploy`（上線時在 CI 或 deploy 腳本執行）。

### 3.3 需要修改的設定檔

- **Prisma**：不需改 provider，只加欄位與新表。  
- **Next.js**：若部署到 Cloudflare Pages，檢查 `next.config` 是否需 `output: 'standalone'` 或 Cloudflare 建議設定。  
- **.env.example**：新增範例，例如 `DATABASE_URL=`、`JWT_SECRET=`，方便之後接雲端 DB。

---

## 四、功能模組拆解（建議實作順序）

### 階段 0：基底（你已有）

- 登入、角色導向、middleware、解鎖 API、老師中控台、學生任務面板、遊戲骨架頁。

### 階段 1：全域 Layout + 首頁

1. **統一 Layout**  
   - 所有「遊戲/測驗」頁共用一個 Layout：  
     - Header：左「活動期數」、右「登入身分與頭像」。  
     - Main：固定比例 Game Container（中央）。  
     - 左下固定【返回首頁/退出遊戲】、右下固定【💡 求助】。  
     - Footer：教育部帶動中小學計畫／Google Developer Groups on Campus NTUB／© 2026。
2. **首頁**  
   - 未登入：歡迎 + 登入表單（或登入按鈕進 /login）。  
   - 登入後：一律導向唯一入口（/dashboard → 依 role 再導向 /dashboard/student | teacher | admin）。

### 階段 2：學員 Onboarding

1. 學員首次登入（依 `onboardingDone === false`）全螢幕遮蔽。  
2. 表單：性別（男/女）、年級（三～六年級）→ POST 更新 User（gender, grade, onboardingDone=true）。  
3. 寫入後不再顯示，進入正常學員首頁。

### 階段 3：Log 與行為追蹤

1. **SystemLog API**  
   - POST `/api/logs`（或 `/api/action-log`）：  
     - 身分驗證後寫入：userId, classGroupId, gameModuleId, action, isCorrect, timeDiffMs, payload(raw_data)。  
   - 前端每個遊戲/測驗在關鍵動作呼叫（START/MOVE/HELP/ERROR/SUCCESS）。
2. **專注度**  
   - 前端監聽 `document.visibilitychange`：  
     - hidden → 送 TAB_LEAVE。  
     - visible → 送 TAB_ENTER。  
   - 可同一 POST 或專用 action。
3. **心跳**  
   - 前端每 30 秒送 PING（同一 log API，action=PING，可帶 gameModuleId/sessionId）。
4. **教師介入**  
   - 老師「解鎖任務」時寫一筆（例：UNLOCK_TASK）。  
   - 老師「查看某學員數據」時寫一筆（VIEW_STUDENT_DATA）。  
   - 後端在對應 API 內寫入 SystemLog。

### 階段 4：班級與登入鎖

1. **Login Lock**  
   - ClassGroup 加 `loginLocked`。  
   - 學員登入 API（或 middleware）：若該班 `loginLocked === true`，回傳「尚未開放登入」並阻擋。
2. **老師 UI**  
   - 中控台加「非上課時間禁止登入」開關，更新 ClassGroup.loginLocked。

### 階段 5：講師完整功能

1. 班級學員管理：批次生成、單一新增、跨班加人、移出班級（不刪帳號）。  
2. 活動面板解鎖：已有多數，補「前測/後測」若未來有。  
3. 學生視角預覽：新分頁模擬該班學員首頁（同 GET /api/games/status + 該班 loginLocked）。  
4. 學員數據面板：前測/後測進度、遊戲進度燈號、求助次數、耗時、錯誤率（從 SystemLog 查詢彙總）。

### 階段 6：MVP 遊戲實作

1. **單擊測試 (CLICK_1)**  
   - 中央一大按鈕；點 1 次 → 送 SUCCESS，顯示過關，亮起返回。  
   - 求助 → 彈窗「請點擊中間按鈕 1 次」+ HELP log。  
2. **雙擊測試 (CLICK_2)**  
   - 連續點 2 次；超過 3 秒未第二擊 → ERROR + 重置。  
   - 求助 → 彈窗「請『連續』點擊中間按鈕 2 次喔！」+ HELP log。

---

## 五、三校 × 四堂課的邏輯分離

- **資料面**：每個班級 (ClassGroup) 已帶 `schoolCode`（如 ML / ST / LY），可再加 `sessionOrder`（1～4）或 `sessionLabel`（第一堂～第四堂）。  
- **權限面**：  
  - 講師只會看到自己 teacherGroups 底下的班級。  
  - Admin 可選「期數 + 班級」操作。  
- **首頁/學員**：學員只看到自己 studentGroup 的解鎖狀態，自然就是「該校該堂」的內容。  
- **遊戲上架**：目前遊戲是掛在 Term，用 ClassGameUnlock 控制「哪一班能看到」；若未來要「按堂課」顯示，再在 ClassGroup 或 Session 上區分堂課即可。

---

## 六、需要你確認的幾點

1. **期數與堂課**：一學期是否固定「每校 4 堂」？班級是否 = 一校一堂（例如「明禮第一堂」一個 ClassGroup）？  
2. **首頁**：未登入首頁要「只有歡迎 + 登入」還是保留目前登入頁的樣式即可？  
3. **Cloudflare**：預計用 Pages（靜態 + Functions）還是 Workers 跑 Next API？這會影響 API 與 DB 連線方式。  
4. **大頭照**：講師/Admin 大頭照要存在雲端（S3/R2）還是先不實作？

你先看這份對齊與順序，回覆上面幾點（或直接說「先做階段 1」），我可以依你選的階段從「資料庫欄位 + 具體要改的檔案」開始一步步改程式碼。

---

## 資料庫同步（Session / Log 已加入 Schema）

本次已加入：`Session`、`SessionGameUnlock`、`ClassGroup.loginLocked`、`SystemLog.sessionId`。請在專案目錄執行其一：

- **開發 / 直接同步**：`npx prisma db push`（不產生遷移檔，結構與 schema 一致即可）
- **正式環境建議**：先解決現有 DB 的 drift 後，再 `npx prisma migrate dev --name add_session_and_logs` 產生並套用遷移

完成後執行：`npx prisma generate`，再執行 `npx prisma db seed` 寫入堂次與解鎖資料。
