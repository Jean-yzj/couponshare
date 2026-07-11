# CouponShare 平台健檢報告

> 檢查日期：2026-07-11 · 分支：`claude/platform-health-check`
> 範圍：工具鏈、相依套件、資料模型、安全授權、並行正確性、維運設定

## 總評

整體工程品質**很高**：型別安全、正式建置都通過，加密／授權／條碼保密等「核心資產」設計扎實。
但健檢發現 **3 個 HIGH 等級缺陷**（1 個帳號接管、2 個並行資料一致性），建議優先修復。

| 面向 | 狀態 |
|------|------|
| TypeScript 型別檢查 | ✅ 通過 |
| 正式建置 `next build` | ✅ 通過 |
| Prisma schema | ✅ 有效、索引完整 |
| 加密 / Session / 條碼保密 | ✅ 扎實 |
| 授權 (IDOR / admin gating) | ⚠️ 1 個 HIGH（原生登入）+ 少數小問題 |
| 並行正確性 | ⚠️ 2 個 HIGH（配額繞過、cron 覆寫） |
| 維運 / 設定 | ⚠️ 多個 MEDIUM（無 migration、env 驗證、backup 快照） |

---

## ✅ 確認健全的部分

- **加密**：條碼 AES-256-GCM、密碼 scrypt、Session/條碼 token HMAC 簽章、全部使用 timing-safe 比較。
- **條碼 / 兌換碼保密**：`serialize.ts` / `feed.ts` / `selects.ts` 永不輸出密文欄位，只回傳 `has_barcode` / `can_view_barcode` 布林值。條碼圖片路由雙重驗證（token + session）。
- **核准流程**（`claim-requests/[id]/approve`）：`SELECT … FOR UPDATE` 鎖 + 鎖內重讀狀態，熱門券不可能被雙重領取。
- **積分帳本冪等**：`ScoreLedger` 的 `@@unique(userId,eventType,referenceType,referenceId)` 由 DB 保證每事件只計一次。
- **同時亮碼 escrow**：`ownerReady`/`claimantReady`/`revealedAt` 皆在同一列上序列化，任一方不會在未交出自己條碼前看到對方條碼。
- **OAuth（Web）**：`state`/`g_state` cookie 比對防 CSRF、所有導向都指向驗證過的 app origin（無 open redirect）、既有帳號登入需 `emailVerified`（防接管）。
- **SQL**：所有 `$queryRaw` 皆為參數化 tagged template，無注入。
- **錯誤處理**：未知錯誤只回傳通用 500，不外洩 stack trace / PII。
- **無 `dangerouslySetInnerHTML`**、無敏感資訊 console log。

---

## 🔴 HIGH — 建議優先修復

### H1 — 原生 Google/Apple 登入可帳號接管（缺 `email_verified` 檢查）
**檔案**：`lib/oauth-jwt.ts:86-97`、`app/api/v1/auth/google/native/route.ts:24-46`、`app/api/v1/auth/apple/route.ts:34-38`

Web callback 有防護（`if (existing && !profile.emailVerified) …email_unverified`），但**原生流程沒有**。
`verifyGoogleIdToken` 讀了 `email` 卻從不回傳／檢查 `email_verified`，原生路由僅憑 email 比對就登入既有帳號。

**攻擊情境**：攻擊者用一個把 email 設為 `victim@company.com`（Google 未驗證，`email_verified=false`）的 Google 帳號，取得 `aud=GOOGLE_IOS_CLIENT_ID` 的合法 id_token，原生登入即接管受害者原本用 email/密碼註冊的帳號。Google 官方文件正是要求驗證 `email_verified` 才能連結帳號。
Apple 路由已算出 `emailVerified` 但完全沒用（風險較低，仍應補上以求一致）。

**修法**：`verifyGoogleIdToken` 回傳 `emailVerified`，原生路由在連結既有帳號前比照 web callback 拒絕未驗證者。

