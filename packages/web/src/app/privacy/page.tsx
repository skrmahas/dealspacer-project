import Link from "next/link";
import { Building2, Shield } from "lucide-react";
import { AppSiteHeader } from "@/components/app-site-header";

const sections = [
  {
    n: "01",
    title: "Overview",
    body: (
      <>
        <p>
          Baltic Earnings Intelligence (operated by DealSpacer) is currently in
          private preview. This policy describes how we handle information you
          provide when requesting access or using the service.
        </p>
      </>
    ),
  },
  {
    n: "02",
    title: "Data we collect",
    body: (
      <>
        <p>
          We collect the work email address you submit when requesting access.
          This is used solely to evaluate your request and manage onboarding
          communication.
        </p>
        <p className="mt-3">
          When you upload a filing, the document is transmitted to our
          processing pipeline for analysis. We do not retain raw uploaded files
          beyond the period required to generate your report.
        </p>
      </>
    ),
  },
  {
    n: "03",
    title: "How we use your data",
    body: (
      <>
        <p>
          Submitted emails are used to manage access requests and product
          communications. They are not sold or shared with third parties for
          marketing purposes.
        </p>
        <p className="mt-3">
          Uploaded filings are processed to generate structured reports for the
          requesting user only. They are not used to train public or
          third-party machine-learning models.
        </p>
      </>
    ),
  },
  {
    n: "04",
    title: "Data retention & deletion",
    body: (
      <>
        <p>
          Access to operational data is limited to what is necessary to provide
          and support the service. You may request deletion of your email or
          associated data at any time by contacting us.
        </p>
      </>
    ),
  },
  {
    n: "05",
    title: "Contact",
    body: (
      <>
        <p>
          For privacy questions, data requests, or deletion inquiries, reach us
          at{" "}
          <a
            href="mailto:hello@dealspacer.com"
            className="text-[#2b79db] transition hover:text-[#3d8de8]"
          >
            hello@dealspacer.com
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div
      className="relative min-h-screen bg-[#080b10] text-[#e8ecf2] font-[family-name:var(--font-body)]"
    >
      <div className="landing-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden />
      <div className="landing-aurora pointer-events-none fixed inset-0 z-0" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col">
        <AppSiteHeader
          maxWidthClass="max-w-[1180px]"
          trailing={
            <span className="hidden items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#5a8f8f] sm:flex">
              <Shield className="size-3.5" />
              Privacy
            </span>
          }
        />

        <main className="mx-auto w-full max-w-[820px] flex-1 px-4 py-12 sm:px-6 md:px-10 md:py-24">
          {/* Document meta strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#6b7d92]">
            <span>Baltic Earnings Intelligence</span>
            <span className="text-[#2a3544]">·</span>
            <span>Classification: Public</span>
            <span className="text-[#2a3544]">·</span>
            <span>Version 1.0</span>
          </div>

          {/* Title block */}
          <div className="relative mt-6 border-l-2 border-[#2b79db] pl-6">
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.02em] text-[#f4f6f9]">
              Privacy Policy
            </h1>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-[#8b9aad]">
              How Baltic Earnings Intelligence handles your data, why we collect
              it, and how you can request its deletion.
            </p>
          </div>

          {/* Divider */}
          <div className="mt-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-[#2b79db]/40 via-[#2a3544] to-transparent" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#3d4d62]">
              Document
            </span>
          </div>

          {/* Sections */}
          <div className="mt-10 space-y-0">
            {sections.map((section, i) => (
              <div
                key={section.n}
                className="group relative grid grid-cols-[40px_1fr] gap-4 border-b border-[#1e2733] py-6 last:border-b-0 sm:grid-cols-[56px_1fr] sm:gap-6 sm:py-8"
              >
                {/* Vertical connector */}
                {i < sections.length - 1 && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-[27px] top-8 w-px bg-gradient-to-b from-[#2a3544] to-transparent"
                    aria-hidden
                  />
                )}

                {/* Number */}
                <div className="relative z-10 pt-0.5">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[#5a8f8f]">
                    {section.n}
                  </span>
                </div>

                {/* Content */}
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-medium text-[#f4f6f9]">
                    {section.title}
                  </h2>
                  <div className="mt-3 text-[15px] leading-relaxed text-[#8b9aad]">
                    {section.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Document footer note */}
          <div className="mt-12 flex items-start gap-3 border border-[#2a3544] bg-[#0c1018]/60 p-5">
            <span className="mt-0.5 block size-1.5 shrink-0 rounded-full bg-[#5a8f8f]" />
            <p className="font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[#6b7d92]">
              This policy applies to the Baltic Earnings Intelligence service in
              private preview. It may be updated as the product evolves. Material
              changes will be communicated to registered users by email.
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1e2733] py-10">
          <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 text-sm text-[#6b7d92] sm:px-6 md:px-10">
            <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]">
              <Building2 className="size-3.5 text-[#2b79db]" />
              © Baltic Earnings Intelligence
            </span>
            <nav className="flex gap-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]">
              <Link href="/privacy" className="text-[#e8ecf2]">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-[#e8ecf2]">
                Terms
              </Link>
              <Link href="/access" className="transition hover:text-[#e8ecf2]">
                Access
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
