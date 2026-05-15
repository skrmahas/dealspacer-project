// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`__REDIRECT__:${url}`);
  }),
}));

import { redirect } from "next/navigation";
import LegacyAppRedirectPage from "./page";

const redirectMock = redirect as unknown as ReturnType<typeof vi.fn>;

describe("legacy /app redirect", () => {
  it("redirects bare /app to /upload", () => {
    redirectMock.mockClear();
    expect(() => LegacyAppRedirectPage({})).toThrow(/__REDIRECT__:\/upload$/);
    expect(redirectMock).toHaveBeenCalledWith("/upload");
  });

  it("forwards search params to /upload", () => {
    redirectMock.mockClear();
    expect(() =>
      LegacyAppRedirectPage({ searchParams: { company: "tallink-grupp" } }),
    ).toThrow(/__REDIRECT__:\/upload\?company=tallink-grupp$/);
    expect(redirectMock).toHaveBeenCalledWith("/upload?company=tallink-grupp");
  });

  it("forwards array search params", () => {
    redirectMock.mockClear();
    expect(() =>
      LegacyAppRedirectPage({ searchParams: { tag: ["a", "b"] } }),
    ).toThrow(/__REDIRECT__:\/upload\?tag=a&tag=b$/);
  });
});
