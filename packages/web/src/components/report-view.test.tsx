import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MetricsTablePanel } from "./report-view";

describe("MetricsTablePanel", () => {
  it("renders extracted metrics with the responsive table pattern", () => {
    render(
      <MetricsTablePanel
        metrics={[
          { label: "Passenger volume", period: "FY2024", unit: "passengers", value: 5_200_000 },
          { label: "Operating margin", period: "FY2024", unit: "%", value: 14.2 },
          { label: "Other revenue", period: "FY2024", unit: "EUR", value: 1_230_000 },
        ]}
      />,
    );

    const table = screen.getByRole("table");
    const scrollFrame = table.parentElement?.parentElement;

    expect(screen.getByRole("heading", { name: /all extracted metrics/i }).closest("section"))
      .toHaveClass("w-full", "min-w-0", "max-w-full");
    expect(table).toHaveClass("w-full", "min-w-[520px]");
    expect(table.parentElement).toHaveClass("inline-block", "min-w-full", "px-4", "sm:px-5");
    expect(scrollFrame).toHaveClass(
      "-mx-4",
      "sm:-mx-5",
      "-my-2",
      "overflow-x-auto",
      "overscroll-x-contain",
      "whitespace-nowrap",
    );

    const metricHeader = screen.getByRole("columnheader", { name: "Metric" });
    expect(metricHeader).toHaveClass("whitespace-nowrap");
    expect(metricHeader.parentElement).not.toHaveClass("uppercase");
    expect(screen.getByRole("columnheader", { name: "Value" })).toHaveClass("text-right");

    expect(within(table).getByText("Passenger volume")).toHaveClass(
      "text-base/6",
      "sm:text-sm/6",
    );
    expect(within(table).getAllByText("FY2024")[0]).toHaveClass(
      "text-base/6",
      "sm:text-sm/6",
    );
    expect(within(table).getByText("€1.2M")).toHaveClass("text-base/6", "sm:text-sm/6");
  });
});
