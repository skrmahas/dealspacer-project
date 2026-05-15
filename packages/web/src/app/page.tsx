"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, BrainCircuit, Building2, Languages, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Stats = {
  companies: number;
  reports: number;
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, ease: "easeOut" },
} as const;

export default function LandingPage() {
  const [stats, setStats] = useState<Stats>({ companies: 0, reports: 0 });
  const [displayStats, setDisplayStats] = useState<Stats>({ companies: 0, reports: 0 });
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setStatsVisible(true);
      return;
    }

    const node = statsRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!statsVisible) return;

    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")) {
      setDisplayStats(stats);
      return;
    }

    const start = performance.now();
    const durationMs = 450;

    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.max(0, Math.min((now - start) / durationMs, 1));
      setDisplayStats({
        companies: Math.round(stats.companies * progress),
        reports: Math.round(stats.reports * progress),
      });

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const fallbackTimeout = window.setTimeout(() => {
      setDisplayStats(stats);
    }, durationMs + 50);

    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallbackTimeout);
    };
  }, [stats, statsVisible]);

  const featureCards = useMemo(
    () => [
      {
        title: "Multi-language reports",
        description: "Generate output in EN, ET, LV, and LT with consistent metric labeling.",
      },
      {
        title: "Side-by-side comparison",
        description: "Compare two reports with deltas, sentiment context, and trend signals.",
      },
      {
        title: "AI metric extraction & charts",
        description: "Extract core earnings metrics and visualize them in clean investor-ready layouts.",
      },
      {
        title: "Sentiment analysis",
        description: "Track management tone, outlook, and guidance direction at a glance.",
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-zinc-200/70 bg-background/90 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Building2 className="size-5 text-primary" />
            <span>DealSpacer</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link href="/companies" className="text-muted-foreground transition hover:text-foreground">
              Catalog
            </Link>
            <Link href="/upload" className="text-muted-foreground transition hover:text-foreground">
              Upload
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-100/80 via-background to-background dark:from-zinc-900/50" />
          <div className="absolute inset-0 [background:radial-gradient(120%_90%_at_50%_0%,rgba(59,130,246,0.14),transparent_55%)]" />

          <div className="relative mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Baltic Earnings Intelligence
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              AI-powered analysis of ~40 Baltic listed companies across Tallinn, Riga, and Vilnius.
              Upload filings, extract key metrics, and compare performance in minutes.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-2xl">
                <Link href="/companies">
                  Browse the Catalog
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl dark:border-white/10">
                <Link href="/upload">Upload a Report</Link>
              </Button>
            </div>
          </div>
        </motion.section>

        <motion.section
          ref={statsRef}
          {...fadeUp}
          className="mx-auto w-full max-w-6xl px-6 pb-8"
        >
          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4 shadow-zinc-950/5 sm:grid-cols-2 md:grid-cols-4 dark:border-white/10 dark:from-zinc-900/30 dark:to-zinc-900/10">
            <StatTile value={displayStats.companies} label="Companies tracked" />
            <StatTile value={displayStats.reports} label="Reports processed" />
            <StatTile value={3} label="Exchanges" />
            <StatTile value={4} label="Languages supported" />
          </div>
        </motion.section>

        <motion.section {...fadeUp} className="mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StepCard icon={Upload} title="Upload" text="Drop in earnings filings from your workflow." />
            <StepCard icon={BrainCircuit} title="AI extracts" text="Pipeline extracts metrics, trends, and sentiment." />
            <StepCard icon={BarChart3} title="Browse & Compare" text="Review reports and compare side-by-side." />
          </div>
        </motion.section>

        <motion.section {...fadeUp} className="mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold tracking-tight">Features</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {featureCards.map((feature) => (
              <Card
                key={feature.title}
                className="relative rounded-2xl border-zinc-200 bg-gradient-to-b from-white to-zinc-50 shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900/20 dark:to-zinc-900/5"
              >
                <span className="absolute -left-px -top-px size-2 border-l-2 border-t-2 border-primary" />
                <span className="absolute -right-px -top-px size-2 border-r-2 border-t-2 border-primary" />
                <CardHeader>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">{feature.description}</CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        <motion.section {...fadeUp} className="mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold tracking-tight">Exchanges</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge variant="outline" className="rounded-xl px-3 py-1.5 dark:border-white/20">
              Tallinn
            </Badge>
            <Badge variant="outline" className="rounded-xl px-3 py-1.5 dark:border-white/20">
              Riga
            </Badge>
            <Badge variant="outline" className="rounded-xl px-3 py-1.5 dark:border-white/20">
              Vilnius
            </Badge>
            <Badge variant="secondary" className="rounded-xl px-3 py-1.5">
              <Languages className="mr-1 size-3.5" />
              EN / ET / LV / LT
            </Badge>
          </div>
        </motion.section>

        <motion.section {...fadeUp} className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-8 shadow-zinc-950/5 dark:border-white/10 dark:from-zinc-900/30 dark:to-zinc-900/10">
            <h3 className="text-2xl font-semibold tracking-tight">Ready to start?</h3>
            <p className="mt-2 text-muted-foreground">Upload your next filing or jump into the catalog.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/upload">Upload a Report</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl dark:border-white/10">
                <Link href="/companies">Browse the Catalog</Link>
              </Button>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-zinc-200/80 py-8 dark:border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-sm text-muted-foreground">
          <span>© Baltic Earnings Intelligence</span>
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
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="rounded-xl border border-zinc-200/80 bg-background/70 p-4 text-center dark:border-white/10"
      aria-label={`${value} ${label}`}
    >
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function StepCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Upload;
  title: string;
  text: string;
}) {
  return (
    <Card className="rounded-2xl border-zinc-200 shadow-zinc-950/5 dark:border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
