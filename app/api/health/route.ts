import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2_000;

export async function GET() {
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("database health check timed out")), DB_TIMEOUT_MS);
      }),
    ]);

    return Response.json(
      { status: "ok", database: "reachable", response_ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
