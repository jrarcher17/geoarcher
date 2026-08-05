import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service — GEO Archer",
  description: "Terms of Service for GEO Archer.",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <p className="text-sm text-slate-500">Last updated: August 5, 2026</p>

      <h2>Agreement</h2>
      <p>
        By accessing or using GEO Archer (“Service”), you agree to these Terms of Service. If
        you do not agree, do not use the Service.
      </p>

      <h2>Service description</h2>
      <p>
        GEO Archer provides website crawling, AI-oriented scoring, visibility modeling,
        recommendations, and related tools to help you improve how AI assistants may understand
        and cite your content. Scores and simulations are informational and do not guarantee
        placement in any third-party AI product.
      </p>

      <h2>Accounts</h2>
      <p>
        You must provide accurate registration information and keep credentials secure. You are
        responsible for activity under your account. We may suspend or terminate accounts that
        violate these terms or abuse the Service.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Crawl or analyze sites you do not have permission to evaluate;</li>
        <li>Reverse engineer, overload, or interfere with the Service;</li>
        <li>Use the Service for unlawful purposes or to violate others’ rights;</li>
        <li>Resell or redistribute the Service without written permission.</li>
      </ul>

      <h2>Plans, billing, and limits</h2>
      <p>
        Free and paid plans include usage limits (sites, scans per month, crawl depth, etc.)
        described at purchase or in the product. Paid subscriptions renew according to the
        billing provider until canceled. Fees are non-refundable except where required by law.
      </p>

      <h2>Your content and scans</h2>
      <p>
        You retain ownership of your websites and data. You grant us a limited license to
        process URLs you submit, run crawls and analysis, and store results to operate the
        Service. We may use aggregated, de-identified usage data to improve the product.
      </p>

      <h2>Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT
        UNINTERRUPTED OPERATION, ERROR-FREE CRAWLS, OR SPECIFIC BUSINESS OUTCOMES FROM GEO
        SCORES OR RECOMMENDATIONS.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, GEO ARCHER AND ITS SUPPLIERS WILL NOT BE
        LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
        LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be posted on this page with an
        updated date. Continued use after changes constitutes acceptance.
      </p>

      <p>
        See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPageShell>
  );
}
