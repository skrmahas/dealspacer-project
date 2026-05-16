import { beiFontVariables } from "@/lib/bei-fonts";

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <div className={beiFontVariables}>{children}</div>;
}
