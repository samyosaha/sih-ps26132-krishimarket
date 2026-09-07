import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Price Discovery",
  description:
    "Check real-time mandi prices and AI-powered price forecasts for agricultural commodities across India.",
};

export default function PricesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
