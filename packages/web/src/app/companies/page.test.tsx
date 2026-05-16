import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CompanyCatalogPage from "./page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const MOCK_COMPANIES = [
  {
    id: "c1",
    name: "Tallink Grupp",
    ticker: "TAL1T",
    exchange: "Nasdaq Tallinn",
    slug: "tallink-grupp",
    country: "EE",
    sector: "Industrials",
    reportCount: 3,
  },
  {
    id: "c2",
    name: "Tallinna Vesi",
    ticker: "TVE1T",
    exchange: "Nasdaq Tallinn",
    slug: "tallinna-vesi",
    country: "EE",
    sector: "Utilities",
    reportCount: 2,
  },
  {
    id: "c3",
    name: "DelfinGroup",
    ticker: "DGR1R",
    exchange: "Nasdaq Riga",
    slug: "delfingroup",
    country: "LV",
    sector: "Financials",
    reportCount: 1,
  },
  {
    id: "c4",
    name: "Akola Group",
    ticker: "AKO1L",
    exchange: "Nasdaq Vilnius",
    slug: "akola-group",
    country: "LT",
    sector: "Consumer Staples",
    reportCount: 0,
  },
];

describe("CompanyCatalogPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/reports")) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => MOCK_COMPANIES,
        });
      }),
    );
  });

  it("renders the sidebar with search box, exchange filter pills, and bottom links", async () => {
    const { container } = render(<CompanyCatalogPage />);

    const search = await screen.findByRole("textbox", { name: /search companies/i });
    expect(search).toHaveAttribute("name", "companySearch");
    expect(search).toHaveClass("h-11", "text-base/6", "sm:h-10", "sm:text-sm/6");
    expect(container.querySelector(".lucide-search")).toHaveClass("size-4", "sm:size-3.5");

    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tallinn$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^riga$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^vilnius$/i })).toBeInTheDocument();

    const uploadLinks = screen.getAllByRole("link", { name: /upload/i });
    expect(uploadLinks.some((el) => el.getAttribute("href") === "/upload")).toBe(true);
    const accessLinks = screen.getAllByRole("link", { name: /access/i });
    expect(accessLinks.some((el) => el.getAttribute("href") === "/access")).toBe(true);

    const sidebarFooter = screen.getByText("Company directory").closest("aside");
    expect(sidebarFooter).not.toBeNull();
    const sidebarUpload = within(sidebarFooter!).getByRole("link", { name: /^upload$/i });
    const sidebarAccess = within(sidebarFooter!).getByRole("link", { name: /^access$/i });

    for (const action of [sidebarUpload, sidebarAccess]) {
      expect(action).toHaveClass("min-h-11", "px-2", "md:min-h-9", "md:px-0");
      expect(action.querySelector("svg")).toHaveClass("size-4", "md:size-3.5");
    }
  });

  it("groups companies by exchange with real report count badges from API", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    expect(screen.getByText("Tallink Grupp")).toBeInTheDocument();
    expect(screen.getByText("Tallinna Vesi")).toBeInTheDocument();
    expect(screen.getByText("DelfinGroup")).toBeInTheDocument();
    expect(screen.getByText("Akola Group")).toBeInTheDocument();

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    expect(screen.getByText(/tallinn \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/riga \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/vilnius \(1\)/i)).toBeInTheDocument();
  });

  it("filters companies by name in real time as user types in search", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const search = screen.getByPlaceholderText(/search companies/i);
    fireEvent.change(search, { target: { value: "tallink" } });

    expect(screen.getByText("Tallink Grupp")).toBeInTheDocument();
    expect(screen.queryByText("Tallinna Vesi")).not.toBeInTheDocument();
    expect(screen.queryByText("DelfinGroup")).not.toBeInTheDocument();
  });

  it("filters companies by ticker in real time", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const search = screen.getByPlaceholderText(/search companies/i);
    fireEvent.change(search, { target: { value: "DGR1R" } });

    expect(screen.getByText("DelfinGroup")).toBeInTheDocument();
    expect(screen.queryByText("Tallink Grupp")).not.toBeInTheDocument();
  });

  it("filters by exchange when a pill is clicked", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^riga$/i }));

    expect(screen.getByText("DelfinGroup")).toBeInTheDocument();
    expect(screen.queryByText("Tallink Grupp")).not.toBeInTheDocument();
    expect(screen.queryByText("Akola Group")).not.toBeInTheDocument();
  });

  it("each company links to /companies/:slug", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const link = screen.getByText("Tallink Grupp").closest("a");
    expect(link).toHaveAttribute("href", "/companies/tallink-grupp");
  });

  it("clicking the hamburger toggles the mobile sidebar drawer", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const hamburger = screen.getByRole("button", { name: /open menu/i });
    expect(hamburger).toHaveClass("size-11");
    expect(hamburger.querySelector("svg")).toHaveClass("size-5");

    fireEvent.click(hamburger);

    const closeButton = screen.getByRole("button", { name: /close menu/i });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveClass("size-11");
    expect(closeButton.querySelector("svg")).toHaveClass("size-5");
  });

  it("renders the welcome state in the main content area", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText(/select a company/i)).toBeInTheDocument());
  });

  it("shows catalog report count and cross-company compare panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/reports")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: "r1",
                companyId: "c1",
                companyName: "Tallink Grupp",
                fiscalYear: 2024,
                reportType: "annual",
                language: "en",
                jobId: null,
                s3Key: "a.pdf",
                extractedJsonSnapshot: null,
                createdAt: "2024-01-01",
              },
              {
                id: "r2",
                companyId: "c3",
                companyName: "DelfinGroup",
                fiscalYear: 2023,
                reportType: "annual",
                language: "en",
                jobId: null,
                s3Key: "b.pdf",
                extractedJsonSnapshot: null,
                createdAt: "2024-01-02",
              },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => MOCK_COMPANIES,
        });
      }),
    );

    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText(/reports in catalog/i)).toBeInTheDocument());

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText(/compare across companies/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compare reports/i })).toBeDisabled();

    const addReportCard = screen.getByText(/need to add a report/i).closest("div");
    expect(addReportCard).not.toBeNull();
    const uploadReportLink = within(addReportCard!).getByRole("link", {
      name: /upload a report/i,
    });
    const accessLink = within(addReportCard!).getByRole("link", { name: /^access$/i });

    for (const action of [uploadReportLink, accessLink]) {
      expect(action).toHaveClass("h-11", "px-4", "sm:h-10");
      expect(action.querySelector("svg")).toHaveClass("size-4", "sm:size-3.5");
    }
  });
});
