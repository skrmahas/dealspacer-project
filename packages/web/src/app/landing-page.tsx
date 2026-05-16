"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  Globe,
  Languages,
  LineChart,
  MessageSquareQuote,
  Scale,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { AppSiteHeader } from "@/components/app-site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CompanyWithReportCount = {
  reportCount?: number;
};

type Stats = {
  companies: number;
  reports: number;
};

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
} as const;

const stagger = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ companies: 0, reports: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const companiesRes = await fetch("/api/companies");
        const companiesData = await companiesRes.json();

        if (cancelled) return;

        const companies = Array.isArray(companiesData)
          ? (companiesData as CompanyWithReportCount[])
          : [];

        setStats({
          companies: companies.length,
          reports: companies.reduce(
            (sum, company) => sum + (company.reportCount ?? 0),
            0,
          ),
        });
      } catch {
        if (!cancelled) {
          setStats({ companies: 0, reports: 0 });
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className={cn(
        "landing-page min-h-screen",
        "bg-[#080b10] text-[#e8ecf2]",
        "font-[family-name:var(--font-body)]",
      )}
    >
      <div className="landing-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden />
      <div className="landing-aurora pointer-events-none fixed inset-0 z-0" aria-hidden />

      <div className="relative z-10">
        <SiteHeader />
        <main>
          <Hero />
          <StatsBar companies={stats.companies} reports={stats.reports} />
          <HowItWorks />
          <FeaturesGrid />
          <ExchangesSection />
          <CtaFooter />
        </main>
        <SiteFooter />
      </div>
    </motion.div>
  );
}

function SiteHeader() {
  return <AppSiteHeader maxWidthClass="max-w-[1180px]" />;
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <HeroChartDecor />

      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          animate: {
            transition: { staggerChildren: 0.1, delayChildren: 0.05 },
          },
        }}
        className="relative mx-auto grid w-full max-w-[1180px] gap-12 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-end md:gap-8 md:px-10 md:pb-28 md:pt-24"
      >
        <motion.div variants={stagger} className="max-w-xl">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[#5a8f8f]">
            Tallinn · Riga · Vilnius
          </p>

          <h1
            className={cn(
              "mt-5 text-balance",
              "font-[family-name:var(--font-display)] text-[clamp(2.6rem,6vw,4.25rem)] font-medium leading-[1.02] tracking-[-0.02em] text-[#f4f6f9]",
            )}
          >
            Baltic Earnings Intelligence
          </h1>

          <motion.p
            variants={stagger}
            className="mt-6 max-w-md text-pretty text-base leading-relaxed text-[#8b9aad] md:text-lg"
          >
            AI-powered analysis of Baltic listed companies. Upload filings,
            extract key metrics, and compare performance across three exchanges
            in minutes.
          </motion.p>

          <motion.div
            variants={stagger}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Button
              asChild
              size="lg"
              className="h-12 rounded-none border-0 bg-[#2b79db] px-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#3d8de8]"
            >
              <Link href="/companies">
                Browse the Catalog
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-none border-[#3d4d62] bg-transparent px-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[#c5d0de] hover:border-[#5a8f8f]/50 hover:bg-[#5a8f8f]/8"
            >
              <Link href="/upload">Upload a Report</Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          variants={stagger}
          className="relative hidden md:block"
        >
          <HeroPreviewCard />
        </motion.div>
      </motion.div>
    </section>
  );
}

function HeroChartDecor() {
  return (
    <svg
      className="pointer-events-none absolute right-[-8%] top-[12%] h-[min(52vh,420px)] w-[min(70vw,640px)] opacity-[0.14]"
      viewBox="0 0 640 420"
      fill="none"
      aria-hidden
    >
      <path
        d="M0 340 C80 300 120 180 200 220 S360 120 440 160 S560 80 640 40"
        stroke="#2b79db"
        strokeWidth="1.5"
      />
      <path
        d="M0 380 C100 350 160 260 260 290 S400 200 520 230 S600 180 640 120"
        stroke="#5a8f8f"
        strokeWidth="1"
        strokeDasharray="6 8"
      />
    </svg>
  );
}

