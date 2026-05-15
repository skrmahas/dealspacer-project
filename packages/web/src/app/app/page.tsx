import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default function LegacyAppRedirectPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.append(key, value);
      }
    }
  }
  const query = params.toString();
  redirect(query ? `/upload?${query}` : "/upload");
}
