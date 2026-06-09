import { NextRequest, NextResponse } from "next/server";
import { createCompanyStore, createReportStore } from "@bei/shared";

function decodeRouteSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: routeSlug } = await params;
    const slug = decodeRouteSlug(routeSlug);
    const company = await createCompanyStore().getCompanyBySlug(slug);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    const reports = await createReportStore().listReportsByCompany(company.id);
    return NextResponse.json(reports);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
