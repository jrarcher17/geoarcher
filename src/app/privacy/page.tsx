import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — GEO Archer",
  description: "Privacy Policy for GEO Archer.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p className="text-sm text-slate-500">Last updated: August 5, 2026</p>

      <h2>Overview</h2>
      <p>
        GEO Archer (“we,” “us”) respects your privacy. This policy describes what we collect,
        how we use it, and your choices when you use our website and application.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email, and authentication credentials when you
          register.
        </li>
        <li>
          <strong>Scan data:</strong> URLs you submit, crawl results, scores, recommendations,
          and related metadata needed to provide reports.
        </li>
        <li>
          <strong>Usage data:</strong> logs, device/browser type, IP address, and product
          interactions for security and improvement.
        </li>
        <li>
          <strong>Payment data:</strong> processed by our payment provider (e.g. Stripe); we
          do not store full card numbers on our servers.
        </li>
      </ul>

      <h2>How we use information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide crawls, scoring, dashboards, and billing;</li>
        <li>Enforce plan limits and prevent abuse;</li>
        <li>Communicate about your account or the Service;</li>
        <li>Improve reliability and develop new features;</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2>AI and third-party processing</h2>
      <p>
        Analysis may use third-party AI providers to generate scores and text recommendations
        from crawled page content. We send only what is necessary to perform the scan. Your
        use of those features is subject to those providers’ policies as applicable.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We share data with service providers (hosting,
        database, email, payments, analytics) under contracts that limit use to providing
        services to us. We may disclose information if required by law or to protect rights and
        safety.
      </p>

      <h2>Retention</h2>
      <p>
        We retain account and scan data while your account is active and as needed for legal,
        security, and backup purposes. You may request deletion of your account through
        Settings; some aggregated or backup copies may persist for a limited period.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures to protect data in transit and at rest. No method of
        transmission over the Internet is completely secure.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or export
        personal data, or to object to certain processing. Contact us through your account
        settings or support channels to exercise these rights.
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies and similar technologies for authentication and session
        management. You can control non-essential cookies through your browser where applicable.
      </p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The “Last updated” date will change when we do. Material
        changes may be communicated via the Service or email.
      </p>

      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPageShell>
  );
}
