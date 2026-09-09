import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transactions",
  description:
    "Track all your deals, payments, and deliveries on KrishiMarket.",
};

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
