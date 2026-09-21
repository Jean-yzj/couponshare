import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "社群獎勵",
  robots: { index: false, follow: false },
};

export default function SocialRewardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
