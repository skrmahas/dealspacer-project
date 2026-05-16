import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetReportById, mockGetReportByJobId, mockReadReport } = vi.hoisted(() => ({
  mockGetReportById: vi.fn(),
  mockGetReportByJobId: vi.fn(),
  mockReadReport: vi.fn(),
}));

vi.mock("@bei/shared", () => ({
  createReportStore: vi.fn(() => ({
    getReportById: mockGetReportById,
    getReportByJobId: mockGetReportByJobId,
  })),
  createAutoFileStore: vi.fn(() => ({
    readReport: mockReadReport,
  })),
}));

import { GET } from "./route";

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    companyId: "company-1",
    fiscalYear: 2024,
    reportType: "annual",
    language: "en",
    jobId: "job-1",
    s3Key: "reports/job-1.pdf",
    extractedJsonSnapshot: null,
    createdAt: "2024-01-01",
    ...overrides,
  };
}

describe("GET /api/reports/:id/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadReport.mockResolvedValue(Buffer.from("%PDF-1.4"));
  });

  it("downloads a report resolved by report id", async () => {
    mockGetReportById.mockResolvedValue(makeReport());

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "report-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(mockReadReport).toHaveBeenCalledWith("job-1");
    expect(mockGetReportByJobId).not.toHaveBeenCalled();
  });

  it("downloads a report resolved by legacy job id", async () => {
    mockGetReportById.mockResolvedValue(null);
    mockGetReportByJobId.mockResolvedValue(makeReport());

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(mockGetReportByJobId).toHaveBeenCalledWith("job-1");
    expect(mockReadReport).toHaveBeenCalledWith("job-1");
  });

  it("returns 404 when neither report id nor job id matches", async () => {
    mockGetReportById.mockResolvedValue(null);
    mockGetReportByJobId.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "missing" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
    expect(mockReadReport).not.toHaveBeenCalled();
  });
});
