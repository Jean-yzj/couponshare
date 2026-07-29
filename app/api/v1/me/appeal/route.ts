import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const user = await requireUser();
  const appeal = await prisma.appeal.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({
    suspended: user.status === "SUSPENDED",
    appeal: appeal
      ? {
          id: appeal.id,
          status: appeal.status,
          message: appeal.message,
          admin_note: appeal.adminNote,
          created_at: appeal.createdAt,
          resolved_at: appeal.resolvedAt,
        }
      : null,
  });
});

// 舊 App 版本的相容出口。正規路徑是 POST /api/v1/appeals（網頁版與新版 App 都打那裡）。
//
// iOS build 5（App Store 現行版）把申訴 POST 到這個路徑，而這裡當時只有 GET，
// Next.js 回 405；App 端又沒有渲染錯誤，被停權的使用者按下送出只會看到轉圈，
// 申訴永遠送不出去。已上架的版本無法追溯更新，所以在這裡補一個出口。
//
// 直接轉出 /appeals 的 handler，不複製邏輯——申訴規則（僅限停權帳號、一個帳號
// 只能申訴一次、駁回即終局）維持單一實作。
//
// 可移除時機：商店上不再有會打這個路徑的 App 版本之後。
export { POST } from "../../appeals/route";
