import { describe, expect, it } from "vitest";
import { formatCatalogReportCount } from "./catalog-stats";

describe("formatCatalogReportCount", () => {
  it("returns the exact count below the cap", () => {
    expect(formatCatalogReportCount(0)).toBe("0");
    expect(formatCatalogReportCount(52)).toBe("52");
    expect(formatCatalogReportCount(69)).toBe("69");
  });

  it('returns "70+" at and above the cap', () => {
    expect(formatCatalogReportCount(70)).toBe("70+");
    expect(formatCatalogReportCount(120)).toBe("70+");
  });
});
