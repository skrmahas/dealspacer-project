import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedData, Job, ReportStore } from "@bei/shared";
import { DuplicateReportError, createReportStore } from "@bei/shared";
import { matchCompany, parseReportPeriod } from "./company-matcher.js";
import { onJobComplete } from "./completion-hook.js";

vi.mock("@bei/shared", async () => {
  const actual = await vi.importActual<typeof import("@bei/shared")>("@bei/shared");
  return {
    ...actual,
    createReportStore: vi.fn(),
  };
});

vi.mock("./company-matcher.js", () => ({
  matchCompany: vi.fn(),
  parseReportPeriod: vi.fn(),
}));

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    state: "complete",
    originalFilename: "report.pdf",
    outputLanguage: "en",
    extractedText: null,
    extractedJson: null,
    error: null,
    companyId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeData(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    metadata: {
      companyName: "Tallink Grupp",
      reportPeriod: "2024",
      sourceLanguage: "en",
    },
    metrics: [{ label: "Revenue", value: 100, unit: "EUR" }],
    narratives: [{ section: "executive_summary", text: "Strong year." }],
    sentiment: { managementTone: "positive", outlook: "Good", riskFactors: [] },
    ...overrides,
  };
}

describe("onJobComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a report row with matched company when upload has no company context", async () => {
    const createReport = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createReportStore).mockReturnValue({ createReport } as unknown as ReportStore);
    vi.mocked(matchCompany).mockResolvedValue({ companyId: "company-123", confidence: 0.91 });
    vi.mocked(parseReportPeriod).mockReturnValue({ fiscalYear: 2024, reportType: "annual" });

    const store = {
      updateJob: vi.fn(),
      getJob: vi.fn(),
    };

    const job = makeJob();
    const data = makeData();

    await onJobComplete(job, data, store);

    expect(matchCompany).toHaveBeenCalledWith("Tallink Grupp");
    expect(createReport).toHaveBeenCalledWith({
      companyId: "company-123",
      fiscalYear: 2024,
      reportType: "annual",
      language: "en",
      jobId: "job-1",
      s3Key: "reports/job-1.pdf",
      extractedJsonSnapshot: data,
    });
    expect(store.updateJob).not.toHaveBeenCalled();
  });

  it("creates unmatched reports with company_id = null when no company is matched", async () => {
    const createReport = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createReportStore).mockReturnValue({ createReport } as unknown as ReportStore);
    vi.mocked(matchCompany).mockResolvedValue(null);
    vi.mocked(parseReportPeriod).mockReturnValue({ fiscalYear: 2024, reportType: "annual" });

    const store = {
      updateJob: vi.fn(),
      getJob: vi.fn(),
    };

    await onJobComplete(makeJob(), makeData(), store);

    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: null }),
    );
    expect(store.updateJob).not.toHaveBeenCalled();
  });

  it("marks the job as duplicate when report creation hits a duplicate", async () => {
    const createReport = vi.fn().mockRejectedValue(new DuplicateReportError("already exists"));
    vi.mocked(createReportStore).mockReturnValue({ createReport } as unknown as ReportStore);
    vi.mocked(matchCompany).mockResolvedValue({ companyId: "company-123", confidence: 0.91 });
    vi.mocked(parseReportPeriod).mockReturnValue({ fiscalYear: 2024, reportType: "annual" });

    const store = {
      updateJob: vi.fn().mockResolvedValue(undefined),
      getJob: vi.fn(),
    };

    await onJobComplete(makeJob(), makeData(), store);

    expect(store.updateJob).toHaveBeenCalledWith("job-1", {
      state: "duplicate",
      error: "already exists",
    });
  });
});
