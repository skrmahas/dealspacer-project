import { NextRequest, NextResponse } from "next/server";
import type { ExtractedData, ReportType, OutputLanguage } from "@bei/shared";
import { createPostgresStore, createReportStore } from "@bei/shared";

function extractDuplicateCompanyId(error: string | null): string | null {
  return error?.match(/Duplicate report: company=([0-9a-f-]{36})/i)?.[1] ?? null;
}

function parseReportPeriod(reportPeriod: string): { fiscalYear: number; reportType: ReportType } | null {
  const s = reportPeriod.trim();

  const qMatch = s.match(/^Q([1-4])\s*(\d{4})$/i);
  if (qMatch) return { fiscalYear: parseInt(qMatch[2]!, 10), reportType: `q${qMatch[1]!.toLowerCase()}` as ReportType };

  const qAlone = s.match(/^Q([1-4])$/i);
  if (qAlone) return { fiscalYear: new Date().getFullYear(), reportType: `q${qAlone[1]!.toLowerCase()}` as ReportType };

  const fyMatch = s.match(/^FY\s*(\d{4})$/i);
  if (fyMatch) return { fiscalYear: parseInt(fyMatch[1]!, 10), reportType: "annual" };

  const yearAnnual = s.match(/^(\d{4})\s*(annual|report)/i);
  if (yearAnnual) return { fiscalYear: parseInt(yearAnnual[1]!, 10), reportType: "annual" };

  const hMatch = s.match(/^H([12])\s*(\d{4})$/i);
  if (hMatch) return { fiscalYear: parseInt(hMatch[2]!, 10), reportType: "semi-annual" };

  const mMatch = s.match(/^(\d{1,2})M\s*(\d{4})$/i);
  if (mMatch) {
    const months = parseInt(mMatch[1]!, 10);
    return { fiscalYear: parseInt(mMatch[2]!, 10), reportType: months === 3 ? "q1" : months === 6 ? "semi-annual" : months === 9 ? "q3" : "other" };
  }

  const dateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10);
    const day = parseInt(dateMatch[3]!, 10);
    if (month === 12 && day === 31) return { fiscalYear: year, reportType: "annual" };
    if (month === 3 && day === 31) return { fiscalYear: year, reportType: "q1" };
    if (month === 6 && day === 30) return { fiscalYear: year, reportType: "q2" };
    if (month === 9 && day === 30) return { fiscalYear: year, reportType: "q3" };
    return { fiscalYear: year, reportType: "other" };
  }

  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return { fiscalYear: parseInt(yearOnly[1]!, 10), reportType: "annual" };

  return null;
}

function isValidLanguage(lang: string): lang is OutputLanguage {
  return lang === "en" || lang === "et" || lang === "lv" || lang === "lt";
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const jobStore = createPostgresStore();
    const job = await jobStore.getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.state !== "duplicate" && job.state !== "complete" && job.state !== "failed") {
      return NextResponse.json({ error: "Only completed, duplicate, or failed jobs can be queued for replacement review" }, { status: 409 });
    }

    let parsed: ExtractedData & { qualityWarnings?: unknown };
    try {
      parsed = job.extractedJson ? JSON.parse(job.extractedJson) : null;
    } catch {
      return NextResponse.json({ error: "No extraction data found" }, { status: 400 });
    }

    if (!parsed?.metadata?.companyName || !parsed?.metadata?.reportPeriod) {
      return NextResponse.json({ error: "Missing company name or report period in extraction data" }, { status: 400 });
    }

    const period = parseReportPeriod(parsed.metadata.reportPeriod);
    if (!period) {
      return NextResponse.json({ error: `Unparseable report period: "${parsed.metadata.reportPeriod}"` }, { status: 400 });
    }

    const language = job.outputLanguage;
    if (!isValidLanguage(language)) {
      return NextResponse.json({ error: `Invalid output language: "${language}"` }, { status: 400 });
    }

    const reportStore = createReportStore();
    const companyId = job.companyId ?? extractDuplicateCompanyId(job.error);

    // Find existing report matching company + fiscal year + report type + language
    const existingReport = await reportStore.getReportByMatch(companyId, period.fiscalYear, period.reportType, language);
    if (!existingReport) {
      return NextResponse.json({ replaced: false, message: "No existing report to replace" }, { status: 404 });
    }

    const qualityWarnings = Array.isArray(parsed.qualityWarnings)
      ? parsed.qualityWarnings.filter((warning): warning is string => typeof warning === "string")
      : [];
    const candidate = await reportStore.createReportRerunCandidate({
      reportId: existingReport.id,
      jobId: id,
      s3Key: `reports/${id}.pdf`,
      extractedJsonSnapshot: parsed,
      status: job.state === "failed" || qualityWarnings.length > 0 ? "failed_quality" : "pending_review",
      qualityWarnings,
    });

    return NextResponse.json({
      replaced: false,
      candidateId: candidate.id,
      reportId: existingReport.id,
      reviewUrl: `/admin/report-reruns?candidate=${candidate.id}`,
      status: candidate.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
