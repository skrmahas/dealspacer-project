import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "DealSpacer | Baltic Earnings Intelligence",
  description:
    "AI-powered analysis of Baltic listed companies, filings, and earnings reports.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="isolate overflow-x-hidden">{children}</body>
    </html>
  );
}
