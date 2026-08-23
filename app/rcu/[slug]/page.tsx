import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getRcuVisitDay } from "@/lib/rcu-game-server";
import { getPublicRcuProgram } from "@/lib/rcu";
import { buildRcuLoyaltySnapshot } from "@/lib/rcu-loyalty";
import { getRcuValidationKey, submitRcuLead } from "@/lib/rcu-server";
import {
  getRcuPublicBrand,
  getStoredRcuForm,
  getStoredRcuGameRecordForDay,
  getStoredRcuGameRecordByToken,
  getStoredRcuWalletByToken,
  listStoredRcuForms,
  listStoredRcuGameRecords,
  listStoredRcuRaffleDraws,
  listStoredRcuRewardRedemptions
} from "@/lib/rcu-store";
import { RcuGameExperience } from "./RcuGameExperience";
import { RcuSubmissionNotifier } from "./RcuSubmissionNotifier";

export default async function RcuFormPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sent?: string; play?: string; wallet?: string; error?: string; new?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const form = await getStoredRcuForm(slug);
  if (!form) notFound();
  const activeForm = form;

  const submissionCookieName = `rcu_play_${slug}`;
  const walletCookieName = `rcu_wallet_${activeForm.merchant_id}`;
  const cookieStore = await cookies();
  const requestedToken = query?.play ?? cookieStore.get(submissionCookieName)?.value;
  const requestedWalletToken = query?.new === "1" ? undefined : query?.wallet ?? cookieStore.get(walletCookieName)?.value;
  const [brand, requestedPlay, requestedWallet] = await Promise.all([
    getRcuPublicBrand(activeForm.merchant_id),
    requestedToken ? getStoredRcuGameRecordByToken(requestedToken) : Promise.resolve(null),
    requestedWalletToken ? getStoredRcuWalletByToken(requestedWalletToken) : Promise.resolve(null)
  ]);
  const tokenPlay = requestedPlay?.program_id === activeForm.id && requestedPlay.program_slug === activeForm.slug
    ? requestedPlay
    : null;
  const wallet = requestedWallet?.merchant_id === activeForm.merchant_id && (!tokenPlay || requestedWallet.customer_key === tokenPlay.customer_key)
    ? requestedWallet
    : null;
  const walletData = wallet ? await Promise.all([
    getStoredRcuGameRecordForDay({ merchantId: activeForm.merchant_id, programId: activeForm.id, customerKey: wallet.customer_key, visitDay: getRcuVisitDay() }),
    listStoredRcuForms(activeForm.merchant_id),
    listStoredRcuGameRecords(activeForm.merchant_id, { customerKey: wallet.customer_key }),
    listStoredRcuRewardRedemptions(activeForm.merchant_id, { customerKey: wallet.customer_key }),
    listStoredRcuRaffleDraws(activeForm.merchant_id, { customerKey: wallet.customer_key })
  ]) : null;
  const currentPlay = walletData?.[0] ?? (tokenPlay?.visit_day === getRcuVisitDay() ? tokenPlay : null);
  const progressPlay = currentPlay ?? walletData?.[2].find((item) => item.program_id === activeForm.id) ?? null;
  const loyalty = walletData ? buildRcuLoyaltySnapshot({ programs: walletData[1], plays: walletData[2], redemptions: walletData[3], raffleDraws: walletData[4] }) : null;
  const alreadyPlayedToday = Boolean(currentPlay);

  async function submitLead(formData: FormData) {
    "use server";

    try {
      const requestHeaders = await headers();
      const result = await submitRcuLead({
        form: activeForm,
        payload: {
          first_name: String(formData.get("first_name") ?? ""),
          last_name: String(formData.get("last_name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? "") || undefined,
          favorite_products: String(formData.get("favorite_products") ?? "") || undefined,
          consent_sms: formData.get("consent_sms") === "on",
          consent_email: formData.get("consent_email") === "on",
          birthday: String(formData.get("birthday") ?? "") || undefined,
          privacy_consent: formData.get("privacy_consent") === "on",
          review_confirmed: formData.get("review_confirmed") === "on",
          visit_code: String(formData.get("visit_code") ?? ""),
          validation_key: getRcuValidationKey(requestHeaders)
        }
      });

      const responseCookies = await cookies();
      responseCookies.set(submissionCookieName, result.playToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 48,
        path: `/rcu/${slug}`
      });
      responseCookies.set(walletCookieName, result.walletToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        path: "/"
      });
      redirect(`/rcu/${slug}?sent=1`);
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error;
      const message = error instanceof Error ? error.message : "Impossible d’enregistrer votre participation.";
      redirect(`/rcu/${slug}?error=${encodeURIComponent(message)}`);
    }
  }

  return (
    <>
      {query?.sent ? <RcuSubmissionNotifier slug={slug} /> : null}
      <RcuGameExperience
        program={getPublicRcuProgram(activeForm)}
        merchant={brand.merchant}
        brandSettings={brand.brandSettings}
        play={currentPlay}
        progressPlay={progressPlay}
        loyalty={loyalty}
        wallet={wallet}
        alreadyPlayedToday={alreadyPlayedToday}
        walletHref={wallet ? `/fidelite/${wallet.token}` : null}
        newCustomerHref={`/rcu/${slug}?new=1`}
        errorMessage={query?.error}
        submitAction={submitLead}
      />
    </>
  );
}
