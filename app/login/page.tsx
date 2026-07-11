import type { Metadata } from "next";
import Client from "./Client";

// The login page itself is crawlable but not a search landing page — noindex it.
export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <Client />;
}
