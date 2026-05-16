import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import ReportViewPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ reportId: "r1" }),
}));

const report = {
  id: "r1",
  companyId: "c1",
  fiscalYear: 2024,
  reportType: "annual",
  language: "en",
  jobId: null,
  s3Key: "reports/acme.pdf",
  extractedJsonSnapshot: {
    metadata: {
      companyName: "Acme Holdings",
      reportPeriod: "FY2024",
    },
    metrics: [],
    narratives: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("ReportViewPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/reports/r1") {
          return Promise.resolve({
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => report,
          });
        }
        if (url === "/api/companies") {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "c1", slug: "acme-holdings" }],
          });
        }
        return Promise.resolve({
          ok: false,
          headers: { get: () => "application/json" },
          json: async () => ({ error: "Unexpected request" }),
        });
      }),
    );
  });

  it("keeps report hero actions mobile-safe and compact on desktop", async () => {
    render(<ReportViewPage />);

    const download = await screen.findByRole("link", { name: "Download PDF" });
    const share = screen.getByRole("button", { name: "Share" });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Open Company" })).toBeInTheDocument();
    });
    const openCompany = screen.getByRole("link", { name: "Open Company" });

    for (const action of [download, share, openCompany]) {
      expect(action).toHaveClass("h-11", "w-full", "px-4", "sm:h-9", "sm:w-auto", "sm:px-3");
      expect(action.querySelector("svg")).toHaveClass("size-4", "sm:size-3.5");
    }
  });

  it("keeps report navigation links mobile-safe and compact on desktop", async () => {
    render(<ReportViewPage />);

    const backToCompany = await screen.findByRole("link", { name: "Back to company" });
    expect(backToCompany).toHaveAttribute("href", "/companies/acme-holdings");

    const sourceOpen = screen.getByRole("link", { name: "Open" });
    const footer = screen.getByText(/Report ID/i).closest("footer");
    expect(footer).not.toBeNull();
    const companyDashboard = within(footer!).getByRole("link", { name: /company dashboard/i });
    const catalog = within(footer!).getByRole("link", { name: /^catalog$/i });

    for (const action of [backToCompany, sourceOpen, companyDashboard, catalog]) {
      expect(action).toHaveClass("min-h-11", "text-[11px]", "sm:min-h-0", "sm:text-[10px]");
      expect(action.querySelector("svg")).toHaveClass("size-4", "sm:size-3");
    }
  });

  it("labels the report hero back link as catalog when no company slug resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/reports/r1") {
          return Promise.resolve({
            ok: true,
            headers: { get: () => "application/json" },
            json: async () => report,
          });
        }
        if (url === "/api/companies") {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        return Promise.resolve({
          ok: false,
          headers: { get: () => "application/json" },
          json: async () => ({ error: "Unexpected request" }),
        });
      }),
    );

    render(<ReportViewPage />);

    const backToCatalog = await screen.findByRole("link", { name: "Back to catalog" });
    expect(backToCatalog).toHaveAttribute("href", "/companies");
  });
});
