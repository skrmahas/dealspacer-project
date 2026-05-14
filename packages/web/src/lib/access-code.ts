import { randomBytes } from "node:crypto";

export const PRODUCTION_ACCESS_CODE_MISSING_MESSAGE = "Server misconfiguration: BEI_ACCESS_CODE must be set in production.";

let developmentFallbackAccessCode: string | null = null;

export function resolveExpectedAccessCode(
  nodeEnv = process.env.NODE_ENV,
  configuredAccessCode = process.env.BEI_ACCESS_CODE,
): string | null {
  const trimmedConfiguredCode = configuredAccessCode?.trim();
  if (trimmedConfiguredCode) return trimmedConfiguredCode;

  if (nodeEnv === "production") {
    return null;
  }

  if (!developmentFallbackAccessCode) {
    developmentFallbackAccessCode = randomBytes(12).toString("hex");
    console.warn("BEI_ACCESS_CODE is not set. Generated development-only fallback access code:", developmentFallbackAccessCode);
  }

  return developmentFallbackAccessCode;
}
