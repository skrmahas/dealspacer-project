"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X, type LucideIcon } from "lucide-react";
import { DealSpacerLogoLink } from "@/components/deal-spacer-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SiteNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  emphasis?: "primary" | "default" | "muted";
};

export type SiteBreadcrumb = {
  label: string;
  href?: string;
};

const DEFAULT_NAV: SiteNavItem[] = [
  { href: "/companies", label: "Catalog" },
  { href: "/upload", label: "Upload", emphasis: "primary" },
];

const navLinkClass = (emphasis: SiteNavItem["emphasis"] = "default") =>
  cn(
    "inline-flex items-center gap-1.5 rounded-sm px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] transition",
    emphasis === "primary" &&
      "border border-[#2b79db]/40 bg-[#2b79db]/10 text-[#b8d4f5] hover:bg-[#2b79db]/18",
    emphasis === "muted" &&
      "text-[#6b7d92] hover:bg-[#2b79db]/8 hover:text-[#e8ecf2]",
    emphasis === "default" &&
      "text-[#8b9aad] hover:bg-[#2b79db]/8 hover:text-[#e8ecf2]",
  );

function NavLinks({
  items,
  onNavigate,
  className,
}: {
  items: SiteNavItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Site">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            className={navLinkClass(item.emphasis)}
          >
            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
            {item.label}
            {item.emphasis === "primary" && (
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSiteHeader({
  navItems = DEFAULT_NAV,
  breadcrumbs,
  trailing,
  maxWidthClass = "max-w-[1240px]",
  sticky = true,
  className,
  logoHref = "/",
  onLogoClick,
}: {
  navItems?: SiteNavItem[];
  breadcrumbs?: SiteBreadcrumb[];
  trailing?: React.ReactNode;
  maxWidthClass?: string;
  sticky?: boolean;
  className?: string;
  logoHref?: string;
  onLogoClick?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const showBreadcrumbs = breadcrumbs && breadcrumbs.length > 0;

  return (
    <header
      className={cn(
        sticky && "sticky top-0 z-40",
        "border-b border-[#2b79db]/12 bg-[#080b10]/85 backdrop-blur-md",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10",
          maxWidthClass,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <DealSpacerLogoLink
            href={logoHref}
            onClick={onLogoClick ?? (menuOpen ? closeMenu : undefined)}
            className="shrink-0 text-[#8b9aad] hover:text-[#f4f6f9]"
          />

          {showBreadcrumbs && (
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  {i > 0 && (
                    <span
                      className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-[#3d4d62]"
                      aria-hidden
                    >
                      /
                    </span>
                  )}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#5a8f8f] transition hover:text-[#2b79db]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#8b9aad]">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={cn(
                    navLinkClass(item.emphasis),
                    item.emphasis === "primary" && "ml-1",
                  )}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {item.label}
                  {item.emphasis === "primary" && (
                    <ArrowUpRight className="size-3" aria-hidden />
                  )}
                </Link>
              );
            })}
          </nav>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-none text-[#8b9aad] hover:bg-[#2b79db]/10 hover:text-[#e8ecf2] md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#040608]/75 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id={menuId}
            className={cn(
              "fixed inset-x-0 top-[53px] z-50 border-b border-[#2b79db]/15 bg-[#0a0e14]/98 px-4 py-4 backdrop-blur-md md:hidden",
              "max-h-[min(70vh,calc(100dvh-53px))] overflow-y-auto",
            )}
          >
            <NavLinks items={navItems} onNavigate={closeMenu} />
          </div>
        </>
      )}
    </header>
  );
}
