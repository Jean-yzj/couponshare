import { NextResponse } from "next/server";

// iOS Universal Links verification. The Team ID is not a secret; it is part of
// Apple's public application identifier and must match the signed app.
const APP_ID = "4LZB57RVVZ.com.lazybearlife.couponshare";

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appID: APP_ID,
            // Keep this list limited to public URLs that have a matching app
            // route. Private/account pages should remain web-only.
            paths: ["/coupons/*", "/brand-coupons/*", "/today", "/login*"],
          },
        ],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json",
      },
    },
  );
}
