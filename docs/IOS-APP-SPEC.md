# CouponShare iOS 原生 App — 完整開發規格（交給執行 Agent）

版本 2026-07-03。本文件自成一體：執行者不需要任何其他對話脈絡。
產品負責人：Jean（lazybearlife）。溝通用繁體中文。

---

## 0. 你的任務（一句話）

用 **Expo (React Native, TypeScript)** 為既有的票券分享平台 CouponShare 建 iOS 原生 App：
**完全重用現有 REST API**（不重寫後端業務邏輯），依本規格補齊 App 專用後端端點，
以通過 App Store 審查為交付終點（TestFlight 可測 → 送審）。

- 網頁版（參考體驗與視覺）：https://couponshare.lazybearlife.com
- 後端 repo（含 API 原始碼）：https://github.com/Jean-yzj/couponshare
- **API 回應格式的最終真相** = repo 的 `lib/serialize.ts`；**請求驗證** = `lib/validation.ts`；**錯誤碼** = `lib/errors.ts`。本文件列出的欄位以那三個檔為準，衝突時以程式碼為準。

## 1. 產品是什麼（30 秒版）

使用者把用不到的優惠券**贈送**或**交換**給需要的人。核心循環：
上架券（拍條碼，AES-256 加密存）→ 別人留言申請 → **持有者親手挑一位**（不是先搶先贏）→
贈送：領取者直接看到條碼兌換；交換：雙方各自上傳條碼、**雙方都按確認後系統才同時亮碼**（escrow，防拿了就跑）→ 完成後互評、累積貢獻分與等級。

### 必須原樣保留的產品規則（不要自己發明）

1. **善意門檻**：從沒上架過券的人，終身只能申請 3 次；上架過第一張後改為每日額度（等級制），**當日每上架一張 +3 次**。API 會回你算好的數字（`/auth/me` 的 `apply_remaining` 等），前端只負責顯示與擋 UI。
2. **等級**：新手(每日 5 申請)/達人(8)/傳奇(12)。升級=貢獻分 ≥50/≥150 **或** 當月成功送出 ≥5/≥20 張。
3. **申請制**：送出申請 ≠ 得到券；持有者從申請列表挑人。已申請的券顯示「已申請 · 等待選擇」。
4. **交換 escrow**：交易頁上傳交換條碼 → 雙方各按「準備好了」→ 都按了才互相亮碼 → 各自按完成 → 雙方 +5 分；有爭議走 dispute（亮碼後才能提）。
5. **檢舉**：3 個不同檢舉人（帳齡 ≥24h）→ 自動停權；管理員可直接下架任何券。
6. **內容品質規則**：折扣沒寫金額/內容不具體/要加好友做任務的券，平台會下架（上架表單要顯示這段警語，文案抄網頁版 /new 頁）。
7. 票券可以**無使用期限**（expiry_date = null → 顯示「無使用期限」）。
8. 條碼是機密：feed/列表絕不含條碼；只有持有者與被選中的領取者能看，且經簽章 URL 或授權 header。

## 2. 技術基座（指定，不要換）

- **Expo SDK（managed）+ TypeScript + expo-router**（tab + stack 導覽）
- 資料層：**@tanstack/react-query**（staleTime 30s，重回前景 refetch；等同網頁版 SWR 行為）
- 推播：**expo-notifications + Expo Push Service**（後端打 Expo push API，不直接管 APNs 憑證）
- 相機/相簿：expo-image-picker（上架條碼用拍照或選圖）
- 安全儲存：expo-secure-store（存 bearer token）
- 最低 iOS 16。EAS Build 出包。
- App 專案開新 repo（例：`couponshare-ios`），不要塞進網頁 repo。

## 3. 後端現況與你要補的端點

### 3.1 現況（已存在、直接用）

Base URL：`https://couponshare.lazybearlife.com/api/v1`
（注意：`couponshare.zeabur.app` 是鏡像，OAuth 已設定強制跳轉正式網域；App 一律用正式網域。）

驗證：目前是 **HMAC cookie session（`cs_session`）**。錯誤格式統一：
```json
{ "error": { "code": "SHARE_FIRST", "message": "中文訊息", "details": {} } }
```
重要錯誤碼（完整見 lib/errors.ts）：`UNAUTHORIZED`(401)、`SHARE_FIRST`(403，跳「先分享一張券」引導)、
`DAILY_CLAIM_LIMIT_EXCEEDED`(429，顯示分享+3 引導)、`DUPLICATE_CLAIM_REQUEST`(409)、
`RATE_LIMITED`(429)、`BARCODE_ACCESS_DENIED`(403)、`USER_SUSPENDED`(403，跳申訴頁)。

