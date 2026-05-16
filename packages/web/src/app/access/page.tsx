"use client";

import Link from "next/link";
import React, { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSiteHeader } from "@/components/app-site-header";
import { Button } from "@/components/ui/button";
import { ACCESS_REQUEST_TIMEOUT_MS } from "@/lib/access-timeout";
import { cn } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
} as const;

const stagger = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

function AccessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const nextPath = useMemo(() => {
    const nextValue = params.get("next");
    if (!nextValue || !nextValue.startsWith("/")) return "/app";
    return nextValue;
  }, [params]);

  async function submit() {
    if (!code.trim()) {
      setError("Enter an access code.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ACCESS_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, next: nextPath }),
        signal: controller.signal,
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Access denied.");
        return;
      }

      router.push(payload.next || "/");
      router.refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError("Could not verify access code.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  return (
    <motion.section
      variants={stagger}
      initial="initial"
      animate="animate"
      className="relative w-full max-w-[440px]"
      aria-labelledby="access-heading"
    >
      <div className="access-panel-glow pointer-events-none absolute -inset-px rounded-none opacity-60" aria-hidden />

      <div className="relative border border-[#2a3544] bg-[#0c1018]/95 p-8 backdrop-blur-sm md:p-10">
        <span className="access-corner access-corner-tl" aria-hidden />
        <span className="access-corner access-corner-tr" aria-hidden />
        <span className="access-corner access-corner-bl" aria-hidden />
        <span className="access-corner access-corner-br" aria-hidden />

        <motion.div variants={fadeUp} className="mb-8 flex items-start justify-between gap-4">
          <motion.span
            className="flex size-11 shrink-0 items-center justify-center border border-[#2b79db]/30 bg-[#2b79db]/10 text-[#7eb3f0]"
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <KeyRound className="size-5" strokeWidth={1.5} aria-hidden />
          </motion.span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#5a8f8f]">
            Secure entry
          </span>
        </motion.div>

        <motion.h1
          id="access-heading"
          variants={fadeUp}
          className="font-[family-name:var(--font-display)] text-[clamp(1.65rem,4vw,2.1rem)] font-medium leading-[1.08] tracking-tight text-[#f4f6f9]"
        >
          Report access
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-3 text-[15px] leading-relaxed text-[#9aa8bc]">
          Enter the private preview code to open the Baltic earnings workspace.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8">
          <label
            htmlFor="access-code"
            className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#6b7d92]"
          >
            Access code
          </label>
          <motion.div
            className={cn(
              "relative border bg-[#080b10] transition-colors duration-300",
              focused ? "border-[#2b79db]/55 access-input-glow" : "border-[#2a3544]",
              error && "border-[#9e4a5a]/60",
            )}
            animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#5a8f8f]"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              id="access-code"
              type="password"
              aria-label="Access code"
              aria-describedby={error ? "access-error" : undefined}
              aria-invalid={error ? true : undefined}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              placeholder="Access code"
              autoComplete="off"
              className={cn(
                "w-full border-0 bg-transparent py-3.5 pl-11 pr-4",
                "font-[family-name:var(--font-mono)] text-[15px] tracking-[0.08em] text-[#e8ecf2]",
                "placeholder:text-[#4a5568] focus:outline-none focus:ring-0",
              )}
            />
          </motion.div>

          {error && (
            <motion.p
              id="access-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 border border-[#9e4a5a]/35 bg-[#9e4a5a]/8 px-3 py-2 font-[family-name:var(--font-mono)] text-[12px] leading-snug text-[#e8a0a8]"
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-6">
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className={cn(
              "group relative h-12 w-full overflow-hidden rounded-none border-0",
              "bg-[#2b79db] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#ffffff]",
              "hover:bg-[#3d8de8] disabled:bg-[#3d4d62] disabled:text-[#6b7d92]",
            )}
          >
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/12 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              aria-hidden
            />
            {submitting ? "Checking..." : "Unlock Access"}
          </Button>
        </motion.div>

        <motion.p
          variants={fadeUp}
          className="mt-6 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[#6b7d92]"
        >
          Preview access is limited to invited analysts. Codes are not shared publicly.
        </motion.p>
      </div>
    </motion.section>
  );
}

function AccessFallback() {
  return (
    <div className="flex w-full max-w-[440px] items-center justify-center border border-[#2a3544] bg-[#0c1018]/90 px-8 py-16">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[#6b7d92]">
        Loading access form…
      </p>
    </div>
  );
}

function AccessHero() {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="hidden max-w-md lg:block"
    >
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[#5a8f8f]">
        Private preview · Baltic exchanges
      </p>
      <h2 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.02em] text-[#f4f6f9]">
        The reading room
        <span className="block text-[#6b7d92]">awaits your key.</span>
      </h2>
      <p className="mt-6 max-w-sm text-[16px] leading-[1.65] text-[#9aa8bc]">
        Automated financial analysis for Nasdaq Tallinn, Riga, and Vilnius company reports — structured,
        translated, and ready for review.
      </p>

      <ul className="mt-10 space-y-4 border-t border-[#2a3544] pt-8">
        {[
          { label: "Tallinn", accent: "#4a7ab8" },
          { label: "Riga", accent: "#9e4a5a" },
          { label: "Vilnius", accent: "#8a9e4a" },
        ].map((exchange, index) => (
          <motion.li
            key={exchange.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: exchange.accent }}
              aria-hidden
            />
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#8b9aad]">
              Nasdaq {exchange.label}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.aside>
  );
}

export default function AccessPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "access-page relative min-h-screen overflow-hidden",
        "bg-[#080b10] text-[#e8ecf2]",
        "font-[family-name:var(--font-body)]",
      )}
    >
      <motion.div
        className="access-page-atmosphere pointer-events-none fixed inset-0 z-0"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <div
        className="access-page-grain pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
      />

      <motion.div
        className="relative z-10 flex min-h-screen flex-col"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <AppSiteHeader
          maxWidthClass="max-w-[1180px]"
          navItems={[
            { href: "/", label: "Home", emphasis: "muted" },
            { href: "/companies", label: "Catalog" },
          ]}
        />

        <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col items-center justify-center gap-10 px-4 py-10 sm:px-6 sm:py-14 md:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-20 lg:py-20">
          <AccessHero />
          <Suspense fallback={<AccessFallback />}>
            <AccessForm />
          </Suspense>
        </main>

        <footer className="border-t border-[#2a3544]/60 px-4 py-5 sm:px-6 md:px-10">
          <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#6b7d92]">
            <span>DealSpacer · Private preview</span>
            <Link href="/privacy" className="transition hover:text-[#9aa8bc]">
              Privacy
            </Link>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}
