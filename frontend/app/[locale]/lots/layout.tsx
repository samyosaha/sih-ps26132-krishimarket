import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Lots",
  description:
    "Discover fresh agricultural produce listed by verified farmers across India. Filter by commodity, state, district, and quality grade.",
};

export default function LotsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