端點總表（× 開頭 = 你要新增的）：

**Auth**
- POST `/auth/register` {email,password,display_name} / POST `/auth/login` {email,password}
- GET `/auth/me` → user 物件（欄位見 3.3）/ POST `/auth/logout`
- GET `/auth/google`（網頁 OAuth 302 流程，App 不用這條）
- × POST `/auth/token`、× `/auth/google/native`、× `/auth/apple`（見 3.2）

**Coupons**
- GET `/coupons/feed?sort=latest|expiry_soon|popular&page&limit&brand&type=GIFT|EXCHANGE&category&within_hours`
- POST `/coupons`（建草稿）→ POST `/coupons/:id/barcode`（multipart file）→ POST `/coupons/:id/publish`
- GET `/coupons/:id`（含 viewer 個人化欄位）/ PATCH `/coupons/:id`（編輯，CLAIMED 前）/ POST `/coupons/:id/cancel`
- GET `/coupons/:id/barcode`（回簽章圖片 URL+效期）/ GET `/coupons/:id/barcode/image`（帶授權直接回圖）
- POST `/coupons/:id/claim-requests` {message, request_type, exchange_offer_text?} / GET 同路徑（持有者看申請列表）

**Claim requests**
- POST `/claim-requests/:id/approve` / `/reject` {reason?} / `/cancel`（申請者撤回，PENDING 限定）

**Transactions（交易+聊天）**
- GET `/transactions/:id`（雙方可看；含 coupon/owner/claimant/status/ready 旗標）
- GET+POST `/transactions/:id/messages` {content}
- POST `/transactions/:id/offer-barcode`（交換方上傳條碼）+ GET `/offer-barcode/image`
- POST `/transactions/:id/ready` / `/complete` / `/dispute` {reason}
- POST `/transactions/:id/ratings` {rating_score 1-5, tags[], comment?}

**Me**
- GET `/me/wallet` → {listed[], applied[], received[], transactions[]}
- GET `/me/score`（貢獻分、等級、規則、徽章解鎖狀態的 ledger）
- GET `/me/brands` + POST `/brands/follow|unfollow` {brand}
- POST `/me/avatar` {image: dataURI|null}（128px JPEG dataURI）/ PATCH `/me/profile` {display_name}
- GET `/me/appeal` + POST（停權申訴）
- × DELETE `/me`（刪除帳號，見 3.2）

**其他**
- GET `/notifications` + POST `/notifications/:id/read` + `/read-all`
- GET `/leaderboard`（前 50 + 我的名次）
- POST `/reports` {coupon_id?, reported_user_id?, reason, description?}
- GET `/users/:id`（公開個人頁：評價、在分享的券）
- × POST `/me/blocks`、× DELETE `/me/blocks/:userId`、× GET `/me/blocks`（見 3.2）

### 3.2 你要在後端 repo 補的（先做這批，App 才能動）

在 `Jean-yzj/couponshare` repo 開 branch 實作（跟隨既有程式風格：`route()` wrapper、zod schema、
`writeAudit`、錯誤丟 `ApiError`）。**不可破壞網頁版既有行為**（cookie 流程照舊）。

1. **Bearer token 驗證**（並存，不取代 cookie）
   - `lib/auth.ts` 的 `getCurrentUser()` 加：無 cookie 時讀 `Authorization: Bearer <token>`，
     token 用與 cookie 相同的 HMAC session 格式（同一把 SESSION_SECRET，效期 90 天）。
   - POST `/auth/token` {email,password} → {token, user}（login 的 token 版）。
2. **原生 Google 登入**：POST `/auth/google/native` {id_token}
   → 用 Google 公鑰驗 id_token（aud = iOS client id，GCP 同專案新增 iOS OAuth client）
   → 依 email 建/連帳號（沿用現有 callback 的邏輯）→ 回 {token, user}。
3. **Sign in with Apple**：POST `/auth/apple` {identity_token, full_name?}
   → 驗 Apple 公鑰（aud = app bundle id）→ 依 apple sub/email 建/連帳號 → 回 {token, user}。
   User model 需加 `appleSub String? @unique`（prisma db push）。
