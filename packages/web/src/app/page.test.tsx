import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import LandingPage from "./landing-page";

describe("LandingPage", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders top navigation and hero CTAs linking to catalog and upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [],
      }),
    );

    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: "Baltic Earnings Intelligence" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute("href", "/companies");
    expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute("href", "/upload");

    const browseLinks = screen.getAllByRole("link", { name: "Browse the Catalog" });
    expect(browseLinks[0]).toHaveAttribute("href", "/companies");
    const uploadReportLinks = screen.getAllByRole("link", { name: "Upload a Report" });
    expect(uploadReportLinks[0]).toHaveAttribute("href", "/upload");
  });

  it("loads live stats from /api/companies", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/companies")) {
        return {
          json: async () => [
            { id: "1", reportCount: 4 },
            { id: "2", reportCount: 7 },
            { id: "3", reportCount: 2 },
          ],
        } as Response;
      }
      return { json: async () => [] } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<LandingPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/companies");
      expect(fetchMock).not.toHaveBeenCalledWith("/api/reports");
    });

    expect(screen.getByLabelText("3 Companies tracked")).toBeInTheDocument();
    expect(screen.getByLabelText("13 Reports processed")).toBeInTheDocument();
    expect(screen.getAllByText("Exchanges")[0]).toBeInTheDocument();
    expect(screen.getByText("Languages supported")).toBeInTheDocument();
  });

  it("renders marketing sections and footer links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [],
      }),
    );

    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();

    expect(screen.getByText("Tallinn")).toBeInTheDocument();
    expect(screen.getByText("Riga")).toBeInTheDocument();
    expect(screen.getByText("Vilnius")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Access" })).toHaveAttribute("href", "/access");
  });
});
