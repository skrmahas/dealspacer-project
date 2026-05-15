"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  CandlestickChart,
  CircleDot,
  DatabaseZap,
  FileUp,
  Globe2,
  Languages,
  LineChart,
  MessageSquareQuote,
  Radar,
  Scale,
  SearchCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Stats = {
  companies: number;
  reports: number;
};

const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.22 },
  transition: { duration: 0.58, ease: "easeOut" },
} as const;

const exchanges = [
  { city: "Tallinn", country: "Estonia", code: "TAL", accent: "bg-[#32f5c8]" },
  { city: "Riga", country: "Latvia", code: "RIG", accent: "bg-[#ff4d6d]" },
  { city: "Vilnius", country: "Lithuania", code: "VIL", accent: "bg-[#ffd166]" },
];

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ companies: 0, reports: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const [companiesRes, reportsRes] = await Promise.all([
          fetch("/api/companies"),
          fetch("/api/reports"),
        ]);

        const companiesData = await companiesRes.json();
        const reportsData = await reportsRes.json();

        if (cancelled) return;

        setStats({
          companies: Array.isArray(companiesData) ? companiesData.length : 0,
          reports: Array.isArray(reportsData) ? reportsData.length : 0,
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
    <div className="min-h-screen overflow-hidden bg-[color:var(--bei-ink)] font-[family-name:var(--font-ui)] text-[color:var(--bei-cream)]">
      <Atmosphere />
      <SiteHeader />

      <main className="relative z-10">
        <Hero companies={stats.companies} reports={stats.reports} />
        <StatsBar companies={stats.companies} reports={stats.reports} />
        <HowItWorks />
        <FeaturesGrid />
        <ExchangesSection />
        <CtaFooter />
      </main>

      <SiteFooter />
    </div>
  );
}

function Atmosphere() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(130deg,var(--bei-ink)_0%,#101b1f_48%,#16110d_100%)]" />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.34]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(235,217,171,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(235,217,171,0.08) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 86%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, transparent 86%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          background:
            "linear-gradient(90deg, transparent 0 49%, rgba(50,245,200,0.18) 49% 50%, transparent 50% 100%), radial-gradient(72% 44% at 74% 4%, rgba(255,209,102,0.16), transparent 60%), radial-gradient(50% 42% at 7% 20%, rgba(255,77,109,0.12), transparent 55%)",
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_bottom,transparent_0,rgba(255,255,255,0.025)_1px,transparent_2px)] bg-[length:100%_7px] opacity-35" />
    </>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--bei-line)] bg-[rgba(11,18,21,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative flex size-8 items-center justify-center border border-[color:var(--bei-line-strong)] bg-[color:var(--bei-panel)] text-[color:var(--bei-cyan)] shadow-[0_0_24px_rgba(50,245,200,0.14)]">
            <Building2 className="size-4" />
            <span className="absolute -right-1 -top-1 size-2 bg-[color:var(--bei-amber)]" />
          </span>
          <span className="font-[family-name:var(--font-display)] text-lg tracking-[0.03em] text-[color:var(--bei-cream)]">
            DealSpacer
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--bei-muted)]">
          <Link
            href="/companies"
            className="px-3 py-2 transition hover:text-[color:var(--bei-cyan)]"
          >
            Catalog
          </Link>
          <Link
            href="/upload"
            className="px-3 py-2 transition hover:text-[color:var(--bei-amber)]"
          >
            Upload
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ companies, reports }: Stats) {
  return (
    <section className="relative min-h-[calc(100vh-65px)] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <Badge
              variant="outline"
              className="border-[color:var(--bei-line-strong)] bg-[rgba(235,217,171,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--bei-cream)]"
            >
              <CircleDot className="mr-2 size-3 text-[color:var(--bei-cyan)]" />
              Live catalog of ~40 Baltic listed companies
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: "easeOut", delay: 0.06 }}
            className="mt-7 max-w-[10ch] font-[family-name:var(--font-display)] text-[clamp(3.4rem,8vw,8.6rem)] font-black uppercase leading-[0.78] tracking-normal text-[color:var(--bei-cream)]"
          >
            Baltic Earnings Intelligence
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: "easeOut", delay: 0.14 }}
            className="mt-7 max-w-2xl text-lg leading-8 text-[color:var(--bei-muted)] sm:text-xl"
          >
            AI-powered analysis of Baltic listed companies across Tallinn, Riga,
            and Vilnius. Upload filings, extract key metrics, and compare
            performance in minutes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, ease: "easeOut", delay: 0.22 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Button
              asChild
              size="lg"
              className="rounded-md bg-[color:var(--bei-cyan)] text-[#061012] shadow-[6px_6px_0_var(--bei-red)] hover:bg-[color:var(--bei-cyan)] hover:brightness-95"
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
              className="rounded-md border-[color:var(--bei-line-strong)] bg-[rgba(235,217,171,0.05)] text-[color:var(--bei-cream)] hover:bg-[rgba(235,217,171,0.12)]"
            >
              <Link href="/upload">Upload a Report</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.16 }}
          className="relative min-h-[520px]"
          aria-hidden="true"
        >
          <MarketConsole companies={companies} reports={reports} />
        </motion.div>
      </div>
    </section>
  );
}

