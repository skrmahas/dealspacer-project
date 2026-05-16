import { describe, expect, it } from "vitest";
import { formatRecentJobDate } from "./recent-jobs";

describe("formatRecentJobDate", () => {
  it("formats valid recent job dates with the user's locale", () => {
    const createdAt = "2026-05-16T08:00:00.000Z";

    expect(formatRecentJobDate(createdAt)).toBe(new Date(createdAt).toLocaleDateString());
  });

  it("uses stable fallback copy when the recent job date is missing or invalid", () => {
    expect(formatRecentJobDate(undefined)).toBe("Date unavailable");
    expect(formatRecentJobDate("not-a-date")).toBe("Date unavailable");
  });
});
