import { NextResponse } from "next/server";
import { createCompanyStore, createReportStore } from "@bei/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [companies, reports] = await Promise.all([
      createCompanyStore().countCompanies(),
      createReportStore().countProcessedReports(),
    ]);

    return NextResponse.json({
      companies,
      reports,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "DATABASE_URL environment variable is required") {
      return NextResponse.json({ companies: 0, reports: 0 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
