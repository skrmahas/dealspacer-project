export function formatRecentJobDate(createdAt: string | undefined): string {
  if (!createdAt) return "Date unavailable";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString();
}
