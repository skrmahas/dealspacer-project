import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminUnmatchedPage from "./page";

const UNMATCHED_REPORTS = [
  {
    id: "r1",
    companyId: null,
    fiscalYear: 2024,
    reportType: "annual",
    language: "en",
    jobId: null,
    s3Key: "reports/acme.pdf",
    extractedJsonSnapshot: {
      metadata: {
        companyName: "Acme Holdings",
        evidence: {
          companyName: {
            confidence: 0.82,
            chunkIndex: 1,
            snippet: "Annual report of Acme Holdings for the year ended 2024.",
          },
        },
      },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const COMPANIES = [
  {
    id: "c1",
    name: "Tallink Grupp",
    exchange: "Nasdaq Tallinn",
    slug: "tallink-grupp",
  },
];

describe("AdminUnmatchedPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/reports/unmatched") {
          return Promise.resolve({ ok: true, json: async () => UNMATCHED_REPORTS });
        }
        if (url === "/api/companies" && !init?.method) {
          return Promise.resolve({ ok: true, json: async () => COMPANIES });
        }
        if (url === "/api/companies/create") {
          return Promise.resolve({ ok: true, json: async () => ({ id: "c2" }) });
        }
        if (url === "/api/reports/r1/map") {
          return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
        }
        return Promise.resolve({ ok: false, json: async () => ({ error: "Unexpected request" }) });
      }),
    );
  });

  it("opens an accessible create form and maps the new company", async () => {
    render(<AdminUnmatchedPage />);

    expect(await screen.findByText("Acme Holdings")).toBeInTheDocument();
    expect(screen.getByText(/82% confidence · chunk 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual report of Acme Holdings/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /map/i }));
    fireEvent.click(screen.getByRole("button", { name: /create new company/i }));

    const nameInput = screen.getByLabelText("Name");
    const tickerInput = screen.getByLabelText("Ticker");
    const exchangeSelect = screen.getByLabelText("Exchange");
    const slugInput = screen.getByLabelText("Slug");

    expect(nameInput).toHaveAttribute("name", "companyName");
    expect(nameInput).toHaveAttribute("id", "create-company-r1-name");
    expect(nameInput.closest("label")).toHaveAttribute("for", "create-company-r1-name");
    expect(nameInput).toHaveAttribute("type", "text");
    expect(nameInput).toHaveClass("normal-case");
    expect(tickerInput).toHaveAttribute("name", "ticker");
    expect(tickerInput).toHaveAttribute("id", "create-company-r1-ticker");
    expect(tickerInput.closest("label")).toHaveAttribute("for", "create-company-r1-ticker");
    expect(exchangeSelect).toHaveAttribute("name", "exchange");
    expect(exchangeSelect).toHaveAttribute("id", "create-company-r1-exchange");
    expect(exchangeSelect.closest("label")).toHaveAttribute("for", "create-company-r1-exchange");
    expect(exchangeSelect).toHaveClass("normal-case");
    expect(exchangeSelect.parentElement).toHaveClass("inline-grid", "w-full", "grid-cols-[1fr_2rem]");
    expect(exchangeSelect.parentElement?.querySelector(".lucide-chevron-down")).toHaveClass(
      "size-4",
      "sm:size-3.5",
    );
    expect(slugInput).toHaveAttribute("name", "slug");
    expect(slugInput).toHaveAttribute("id", "create-company-r1-slug");
    expect(slugInput.closest("label")).toHaveAttribute("for", "create-company-r1-slug");
    expect(slugInput).toHaveClass("normal-case");
    expect(slugInput).toHaveValue("acme-holdings");

    fireEvent.change(nameInput, { target: { value: "Baltic Power" } });
    fireEvent.change(tickerInput, { target: { value: "BPOW" } });
    fireEvent.change(exchangeSelect, { target: { value: "Nasdaq Riga" } });

    await waitFor(() => expect(slugInput).toHaveValue("baltic-power"));

    fireEvent.click(screen.getByRole("button", { name: /create & map/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/companies/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Baltic Power",
            ticker: "BPOW",
            exchange: "Nasdaq Riga",
            slug: "baltic-power",
          }),
        }),
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/reports/r1/map",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ companyId: "c2" }),
      }),
    );
  });
});
