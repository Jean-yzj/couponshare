import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "品牌管理",
  robots: { index: false, follow: false },
};

export default function BrandLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