function MarketConsole({ companies, reports }: Stats) {
  return (
    <div className="absolute inset-0">
      <div className="absolute right-0 top-4 h-[86%] w-[82%] border border-[color:var(--bei-line-strong)] bg-[rgba(8,14,16,0.82)] shadow-[22px_22px_0_rgba(0,0,0,0.28)]" />
      <div className="absolute left-2 top-12 w-[78%] border border-[color:var(--bei-line)] bg-[color:var(--bei-panel)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:left-8">
        <div className="flex items-center justify-between border-b border-[color:var(--bei-line)] pb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--bei-muted)]">
          <span>Nasdaq Baltic feed</span>
          <span className="text-[color:var(--bei-cyan)]">normalised</span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 font-[family-name:var(--font-mono)] text-sm">
          {[
            ["TAL1T", "+4.8%", "text-[color:var(--bei-cyan)]"],
            ["LHV1T", "+1.3%", "text-[color:var(--bei-cyan)]"],
            ["OLF1R", "-0.7%", "text-[color:var(--bei-red)]"],
            ["IGN1L", "+2.1%", "text-[color:var(--bei-cyan)]"],
          ].map(([ticker, value, tone]) => (
            <React.Fragment key={ticker}>
              <span className="border-b border-dashed border-[color:var(--bei-line)] pb-2 text-[color:var(--bei-cream)]">
                {ticker}
              </span>
              <span className={cn("border-b border-dashed border-[color:var(--bei-line)] pb-2", tone)}>
                {value}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 right-3 w-[72%] border border-[color:var(--bei-line)] bg-[#141f1e] p-5 sm:right-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--bei-muted)]">
              extraction pillars
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-black uppercase leading-none text-[color:var(--bei-cream)]">
              Revenue / FCF / Guidance
            </p>
          </div>
          <Radar className="size-10 shrink-0 text-[color:var(--bei-amber)]" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          {[72, 48, 88, 36, 64, 94, 54, 76, 42].map((height, index) => (
            <span
              key={index}
              className="block bg-[color:var(--bei-cyan)]/80"
              style={{ height }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 grid w-[56%] grid-cols-2 border border-[color:var(--bei-line-strong)] bg-[color:var(--bei-cream)] text-[#061012]">
        <MiniStat value={companies} label="Companies" />
        <MiniStat value={reports} label="Reports" />
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-r border-[#061012]/20 p-4 last:border-r-0">
      <div className="font-[family-name:var(--font-display)] text-4xl font-black leading-none">
        {value}
      </div>
      <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]">
        {label}
      </div>
    </div>
  );
}

function StatsBar({ companies, reports }: Stats) {
  return (
    <motion.section {...reveal} className="px-5 pb-10 sm:px-8">
      <div className="mx-auto grid w-full max-w-7xl border border-[color:var(--bei-line)] bg-[rgba(8,14,16,0.66)] sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Building2} value={companies} label="Companies tracked" />
        <StatTile icon={LineChart} value={reports} label="Reports processed" />
        <StatTile icon={Globe2} value={3} label="Exchanges" />
        <StatTile icon={Languages} value={4} label="Languages supported" />
      </div>
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
      icon: FileUp,
      title: "Upload",
      text: "Drop in an annual, quarterly, or semi-annual earnings filing.",
    },
    {
      icon: BrainCircuit,
      title: "AI extracts",
      text: "The pipeline reads metrics, narratives, sentiment, and chart data.",
    },
    {
      icon: SearchCheck,
      title: "Browse & compare",
      text: "Find reports by company, then stack two side-by-side with weighted deltas.",
    },
  ];

  return (
    <motion.section {...reveal} className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <SectionHeading
        eyebrow="Workflow"
        title="How it works"
        description="From raw Baltic filing to comparable intelligence without a spreadsheet hunt."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <ProcessPanel key={step.title} index={index + 1} {...step} />
        ))}
      </div>
    </motion.section>
  );
}

function FeaturesGrid() {
  const features: {
    icon: LucideIcon;
    title: string;
    description: string;
  }[] = [
    {
      icon: Languages,
      title: "Multi-language reports",
      description:
        "Generate output in EN, ET, LV, and LT with metric labels kept consistent across filings.",
    },
    {
      icon: Scale,
      title: "Side-by-side comparison",
      description:
        "Put two reports under the same lens and expose deltas, sentiment, and direction.",
    },
    {
      icon: DatabaseZap,
      title: "AI metric extraction & charts",
      description:
        "Transform long reports into structured metrics, profitability trends, and chart-ready data.",
    },
    {
      icon: MessageSquareQuote,
      title: "Sentiment analysis",
      description:
        "Track management tone, outlook, risk factors, and whether guidance is being raised or lowered.",
    },
  ];

  return (
    <motion.section {...reveal} className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <SectionHeading
        eyebrow="Capabilities"
        title="Features"
        description="Built for the odd shape of Baltic market work: multilingual filings, thin coverage, and reports that refuse to be tidy."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <FeaturePanel key={feature.title} {...feature} />
        ))}
      </div>
    </motion.section>
  );
}

function ExchangesSection() {
  return (
    <motion.section {...reveal} className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <SectionHeading
        eyebrow="Coverage"
        title="Exchanges"
        description="Three Baltic exchanges, four languages, one normalized view."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {exchanges.map((exchange) => (
          <div
            key={exchange.city}
            className="group border border-[color:var(--bei-line)] bg-[rgba(235,217,171,0.05)] p-5 transition duration-300 hover:-translate-y-1 hover:border-[color:var(--bei-line-strong)] hover:bg-[rgba(235,217,171,0.09)]"
          >
            <div className="flex items-start justify-between">
              <span className={cn("h-16 w-2", exchange.accent)} />
              <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--bei-muted)]">
                {exchange.code}
              </span>
            </div>
            <h3 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-black uppercase leading-none text-[color:var(--bei-cream)]">
              {exchange.city}
            </h3>
            <p className="mt-3 text-sm text-[color:var(--bei-muted)]">
              Nasdaq {exchange.city} · {exchange.country}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bei-muted)]">
        <span>Languages</span>
        <Badge
          variant="secondary"
          className="rounded-md bg-[rgba(50,245,200,0.12)] text-[color:var(--bei-cyan)]"
        >
          <Languages className="mr-1 size-3.5" />
          EN / ET / LV / LT
        </Badge>
      </div>
    </motion.section>
  );
}

function CtaFooter() {
  return (
    <motion.section {...reveal} className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="relative overflow-hidden border border-[color:var(--bei-line-strong)] bg-[color:var(--bei-cream)] p-6 text-[#061012] sm:p-8 lg:p-10">
        <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,var(--bei-cyan),var(--bei-amber),var(--bei-red))]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.18em] opacity-70">
              Next filing, less friction
            </p>
            <h3 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-5xl font-black uppercase leading-[0.9] sm:text-6xl">
              Ready to start?
            </h3>
            <p className="mt-5 max-w-xl text-base leading-7 opacity-75">
              Upload your next filing or jump into the catalog and explore
              what&apos;s already there.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="rounded-md bg-[#061012] text-[color:var(--bei-cream)] hover:bg-[#061012]/90"
            >
              <Link href="/upload">
                Upload a Report
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-md border-[#061012]/25 bg-transparent text-[#061012] hover:bg-[#061012]/10"
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
    <footer className="relative z-10 border-t border-[color:var(--bei-line)] py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 text-sm text-[color:var(--bei-muted)] sm:px-8">
        <span className="flex items-center gap-2">
          <CandlestickChart className="size-4 text-[color:var(--bei-cyan)]" />
          © Baltic Earnings Intelligence
        </span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-[color:var(--bei-cream)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[color:var(--bei-cream)]">
            Terms
          </Link>
          <Link href="/access" className="hover:text-[color:var(--bei-cream)]">
            Access
          </Link>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="grid gap-4 border-l-4 border-[color:var(--bei-red)] pl-5">
      <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--bei-amber)]">
        {eyebrow}
      </span>
      <h2 className="font-[family-name:var(--font-display)] text-4xl font-black uppercase leading-none text-[color:var(--bei-cream)] sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-base leading-7 text-[color:var(--bei-muted)]">
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
      className="border-b border-[color:var(--bei-line)] p-5 last:border-b-0 sm:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
      aria-label={`${value} ${label}`}
    >
      <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--bei-muted)]">
        <Icon className="size-4 text-[color:var(--bei-amber)]" />
        {label}
      </span>
      <div className="mt-3 font-[family-name:var(--font-display)] text-5xl font-black leading-none text-[color:var(--bei-cream)] tabular-nums">
        <AnimatedNumber value={value} />
      </div>
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

