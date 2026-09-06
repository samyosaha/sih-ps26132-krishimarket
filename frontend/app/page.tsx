import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sprout,
  ShoppingBasket,
  TrendingUp,
  Users,
  Handshake,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-20 py-8">
      <section className="grid gap-10 py-10 md:grid-cols-2 md:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            <Sprout className="h-3.5 w-3.5" />
            KrishiMarket
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Fair prices for every harvest.
            <span className="block text-emerald-700">
              Direct from farmers to buyers.
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            List your produce, make transparent offers, and track payments — all
            in one place. No middlemen, no hidden cuts.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/register">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/lots">Browse produce</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Verified users
            </div>
            <div className="flex items-center gap-1.5">
              <Handshake className="h-4 w-4 text-emerald-600" />
              Direct P2P offers
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Live price dashboard
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 -z-10 rounded-3xl bg-gradient-to-br from-emerald-100 via-amber-50 to-transparent blur-2xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-emerald-200/60">
              <CardHeader className="pb-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Sprout className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-lg">For Farmers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>🌾 List unlimited harvest lots with quality grade</p>
                <p>📩 Receive & compare multiple buyer offers</p>
                <p>✅ Accept / reject in one click with instant notifs</p>
                <p>💸 Track transaction & payment status end-to-end</p>
              </CardContent>
            </Card>
            <Card className="mt-6 border-amber-200/60 sm:mt-0">
              <CardHeader className="pb-2">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <ShoppingBasket className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-lg">For Buyers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>🔎 Browse lots by commodity, district, and grade</p>
                <p>💰 Send targeted offers directly to farmers</p>
                <p>📊 Compare prices with the market dashboard</p>
                <p>🧾 Confirm payments when produce is delivered</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Sprout,
            title: "List lots",
            desc: "Title, produce, quantity, price, harvest date, grade.",
            tint: "emerald",
          },
          {
            icon: ShoppingBasket,
            title: "Smart filters",
            desc: "Search by commodity, state, district, grade.",
            tint: "sky",
          },
          {
            icon: Users,
            title: "Direct offers",
            desc: "Buyers send offers, farmers decide, no middleman.",
            tint: "amber",
          },
          {
            icon: TrendingUp,
            title: "Price insights",
            desc: "Market dashboard keeps everyone informed.",
            tint: "violet",
          },
        ].map((f) => {
          const Icon = f.icon;
          const tintMap: Record<string, string> = {
            emerald: "bg-emerald-100 text-emerald-700",
            sky: "bg-sky-100 text-sky-700",
            amber: "bg-amber-100 text-amber-700",
            violet: "bg-violet-100 text-violet-700",
          };
          return (
            <Card key={f.title}>
              <CardHeader>
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tintMap[f.tint]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{f.desc}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-3xl border bg-gradient-to-br from-emerald-50 to-amber-50 p-10 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight">
          Ready to trade smarter?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Join KrishiMarket in 2 minutes. Register as a farmer to sell your
          harvest, or as a buyer to source quality produce.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Link href="/register">Create free account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/lots">Explore lots →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
