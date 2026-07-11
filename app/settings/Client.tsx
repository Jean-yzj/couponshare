"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiErr, useMe } from "@/lib/client";
import { Avatar, Banner, Button, Card, Field, Input, NeedLogin, PageHeader, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";

// Read a picked file, crop it to a centered square and downscale to 128px, then
// re-encode as JPEG. Re-encoding through a canvas also strips any embedded nasties.
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { me, loading, refetch } = useMe();
  const [displayName, setDisplayName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me) setDisplayName(me.display_name);
  }, [me]);

  if (loading)
    return (
      <div className="mx-auto max-w-lg">
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  if (!me) return <NeedLogin message="登入後即可編輯個人資料。" />;

  const shown = preview ?? me.avatar_url;
  const name = displayName.trim();
  const nameChanged = name.length > 0 && name !== me.display_name;
  const canSave = nameChanged || !!preview;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("請選擇圖片檔（PNG / JPG / WebP）");
      return;
    }
    try {
      setPreview(await fileToAvatar(file));
    } catch {
      setError("無法讀取這張圖片，請換一張");
    }
  }

  async function saveProfile() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      if (nameChanged) {
        await apiFetch("/api/v1/me/profile", {
          method: "PATCH",
          body: JSON.stringify({ display_name: name }),
        });
      }
      if (preview) {
        await apiFetch("/api/v1/me/avatar", { method: "POST", body: JSON.stringify({ image: preview }) });
      }
      await refetch();
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiErr ? err.message : "儲存失敗，請稍後再試");
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/me/avatar", { method: "POST", body: JSON.stringify({ image: null }) });
      await refetch();
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiErr ? err.message : "移除失敗，請稍後再試");
      setBusy(false);
    }
  }

  async function deleteAccount() {
    const input = window.prompt("刪除後無法復原。若確定要刪除帳號，請輸入「刪除帳號」。");
    if (input !== "刪除帳號") return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiFetch("/api/v1/me", { method: "DELETE" });
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof ApiErr ? err.message : "刪除失敗，請稍後再試");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader eyebrow="Settings" title="個人設定" subtitle="更新你的暱稱與頭像。" />

      <Card className="mt-5 p-6">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar name={me.display_name} url={shown} size={112} className="ring-4 ring-canvas" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="上傳新頭像"
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-grad-brand text-white shadow-glow ring-4 ring-paper transition-transform active:scale-95"
            >
              <Icon name="plus" size={18} strokeWidth={2.4} />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPick}
            className="hidden"
          />
          <p className="mt-4 text-sm text-ink-soft">點右下角的 + 選一張照片，會自動裁成方形。</p>

          <div className="mt-6 w-full">
            <Field label="暱稱" hint="最多 40 個字，會顯示在票券、排行榜與交易訊息中。">
              <Input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError(null);
                }}
                maxLength={40}
                placeholder="輸入你的暱稱"
              />
            </Field>
          </div>

          {error && (
            <div className="mt-4 w-full">
              <Banner tone="warn" icon="info">
                {error}
              </Banner>
            </div>
          )}
          <div className="mt-5 flex w-full flex-col gap-2">
            <Button full size="lg" icon="check" loading={busy} disabled={!canSave} onClick={saveProfile}>
              {canSave ? "儲存個人資料" : "尚未變更"}
            </Button>
            {me.avatar_url && !preview && (
              <Button full variant="ghost" loading={busy} onClick={removeAvatar}>
                移除頭像，改用預設
              </Button>
            )}
            {preview && (
              <Button full variant="ghost" disabled={busy} onClick={() => setPreview(null)}>
                取消
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-4 border-danger/20 p-5">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-danger">刪除帳號</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              刪除後會清除 Email、密碼與頭像，正在分享的票券會下架；既有交易紀錄仍會保留給交易雙方查詢。
            </p>
          </div>
          {deleteError && <Banner tone="warn" icon="info">{deleteError}</Banner>}
          <Button full variant="danger" loading={deleteBusy} onClick={deleteAccount}>
            永久刪除帳號
          </Button>
        </div>
      </Card>
    </div>
  );
}
