import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { transactionView, publicUser } from "@/lib/serialize";
import { getUserTrust } from "@/lib/trust";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();

  const t = await prisma.transaction.findUnique({
    where: { id },
    include: {
      coupon: true,
      owner: true,
      claimant: true,
      ratings: true,
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) throw new ApiError("NOT_FOUND");
  if (t.ownerId !== user.id && t.claimantId !== user.id) throw new ApiError("FORBIDDEN");

  // Find the counterpart (the other party who is not the current viewer)
  const counterpartId = t.ownerId === user.id ? t.claimantId : t.ownerId;
  const counterpart_trust = counterpartId ? await getUserTrust(counterpartId) : null;

  return jsonOk({
    ...transactionView(t, user.id),
    counterpart_trust,
    ratings: t.ratings.map((r) => ({
      from_user_id: r.fromUserId,
      to_user_id: r.toUserId,
      rating_score: r.ratingScore,
      tags: r.tags,
      comment: r.comment,
      created_at: r.createdAt,
    })),
    messages: t.messages.map((m) => ({
      id: m.id,
      sender: publicUser(m.sender),
      message: m.message,
      image_url: m.imageUrl,
      created_at: m.createdAt,
    })),
  });
});
