import { Shield, FileText, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how KrishiMarket collects, uses, and protects your personal data.",
};

export default function PrivacyPolicyPage() {
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Privacy Policy
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
          <h2 className="text-lg font-semibold">1. Introduction</h2>
          <p>
            KrishiMarket (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
            operates the KrishiMarket platform, a farmer-buyer marketplace that
            connects agricultural producers directly with buyers. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your
            information when you use our platform.
          </p>
          <p>
            By accessing or using KrishiMarket, you agree to this Privacy
            Policy. If you do not agree, please do not use the platform.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            2. Information We Collect
          </h2>

          <h3 className="text-base font-medium">
            2.1 Personal Information You Provide
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account Registration:</strong> Name, email address, phone
              number, password, and user role (farmer or buyer).
            </li>
            <li>
              <strong>Lot Listings:</strong> Commodity details, quantity,
              quality grade, asking price, location (state and district).
            </li>
            <li>
              <strong>Offers & Transactions:</strong> Offered prices, messages
              exchanged between parties, payment status, and dispute details.
            </li>
          </ul>

          <h3 className="text-base font-medium">
            2.2 Information Collected Automatically
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Usage Data:</strong> Pages visited, features used, search
              queries, timestamps, and session duration.
            </li>
            <li>
              <strong>Device Information:</strong> Browser type, operating
              system, IP address, and device identifiers.
            </li>
            <li>
              <strong>Cookies:</strong> We use essential cookies for
              authentication and session management. See our Cookie Policy below.
            </li>
          </ul>

          <h3 className="text-base font-medium">2.3 Third-Party Data</h3>
          <p>
            We retrieve publicly available agricultural commodity price data from
            the Government of India&apos;s Open Data Platform (data.gov.in) via
            the Agmarknet API. This data does not contain personal information.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            3. How We Use Your Information
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              To create and manage your account, authenticate sessions, and
              provide customer support.
            </li>
            <li>
              To facilitate listings, offers, negotiations, and transactions
              between farmers and buyers.
            </li>
            <li>
              To display real-time and historical market prices and
              AI-generated price forecasts.
            </li>
            <li>
              To send you transactional notifications (offer received, accepted,
              payment updates).
            </li>
            <li>
              To improve platform performance, fix bugs, and develop new
              features.
            </li>
            <li>
              To comply with legal obligations and enforce our Terms &
              Conditions.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">4. Data Sharing</h2>
          <p>
            We do <strong>not</strong> sell your personal information. We may
            share data in the following limited circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>With Other Users:</strong> Your name, role, and listing
              details are visible to other platform users to facilitate trade.
            </li>
            <li>
              <strong>Service Providers:</strong> We may share data with trusted
              vendors who assist with hosting, analytics, and payment processing,
              under strict confidentiality agreements.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose information if
              required by law, regulation, or court order.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">5. Data Security</h2>
          <p>
            We implement industry-standard security measures including encrypted
            connections (HTTPS), hashed passwords, and access controls. However,
            no method of transmission over the Internet is 100% secure, and we
            cannot guarantee absolute security.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">6. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is
            active or as needed to provide services. Transaction records are
            retained for a minimum of 3 years for compliance purposes. You may
            request account deletion by contacting us.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">7. Your Rights</h2>
          <p>
            Under applicable Indian data protection laws (including the Digital
            Personal Data Protection Act, 2023), you have the right to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request erasure of your data (subject to legal obligations).</li>
            <li>Withdraw consent for data processing.</li>
            <li>Lodge a grievance with the Data Protection Board of India.</li>
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">8. Children&apos;s Privacy</h2>
          <p>
            KrishiMarket is not directed at individuals under the age of 18. We
            do not knowingly collect personal information from minors.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated &quot;Last updated&quot; date. Continued
            use of the platform after changes constitutes acceptance of the
            revised policy.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">10. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or wish to exercise
            your data rights, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> privacy@krishimarket.in
            <br />
            <strong>Address:</strong> KrishiMarket Team, India
          </p>
        </section>
      </div>

      {/* Footer link */}
      <div className="border-t pt-6 text-center">
        <Link
          href="/terms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Read our Terms & Conditions
        </Link>
      </div>
    </div>
  );
}
