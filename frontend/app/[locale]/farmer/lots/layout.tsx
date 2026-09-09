import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Lots",
  description:
    "Manage your produce listings, create new lots, and track buyer offers on KrishiMarket.",
};

export default function FarmerLotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
