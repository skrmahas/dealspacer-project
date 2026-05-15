import { beiFontVariables } from "@/lib/bei-fonts";

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={beiFontVariables}>{children}</div>;
}
