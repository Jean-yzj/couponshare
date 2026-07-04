import type { Prisma, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { transactionView } from "@/lib/serialize";
import { txnSelect } from "@/lib/selects";

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const role = url.searchParams.get("role") || "all";
  const status = url.searchParams.get("status");

  const where: Prisma.TransactionWhereInput = {};
  if (role === "owner") where.ownerId = user.id;
  else if (role === "claimant") where.claimantId = user.id;
  else where.OR = [{ ownerId: user.id }, { claimantId: user.id }];

  const VALID: TransactionStatus[] = ["CREATED", "COMPLETED", "DISPUTED", "CANCELLED"];
  if (status && VALID.includes(status as TransactionStatus)) {
    where.status = status as TransactionStatus;
  }

  const txns = await prisma.transaction.findMany({
    where,
    select: txnSelect,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk({ data: txns.map((t) => transactionView(t, user.id)) });
});
