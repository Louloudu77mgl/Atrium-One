import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SocialCreatePage() {
  redirect("/social#create-with-hans");
}
