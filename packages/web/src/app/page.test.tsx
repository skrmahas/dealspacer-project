import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import CompanyDirectory from "./page";

const MOCK_COMPANIES = [
  { id: "1", name: "Tallink Grupp", ticker: "TAL1T", exchange: "Nasdaq Tallinn", slug: "tallink-grupp", country: "EE", sector: "Industrials", reportCount: 3 },
  { id: "2", name: "LHV Group", ticker: "LHV1T", exchange: "Nasdaq Tallinn", slug: "lhv-group", country: "EE", sector: "Financials", reportCount: 0 },
  { id: "3", name: "Olainfarm", ticker: "OLF1R", exchange: "Nasdaq Riga", slug: "olainfarm", country: "LV", sector: "Health Care", reportCount: 1 },
];

describe("CompanyDirectory", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders welcome state and company count after loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
    expect(screen.getByText(/3 companies tracked/)).toBeInTheDocument();
    expect(screen.getByText("Upload a Report")).toBeInTheDocument();
  });

  it("shows company names in sidebar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());
    expect(screen.getByText("LHV Group")).toBeInTheDocument();
    expect(screen.getByText("Olainfarm")).toBeInTheDocument();
  });

  it("shows ticker and report count badge", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.getByText("TAL1T")).toBeInTheDocument());
    expect(screen.getByText("3")).toBeInTheDocument(); // Tallink report count
  });

  it("filters companies by search", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText("Search companies...");
    fireEvent.change(searchInput, { target: { value: "olain" } });

    expect(screen.queryByText("Tallink Grupp")).not.toBeInTheDocument();
    expect(screen.getByText("Olainfarm")).toBeInTheDocument();
  });

  it("filters by exchange tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    // Click "Riga" tab
    const rigaTab = screen.getByText("Riga");
    fireEvent.click(rigaTab);

    expect(screen.queryByText("Tallink Grupp")).not.toBeInTheDocument();
    expect(screen.getByText("Olainfarm")).toBeInTheDocument();
  });

  it("each company links to /companies/:slug", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const link = screen.getByText("Tallink Grupp").closest("a");
    expect(link).toHaveAttribute("href", "/companies/tallink-grupp");
  });

  it("shows no companies found when search has no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => MOCK_COMPANIES }));
    render(<CompanyDirectory />);
    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Search companies..."), {
      target: { value: "zzz-nomatch" },
    });
    expect(screen.getByText("No companies found")).toBeInTheDocument();
  });
});
