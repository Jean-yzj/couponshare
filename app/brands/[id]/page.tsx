import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Client from "./Client";

// Server shell: unknown brand id → real 404 (not a soft-404 app shell).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.brand.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  return <Client />;
}
