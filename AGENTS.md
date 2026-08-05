<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 多 agent 協作守則（Claude × Codex 共用）

這個 repo 常態上同時有多個 AI agent 與使用者本人操作。歷史事故：未 commit 的半成品被別的 session 帶上線（7/7）、用一週前的舊 worktree 部署讓正式站倒退 50 個 commit（7/16）、schema 沒 migrate 就部署造成 API 500（7/16）。以下規則就是為了堵這些洞，缺一條都出過事。

## 1. 部署 = push main，沒有別的路

正式站是 Zeabur git-connected：**push 到 main 即自動部署**。禁止 `zeabur deploy` 直傳（會與 git-connected 互相取消、蓋掉線上版本）。

push main 前三步：

1. `git fetch origin && git log origin/main..HEAD --oneline`——列出的每個 commit 都必須是你認識、且驗證過的；有陌生 commit 就停下來查
2. `prisma/schema.prisma` 有變更 → 先做第 3 條的 migration，再 push
3. 打備份端點確認不是 409（每天 02:00 台北有自動備份跑約 20 分鐘，部署會殺掉跑一半的備份）

push 後驗證：`zeabur deployment list --service-id=6a429abb22d1fdaf7eb0eca3 --env-id=6a4296f6e33d94ef307b2286 --interactive=false --json` 等狀態轉 RUNNING（建置約 4-6 分鐘），再 curl 首頁與你改動的路由。build 失敗不會換掉線上版本，但你必須回報而不是假設成功。

## 2. commit 紀律：commit 就是交接文件

- 只 `git add` 明列的自己的檔案。禁止 `add -A`、`add .`——共用樹隨時有別人的半成品
- 動手前先 `git status --short`＋`git log -5`：session 開場的快照會過期，別信它
- 完成一個可驗證的單位就 commit，message 寫「做了什麼＋怎麼驗證的」——這就是給下一個 agent 的交接
- 沒做完的東西不留在共用主樹過夜：開自己的 worktree＋branch

## 3. schema 變更順序：先庫後碼

順序反了＝新程式打到缺欄位／缺表的庫、API 直接 500（7/16 實際發生：`brands.status` 沒先套用，品牌查詢與備份一起掛）。所以一律先把正式庫改好、驗過，再 push main 部署。

**禁止用容器內的 `prisma db push` 當作這一步**（2026-07-29 實測）：`zeabur service exec ... -- npx prisma db push` 跑的是「目前部署那個 commit」的容器，裡面的 `prisma/schema.prisma` 還沒有你新加的 model／欄位，所以對新增的表與欄位**等於什麼都沒做——而且它會安靜地回報成功**。執行者以為先庫後碼做完了、接著 push main，製造出來的正是這一節要防的 7/16 事故。

正式庫沒有對外 port（`.env` 裡的對外端點早已失效），所有操作都得經由容器。以下流程 2026-07-29 用它成功建出 `client_events` 表。動手前先確認沒有別人的部署在 BUILDING（第 5 條）。

**0.** 改 `prisma/schema.prisma`、commit（先 commit 才有東西可對照），先別 push main。

**1. 本機產出精確 DDL**

```bash
DEPLOYED=$(zeabur deployment list --service-id=6a429abb22d1fdaf7eb0eca3 --env-id=6a4296f6e33d94ef307b2286 --interactive=false --json </dev/null | jq -r '.[] | select(.status=="RUNNING") | .commitSHA')
git show "$DEPLOYED:prisma/schema.prisma" > /tmp/schema-old.prisma   # 說找不到 commit 就先 git fetch origin
npx prisma migrate diff --from-schema-datamodel /tmp/schema-old.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/migration.sql
```

逐行讀 `/tmp/migration.sql`：**只有 CREATE 才算安全**；出現 DROP／ALTER 代表可能掉資料或鎖表，停下來問使用者。確認後把 DDL 改成 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，重跑才安全。

**2. 確認正式庫沒有漂移**（庫若與已部署 schema 不一致，DDL 套下去結果不可預測）

