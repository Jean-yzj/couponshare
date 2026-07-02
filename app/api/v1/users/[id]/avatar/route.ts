import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export const runtime = "nodejs";

// Streams a user's uploaded avatar (stored as a data URI) as a real image with
// aggressive caching. The URL carries a content-derived `v` param (see avatarRef),
// so it can be cached as immutable — a new upload produces a new URL. Avatars are
// public by design (they render on public profiles and feed cards).
export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { avatarUrl: true, status: true },
  });
  if (!user || user.status === "DELETED" || !user.avatarUrl) throw new ApiError("NOT_FOUND");

  // External avatar (e.g. Google photo) — just point the browser there.
  if (!user.avatarUrl.startsWith("data:")) {
    return NextResponse.redirect(user.avatarUrl, 302);
  }

  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(user.avatarUrl);
  if (!m) throw new ApiError("NOT_FOUND");

  return new NextResponse(new Uint8Array(Buffer.from(m[2], "base64")), {
    status: 200,
    headers: {
      "Content-Type": m[1],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
