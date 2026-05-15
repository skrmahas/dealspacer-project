import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges and resolves conflicting Tailwind classes", () => {
    const classes = cn("px-2", "px-4", "font-medium", "text-sm");

    expect(classes).toContain("px-4");
    expect(classes).not.toContain("px-2");
    expect(classes).toContain("font-medium");
    expect(classes).toContain("text-sm");
  });
});