```bash
zeabur service exec --id=6a429abb22d1fdaf7eb0eca3 --env-id=6a4296f6e33d94ef307b2286 --interactive=false -- sh -c 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script' </dev/null
```

回 `-- This is an empty migration.` ＝ 一致，可以往下走。回出任何 SQL ＝ 有人手動改過庫、或有沒套用的變更，先查清楚再動手。

**3. 套用 DDL**（base64 送進容器，避開 CLI 的引號地獄）

```bash
B64=$(base64 < /tmp/migration.sql | tr -d '\n')
zeabur service exec --id=6a429abb22d1fdaf7eb0eca3 --env-id=6a4296f6e33d94ef307b2286 --interactive=false -- sh -c "echo $B64 | base64 -d > /tmp/migration.sql && npx prisma db execute --url \"\$DATABASE_URL\" --file /tmp/migration.sql" </dev/null
```

成功會印 `Script executed successfully.`。

**4. 驗證表真的在，才 push main**：同一招送一句存在性查詢進去，表不存在會直接報錯（`db execute` 不印結果，成功訊息就是證據）。

```bash
B64=$(printf 'SELECT 1 FROM "<新表名>" LIMIT 1;\n' | base64 | tr -d '\n')
zeabur service exec --id=6a429abb22d1fdaf7eb0eca3 --env-id=6a4296f6e33d94ef307b2286 --interactive=false -- sh -c "echo $B64 | base64 -d > /tmp/check.sql && npx prisma db execute --url \"\$DATABASE_URL\" --file /tmp/check.sql" </dev/null
```

套用後、部署前重跑第 2 步會看到「反向的 DROP」——容器的 schema 還是舊的、庫多了新表，這是正常現象不是漂移；等部署完成後再跑一次，才會回 empty migration。

注意：這些指令會把含密碼的 `$DATABASE_URL` 印在輸出裡，原始輸出不要貼進 PR／issue／HANDOFF。

## 4. worktree 衛生

- 平行開發用 `git worktree add`＋自己的 branch，併回後立刻 `git worktree remove`
- **禁止用非當天建立的 worktree 做 push 或部署**——7/16 的線上退版就是這樣來的
- 看到 `.claude/worktrees/` 有殘留：`git status` 乾淨就刪；髒的先問使用者

## 5. 高風險動作單一執行者

DB migration、資料刪除、env 變更、網域、部署：同一時間只允許一個 agent 做。動手前查 deployment list 最近 15 分鐘有無別人的部署在 BUILDING，有就等它完成。拿不準誰在做 → 問使用者，不要搶。

## 6. session 收尾自檢（交接檢查點）

- [ ] 完成的工作都 commit 且 push 了？（沒 push ＝ 其他環境看不到）
- [ ] 主樹上留下的未 commit 檔案，下一個 agent 看得懂是誰的、為什麼在嗎？
- [ ] 有跨 session 未完事項 → 寫 `docs/HANDOFF-YYYY-MM-DD.md`：現況／已驗證／未完／下一步，一頁以內
- [ ] 動過 infra（env、schema、部署方式、cron、secrets）→ 必寫進 HANDOFF 或 commit message——這類變更下一個 agent 猜不到，是最大的漏洞來源

## 7. iOS app 同步（使用者裁定 2026-07-19：平台改版後 iOS 必須跟上）

iOS app 在獨立 repo `/Users/jean/couponshare-ios`（GitHub 私有 Jean-yzj/couponshare-ios，已設 origin）。

- 動了 API 合約（`lib/validation.ts` schema、`lib/serialize.ts` 欄位、枚舉值、使用者可見的路由行為）→ **同一個工作階段內同步 iOS**：型別（`lib/api.tsx`）、表單、顯示。驗證底線：`npx tsc --noEmit` 全過；UI 變更盡量模擬器實看
- 新增使用者可見功能 → 評估 iOS 對應面；當下做不完就把差距寫進 couponshare-ios/AGENTS.md 的「已知差距」清單——不許默默留洞
- iOS 改完必 commit＋push；commit message 註明對應的 web commit 方便對照
- 第 6 條收尾自檢多問一句：動過 API/schema，iOS 同步了或記帳了嗎？
