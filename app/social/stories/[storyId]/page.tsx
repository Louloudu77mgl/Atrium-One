import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StoryPreviewClient } from "./StoryPreviewClient";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  if (!merchant) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: story } = await supabase.from("social_posts").select("*").eq("id", storyId).eq("merchant_id", merchant.id).eq("media_kind", "story").maybeSingle();
  if (!story) notFound();
  const counters = getReviewCountersFromReviews(reviews);
  return <div className={appShellStyles.page}>
    <Sidebar active="social" merchant={merchant} counters={counters} />
    <div className={appShellStyles.pageInner}>
      <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={getAppNotifications(reviews, googleConnection)} />
      <main className={appShellStyles.content}><div className={appShellStyles.width}><StoryPreviewClient story={story} /></div></main>
    </div>
  </div>;
}
