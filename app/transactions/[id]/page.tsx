import type { Metadata } from "next";
import Client from "./Client";

// Private (login-gated exchange thread) — keep out of search indexes.
export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <Client />;
}
