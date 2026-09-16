import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { getAppShellData } from "@/lib/app-shell-data";
import { appShellStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { getReviewCountersFromReviews } from "@/lib/review-counters";
import type { DraftIdeaInput } from "@/lib/social-drafts";
import { SocialCreateStoryClient } from "./SocialCreateStoryClient";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export default async function CreateStoryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { reviews, merchant, googleConnection } = await getAppShellData();
  const counters = getReviewCountersFromReviews(reviews);
  const notifications = getAppNotifications(reviews, googleConnection);
  const read = (key: string) => typeof params?.[key] === "string" ? params[key] : undefined;
  const initialIdea: DraftIdeaInput | null = read("title") && read("angle") ? {
    platform: "instagram",
    contentType: "story",
    title: read("title"),
    angle: read("angle"),
    source: read("source"),
    sourcePainPoint: read("sourcePainPoint"),
    sourceStrength: read("sourceStrength"),
    category: read("category"),
    seasonalMoment: read("seasonalMoment"),
    localEvent: read("localEvent"),
    eventDate: read("eventDate"),
    sourceUrl: read("sourceUrl"),
    visualDirection: read("visualDirection")
  } : null;
  return <div className={appShellStyles.page}>
    <Sidebar active="social" merchant={merchant} counters={counters} />
    <div className={appShellStyles.pageInner}>
      <Header merchant={merchant} googleConnection={googleConnection} counters={counters} notifications={notifications} />
      <main className={appShellStyles.content}><div className={appShellStyles.width}><SocialCreateStoryClient initialIdea={initialIdea} /></div></main>
    </div>
  </div>;
}
