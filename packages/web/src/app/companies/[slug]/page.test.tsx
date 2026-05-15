import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompanyDetailPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: vi.fn().mockReturnValue({ slug: "tallink-grupp" }),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

const MOCK_COMPANY = { id: "c1", name: "Tallink Grupp", ticker: "TAL1T", exchange: "Nasdaq Tallinn", slug: "tallink-grupp", country: "EE", sector: "Industrials", reportCount: 2 };
const MOCK_REPORTS = [
  { id: "r1", companyId: "c1", fiscalYear: 2024, reportType: "annual", language: "en", jobId: "j1", s3Key: "r1.pdf", previewRevenue: 500000000, previewEbitda: 120000000, previewNetProfit: 80000000, createdAt: "2025-03-15", companyName: "Tallink Grupp" },
  { id: "r2", companyId: "c1", fiscalYear: 2023, reportType: "q4", language: "en", jobId: "j2", s3Key: "r2.pdf", previewRevenue: 480000000, previewEbitda: 110000000, previewNetProfit: 75000000, createdAt: "2024-02-20", companyName: "Tallink Grupp" },
];

describe("CompanyDetailPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows company header with name, ticker, and exchange", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_COMPANY] })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_REPORTS }));
    render(<CompanyDetailPage />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());
    expect(screen.getByText("TAL1T")).toBeInTheDocument();
    expect(screen.getByText("Nasdaq Tallinn")).toBeInTheDocument();
    expect(screen.getByText("2 reports")).toBeInTheDocument();
  });

  it("shows report rows with inline metric previews", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_COMPANY] })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_REPORTS }));
    render(<CompanyDetailPage />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());
    expect(screen.getByText("€500M")).toBeInTheDocument();
    expect(screen.getByText("€120M")).toBeInTheDocument();
    expect(screen.getByText("€80M")).toBeInTheDocument();
  });

  it("checkbox selection allows max 2 and shows Compare button", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_COMPANY] })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_REPORTS }));
    render(<CompanyDetailPage />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);

    // Select first
    fireEvent.click(checkboxes[0]);
    expect(screen.queryByText("Compare Selected")).not.toBeInTheDocument();

    // Select second
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("Compare Selected")).toBeInTheDocument();

    // Click third (wraps — oldest unselected)
    fireEvent.click(checkboxes[0]);
    // Now only r2 is selected
    expect(screen.queryByText("Compare Selected")).not.toBeInTheDocument();
  });

  it("shows 'Add Report' button linking to /app?company={slug}", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [MOCK_COMPANY] })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_REPORTS }));
    render(<CompanyDetailPage />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());
    const link = screen.getAllByText("Add Report")[0].closest("a");
    expect(link).toHaveAttribute("href", "/app?company=tallink-grupp");
  });

  it("shows empty state when no reports", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...MOCK_COMPANY, reportCount: 0 }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }));
    render(<CompanyDetailPage />);
    await waitFor(() => expect(screen.getByText(/No reports yet/)).toBeInTheDocument());
  });

  it("shows 404 when company not found", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }));
    render(<CompanyDetailPage />);
    await waitFor(() => expect(screen.getByText("Company not found")).toBeInTheDocument());
  });
});
