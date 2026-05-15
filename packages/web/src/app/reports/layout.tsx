import { beiFontVariables } from "@/lib/bei-fonts";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={beiFontVariables}>{children}</div>;
}
