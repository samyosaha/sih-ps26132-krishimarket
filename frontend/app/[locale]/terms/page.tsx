import { FileText, Shield, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Read the terms and conditions governing your use of the KrishiMarket platform.",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-emerald-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Terms &amp; Conditions
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: September 8, 2026
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm prose-gray max-w-none space-y-6 text-muted-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground">
        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using KrishiMarket (&quot;the Platform&quot;), you
            agree to be bound by these Terms &amp; Conditions. If you do not
            agree, you must discontinue use immediately. These terms apply to all
            visitors, registered users, and anyone who accesses the Platform.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">2. Eligibility</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              You must be at least <strong>18 years of age</strong> to register
              and use the Platform.
            </li>
            <li>
              You must provide accurate and complete registration information and
              keep it up to date.
            </li>
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activities that occur under your
              account.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">3. Platform Description</h2>
          <p>
            KrishiMarket is a digital marketplace that connects agricultural
            producers (&quot;Farmers&quot;) directly with purchasers
            (&quot;Buyers&quot;). The Platform facilitates:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Listing and discovery of agricultural produce lots with quality
              grades.
            </li>
            <li>
              Direct offer and negotiation between Farmers and Buyers.
            </li>
            <li>Transaction tracking and payment status updates.</li>
            <li>
              Real-time and historical market price data and AI-assisted price
              forecasts.
            </li>
          </ul>
          <p>
            KrishiMarket acts solely as an intermediary platform and is{" "}
            <strong>not a party</strong> to any transaction between Farmers and
            Buyers.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">4. User Obligations</h2>

          <h3 className="text-base font-medium">4.1 General Conduct</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              You shall not use the Platform for any unlawful, fraudulent, or
              harmful purpose.
            </li>
            <li>
              You shall not post false, misleading, or deceptive information
              about your produce or offers.
            </li>
            <li>
              You shall not attempt to gain unauthorized access to other
              accounts, the Platform&apos;s infrastructure, or data.
            </li>
          </ul>

          <h3 className="text-base font-medium">4.2 Farmers</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Listings must accurately describe the commodity, quantity, quality
              grade, and asking price.
            </li>
            <li>
              Once an offer is accepted, the Farmer is expected to honour the
              agreed terms and deliver the produce.
            </li>
          </ul>

          <h3 className="text-base font-medium">4.3 Buyers</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Offers must be made in good faith with intent to complete the
              purchase.
            </li>
            <li>
              Once an offer is accepted by a Farmer, the Buyer is expected to
              fulfil payment obligations.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">5. Listings &amp; Transactions</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              All lot listings and offers are visible to registered users of the
              Platform.
            </li>
            <li>
              KrishiMarket does not guarantee the quality, safety, or legality of
              listed produce.
            </li>
            <li>
              Payments and delivery are the sole responsibility of the transacting
              parties. KrishiMarket does not process payments on behalf of users.
            </li>
            <li>
              The Platform records transaction status for transparency, but does
              not act as an escrow or payment processor.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">6. Disputes</h2>
          <p>
            Users may raise disputes through the Platform&apos;s dispute
            mechanism. KrishiMarket may assist in mediation but is{" "}
            <strong>not obligated</strong> to resolve disputes between users.
            Users are encouraged to settle disputes amicably or seek
            appropriate legal remedies.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">7. Price Data &amp; Forecasts</h2>
          <p>
            Market price data is sourced from publicly available government
            datasets (data.gov.in via Agmarknet). AI-generated price forecasts
            are{" "}
            <strong>
              indicative only and do not constitute financial or trading advice
            </strong>
            . KrishiMarket is not liable for any decisions made based on the
            displayed price data or forecasts.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            8. Intellectual Property
          </h2>
          <p>
            All content, design, code, logos, and trademarks on KrishiMarket are
            the property of KrishiMarket or its licensors. You may not
            reproduce, distribute, or create derivative works from any part of
            the Platform without prior written consent.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            9. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, KrishiMarket shall not be
            liable for:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Any indirect, incidental, special, or consequential damages
              arising from your use of the Platform.
            </li>
            <li>
              Loss of profits, data, or revenue resulting from transactions
              between users.
            </li>
            <li>
              Interruptions, delays, or errors in the Platform&apos;s
              operation.
            </li>
            <li>
              Actions or omissions of other users, including fraudulent
              listings or failed deliveries.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at our
            discretion if you violate these Terms, engage in fraudulent
            activity, or abuse the Platform. You may also delete your account at
            any time by contacting us.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            11. Modifications to Terms
          </h2>
          <p>
            We may update these Terms &amp; Conditions from time to time.
            Changes will be posted on this page with an updated &quot;Last
            updated&quot; date. Continued use of the Platform after changes
            constitutes acceptance of the revised terms.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            12. Governing Law
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of India. Any disputes arising under these Terms shall be
            subject to the exclusive jurisdiction of the courts in India.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">13. Contact Us</h2>
          <p>
            If you have questions about these Terms &amp; Conditions, please
            contact us at:
          </p>
          <p>
            <strong>Email:</strong> support@krishimarket.in
            <br />
            <strong>Address:</strong> KrishiMarket Team, India
          </p>
        </section>
      </div>

      {/* Footer link */}
      <div className="border-t pt-6 text-center">
        <Link
          href="/privacy"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
        >
          <Shield className="h-3.5 w-3.5" />
          Read our Privacy Policy
        </Link>
      </div>
    </div>
  );
}
