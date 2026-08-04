import { redirect } from "next/navigation";

export default async function GoogleBusinessSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const destination = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (typeof value === "string") {
      destination.set(key, value);
    }
  });

  redirect(`/integrations${destination.size > 0 ? `?${destination.toString()}` : ""}`);
}
