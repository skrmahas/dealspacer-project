import { describe, expect, it } from "vitest";
import { motion } from "framer-motion";
import Chart from "chart.js/auto";

describe("design system dependencies", () => {
  it("imports framer-motion", () => {
    expect(motion.div).toBeDefined();
  });

  it("imports chart.js", () => {
    expect(Chart).toBeDefined();
  });
});
