import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Create a free KrishiMarket account. Register as a farmer to sell your harvest or as a buyer to source quality produce.",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
