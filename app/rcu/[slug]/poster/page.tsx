import { notFound } from "next/navigation";
import { getBrandSettings } from "@/lib/brand-settings";
import { buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import { getMerchant } from "@/lib/merchants";
import { getStoredRcuForm } from "@/lib/rcu-store";
import { getAppOriginFromHeaders } from "@/lib/auth/google-login";
import { RcuPosterStudio } from "./RcuPosterStudio";

export default async function RcuPosterPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getStoredRcuForm(slug);

  if (!form) {
    notFound();
  }

  const origin = await getAppOriginFromHeaders();
  const merchant = await getMerchant().catch(() => null);
  const ownMerchant = merchant?.id === form.merchant_id ? merchant : null;
  const brandSettings = ownMerchant ? await getBrandSettings(ownMerchant).catch(() => null) : null;

  return (
    <main className="min-h-screen bg-[#F8F7F4] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className={surfaceStyles.hero}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className={`${typographyStyles.kicker} mb-2`}>Affiche boutique</p>
              <h1 className={typographyStyles.h1}>Préparez le visuel RCU et son QR code.</h1>
              <p className={`${typographyStyles.body} mt-2`}>
                Exportez une affiche propre pour la caisse, la vitrine ou un support imprimé, en réutilisant la logique du studio social.
              </p>
            </div>
            <a href={`/api/rcu/qr?size=720&data=${encodeURIComponent(`${origin}/rcu/${form.slug}`)}`} target="_blank" rel="noreferrer" className={buttonStyles.tertiary}>
              Ouvrir le QR seul
            </a>
          </div>
        </section>

        <RcuPosterStudio form={form} origin={origin} merchant={ownMerchant} brandSettings={brandSettings} />
      </div>
    </main>
  );
}
