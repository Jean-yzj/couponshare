import { z } from "zod";
import { prisma } from "@/lib/db";
import { route, readBody, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { sniffImageType } from "@/lib/image";
import { throttle } from "@/lib/throttle";

export const runtime = "nodejs";

const schema = z.object({ image: z.string().nullable() });

// Set or clear the current user's avatar. The client sends a small square data
// URI (resized/cropped to 128px). We re-validate by magic bytes (SVG rejected —
// it could carry inline script) and cap the size before storing it in avatar_url.
export const POST = route(async (req) => {
  throttle(req, "avatar", 12, 10 * 60_000);
  const user = await requireUser();
  const { image } = await readBody(req, schema);

  if (!image) {
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
    return jsonOk({ avatar_url: null });
  }

  const m = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) throw new ApiError("VALIDATION_ERROR", { message: "頭像格式不支援，請用 PNG 或 JPG 圖片" });
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > 80 * 1024) {
    throw new ApiError("VALIDATION_ERROR", { message: "頭像檔案太大，請換一張圖片" });
  }
  if (!sniffImageType(bytes)) {
    throw new ApiError("VALIDATION_ERROR", { message: "頭像必須是 PNG、JPG 或 WebP 圖片" });
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: image } });
  return jsonOk({ avatar_url: image });
});
