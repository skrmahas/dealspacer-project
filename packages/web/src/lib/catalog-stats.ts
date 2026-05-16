/** When catalog report count reaches this threshold, show "70+" in marketing stats. */
export const CATALOG_REPORT_DISPLAY_CAP = 70;

export function formatCatalogReportCount(count: number): string {
  if (count >= CATALOG_REPORT_DISPLAY_CAP) {
    return `${CATALOG_REPORT_DISPLAY_CAP}+`;
  }
  return String(count);
}
