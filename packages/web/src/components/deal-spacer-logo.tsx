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
        "inline-flex shrink-0 items-center transition-colors hover:text-white",
        className,
      )}
    >
      <DealSpacerLogo />
    </Link>
  );
}
