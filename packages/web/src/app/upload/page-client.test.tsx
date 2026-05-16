import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "./page-client";
import { uploadFileWithProgress } from "@/lib/upload-progress";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/upload-progress", () => ({
  uploadFileWithProgress: vi.fn(),
}));

describe("Upload workspace", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.unstubAllGlobals();
  });

  it("announces the active pipeline state with user-facing progress copy", async () => {
    vi.mocked(uploadFileWithProgress).mockResolvedValue({
      jobId: "job-1",
      state: "extracting",
    });

    render(<Home initialCompanySlug={null} />);

    const input = screen.getByLabelText("Upload document");
    expect(input).toHaveAttribute("name", "document");
    expect(screen.getByRole("button", { name: "Choose file" })).toHaveClass(
      "min-h-11",
      "sm:min-h-9",
    );
    expect(screen.getByText("No file chosen yet")).toHaveClass(
      "text-base/6",
      "sm:text-[11px]",
    );

    const file = new File(["revenue,ebitda"], "report.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Start pipeline" }));

    await waitFor(() => {
      expect(uploadFileWithProgress).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Extracting");
    expect(screen.getByText("Extracting financial data and narrative signals.")).toBeInTheDocument();
    expect(screen.queryByText(/GPT-4o/)).not.toBeInTheDocument();
  });
});