function HeroPreviewCard() {
  const rows = [
    { label: "Revenue", value: "€142.3M", delta: "+8.2%" },
    { label: "EBITDA", value: "€28.1M", delta: "+3.1%" },
    { label: "Net income", value: "€19.4M", delta: "−1.4%" },
  ];

  return (
    <div className="relative border border-[#2a3544] bg-[#0c1018]/90 p-6 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)]">
      <span className="absolute -left-px -top-px block size-3 border-l-2 border-t-2 border-[#2b79db]" />
      <span className="absolute -right-px -top-px block size-3 border-r-2 border-t-2 border-[#2b79db]" />
      <span className="absolute -bottom-px -left-px block size-3 border-b-2 border-l-2 border-[#5a8f8f]" />
      <span className="absolute -bottom-px -right-px block size-3 border-b-2 border-r-2 border-[#5a8f8f]" />

      <div className="flex items-center justify-between border-b border-[#2a3544] pb-4">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#5a8f8f]">
          Extracted snapshot
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#6b7d92]">
          FY2024 · Q3
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row, i) => (
          <motion.li
            key={row.label}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.08, duration: 0.5 }}
            className="flex items-baseline justify-between gap-4 border-b border-[#1e2733]/80 py-2 last:border-0"
          >
            <span className="text-sm text-[#8b9aad]">{row.label}</span>
            <span className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[#e8ecf2]">
                {row.value}
              </span>
              <span
                className={cn(
                  "font-[family-name:var(--font-mono)] text-[11px] tabular-nums",
                  row.delta.startsWith("−")
                    ? "text-[#c97a6a]"
                    : "text-[#6db88a]",
                )}
              >
                {row.delta}
              </span>
            </span>
          </motion.li>
        ))}
      </ul>

      <div className="mt-5 flex h-16 items-end gap-1.5">
        {[42, 58, 48, 72, 65, 80, 74].map((h, i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.55 + i * 0.04, duration: 0.4 }}
            style={{ height: `${h}%` }}
            className="block w-full max-w-[28px] origin-bottom bg-gradient-to-t from-[#5a8f8f]/30 to-[#2b79db]/70"
          />
        ))}
      </div>
    </div>
  );
}

function StatsBar({
  companies,
  reports,
}: {
  companies: number;
  reports: number;
}) {
  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 md:px-10"
    >
      <motion.div
        className="grid grid-cols-2 gap-px border border-[#2a3544] bg-[#2a3544] lg:grid-cols-4"
      >
        <StatTile
          icon={Building2}
          value={companies}
          label="Companies tracked"
        />
        <StatTile icon={LineChart} value={reports} label="Reports processed" />
        <StatTile icon={Globe} value={3} label="Exchanges" />
        <StatTile icon={Languages} value={4} label="Languages supported" />
      </motion.div>
    </motion.section>
  );
}

function HowItWorks() {
  const steps: {
    icon: LucideIcon;
    title: string;
    text: string;
  }[] = [
    {
      icon: Upload,
      title: "Upload",
      text: "Drop in an earnings filing — annual, quarterly, or semi-annual.",
    },
    {
      icon: BrainCircuit,
      title: "AI extracts",
      text: "Our pipeline pulls metrics, narratives, sentiment, and charts.",
    },
    {
      icon: BarChart3,
      title: "Browse & compare",
      text: "Review reports and stack two side-by-side with weighted deltas.",
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-[1180px] px-4 py-14 sm:px-6 md:px-10 md:py-28"
    >
      <div className="grid gap-12 lg:grid-cols-[0.42fr_1fr] lg:gap-16">
        <SectionHeading
          eyebrow="Workflow"
          title="How it works"
          description="From raw filing to comparable insight in three deliberate steps."
          className="lg:sticky lg:top-28 lg:self-start"
        />

        <ol className="relative space-y-0">
          <div
            className="pointer-events-none absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-[#2b79db]/50 via-[#5a8f8f]/30 to-transparent"
            aria-hidden
          />
          {steps.map((step, i) => (
            <Step key={step.title} index={i + 1} {...step} />
          ))}
        </ol>
      </div>
    </motion.section>
  );
}

function FeaturesGrid() {
  const features: {
    icon: LucideIcon;
    title: string;
    description: string;
    wide?: boolean;
  }[] = [
    {
      icon: Languages,
      title: "Multi-language reports",
      description:
        "Generate output in EN, ET, LV, and LT with consistent metric labeling across languages.",
      wide: true,
    },
    {
      icon: Scale,
      title: "Side-by-side comparison",
      description:
        "Stack two reports and surface deltas, sentiment context, and trend signals.",
    },
    {
      icon: LineChart,
      title: "AI metric extraction & charts",
      description:
        "Pull core earnings metrics into clean, investor-ready visualisations.",
    },
    {
      icon: MessageSquareQuote,
      title: "Sentiment analysis",
      description:
        "Track management tone, outlook, and guidance direction at a glance.",
      wide: true,
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="border-t border-[#1e2733] bg-[#0a0e14]"
    >
      <motion.div className="mx-auto w-full max-w-[1180px] px-4 py-14 sm:px-6 md:px-10 md:py-28">
        <SectionHeading
          eyebrow="Capabilities"
          title="Features"
          description="Everything you need to read Baltic earnings — built on the same pipeline that powers the catalog."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} index={i} {...feature} />
          ))}
        </div>
      </motion.div>
    </motion.section>
  );
}