4. **推播**：model `PushToken {id, userId, token @unique, platform, createdAt}`；
   POST `/me/push-tokens` {token, platform:"ios"}、DELETE 同路徑（登出時）。
   `lib/notify.ts` 的 `notify()` 落庫後**同時**打 Expo Push API（`https://exp.host/--/api/v2/push/send`，
   批次、失敗吞掉不影響主流程；DeviceNotRegistered 就刪 token）。
5. **封鎖**（App Store 1.2 硬性要求）：model `Block {blockerId, blockedId, @@unique}`；
   端點見 3.1；效果：feed 與 `/users/:id` 的券過濾被封鎖者、被封鎖者不能對我發申請（回 FORBIDDEN）、
   交易訊息不能再送。UI 入口：公開個人頁「⋯」選單＋聊天室選單。
6. **刪除帳號**（App Store 5.1.1(v) 硬性要求）：DELETE `/me` → status=DELETED、
   email/passwordHash/avatarUrl 清空、displayName 改「已刪除的使用者」、
   AVAILABLE 券轉 CANCELLED；保留交易紀錄（對方的紀錄不可消失）。網頁版設定頁也加同入口。
7. **條碼图 Bearer 支援**：`/coupons/:id/barcode/image` 與 offer-barcode/image 目前收簽章 token 或 cookie，
   加收 Bearer header（RN 的 Image 元件用 headers 屬性帶）。

驗收（後端批）：
- [ ] 既有網頁全部功能不變（cookie 流程回歸測試：登入、上架、申請、亮碼）
- [ ] `npm run build` 過；新端點各附 curl 實測輸出
- [ ] token 流程 e2e：/auth/token → 帶 Bearer 打 /auth/me 回 200；錯 token 401
- [ ] 推播 e2e：註冊 token → 觸發一則申請通知 → Expo push 收到
- [ ] 封鎖 e2e：A 封 B → B 申請 A 的券回 403、B 看不到 A 的券
- [ ] 刪帳號 e2e：刪後登入失敗、對方交易紀錄仍在且顯示「已刪除的使用者」

### 3.3 `/auth/me` 回應欄位（App 大量依賴，照抄）

```
id, display_name, avatar_url, email, login_provider, user_level(LEVEL_1|2|3),
level_name, contribution_score, monthly_gifts, risk_flag, status, is_admin,
daily_claim_limit, daily_publish_limit, next_level{level,name,needScore,needGifts}|null,
has_shared, apply_remaining, apply_limit, apply_base, must_share_first
```
個人頁要顯示「今天還可申請 N 張」= `apply_remaining`；`must_share_first=true` 時申請按鈕換成「先分享一張券」引導。

## 4. 畫面清單（對照網頁版做，不要重新發明資訊架構）

Tab bar（5）：**探索**（feed+搜尋+分類 chips+類型/排序）、**錢包**（我上架/我申請的/我領取的/已過期/已取消/交易紀錄六分頁）、**＋上架**（置中大按鈕）、**貢獻**（玩家卡+徽章牆+規則+等級+ledger）、**通知**。

