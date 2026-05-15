"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  Menu,
  X,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string;
  slug: string;
  country: string | null;
  sector: string | null;
  reportCount: number;
}

type ExchangeFilter = "All" | "Nasdaq Tallinn" | "Nasdaq Riga" | "Nasdaq Vilnius";

const EXCHANGE_TABS: ExchangeFilter[] = ["All", "Nasdaq Tallinn", "Nasdaq Riga", "Nasdaq Vilnius"];
const EXCHANGE_SHORT: Record<string, string> = {
  "Nasdaq Tallinn": "Tallinn",
  "Nasdaq Riga": "Riga",
  "Nasdaq Vilnius": "Vilnius",
};

export default function CompanyDirectory() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("All");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCompanies(data);
        } else {
          setError(data.error || "Failed to load companies");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = companies;
    if (exchangeFilter !== "All") {
      list = list.filter((c) => c.exchange === exchangeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.ticker && c.ticker.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [companies, exchangeFilter, search]);

  // Group by exchange
  const grouped = useMemo(() => {
    const groups: Record<string, Company[]> = {};
    for (const c of filtered) {
      if (!groups[c.exchange]) groups[c.exchange] = [];
      groups[c.exchange].push(c);
    }
    return groups;
  }, [filtered]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif", color: "#21324a" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className="company-sidebar"
        style={{
          width: 280,
          minWidth: 280,
          borderRight: "1px solid #e2e8f0",
          background: "#f8fafd",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: sidebarOpen ? 0 : -280,
          bottom: 0,
          zIndex: 50,
          transition: "left 0.2s ease",
          padding: "16px 14px",
          gap: 12,
          overflow: "hidden",
        }}
      >
        {/* Sidebar header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/app" style={{ fontSize: 18, fontWeight: 800, color: "#173b68", textDecoration: "none" }}>
            DealSpacer
          </Link>
          <button
            onClick={closeSidebar}
            className="mobile-only"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#607287" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              border: "1px solid #cfd8e3", borderRadius: 10,
              padding: "8px 10px 8px 32px", fontSize: 13,
              outline: "none", background: "#fff", color: "#24364f",
            }}
          />
        </div>

        {/* Exchange tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {EXCHANGE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setExchangeFilter(tab)}
              style={{
                border: exchangeFilter === tab ? "1px solid #4680ff" : "1px solid #cfd8e3",
                borderRadius: 999, padding: "4px 10px", fontSize: 11,
                fontWeight: exchangeFilter === tab ? 700 : 500,
                background: exchangeFilter === tab ? "#edf4ff" : "#fff",
                color: exchangeFilter === tab ? "#2d5fbf" : "#607287",
                cursor: "pointer",
              }}
            >
              {EXCHANGE_SHORT[tab] || tab}
            </button>
          ))}
        </div>

        {/* Company list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              Loading companies...
            </div>
          )}
          {error && (
            <div style={{ padding: 12, color: "#c0392b", fontSize: 13 }}>
              {error}
            </div>
          )}
          {!loading && !error && Object.entries(grouped).map(([exchange, list]) => (
            <div key={exchange} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#8b9cb8", letterSpacing: "0.05em", padding: "0 4px", marginBottom: 6 }}>
                {EXCHANGE_SHORT[exchange] || exchange} ({list.length})
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/companies/${c.slug}`}
                    onClick={closeSidebar}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", borderRadius: 8, textDecoration: "none",
                      color: "#21324a", background: "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2f8")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                      {c.ticker && (
                        <div style={{ fontSize: 11, color: "#8b9cb8", marginTop: 1 }}>
                          {c.ticker}
                        </div>
                      )}
                    </div>
                    {c.reportCount > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, background: "#e2ecf9", color: "#2d5fbf",
                        borderRadius: 999, padding: "2px 7px", flexShrink: 0,
                      }}>
                        {c.reportCount}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              No companies found
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "flex", gap: 10, fontSize: 12 }}>
          <Link href="/app" style={{ color: "#3b5f93", textDecoration: "none", fontWeight: 600 }}>
            Upload
          </Link>
          <Link href="/access" style={{ color: "#3b5f93", textDecoration: "none", fontWeight: 600 }}>
            Access
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content" style={{ flex: 1, marginLeft: 0, transition: "margin 0.2s" }}>
        {/* Mobile header */}
        <div className="mobile-only" style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0", background: "#fff",
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#21324a" }}
          >
            <Menu size={22} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#173b68" }}>DealSpacer</span>
        </div>

        {/* Welcome state */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", padding: "40px 20px", textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            display: "grid", placeItems: "center",
            background: "#edf2ff", color: "#3b5f93", marginBottom: 16,
          }}>
            <Building2 size={30} />
          </div>
          <h2 style={{ margin: 0, fontSize: 24, color: "#0f2e52" }}>
            {companies.length > 0
              ? `${companies.length} companies tracked`
              : "Baltic Company Directory"}
          </h2>
          <p style={{ margin: "10px 0 0", maxWidth: 420, color: "#5f6f83", fontSize: 14, lineHeight: 1.5 }}>
            Select a company from the sidebar to view its reports and financial data.
            Upload new reports via the{" "}
            <Link href="/app" style={{ color: "#365d9c", fontWeight: 700 }}>
              upload page
            </Link>
            .
          </p>
          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/app"
              style={{
                display: "inline-block", padding: "10px 20px", borderRadius: 10,
                background: "linear-gradient(90deg, #5d7dff, #63d2ff)", color: "#fff",
                fontWeight: 700, textDecoration: "none", fontSize: 14,
              }}
            >
              Upload a Report
            </Link>
            <Link
              href="/access"
              style={{
                display: "inline-block", padding: "10px 20px", borderRadius: 10,
                border: "1px solid #cdd9eb", color: "#365d9c",
                fontWeight: 700, textDecoration: "none", fontSize: 14,
              }}
            >
              Request Access
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (min-width: 768px) {
          .company-sidebar {
            left: 0 !important;
            position: relative !important;
          }
          .main-content {
            margin-left: 0 !important;
          }
          .mobile-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
