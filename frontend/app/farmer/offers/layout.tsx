import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offers Received",
  description:
    "Review and manage buyer offers on your produce lots on KrishiMarket.",
};

export default function FarmerOffersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
