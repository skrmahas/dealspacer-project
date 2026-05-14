import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baltic Earnings Intelligence",
  description: "Upload Baltic company earnings reports in any format. Get structured financial summaries with charts, translations, and sentiment analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
