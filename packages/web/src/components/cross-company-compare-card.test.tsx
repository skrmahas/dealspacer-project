import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CrossCompanyCompareCard } from "./cross-company-compare-card";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const REPORTS = [
  {
    id: "r1",
    companyId: "c1",
    companyName: "Tallink Grupp",
    fiscalYear: 2024,
    reportType: "annual",
    language: "en",
    jobId: null,
    s3Key: "a.pdf",
    extractedJsonSnapshot: null,
    createdAt: "2024-01-01",
  },
  {
    id: "r2",
    companyId: "c2",
    companyName: "DelfinGroup",
    fiscalYear: 2023,
    reportType: "annual",
    language: "en",
    jobId: null,
    s3Key: "b.pdf",
    extractedJsonSnapshot: null,
    createdAt: "2024-01-02",
  },
];

describe("CrossCompanyCompareCard", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => REPORTS,
      }),
    );
  });

  it("uses accessible, mobile-safe form controls and navigates to compare", async () => {
    const { container } = render(<CrossCompanyCompareCard />);

    const filter = await screen.findByRole("textbox", { name: "Filter reports" });
    expect(filter).toHaveAttribute("name", "reportFilter");
    expect(filter).toHaveClass("h-11", "sm:h-10", "text-base/6", "sm:text-sm/6");

    const reportA = screen.getByRole("combobox", { name: "Report A" });
    const reportB = screen.getByRole("combobox", { name: "Report B" });

    expect(reportA).toHaveAttribute("name", "reportA");
    expect(reportB).toHaveAttribute("name", "reportB");
    expect(reportA).toHaveClass(
      "appearance-none",
      "h-11",
      "py-2.5",
      "pr-8",
      "sm:h-10",
      "sm:py-2",
      "text-base/6",
      "sm:text-sm/6",
    );
    expect(reportA.parentElement).toHaveClass("inline-grid", "grid-cols-[1fr_2rem]");
    expect(container.querySelectorAll(".lucide-chevron-down")).toHaveLength(2);
    expect(container.querySelector(".lucide-chevron-down")).toHaveClass("size-4", "sm:size-3.5");

    fireEvent.change(filter, { target: { value: "Tallink" } });
    await waitFor(() => {
      expect(within(reportA).getByText(/Tallink Grupp/)).toBeInTheDocument();
      expect(within(reportA).queryByText(/DelfinGroup/)).not.toBeInTheDocument();
    });

    fireEvent.change(filter, { target: { value: "" } });
    fireEvent.change(reportA, { target: { value: "r1" } });
    fireEvent.change(reportB, { target: { value: "r2" } });

    const compareButton = screen.getByRole("button", { name: "Compare reports" });
    expect(compareButton).toHaveClass("h-9", "pl-2", "pr-3");
    fireEvent.click(compareButton);

    expect(pushMock).toHaveBeenCalledWith("/compare?reportA=r1&reportB=r2");
  });
});
