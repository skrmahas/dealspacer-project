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
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Stats = {
  companies: number;
  reports: number;
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: "easeOut" },
} as const;

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
    <div className="min-h-screen bg-background text-foreground">
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
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-background/80 backdrop-blur dark:border-white/10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="relative flex size-7 items-center justify-center rounded-lg border border-zinc-200 bg-gradient-to-br from-white to-zinc-100 shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950">
            <Building2 className="size-4 text-primary" />
          </span>
          <span>DealSpacer</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            href="/companies"
            className="rounded-lg px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Catalog
          </Link>
          <Link
            href="/upload"
            className="rounded-lg px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Upload
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-100/80 via-background to-background dark:from-zinc-900/40" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(59,130,246,0.16), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.18) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage:
            "linear-gradient(to bottom, black, transparent 75%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black, transparent 75%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Badge
            variant="outline"
            className="rounded-full border-zinc-200 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur dark:border-white/10"
          >
            <Sparkles className="mr-1.5 size-3.5 text-primary" />
            Live catalog of ~40 Baltic listed companies
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
          className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
        >
          Baltic Earnings Intelligence
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
          className="mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          AI-powered analysis of Baltic listed companies across Tallinn, Riga,
          and Vilnius. Upload filings, extract key metrics, and compare
          performance in minutes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg" className="rounded-2xl">
            <Link href="/companies">
              Browse the Catalog
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-2xl dark:border-white/10"
          >
            <Link href="/upload">Upload a Report</Link>
          </Button>
        </motion.div>
      </div>
    </section>
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
    <motion.section {...fadeUp} className="mx-auto w-full max-w-6xl px-6 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900/30 dark:to-zinc-900/10">
        <CardCorners />
        <div className="grid divide-y divide-zinc-200/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:grid-cols-4 dark:divide-white/10">
          <StatTile
            icon={Building2}
            value={companies}
            label="Companies tracked"
          />
          <StatTile icon={LineChart} value={reports} label="Reports processed" />
          <StatTile icon={Globe} value={3} label="Exchanges" />
          <StatTile icon={Languages} value={4} label="Languages supported" />
        </div>
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
      className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24"
    >
      <SectionHeading
        eyebrow="Workflow"
        title="How it works"
        description="From raw filing to comparable insight in three simple steps."
      />
      <div className="relative mt-10 grid gap-6 md:grid-cols-3">
        <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-white/10 md:block" />
        {steps.map((step, i) => (
          <Step key={step.title} index={i + 1} {...step} />
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
        "Generate output in EN, ET, LV, and LT with consistent metric labeling across languages.",
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
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24"
    >
      <SectionHeading
        eyebrow="Capabilities"
        title="Features"
        description="Everything you need to read Baltic earnings — built on the same pipeline that powers the catalog."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </motion.section>
  );
}

function ExchangesSection() {
  const exchanges = [
    {
      city: "Tallinn",
      country: "Estonia",
      code: "TAL",
    },
    {
      city: "Riga",
      country: "Latvia",
      code: "RIG",
    },
    {
      city: "Vilnius",
      country: "Lithuania",
      code: "VIL",
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24"
    >
      <SectionHeading
        eyebrow="Coverage"
        title="Exchanges"
        description="Three Baltic exchanges, four languages, one normalised view."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {exchanges.map((exchange) => (
          <div
            key={exchange.city}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-6 shadow-zinc-950/5 transition-colors hover:border-primary/40 dark:border-white/10 dark:from-zinc-900/30 dark:to-zinc-900/10"
          >
            <CardCorners />
            <div className="flex items-center justify-between">
              <div className="relative flex aspect-square size-10 items-center justify-center rounded-full border border-zinc-200 before:absolute before:-inset-2 before:rounded-full before:border before:border-zinc-200 dark:border-white/10 dark:before:border-white/5">
                <Globe className="size-4 text-primary" />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {exchange.code}
              </span>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold tracking-tight">
                {exchange.city}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Nasdaq {exchange.city} · {exchange.country}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">Languages</span>
        <Badge variant="secondary" className="rounded-full">
          <Languages className="mr-1 size-3.5" />
          EN / ET / LV / LT
        </Badge>
      </div>
    </motion.section>
  );
}

function CtaFooter() {
  return (
    <motion.section
      {...fadeUp}
      className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24"
    >
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-10 shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-900/10">
        <CardCorners />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 0%, rgba(59,130,246,0.10), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to start?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Upload your next filing or jump into the catalog and explore
              what&apos;s already there.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-xl">
              <Link href="/upload">
                Upload a Report
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-xl dark:border-white/10"
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
    <footer className="border-t border-zinc-200/80 py-8 dark:border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Building2 className="size-3.5 text-primary" />© Baltic Earnings
          Intelligence
        </span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/access" className="hover:text-foreground">
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
    <div className="flex max-w-2xl flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </span>
      <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="text-balance text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function CardCorners() {
  return (
    <>
      <span className="pointer-events-none absolute -left-px -top-px block size-2 border-l-2 border-t-2 border-primary" />
      <span className="pointer-events-none absolute -right-px -top-px block size-2 border-r-2 border-t-2 border-primary" />
      <span className="pointer-events-none absolute -bottom-px -left-px block size-2 border-b-2 border-l-2 border-primary" />
      <span className="pointer-events-none absolute -bottom-px -right-px block size-2 border-b-2 border-r-2 border-primary" />
    </>
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
      className="flex flex-col items-center gap-2 p-6 text-center"
      aria-label={`${value} ${label}`}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </span>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">
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
    <Card className="relative overflow-hidden rounded-2xl border-zinc-200 bg-gradient-to-b from-white to-zinc-50 shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900/30 dark:to-zinc-900/10">
      <CardCorners />
      <CardContent className="flex flex-col gap-5 p-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="relative flex aspect-square size-12 items-center justify-center rounded-full border border-zinc-200 before:absolute before:-inset-2 before:rounded-full before:border before:border-zinc-200 dark:border-white/10 dark:before:border-white/5">
            <Icon className="size-5 text-primary" strokeWidth={1.5} />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {String(index).padStart(2, "0")}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-2xl border-zinc-200 bg-gradient-to-b from-white to-zinc-50 shadow-zinc-950/5 transition-colors hover:border-primary/40 dark:border-white/10 dark:from-zinc-900/20 dark:to-zinc-900/5">
      <CardCorners />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover:opacity-100",
        )}
        style={{
          background:
            "radial-gradient(125% 125% at 50% 0%, transparent 40%, hsl(var(--muted) / 0.6))",
        }}
      />
      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl border border-zinc-200 bg-background/80 text-primary dark:border-white/10">
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative pt-0 text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}
