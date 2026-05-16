import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ExtractedData, Report } from "@bei/shared";
import ComparePage from "./page-client";

const tallinkSnapshot: ExtractedData = {
  metadata: {
    companyName: "Tallink Grupp",
    reportPeriod: "2024",
    sourceLanguage: "en",
  },
  metrics: [
    { label: "Revenue", value: 500_000_000 },
    { label: "Free Cash Flow", value: 60_000_000 },
    { label: "Net Profit", value: 80_000_000 },
  ],
  narratives: [],
  sentiment: {
    managementTone: "Disciplined cost control with resilient demand.",
    outlook: "Management expects steady route demand.",
    riskFactors: ["Fuel costs"],
    guidanceDirection: "raised",
  },
  revenueBreakdown: {
    bySegment: [{ name: "Ferry operations", value: 350_000_000 }],
  },
  profitabilityTrends: {
    periods: ["FY2023", "FY2024"],
    revenue: [400_000_000, 500_000_000],
    ebitda: [110_000_000, 120_000_000],
  },
};

const delfinSnapshot: ExtractedData = {
  metadata: {
    companyName: "DelfinGroup",
    reportPeriod: "2024",
    sourceLanguage: "en",
  },
  metrics: [
    { label: "Revenue", value: 430_000_000 },
    { label: "Free Cash Flow", value: 45_000_000 },
    { label: "Net Profit", value: 90_000_000 },
  ],
  narratives: [],
  sentiment: {
    managementTone: "Growth remains constructive.",
    outlook: "Management expects loan book expansion.",
    riskFactors: ["Credit costs"],
    guidanceDirection: "maintained",
  },
  revenueBreakdown: {
    bySegment: [{ name: "Consumer lending", value: 430_000_000 }],
  },
  profitabilityTrends: {
    periods: ["FY2023", "FY2024"],
    revenue: [380_000_000, 430_000_000],
    ebitda: [90_000_000, 105_000_000],
  },
};

function makeReport(id: string, snapshot: ExtractedData): Report {
  return {
    id,
    companyId: `company-${id}`,
    fiscalYear: 2024,
    reportType: "annual",
    language: "en",
    jobId: null,
    s3Key: `${id}.pdf`,
    extractedJsonSnapshot: snapshot,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("ComparePage", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/reports/report-a")) {
          return Promise.resolve({
            ok: true,
            json: async () => makeReport("report-a", tallinkSnapshot),
          });
        }
        if (url.endsWith("/api/reports/report-b")) {
          return Promise.resolve({
            ok: true,
            json: async () => makeReport("report-b", delfinSnapshot),
          });
        }
        return Promise.resolve({
          ok: false,
          json: async () => null,
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the metrics table with responsive table affordances", async () => {
    render(<ComparePage initialReportA="report-a" initialReportB="report-b" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Metrics" })).toBeInTheDocument();
    });

    const table = screen.getByRole("table");
    const scrollFrame = table.parentElement?.parentElement;
    expect(table).toHaveClass("w-full", "min-w-[640px]", "text-left");
    expect(table.parentElement).toHaveClass("inline-block", "min-w-full", "px-5", "py-2");
    expect(scrollFrame).toHaveClass(
      "-mx-5",
      "-my-2",
      "overflow-x-auto",
      "overscroll-x-contain",
      "whitespace-nowrap",
    );

    const headerRow = screen.getByRole("columnheader", { name: "Metric" }).parentElement;
    expect(headerRow).not.toHaveClass("uppercase");
    expect(screen.getByRole("columnheader", { name: "Metric" })).toHaveClass(
      "whitespace-nowrap",
    );
    expect(screen.getByRole("columnheader", { name: "Delta" })).toBeInTheDocument();

    expect(within(table).getByText("Revenue")).toHaveClass("text-base/6", "sm:text-[13px]");
    expect(within(table).getAllByText("2×")[0]).toHaveClass("text-[10px]", "sm:text-[8px]");
    expect(within(table).getByText("€500M")).toHaveClass("text-base/6", "sm:text-[13px]");
  });
});
