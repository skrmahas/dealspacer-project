import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { createPostgresStore, createReportStore } from "@bei/shared";

vi.mock("@bei/shared", () => ({
  createPostgresStore: vi.fn(),
  createReportStore: vi.fn(),
}));

const snapshot = {
  metadata: { companyName: "Tallink Grupp", reportPeriod: "FY 2025", sourceLanguage: "en" },
  metrics: [],
  narratives: [],
  sentiment: { managementTone: "", outlook: "", riskFactors: [] },
};

describe("POST /api/jobs/:id/replace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending review candidate instead of replacing the public report", async () => {
    const updateJob = vi.fn();
    const replaceReport = vi.fn();
    const createReportRerunCandidate = vi.fn().mockResolvedValue({
      id: "candidate-1",
      status: "pending_review",
    });
    vi.mocked(createPostgresStore).mockReturnValue({
      getJob: vi.fn().mockResolvedValue({
        id: "job-1",
        state: "duplicate",
        outputLanguage: "en",
        companyId: "company-1",
        extractedJson: JSON.stringify(snapshot),
      }),
      updateJob,
    } as any);
    vi.mocked(createReportStore).mockReturnValue({
      getReportByMatch: vi.fn().mockResolvedValue({ id: "report-1" }),
      createReportRerunCandidate,
      replaceReport,
    } as any);

    const response = await POST(
      new Request("http://localhost/api/jobs/job-1/replace") as any,
      { params: Promise.resolve({ id: "job-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      replaced: false,
      candidateId: "candidate-1",
      reportId: "report-1",
      reviewUrl: "/admin/report-reruns?candidate=candidate-1",
      status: "pending_review",
    });
    expect(createReportRerunCandidate).toHaveBeenCalledWith(expect.objectContaining({
      reportId: "report-1",
      jobId: "job-1",
      status: "pending_review",
    }));
    expect(replaceReport).not.toHaveBeenCalled();
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("quarantines failed-quality reruns with their warnings", async () => {
    const createReportRerunCandidate = vi.fn().mockResolvedValue({
      id: "candidate-2",
      status: "failed_quality",
    });
    vi.mocked(createPostgresStore).mockReturnValue({
      getJob: vi.fn().mockResolvedValue({
        id: "job-2",
        state: "failed",
        outputLanguage: "en",
        companyId: "company-1",
        extractedJson: JSON.stringify({
          ...snapshot,
          qualityWarnings: ["Report sanity check failed"],
        }),
      }),
    } as any);
    vi.mocked(createReportStore).mockReturnValue({
      getReportByMatch: vi.fn().mockResolvedValue({ id: "report-1" }),
      createReportRerunCandidate,
    } as any);

    const response = await POST(
      new Request("http://localhost/api/jobs/job-2/replace") as any,
      { params: Promise.resolve({ id: "job-2" }) },
    );

    expect(response.status).toBe(200);
    expect(createReportRerunCandidate).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed_quality",
      qualityWarnings: ["Report sanity check failed"],
    }));
  });

  it("uses the duplicate error company id when the job has no selected company context", async () => {
    const getReportByMatch = vi.fn().mockResolvedValue({ id: "amber-report" });
    const createReportRerunCandidate = vi.fn().mockResolvedValue({
      id: "candidate-amber",
      status: "pending_review",
    });
    vi.mocked(createPostgresStore).mockReturnValue({
      getJob: vi.fn().mockResolvedValue({
        id: "job-amber",
        state: "duplicate",
        outputLanguage: "en",
        companyId: null,
        error: "Duplicate report: company=e972dd7e-20d3-4570-99d2-17db426c79d5, year=2024, type=annual, lang=en",
        extractedJson: JSON.stringify({
          ...snapshot,
          metadata: { ...snapshot.metadata, companyName: "AS Amber Latvijas balzams", reportPeriod: "FY 2024" },
        }),
      }),
    } as any);
    vi.mocked(createReportStore).mockReturnValue({
      getReportByMatch,
      createReportRerunCandidate,
    } as any);

    const response = await POST(
      new Request("http://localhost/api/jobs/job-amber/replace") as any,
      { params: Promise.resolve({ id: "job-amber" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getReportByMatch).toHaveBeenCalledWith(
      "e972dd7e-20d3-4570-99d2-17db426c79d5",
      2024,
      "annual",
      "en",
    );
    expect(body).toMatchObject({
      candidateId: "candidate-amber",
      reportId: "amber-report",
      reviewUrl: "/admin/report-reruns?candidate=candidate-amber",
    });
  });
});
