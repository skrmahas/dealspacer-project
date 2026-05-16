import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompanyAnalyticsDashboardPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: vi.fn().mockReturnValue({ slug: "tallink-grupp" }),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

const MOCK_COMPANY = {
  id: "c1",
  name: "Tallink Grupp",
  ticker: "TAL1T",
  exchange: "Nasdaq Tallinn",
  slug: "tallink-grupp",
  country: "EE",
  sector: "Industrials",
  reportCount: 2,
};

const MOCK_REPORTS = [
  {
    id: "r1",
    companyId: "c1",
    fiscalYear: 2024,
    reportType: "annual",
    language: "en",
    jobId: "j1",
    s3Key: "r1.pdf",
    previewRevenue: 500000000,
    previewEbitda: 120000000,
    previewNetProfit: 80000000,
    previewFcf: 60000000,
    createdAt: "2025-03-15",
    companyName: "Tallink Grupp",
    extractedJsonSnapshot: {
      metadata: { companyName: "Tallink Grupp", reportPeriod: "FY2024" },
      metrics: [],
      sentiment: {
        managementTone: "Confident and positive outlook on ferry traffic.",
        outlook: "Optimistic",
        riskFactors: [],
        guidanceDirection: "raised",
      },
      revenueBreakdown: {
        bySegment: [
          { name: "Ferry", value: 350000000 },
          { name: "Hotel", value: 150000000 },
        ],
      },
    },
  },
  {
    id: "r2",
    companyId: "c1",
    fiscalYear: 2023,
    reportType: "annual",
    language: "en",
    jobId: "j2",
    s3Key: "r2.pdf",
    previewRevenue: 400000000,
    previewEbitda: 100000000,
    previewNetProfit: 60000000,
    previewFcf: 50000000,
    createdAt: "2024-02-20",
    companyName: "Tallink Grupp",
    extractedJsonSnapshot: {
      metadata: { companyName: "Tallink Grupp", reportPeriod: "FY2023" },
      metrics: [],
      sentiment: {
        managementTone: "Cautious recovery from pandemic-era slump.",
        outlook: "Stable",
        riskFactors: [],
        guidanceDirection: "maintained",
      },
    },
  },
];

function mockSuccessfulLoad(reports = MOCK_REPORTS, company = MOCK_COMPANY) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [company] })
      .mockResolvedValueOnce({ ok: true, json: async () => reports }),
  );
}

describe("CompanyAnalyticsDashboardPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows company header with name, ticker, exchange badge, and report count", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());
    expect(screen.getByText("TAL1T")).toBeInTheDocument();
    expect(screen.getByText("Nasdaq Tallinn")).toBeInTheDocument();
    expect(screen.getByText(/2 reports indexed/)).toBeInTheDocument();
  });

  it("shows 'Add Report' button linking to /upload?company=:slug", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());
    const link = screen.getByText("Add Report").closest("a");
    expect(link).toHaveAttribute("href", "/upload?company=tallink-grupp");
  });

  it("renders 4 KPI cards with YoY delta and FY label", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getAllByText("Revenue")[0]).toBeInTheDocument());

    expect(screen.getAllByText("Revenue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("EBITDA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Net Profit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Free Cash Flow").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText(/FY\s*2024/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText("€500M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€120M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€80M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("€60M").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("+25.0%").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the trend line chart container", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByTestId("trend-line-chart")).toBeInTheDocument());
    expect(screen.getByText("Performance trends")).toBeInTheDocument();
  });

  it("renders the breakdown bar chart only when revenue breakdown data exists", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() =>
      expect(screen.getByTestId("breakdown-bar-chart")).toBeInTheDocument(),
    );
    expect(screen.getByText("Revenue breakdown")).toBeInTheDocument();
    // "Ferry" appears both in the bar row and in the "Top stream" header cell
    expect(screen.getAllByText("Ferry").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Hotel")).toBeInTheDocument();
  });

  it("hides the breakdown bar chart when no revenue breakdown is present in latest report", async () => {
    const stripped = MOCK_REPORTS.map((r) => ({
      ...r,
      extractedJsonSnapshot: {
        ...r.extractedJsonSnapshot,
        revenueBreakdown: undefined,
      },
    }));
    mockSuccessfulLoad(stripped);
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText("Performance trends")).toBeInTheDocument());
    expect(screen.queryByText("Revenue breakdown")).not.toBeInTheDocument();
  });

  it("renders sentiment cards with guidance direction tags", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText("Sentiment timeline")).toBeInTheDocument());
    expect(screen.getByText("raised")).toBeInTheDocument();
    expect(screen.getByText("maintained")).toBeInTheDocument();
    expect(
      screen.getByText(/Confident and positive outlook on ferry traffic/),
    ).toBeInTheDocument();
  });

  it("keeps quarterly sentiment visible when annual filings drive the trend chart", async () => {
    const quarterlyReport = {
      ...MOCK_REPORTS[0],
      id: "r3",
      fiscalYear: 2025,
      reportType: "q1",
      createdAt: "2025-05-01",
      extractedJsonSnapshot: {
        ...MOCK_REPORTS[0].extractedJsonSnapshot,
        metadata: { companyName: "Tallink Grupp", reportPeriod: "2025-03-31" },
        sentiment: {
          managementTone: "Quarterly demand improved on higher passenger volumes.",
          outlook: "Positive",
          riskFactors: [],
          guidanceDirection: "raised",
        },
      },
    };

    mockSuccessfulLoad([MOCK_REPORTS[1], MOCK_REPORTS[0], quarterlyReport]);
    render(<CompanyAnalyticsDashboardPage />);

    await waitFor(() => expect(screen.getByText("Sentiment timeline")).toBeInTheDocument());
    expect(
      screen.getByText(/Quarterly demand improved on higher passenger volumes/),
    ).toBeInTheDocument();
  });

  it("renders the reports table with checkboxes and supports Compare button toggle", async () => {
    mockSuccessfulLoad();
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText("Reports")).toBeInTheDocument());

    const table = screen.getByRole("table");
    expect(table).toHaveClass("w-full", "min-w-[720px]", "text-left");
    expect(table.parentElement).toHaveClass("inline-block", "min-w-full", "px-5", "py-2");
    expect(table.parentElement?.parentElement).toHaveClass(
      "-mx-5",
      "-my-2",
      "overflow-x-auto",
      "whitespace-nowrap",
    );

    const yearHeader = screen.getByRole("columnheader", { name: "Year" });
    expect(yearHeader).toHaveClass("whitespace-nowrap");
    expect(yearHeader.parentElement).not.toHaveClass("uppercase");

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].parentElement).toHaveClass("size-5", "sm:size-4");
    expect(checkboxes[0]).toHaveClass(
      "peer",
      "size-5",
      "appearance-none",
      "checked:bg-[#2b79db]",
      "sm:size-4",
    );
    expect(checkboxes[0]).toHaveAttribute("name", "selectedReports");
    expect(checkboxes[0]).toHaveAttribute("value", "r1");
    expect(checkboxes[0]).toHaveAccessibleName("Select report 2024 Annual");

    fireEvent.click(checkboxes[0]);
    expect(screen.queryByText("Compare Selected")).not.toBeInTheDocument();

    fireEvent.click(checkboxes[1]);
    expect(screen.getByRole("button", { name: /compare selected/i })).toHaveClass(
      "min-h-11",
      "sm:h-10",
    );
  });

  it("renders the empty state when the company has no reports", async () => {
    mockSuccessfulLoad([], { ...MOCK_COMPANY, reportCount: 0 });
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText(/No reports yet/)).toBeInTheDocument());
    const link = screen.getByText("Add First Report").closest("a");
    expect(link).toHaveAttribute("href", "/upload?company=tallink-grupp");
  });

  it("renders the company-not-found state for an unknown slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] }),
    );
    render(<CompanyAnalyticsDashboardPage />);
    await waitFor(() => expect(screen.getByText("Company not found")).toBeInTheDocument());
  });
});