### H2 — 每日領取上限 + 反爆量為 TOCTOU，平行請求可繞過
**檔案**：`app/api/v1/coupons/[id]/claim-requests/route.ts:53-76`（檢查）vs `78-100`（寫入）

`applyQuota(user)`（L70）與 `lastClaim` 間隔檢查（L53-65）都是交易**外**的普通讀取；`$transaction` 內只鎖了**券**（L80），沒鎖 user。

**攻擊情境**：機器人同一毫秒對 15 張不同的 AVAILABLE 券發 15 個領取請求，每個都讀到 count=0、無近期 `lastClaim`，全部通過配額與 5 秒節流，各自鎖不同券成功寫入 → 遠超 `MAX_DAILY_CLAIMS` 並繞過反爆量。正是最近 commit「close the farm-quota bypass」想防的行為，但在並行下仍可繞過。

**修法**：在 `$transaction` 內先鎖 user（`SELECT id FROM users WHERE id=${uid} FOR UPDATE` 或 `pg_advisory_xact_lock(hashtext(uid))`），鎖內重算配額與間隔再寫入。

### H3 — Cron 無條件覆寫券狀態，會蓋掉並行核准
**檔案**：`lib/cron-jobs.ts:22-27`（expire）、`121-126`（pending-timeout）

`runExpireCoupons` 先 `findMany`（不鎖）後在交易內 `coupon.update({data:{status:"EXPIRED"}})` **無條件、不鎖內重讀**。

**攻擊情境**：cron 撈到即將過期的券 C → 擁有者核准某申請者（鎖 C、C→CLAIMED、建立 Transaction、擁有者 +10）→ cron 的 update 等到鎖釋放後把 C 蓋成 **EXPIRED**。結果：Transaction 仍存在、擁有者留著 +10，但領取者因 `barcode` 路由要求 `status==="CLAIMED"` 而永遠拿不到條碼。pending-timeout 版本更會把剛 CLAIMED 的券還原成 AVAILABLE，留下孤兒交易，之後再核准會因 `Transaction.couponId @unique` 觸發 P2002 硬錯。

**修法**：改成條件式 `updateMany({ where:{ id, status:{ in:["AVAILABLE","PENDING"] } }, … })`，count=0 時跳過後續副作用；或比照 approve 用 `FOR UPDATE` + 鎖內重讀。

---

## 🟠 MEDIUM

### 業務 / 並行
- **M1 — approve 未檢查 `expiryDate`**（`claim-requests/[id]/approve/route.ts:32-41`）：可核准已過期的券並發 `COUPON_GIFTED +10`。修：鎖內重讀後加 `if (locked.expiryDate && locked.expiryDate<=now) throw COUPON_EXPIRED`。
- **M2 — `complete` 路由非原子**（`transactions/[id]/complete/route.ts:16-60`）：頂部讀取 + 狀態守衛 + flag 更新都在交易外，只有 finalize 在交易內且**不重查狀態**。後果：(a) 雙方同時按完成會重複發通知／稽核；(b) 一方 in-flight 的 complete 可覆蓋另一方剛送出的 **DISPUTED**，錯誤地把交換算成完成並發 +5（積分本身有冪等保護，不會雙計）。修：整段包進 `$transaction` + `FOR UPDATE` + 鎖內 `status!=="COMPLETED" && status!=="DISPUTED"` 重查。

