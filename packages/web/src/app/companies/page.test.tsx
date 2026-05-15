import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompanyCatalogPage from "./page";

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
    ticker: "TVEAT",
    exchange: "Nasdaq Tallinn",
    slug: "tallinna-vesi",
    country: "EE",
    sector: "Utilities",
    reportCount: 2,
  },
  {
    id: "c3",
    name: "Latvijas Gāze",
    ticker: "GZE1R",
    exchange: "Nasdaq Riga",
    slug: "latvijas-gaze",
    country: "LV",
    sector: "Utilities",
    reportCount: 1,
  },
  {
    id: "c4",
    name: "Šiaulių Bankas",
    ticker: "SAB1L",
    exchange: "Nasdaq Vilnius",
    slug: "siauliu-bankas",
    country: "LT",
    sector: "Financials",
    reportCount: 0,
  },
];

describe("CompanyCatalogPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_COMPANIES,
      }),
    );
  });

  it("renders the sidebar with search box, exchange filter pills, and bottom links", async () => {
    render(<CompanyCatalogPage />);

    expect(await screen.findByPlaceholderText(/search companies/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tallinn$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^riga$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^vilnius$/i })).toBeInTheDocument();

    const uploadLinks = screen.getAllByRole("link", { name: /upload/i });
    expect(uploadLinks.some((el) => el.getAttribute("href") === "/upload")).toBe(true);
    const accessLinks = screen.getAllByRole("link", { name: /access/i });
    expect(accessLinks.some((el) => el.getAttribute("href") === "/access")).toBe(true);
  });

  it("groups companies by exchange with real report count badges from API", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    expect(screen.getByText("Tallink Grupp")).toBeInTheDocument();
    expect(screen.getByText("Tallinna Vesi")).toBeInTheDocument();
    expect(screen.getByText("Latvijas Gāze")).toBeInTheDocument();
    expect(screen.getByText("Šiaulių Bankas")).toBeInTheDocument();

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
    expect(screen.queryByText("Latvijas Gāze")).not.toBeInTheDocument();
  });

  it("filters companies by ticker in real time", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    const search = screen.getByPlaceholderText(/search companies/i);
    fireEvent.change(search, { target: { value: "GZE1R" } });

    expect(screen.getByText("Latvijas Gāze")).toBeInTheDocument();
    expect(screen.queryByText("Tallink Grupp")).not.toBeInTheDocument();
  });

  it("filters by exchange when a pill is clicked", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText("Tallink Grupp")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^riga$/i }));

    expect(screen.getByText("Latvijas Gāze")).toBeInTheDocument();
    expect(screen.queryByText("Tallink Grupp")).not.toBeInTheDocument();
    expect(screen.queryByText("Šiaulių Bankas")).not.toBeInTheDocument();
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
    fireEvent.click(hamburger);

    expect(screen.getByRole("button", { name: /close menu/i })).toBeInTheDocument();
  });

  it("renders the welcome state in the main content area", async () => {
    render(<CompanyCatalogPage />);

    await waitFor(() => expect(screen.getByText(/select a company/i)).toBeInTheDocument());
  });
});
