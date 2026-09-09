import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Offers",
  description:
    "Track and manage your offers to farmers on KrishiMarket.",
};

export default function BuyerOffersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