### 維運 / 設定
- **M3 — 沒有 Prisma migration**：專案用 `db:push`，`prisma/migrations` 不存在。正式 DB 無版本history／無法回滾／無 drift 偵測，`db push` 改欄位可能無聲毀資料。建議導入 `prisma migrate`（dev 產生、CI `migrate deploy`）。
- **M4 — 必要密鑰延遲驗證 + 缺 `.env.example`**：`SESSION_SECRET`/`BARCODE_KEY` 只在「首次使用」才丟錯，不是開機即檢查；缺 `BARCODE_KEY` 的部署會「假綠燈」啟動，直到第一個人看條碼才爆。README 叫你 `cp .env.example .env` 但**檔案不存在**。建議：`instrumentation.ts` 開機 fail-fast 檢查 + 補一份 committed `.env.example`。
- **M5 — Backup 非時間點快照**：匯出橫跨數分鐘多個 HTTP 請求，可能出現「Transaction 指向匯出中途才建立、未被收錄的 Coupon」，還原時 `createMany` 不跳過 FK 檢查會整批 abort。（完整性、FK 順序、防截斷都已驗證 PASS，只有快照原子性這點有風險。）建議對 replica/快照匯出，或還原時延後約束。
- **M6 — CSP `script-src 'unsafe-inline'` + 無 HSTS**（`next.config.ts`）：inline script 允許會削弱 XSS 防護（app 會渲染使用者字串）；且缺 `Strict-Transport-Security`。建議改 nonce-based CSP 並加 HSTS。
- **M7 — 多實例下 cron 會重跑**（`lib/scheduler.ts`）：in-process 排程每實例各跑一份。單實例現況無虞，但水平擴充前需用 advisory lock 或 `DISABLE_CRON` 只留一份。另外 in-process 排程與 HTTP cron 路由功能重複，擇一即可。
- **M8 — `admin/normalize-brands` 用 `CRON_SECRET` 而非 `requireAdmin`**（該路由 L8-9）：其餘 admin 路由都正確用 `requireAdmin`，此路由用較低權的 cron secret 授權可批次改寫所有品牌名。建議改 `requireAdmin` 或移出 admin 命名空間。
- **M9 — `admin/stats` 三個時間序列查詢未設上限**（`stats/route.ts:173-178`）：`userTs/couponTs/txnTs` 用 `findMany`（30 天內、無 `take`）在記憶體分桶，量大時會抓數萬列。建議改 `GROUP BY to_char(created_at,'YYYY-MM-DD')`（鄰近查詢已這樣做）。

---

## 🟡 LOW / 資訊

- **L1 — `THANK_YOU_MESSAGE` 積分在交易外且無 try/catch**（`transactions/[id]/messages/route.ts:58-67`）：兩則並行留言時，敗者撞 P2002 → 給使用者假 500（訊息其實已建立、不會雙計）。修：比照 publish 路由吞掉 P2002。
- **L2 — `ready` 亮碼可能重複通知**（`transactions/[id]/ready/route.ts`）：亮碼守衛正確，只是通知會重送。次要。
- **L3 — `claimRequestCount` 語意不一致**：cancel 會減、reject 不減（`claim-requests/[id]/cancel` vs `reject`）。原子增減本身無 race，只是語意需確認（會影響 stale 自動下架判斷）。
- **L4 — 分級限定券的 detail 任何人憑 id 可讀**（`coupons/[id]/route.ts:12-44`）：`LEVEL_2/3_ONLY` 券的標題／品牌／描述對未登入者也回傳（不外洩條碼；申請仍正確擋等級）。若為刻意（可分享連結）可忽略，僅提示與 feed 過濾行為不一致。
- **L5 — npm audit：2 個 moderate**（postcss 經 Next 傳遞）：上游問題，修復會把 Next 降版，不建議動。
- **L6 — 相依現況良好**：Next 16.2.9、React 19.2.4、Prisma 6.19.3 皆接近最新。可用大版本只有 Prisma 7 / TS 7；`package.json#prisma` 設定在 Prisma 7 會移除，未來需遷 `prisma.config.ts`。
- **L7 — 無 lint / test / 程式碼 CI**：`.github` 只有 `backup.yml`（寫得很好）。目前完全靠本地紀律；建議至少加 `typecheck`/`lint` script 與 PR CI。

---

## 修復狀態（本分支）

以下項目已於本分支修復並通過 typecheck + build：

