import { Fraunces, IBM_Plex_Mono, Literata } from "next/font/google";

export const beiDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const beiBody = Literata({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const beiMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const beiFontVariables = `${beiDisplay.variable} ${beiBody.variable} ${beiMono.variable}`;
