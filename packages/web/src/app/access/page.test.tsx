import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccessPage from "./page";
import { ACCESS_REQUEST_TIMEOUT_MS } from "@/lib/access-timeout";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "next" ? "/" : null),
  }),
}));

describe("AccessForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
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

    fireEvent.change(screen.getByPlaceholderText("Access code"), {
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
});
