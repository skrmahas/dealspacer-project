import { NextRequest, NextResponse } from "next/server";
import { createCompanyStore } from "@bei/shared";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ticker, exchange, slug } = body;
    if (!name || !exchange || !slug) {
      return NextResponse.json({ error: "name, exchange, and slug are required" }, { status: 400 });
    }
    const company = await createCompanyStore().createCompany({ name, exchange, slug, ticker: ticker || null });
    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
