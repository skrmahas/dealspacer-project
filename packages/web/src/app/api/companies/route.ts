import { NextResponse } from "next/server";
import { createCompanyStore } from "@bei/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = createCompanyStore();
    const companies = await store.listCompanies();
    return NextResponse.json(companies);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
