import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type DealSpacerLogoProps = {
  className?: string;
};

export function DealSpacerLogo({ className }: DealSpacerLogoProps) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f4f6f9]",
        className,
      )}
    >
      DealSpacer
    </span>
  );
}

type DealSpacerLogoLinkProps = DealSpacerLogoProps & {
  href?: string;
  onClick?: () => void;
};

export function DealSpacerLogoLink({ href = "/", onClick, className }: DealSpacerLogoLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center transition-colors hover:text-white",
        className,
      )}
    >
      <span
        className="absolute left-1/2 top-1/2 hidden size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 [@media(any-pointer:coarse)]:block"
        aria-hidden
      />
      <DealSpacerLogo />
    </Link>
  );
}
