import { beiFontVariables } from "@/lib/bei-fonts";

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={beiFontVariables}>{children}</div>;
}
