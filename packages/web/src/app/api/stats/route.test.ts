// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { countCompanies, countProcessedReports } = vi.hoisted(() => ({
  countCompanies: vi.fn(),
  countProcessedReports: vi.fn(),
}));

vi.mock("@bei/shared", () => ({
  createCompanyStore: vi.fn(() => ({ countCompanies })),
  createReportStore: vi.fn(() => ({ countProcessedReports })),
}));

import { GET } from "./route";

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countCompanies.mockResolvedValue(3);
    countProcessedReports.mockResolvedValue(15);
  });

  it("returns public aggregate counts without exposing report rows", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ companies: 3, reports: 15 });
    expect(payload).not.toHaveProperty("unmatchedReports");
    expect(payload).not.toHaveProperty("reportsList");
    expect(countCompanies).toHaveBeenCalledTimes(1);
    expect(countProcessedReports).toHaveBeenCalledTimes(1);
  });

  it("returns zero counts when stores are empty", async () => {
    countCompanies.mockResolvedValue(0);
    countProcessedReports.mockResolvedValue(0);

    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({ companies: 0, reports: 0 });
  });
});
