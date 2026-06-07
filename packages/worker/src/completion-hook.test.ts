import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyStore, ExtractedData, Job, ReportStore } from "@bei/shared";
import { DuplicateReportError, createCompanyStore, createReportStore } from "@bei/shared";
import { matchCompany, parseReportPeriod, pickBestMatch } from "./company-matcher.js";
import { onJobComplete } from "./completion-hook.js";

vi.mock("@bei/shared", async () => {
  const actual = await vi.importActual<typeof import("@bei/shared")>("@bei/shared");
  return {
    ...actual,
    createCompanyStore: vi.fn(),
    createReportStore: vi.fn(),
  };
});

vi.mock("./company-matcher.js", () => ({
  matchCompany: vi.fn(),
  parseReportPeriod: vi.fn(),
  pickBestMatch: vi.fn(),
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
    vi.mocked(createCompanyStore).mockReturnValue({
      listCompanies: vi.fn().mockResolvedValue([
        {
          id: "company-123",
          name: "AS Tallink Grupp",
          ticker: "TAL1T",
          exchange: "Nasdaq Tallinn",
          slug: "tallink-grupp",
          country: "EE",
          sector: "Consumer Discretionary",
          reportCount: 0,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ]),
    } as unknown as CompanyStore);
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

  it("creates a report row with selected company when upload context matches extracted company", async () => {
    const createReport = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createReportStore).mockReturnValue({ createReport } as unknown as ReportStore);
    vi.mocked(pickBestMatch).mockReturnValue({ companyId: "company-123", confidence: 0.99 });
    vi.mocked(parseReportPeriod).mockReturnValue({ fiscalYear: 2024, reportType: "annual" });

    const store = {
      updateJob: vi.fn(),
      getJob: vi.fn(),
    };

    await onJobComplete(makeJob({ companyId: "company-123" }), makeData(), store);

    expect(matchCompany).not.toHaveBeenCalled();
    expect(pickBestMatch).toHaveBeenCalledWith("Tallink Grupp", [
      expect.objectContaining({ id: "company-123", name: "AS Tallink Grupp" }),
    ]);
    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-123" }),
    );
    expect(store.updateJob).not.toHaveBeenCalled();
  });

  it("routes selected-company conflicts to unmatched report review", async () => {
    const createReport = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createReportStore).mockReturnValue({ createReport } as unknown as ReportStore);
    vi.mocked(pickBestMatch).mockReturnValue(null);
    vi.mocked(parseReportPeriod).mockReturnValue({ fiscalYear: 2024, reportType: "annual" });

    const store = {
      updateJob: vi.fn().mockResolvedValue(undefined),
      getJob: vi.fn(),
    };
    const data = makeData({
      metadata: {
        companyName: 'UAB "Orkela"',
        reportPeriod: "2024",
        sourceLanguage: "lt",
      },
    });

    await onJobComplete(makeJob({ companyId: "company-123" }), data, store);

    expect(matchCompany).not.toHaveBeenCalled();
    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: null,
        extractedJsonSnapshot: data,
      }),
    );
    expect(store.updateJob).toHaveBeenCalledWith("job-1", {
      error: 'Selected company "AS Tallink Grupp" conflicts with extracted company "UAB "Orkela""; creating unmatched report for admin review.',
    });
  });

  it("routes missing selected-company ids to unmatched report review", async () => {
    const createReport = vi.fn().mockResolvedValue(undefined);
    vi.mocked(createReportStore).mockReturnValue({ createReport } as unknown as ReportStore);
    vi.mocked(createCompanyStore).mockReturnValue({
      listCompanies: vi.fn().mockResolvedValue([]),
    } as unknown as CompanyStore);
    vi.mocked(parseReportPeriod).mockReturnValue({ fiscalYear: 2024, reportType: "annual" });

    const store = {
      updateJob: vi.fn().mockResolvedValue(undefined),
      getJob: vi.fn(),
    };

    await onJobComplete(makeJob({ companyId: "missing-company" }), makeData(), store);

    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: null }),
    );
    expect(store.updateJob).toHaveBeenCalledWith("job-1", {
      error: 'Selected company missing-company was not found; creating unmatched report for extracted company "Tallink Grupp".',
    });
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
