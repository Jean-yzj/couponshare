import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Client from "./Client";

// Server shell: a bad coupon id must return a real 404 (not a soft-404 app shell),
// otherwise search engines index every junk URL. Existence only — visibility/auth
// is handled client-side (owners can view their own drafts, etc.).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  return <Client />;
}
