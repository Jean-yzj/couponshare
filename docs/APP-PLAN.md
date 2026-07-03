# CouponShare 做成 App 的路線規劃

撰於 2026-07-03。前提盤點與三階段路線；每階段都可以獨立停下來，不做白工。

## 現況盤點：你手上有什麼、缺什麼

**最大資產：後端 API 已經是完整的 REST API**（`/api/v1/*` 約 40 個端點，票券、申請、交易聊天、評價、檢舉、通知、管理全都有）。做 App 時後端幾乎不用重寫，只需補少數 App 專用的端點。UI 也已經是行動優先設計（底部導覽、手機版面），視覺可直接沿用。

**缺的東西（依階段補）**：
- PWA 基礎（manifest / service worker / 圖示）— 目前完全沒有
- 推播通知 — 目前使用者看不到「有人傳訊息」，要自己開網站才知道
- Token 式登入（現在是 cookie session，App 內建瀏覽器外不適用）
- Sign in with Apple（App Store 硬性要求：有 Google 登入就必須也有 Apple 登入）
- 使用者封鎖功能（App Store UGC 硬性要求，聊天功能一定會被查）
- App 內刪除帳號（App Store 硬性要求 5.1.1(v)；現在只有「來信刪除」）

## 建議路線：三階段，先驗證再投資

原則：**用最便宜的方式先拿到「像 App 的體驗」+ 推播，等有使用量訊號再投入原生開發。**

### Stage 0 — PWA（工時 ~1-2 天，費用 0，不用審查）

做完後：使用者可「加入主畫面」，全螢幕開啟、有自己的圖示，**且可以收到推播**（Android 全支援；iPhone 需 iOS 16.4+ 且從主畫面開啟）。

工作清單：
1. `manifest.json`＋全套圖示（512/192/apple-touch-icon，用品牌藍＋票券 logo）
2. Service worker：**只做離線殼與圖示快取，HTML/API 一律走網路**（我們部署頻繁，快取策略保守才不會舊版卡死——這點吃過虧）
3. iOS meta（`apple-mobile-web-app-capable` 等）
4. Web Push：後端加 push 訂閱表＋在 `notify()` 同時發推播；前端加「開啟通知」引導
5. 站內加「安裝 App」引導卡（偵測未安裝時顯示，iOS 給「分享→加入主畫面」圖解）

效益：解決「不知道有新訊息」這個最痛的問題；體驗上已經「是個 App」。

### Stage 1 — 上架 Google Play（工時 ~2-3 天，費用 US$25 一次性）

Android 官方允許 TWA（Trusted Web Activity）：把 PWA 原封包成 Play 商店 App，**不算灌水 App，審查過得了**。用 Bubblewrap 打包＋Digital Asset Links 驗證網域即可。

做完後：Android 使用者從 Play 商店搜得到、裝得到，推播走同一套 Web Push。

### Stage 2 — iOS 原生 App（工時 ~4-8 週，費用 US$99/年，等訊號再做）

**為什麼 iOS 不能便宜解**：Apple 拒收純 WebView 包殼（Guideline 4.2 minimum functionality），你的星之占卜/InternX 經驗也知道審查會刁。要過審就要有原生價值。

建議做法：**Expo（React Native）重寫 UI、完全重用既有 API**。
- UI 是 React → 元件邏輯、設計 token（顏色/圓角/字型感）可平移，AI 輔助重寫成本可控
- 原生賣點順便做：**相機掃條碼直接上架票券**（比網頁拍照上傳順）、原生推播、生物辨識快速開條碼

後端要補的（都不大）：
1. Bearer token 登入端點（登入回 token，App 帶 `Authorization` header；與 cookie 並存不影響網頁）
2. Sign in with Apple 端點（網頁版也一起加，一魚兩吃）
3. 原生 Google 登入的 id_token 交換端點
4. 推播 token 註冊表＋`notify()` 發 APNs/FCM
5. **封鎖使用者**（block model＋聊天/申請過濾）— 審查必查
6. **App 內刪除帳號**端點＋設定頁入口 — 審查必查

App Store 審查清單（從 InternX 送審經驗直接抄）：
- [ ] 4.8：有 Google 登入 → 必須有 Sign in with Apple
- [ ] 1.2 UGC：檢舉 ✓（已有）＋封鎖（要補）＋審核機制說明（已有 admin）
- [ ] 5.1.1(v)：App 內刪帳號（要補）
- [ ] 隱私營養標籤：對照隱私權政策填（蒐集 email/名稱/頭像/IP/使用紀錄）
- [ ] 螢幕截圖 6.7"/6.5"/5.5"＋預覽文案

### 什麼時候啟動 Stage 2（建議門檻）

PWA 上線後看數據，符合任一才投入：
- 週活躍使用者穩定 > 200，或
- 推播開啟率 > 40%（代表大家真的想被通知），或
- 有品牌合作需求需要 App 存在感

沒到門檻就停在 Stage 0/1——PWA + Play 商店已覆蓋 90% 的「App 體驗」，投報比最高。

## 費用與時程總表

| 階段 | 工時 | 費用 | 產出 |
|---|---|---|---|
| Stage 0 PWA＋推播 | 1-2 天 | $0 | 可安裝、有推播的 Web App |
| Stage 1 Google Play | 2-3 天 | $25 一次 | Play 商店上架 |
| Stage 2 iOS（Expo） | 4-8 週 | $99/年 | 雙平台原生 App |

## 相關既有資源

- Apple 開發者帳號：已有（星之占卜上架用）
- App Store 送審經驗與地雷：見 InternX 上架筆記（4.8/UGC 缺口同款）
- 伺服器：App 流量走同一套 API；若屆時使用者多，先做 CDN/搬機再上 App（App 使用者對慢更不耐）