function ProcessPanel({
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
    <div className="relative min-h-64 border border-[color:var(--bei-line)] bg-[rgba(8,14,16,0.68)] p-5">
      <span className="absolute right-5 top-5 font-[family-name:var(--font-display)] text-7xl font-black leading-none text-[rgba(235,217,171,0.08)]">
        {String(index).padStart(2, "0")}
      </span>
      <div className="flex size-12 items-center justify-center border border-[color:var(--bei-line-strong)] bg-[rgba(50,245,200,0.08)] text-[color:var(--bei-cyan)]">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <h3 className="mt-16 font-[family-name:var(--font-display)] text-3xl font-black uppercase leading-none text-[color:var(--bei-cream)]">
        {title}
      </h3>
      <p className="mt-4 text-sm leading-6 text-[color:var(--bei-muted)]">
        {text}
      </p>
    </div>
  );
}

function FeaturePanel({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="group grid min-h-52 grid-cols-[auto_1fr] gap-5 border border-[color:var(--bei-line)] bg-[rgba(235,217,171,0.045)] p-5 transition duration-300 hover:border-[color:var(--bei-cyan)] hover:bg-[rgba(50,245,200,0.07)]">
      <span className="flex size-11 items-center justify-center bg-[color:var(--bei-cream)] text-[#061012] transition group-hover:bg-[color:var(--bei-cyan)]">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-black uppercase leading-none text-[color:var(--bei-cream)]">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-6 text-[color:var(--bei-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}