function ExchangesSection() {
  const exchanges = [
    {
      city: "Tallinn",
      country: "Estonia",
      code: "TAL",
      accent: "#4a7ab8",
    },
    {
      city: "Riga",
      country: "Latvia",
      code: "RIG",
      accent: "#9e4a5a",
    },
    {
      city: "Vilnius",
      country: "Lithuania",
      code: "VIL",
      accent: "#8a9e4a",
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-[1180px] px-4 py-14 sm:px-6 md:px-10 md:py-28"
    >
      <SectionHeading
        eyebrow="Coverage"
        title="Exchanges"
        description="Three Baltic exchanges, four languages, one normalised view."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {exchanges.map((exchange, i) => (
          <motion.div
            key={exchange.city}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="group relative overflow-hidden border border-[#2a3544] bg-[#0c1018] p-6 transition hover:border-[#3d4d62]"
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-0.5 opacity-80"
              style={{ background: exchange.accent }}
            />
            <div className="flex items-start justify-between">
              <span
                className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#f4f6f9]"
              >
                {exchange.city}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#6b7d92]">
                {exchange.code}
              </span>
            </div>
            <p className="mt-3 text-sm text-[#8b9aad]">
              Nasdaq {exchange.city} · {exchange.country}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#6b7d92]">
          Languages
        </span>
        <span className="inline-flex items-center gap-2 border border-[#2a3544] bg-[#0f141c] px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[#9aa8bc]">
          <Languages className="size-3.5 text-[#5a8f8f]" />
          EN / ET / LV / LT
        </span>
      </div>
    </motion.section>
  );
}

function CtaFooter() {
  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-[1180px] px-4 pb-14 sm:px-6 md:px-10 md:pb-28"
    >
      <div className="relative overflow-hidden border border-[#2b79db]/25 bg-gradient-to-br from-[#141a24] via-[#0f141c] to-[#0a0e14] px-8 py-12 md:px-12 md:py-14">
        <motion.div
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[#2b79db]/12 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-lg">
            <h3 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[#f4f6f9] md:text-4xl">
              Ready to start?
            </h3>
            <p className="mt-3 text-[#8b9aad]">
              Upload your next filing or jump into the catalog and explore
              what&apos;s already there.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="h-11 rounded-none border-0 bg-[#2b79db] px-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[#ffffff] hover:bg-[#3d8de8]"
            >
              <Link href="/upload">
                Upload a Report
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-none border-[#3d4d62] bg-transparent px-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[#c5d0de] hover:border-[#5a8f8f]/50 hover:bg-[#5a8f8f]/8"
            >
              <Link href="/companies">Browse the Catalog</Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[#1e2733] py-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 text-sm text-[#6b7d92] sm:px-6 md:px-10">
        <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]">
          <Building2 className="size-3.5 text-[#2b79db]" />
          © Baltic Earnings Intelligence
        </span>
        <motion.div className="flex gap-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]">
          <Link href="/privacy" className="transition hover:text-[#e8ecf2]">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-[#e8ecf2]">
            Terms
          </Link>
          <Link href="/access" className="transition hover:text-[#e8ecf2]">
            Access
          </Link>
        </motion.div>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-md flex-col gap-4", className)}>
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[#5a8f8f]">
        {eyebrow}
      </span>
      <h2 className="font-[family-name:var(--font-display)] text-balance text-3xl font-medium tracking-tight text-[#f4f6f9] sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-pretty text-base leading-relaxed text-[#8b9aad]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 bg-[#0c1018] p-6"
      aria-label={`${value} ${label}`}
    >
      <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7d92]">
        <Icon className="size-3.5 text-[#2b79db]" />
        {label}
      </span>
      <motion.div className="font-[family-name:var(--font-display)] text-4xl font-medium tabular-nums tracking-tight text-[#f4f6f9] md:text-5xl">
        <AnimatedNumber value={value} />
      </motion.div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString(),
  );
  const [text, setText] = useState("0");

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  useEffect(() => {
    return display.on("change", (latest) => setText(latest));
  }, [display]);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent.toLowerCase().includes("jsdom")
    ) {
      setText(value.toLocaleString());
    }
  }, [value]);

  return <span ref={ref}>{text}</span>;
}

function Step({
  icon: Icon,
  title,
  text,
  index,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  index: number;
}) {
  return (
    <li className="relative grid grid-cols-[40px_1fr] gap-6 py-8 first:pt-0 last:pb-0">
      <div className="relative z-10 flex size-10 items-center justify-center border border-[#2a3544] bg-[#0c1018]">
        <Icon className="size-4 text-[#2b79db]" strokeWidth={1.5} />
      </div>
      <div>
        <motion.div className="flex items-baseline gap-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-[#5a8f8f]">
            {String(index).padStart(2, "0")}
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-xl font-medium text-[#f4f6f9]">
            {title}
          </h3>
        </motion.div>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#8b9aad]">
          {text}
        </p>
      </div>
    </li>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  wide,
  index,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  wide?: boolean;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      className={cn(
        "group relative border border-[#2a3544] bg-[#0c1018] p-6 transition hover:border-[#2b79db]/30",
        wide && "md:col-span-2",
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center border border-[#2a3544] bg-[#080b10] text-[#2b79db] transition group-hover:border-[#2b79db]/40">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-xl font-medium text-[#f4f6f9]">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#8b9aad]">
            {description}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
