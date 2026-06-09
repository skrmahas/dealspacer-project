import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminReportRerunsPage from "./page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const CANDIDATES = [
  {
    id: "candidate-1",
    reportId: "report-1",
    jobId: "job-2",
    s3Key: "reports/job-2.pdf",
    status: "pending_review",
    qualityWarnings: ["Revenue differs by more than 10x from history."],
    createdAt: "2026-01-01T00:00:00.000Z",
    extractedJsonSnapshot: {
      metadata: { companyName: "Tallink Grupp", reportPeriod: "FY 2025", sourceLanguage: "en" },
      metrics: [
        {
          label: "Revenue",
          canonicalId: "revenue",
          value: 1200000,
          unit: "EUR",
          evidence: {
            confidence: 0.91,
            page: 12,
            snippet: "Revenue for the year was EUR 1.2 million.",
          },
        },
        {
          label: "Net Profit",
          canonicalId: "net_profit",
          value: 120000,
          unit: "EUR",
        },
      ],
    },
    report: {
      id: "report-1",
      companyName: "AS Tallink Grupp",
      companySlug: "tallink-grupp",
      fiscalYear: 2025,
      reportType: "annual",
      language: "en",
      s3Key: "reports/job-1.pdf",
      extractedJsonSnapshot: {
        metadata: { companyName: "Tallink Grupp", reportPeriod: "FY 2025", sourceLanguage: "en" },
        metrics: [
          { label: "Revenue", canonicalId: "revenue", value: 1000000, unit: "EUR" },
          { label: "Net Profit", canonicalId: "net_profit", value: 100000, unit: "EUR" },
        ],
      },
    },
  },
];

describe("AdminReportRerunsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/report-rerun-candidates" && !init?.method) {
          return Promise.resolve({ ok: true, json: async () => CANDIDATES });
        }
        if (url === "/api/report-rerun-candidates/candidate-1/promote") {
          return Promise.resolve({ ok: true, json: async () => ({ promoted: true, reportId: "report-1" }) });
        }
        if (url === "/api/report-rerun-candidates/candidate-1/reject") {
          return Promise.resolve({ ok: true, json: async () => ({ rejected: true, candidateId: "candidate-1" }) });
        }
        return Promise.resolve({ ok: false, json: async () => ({ error: "Unexpected request" }) });
      }),
    );
  });

  it("shows current vs rerun metrics with warnings and evidence", async () => {
    render(<AdminReportRerunsPage />);

    expect(await screen.findByRole("heading", { name: "Rerun review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AS Tallink Grupp" })).toBeInTheDocument();
    expect(screen.getByText("Revenue differs by more than 10x from history.")).toBeInTheDocument();
    expect(screen.getByText("1,000,000 EUR")).toBeInTheDocument();
    expect(screen.getByText("1,200,000 EUR")).toBeInTheDocument();
    expect(screen.getByText("91% · p. 12")).toBeInTheDocument();
    expect(screen.getByText("Revenue for the year was EUR 1.2 million.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /current/i })).toHaveAttribute("href", "/reports/report-1");
  });

  it("approves through the candidate promotion endpoint and removes the candidate", async () => {
    render(<AdminReportRerunsPage />);

    await screen.findByRole("heading", { name: "AS Tallink Grupp" });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/report-rerun-candidates/candidate-1/promote",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(screen.getByText("No rerun candidates need review.")).toBeInTheDocument());
  });

  it("rejects through the candidate reject endpoint and removes the candidate", async () => {
    render(<AdminReportRerunsPage />);

    await screen.findByRole("heading", { name: "AS Tallink Grupp" });
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/report-rerun-candidates/candidate-1/reject",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
