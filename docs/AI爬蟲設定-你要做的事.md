# 讓 AI 讀得到你的站：Cloudflare 要改的一個設定

2026-09-06。你選了「全部放行」。這件我沒有 Cloudflare 憑證做不了，但只有一個開關。

---

## 現在的狀況

`https://couponshare.lazybearlife.com/robots.txt` 裡有一段 `# BEGIN Cloudflare Managed content`，
那不是你程式碼寫的，是 Cloudflare 自動插進去的。它現在對這些爬蟲回 `Disallow: /`：

| 爬蟲 | 是誰的 | 擋掉的後果 |
|---|---|---|
| `ClaudeBot` | Anthropic | Claude 完全讀不到你的站 |
| `GPTBot` | OpenAI（訓練） | 內容不會進 ChatGPT 的知識 |
| `Google-Extended` | Google | Gemini 與 AI 總覽無法引用你 |
| `CCBot` | Common Crawl | 幾乎所有開源模型的資料來源 |
| `Bytespider` | 抖音／TikTok | — |
| `Amazonbot`、`Applebot-Extended`、`meta-externalagent` | Amazon／Apple／Meta | — |

**沒有被擋的**：`OAI-SearchBot`（ChatGPT 的搜尋）、`ChatGPT-User`（使用者要它開網頁時）、
`PerplexityBot`。所以現在唯一還通的 AI 管道是 ChatGPT 搜尋和 Perplexity——
我實測搜「用不到的優惠券 送人 交換 平台」時，AI 摘要確實引用了你站上的內容
（連「新手每日 5 張」都講出來了），證明內容品質沒問題，是通道被關了一大半。

---

## 怎麼改（約 2 分鐘）

Cloudflare 主控台 → 選 `lazybearlife.com` → 左側 **AI Crawl Control**
（舊版介面可能叫 **Bots** → **AI Scrapers and Crawlers**）

把「封鎖 AI 爬蟲」關掉，或逐一把上表那些爬蟲改成 **Allow**。

> 注意：這個設定是**整個 lazybearlife.com 網域**層級的，會一併影響你掛在同一個
> 網域下的其他專案。如果你只想開 CouponShare，要用 **Configuration Rule** 針對
> `couponshare.lazybearlife.com` 這個 hostname 單獨設定。

改完等幾分鐘，重新抓一次 robots.txt 確認 `# BEGIN Cloudflare Managed content`
那一段不見了或改成 Allow，然後跟我說一聲，我會驗證。

---

## 這個取捨你已經決定了，但還是留個紀錄

**放行的代價**：內容可能被拿去訓練模型。

**放行的好處**：AI 助理正在成為人們找服務的入口。「有沒有那種可以把用不到的
優惠券送人的平台？」這種問題，如果 Claude 和 Gemini 讀不到你的站，答案裡就
不會有 CouponShare。

你的東西是公開的券資訊和平台說明，不是原創作品——被訓練的損失趨近於零，
而被推薦的價值直接對應到你「不推廣就沒人用」的問題。

---

## 順帶一提：robots.txt 現在有兩組衝突的規則

Cloudflare 那段結尾是 `User-agent: *` + `Allow: /`，接著你程式碼產生的又是一組
`User-agent: *` 加上 `/admin`、`/wallet`、`/settings` 等 Disallow。

同一個 user-agent 出現兩組，Google 的規範是「合併處理」所以沒事，但不是每一支
爬蟲都這樣做——有些只認第一組，那樣後台路徑就等於沒有被擋。

關掉 Cloudflare 的封鎖之後這段會一起消失，問題自然解決。**所以先做上面那步，
做完我再回頭確認 robots.txt 只剩一組規則。**
