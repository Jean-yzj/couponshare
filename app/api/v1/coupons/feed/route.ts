import { route, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getCouponFeed } from "@/lib/feed";

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand")?.trim() || undefined;
  const type = url.searchParams.get("type");
  const category = url.searchParams.get("category");
  const redeemKind = url.searchParams.get("redeem_kind");
  const sort = url.searchParams.get("sort") || "latest";
  const withinHours = parseInt(url.searchParams.get("within_hours") || "", 10);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const viewer = await getCurrentUser();

  return jsonOk(
    await getCouponFeed({
      viewer,
      brand,
      type,
      category,
      redeemKind,
      sort,
      withinHours: Number.isFinite(withinHours) ? withinHours : 0,
      page,
      limit,
    }),
  );
});