| 項目 | 狀態 | 摘要 |
|------|------|------|
| H1 原生登入帳號接管 | ✅ 已修 | `verifyGoogleIdToken` 回傳 `emailVerified`；native/apple 連結既有帳號前檢查，新增 `EMAIL_NOT_VERIFIED` 錯誤 |
| H2 配額 TOCTOU | ✅ 已修 | 領取交易內先 `pg_advisory_xact_lock(user)`，鎖內重算 burst + quota |
| H3 cron 覆寫 | ✅ 已修 | expire/stale/pending-timeout 改條件式 `updateMany`（status 守衛），count=0 跳過副作用 |
| M1 approve 過期 | ✅ 已修 | 鎖內加 `expiryDate` 檢查 |
| M2 complete 非原子 | ✅ 已修 | 整段包進 `$transaction` + `FOR UPDATE` + 狀態重查；dispute 端同步加鎖重查 |
| M3 無 migration | ✅ 已建立 | 產生 `prisma/migrations/0_init` 基線 + `db:migrate*` scripts + `docs/MIGRATIONS.md`（含既有 DB baseline 步驟） |
| M4 env 驗證 | ✅ 已修 | `instrumentation.ts` 開機 fail-fast + 補 `.env.example` |
| M5 backup 快照 | ✅ 已緩解 | 還原改為 FK 違規時逐列 fallback、跳過孤兒列並記錄，不再整批 abort |
| M6 CSP/HSTS | ⚠️ 部分 | 已加 HSTS + `upgrade-insecure-requests`；**未**改 nonce（見下方說明） |
| M7 多實例 cron | ✅ 已修 | scheduler 以 `pg_try_advisory_xact_lock` 單一實例執行 |
| M8 normalize-brands 授權 | ✅ 已修 | 改用 `requireAdmin` |
| M9 stats 無上限查詢 | ✅ 已修 | 3 個時間序列改 `GROUP BY` |
| L1 感謝訊息假 500 | ✅ 已修 | `applyScore` 包 try/catch |
| L2 亮碼重複通知 | ✅ 已修 | 條件式 `updateMany(revealedAt:null)` 單次觸發 |
| L3 count 語意不一致 | ✅ 已修 | reject 同步 decrement |
| L4 分級券 detail 外洩 | ✅ 已修 | detail 依等級 gate（owner/claimant 例外） |
| L7 無程式碼 CI | ✅ 已修 | 新增 `.github/workflows/ci.yml`（typecheck + build）與 `typecheck` script |

**未修（附理由）：**
- **M6 nonce-based CSP** — Next 16 的 nonce 方案會強制所有頁面轉為動態渲染（現有 `/login`、`/leaderboard`、`/terms` 等靜態頁會失去靜態最佳化並有 runtime 風險）。為換取一個 MEDIUM 等級的強化而犧牲效能與穩定性不划算，且本專案無 XSS sink（已確認無 `dangerouslySetInnerHTML`）。已改加 HSTS。若要強制 strict CSP，可另開工作改走 middleware nonce 或實驗性 SRI。
- **L5 postcss（2 個 moderate）** — 上游經 Next 傳遞，修復會把 Next 降版，維持現狀。
- **L6 `package.json#prisma` 棄用警告** — 遷 `prisma.config.ts` 屬 Prisma early-access，改錯會讓所有 prisma 指令（含 build 的 generate）失效；在 Prisma 7 升級時一併處理較安全。此為無害警告，不影響功能。

## 建議修復順序

1. **H1 原生登入帳號接管** — 安全最優先，修法小而安全。
2. **H2 + H3 並行資料一致性**（配額繞過、cron 覆寫）— 影響資料正確性與防濫用。
3. **M3 導入 Prisma migration** — 長期資料完整性最大風險。
4. **M4 開機 env fail-fast + `.env.example`**、**M8 normalize-brands 授權**。
5. 其餘 MEDIUM（backup 快照、CSP/HSTS、stats 查詢、cron 單實例）與 LOW 視情況排入。