Stack：券詳情（含申請 modal、持有者的申請列表與選人、管理員下架）、編輯券、交易頁（狀態流程+聊天+雙條碼+確認/完成/爭議/互評）、條碼全螢幕頁（亮度調到最高、防截圖提示）、公開個人頁（含封鎖）、排行榜、個人設定（暱稱/頭像/**刪除帳號**）、申訴頁、登入頁（Apple 置頂/Google/Email）、使用條款與隱私權政策（可 WebView 開網頁版 /terms /privacy）。

通知 deep link：reference_type=coupon → 券詳情；transaction → 交易頁；appeal → 申訴頁。
推播點擊也走同樣路由。

## 5. 設計系統（沿用網頁版，token 照抄）

- 背景 canvas `#f2f7ff`、卡片 paper `#ffffff`、主文字 ink `#142140`、次要 `#566388`、淡 `#93a0bd`、框線 `#e6ecf8`
- 主色 accent `#1f7bff`（按下 `#0e60e6`、淡底 `#e7f0ff`）；品牌漸層 `135deg #3b93ff→#0e60e6`＋藍色 glow 陰影
- 分類色（券卡 header 淡底/圓標漸層/膠囊）：超商綠 `#0f9d57`、咖啡棕 `#875f3b`、手搖飲黃 `#c98f10`、速食紅 `#e5322a`、甜點粉 `#ec4b82`、餐廳橘 `#ef7d1f`、購物藍 `#1f7bff`、娛樂紫 `#7a5cf0`、其他灰 `#6b7a99`（精確值見 repo `lib/categories.ts` 的 CATEGORY_STYLE）
- 字型：**GenSenRounded 2 TW（源泉圓體）Bold**，SIL OFL 授權可隨 App 內嵌（打包 OTF 進 app）；數字/英文同字型
- 券卡＝票券造型：分類色 header（品牌圓標+贈送/交換膠囊）+ 虛線裁切線 + 內容
- 按鈕＝漸層膠囊+glow；徽章＝發光 3D 圓形獎章（已解鎖彩色/未解鎖灰+鎖）
- **不用 emoji，一律 SVG 圖示**（react-native-svg）；風格克制、不堆砌
- 沒有吉祥物（曾有後已移除，不要加回）

## 6. 原生加分項（過審的 minimum functionality 證據）

必做：推播（新申請/被選中/新訊息/交換進度）、相機拍條碼上架、通知 deep link。
建議做：亮碼頁自動最高亮度、Face ID 保護「出示條碼」、分享券連結的 share sheet、觸覺回饋。
不做（focus）：IAP、任何金流、地圖、AI 功能。

## 7. App Store 合規（送審前逐條打勾）

- [ ] **4.8**：有 Google 登入 → **必須有 Sign in with Apple**，且按鈕不得低於 Google（放最上面）
- [ ] **1.2 UGC**：檢舉（已有 API）＋**封鎖**（3.2 新增）＋內容規範連結（/terms 5.2）＋客服信箱 iamlazybear2023@gmail.com
- [ ] **5.1.1(v)**：App 內刪除帳號（設定頁，紅字，雙重確認）
- [ ] 隱私營養標籤：Email、名稱、頭像、使用者內容（券/訊息/評價）、IP（防濫用）— 對照 /privacy 頁填
- [ ] 加密出口合規：只用 HTTPS → `ITSAppUsesNonExemptEncryption = false`
- [ ] 年齡分級 4+；截圖 6.7"/6.5"（送審用 Demo 帳號：提供一組測試帳密給審查員，並在備註說明申請制流程）
- [ ] 條碼頁加「請勿轉傳截圖」提示（審查員會看 UGC 安全性）

## 8. 里程碑與驗收（依序交付，每個都能單獨驗）

- **M0 後端批**：3.2 全部 + 驗收清單過 → 出 API 煙霧測試腳本
- **M1 骨架+登入**：Expo 專案、tab 導覽、三種登入（Apple/Google/Email）拿到 token、/auth/me 顯示個人卡
- **M2 瀏覽+申請**：feed（分類/搜尋/排序）、券詳情、申請 modal、善意門檻與每日額度的完整 UI 行為（SHARE_FIRST/429 的引導）
- **M3 上架+錢包**：拍照上架流程（草稿→條碼→發布）、錢包六分頁、編輯、下架、撤回申請
- **M4 交易+推播**：交易頁全流程（贈送亮碼/交換 escrow/聊天/完成/互評/爭議）、推播收發與 deep link
- **M5 合規+潤飾**：封鎖、刪帳號、申訴、排行榜、貢獻頁、設定；第 7 節全勾
- **M6 TestFlight**：EAS build 上 TestFlight，附完整測試腳本（兩支手機互相贈送+交換走完一輪）

每個里程碑回報格式：完成項清單（附截圖）、驗收逐條打勾附證據、已知問題、下一步。
**禁止**：改動後端既有行為、引入未列出的重依賴、跳過合規項先做美化。

## 9. 已知地雷（省你踩坑時間）

- 伺服器在新加坡、無 CDN：API 一律經 react-query 快取＋樂觀更新；圖片開快取。條碼圖是 `no-store`，**不要**快取條碼。
- 後端部署會重啟 1-2 分鐘：App 要能優雅重試（已有 429/timeout 的錯誤碼約定）。
- 頭像 URL 是 `/api/v1/users/:id/avatar?v=hash`（immutable 快取）；Google 頭像是外部 URL，兩種都會出現。
- 券的 `claim_request_count` 顯示「N 人申請」；`my_request_status`（PENDING/APPROVED）與 `my_request_id`（撤回用）只在登入時出現。
- 帳號被停權：所有寫入端點回 `USER_SUSPENDED` → 全 App 顯示申訴引導，不要讓使用者卡在錯誤畫面。
