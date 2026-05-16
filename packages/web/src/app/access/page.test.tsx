import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AccessPage from "./page";
import { ACCESS_REQUEST_TIMEOUT_MS } from "@/lib/access-timeout";

const pushMock = vi.fn();
const refreshMock = vi.fn();
let nextParamValue: string | null = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "next" ? nextParamValue : null),
  }),
}));

vi.mock("@/components/deal-spacer-logo", () => ({
  DealSpacerLogoLink: () => React.createElement("a", { href: "/" }, "DealSpacer"),
}));

describe("AccessForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockReset();
    refreshMock.mockReset();
    nextParamValue = "/";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows timeout message when access request does not respond", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;

        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      })
    ));

    vi.stubGlobal("fetch", fetchMock);

    render(<AccessPage />);

    const accessCode = screen.getByLabelText("Access code");
    expect(accessCode).toHaveAttribute("name", "accessCode");
    expect(accessCode).toHaveClass("text-base/6", "sm:text-[15px]");

    fireEvent.change(accessCode, {
      target: { value: "some-code" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Access" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(ACCESS_REQUEST_TIMEOUT_MS + 1);
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByText("Request timed out. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock Access" })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("defaults to /app when next query param is missing", async () => {
    nextParamValue = null;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, next: "/app" }),
    });
    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    render(<AccessPage />);

    fireEvent.change(screen.getByPlaceholderText("Access code"), {
      target: { value: "some-code" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Access" }));

    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toContain("\"next\":\"/app\"");
    expect(pushMock).toHaveBeenCalledWith("/app");
    expect(refreshMock).toHaveBeenCalled();
  });
});
