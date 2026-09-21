import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "貢獻排行榜",
  robots: { index: false, follow: false },
};

export default function LeaderboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
