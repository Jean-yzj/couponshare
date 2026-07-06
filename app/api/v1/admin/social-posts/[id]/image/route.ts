import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin";

// Serves one submission's evidence screenshot on demand, so the review LIST stays
// lightweight (the data-URIs are ~700KB each). Admin-only.
export const GET = route(async (_req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: { evidenceImage: true },
  });
  if (!post?.evidenceImage) throw new ApiError("NOT_FOUND");

  // Stored as a data-URI: data:image/<type>;base64,<data>
  const comma = post.evidenceImage.indexOf(",");
  const head = comma >= 0 ? post.evidenceImage.slice(0, comma) : "";
  const mime = /^data:(image\/[\w.+-]+);base64$/.exec(head)?.[1];
  if (!mime || comma < 0) throw new ApiError("NOT_FOUND");
  const bytes = Buffer.from(post.evidenceImage.slice(comma + 1), "base64");

  return new NextResponse(bytes, {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=300" },
  });
});
