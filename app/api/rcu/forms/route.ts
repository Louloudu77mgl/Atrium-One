import { NextResponse } from "next/server";
import { getMerchant } from "@/lib/merchants";
import { getRcuDefaultDraft, getRcuTypeDefinition, isRcuFormType, normalizeRcuGameConfig, slugifyRcuValue, type RcuGameConfig } from "@/lib/rcu";
import { createStoredRcuForm } from "@/lib/rcu-store";

function isValidWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const merchant = await getMerchant();

  if (!merchant) {
    return NextResponse.json({ error: "Commerce introuvable." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    form_type?: string;
    title?: string;
    incentive_text?: string;
    slug?: string;
    cta_label?: string;
    target_url?: string;
    discount_label?: string;
    discount_value?: number;
    success_message?: string;
    poster_headline?: string;
    poster_body?: string;
    poster_theme?: string;
    game_config?: RcuGameConfig;
  };
  const formType = isRcuFormType(payload.form_type) ? payload.form_type : "points";
  const defaults = getRcuDefaultDraft(formType, merchant.business_name);
  const definition = getRcuTypeDefinition(formType);
  const normalizedSlug = slugifyRcuValue(payload.slug?.trim() || defaults.slug);

  if (!payload.title?.trim() || !payload.incentive_text?.trim() || !normalizedSlug) {
    return NextResponse.json({ error: "Titre, promesse et lien personnalisé requis." }, { status: 400 });
  }

  if (definition.targetRequired && !payload.target_url?.trim()) {
    return NextResponse.json({ error: `${definition.targetLabel} requis.` }, { status: 400 });
  }

  if (payload.target_url?.trim() && !isValidWebUrl(payload.target_url.trim())) {
    return NextResponse.json({ error: `${definition.targetLabel} doit commencer par https:// ou http://.` }, { status: 400 });
  }

  try {
    const form = await createStoredRcuForm({
      merchant_id: merchant.id,
      form_type: formType,
      title: payload.title.trim(),
      incentive_text: payload.incentive_text.trim(),
      slug: normalizedSlug,
      consent_label: `J’accepte que ${merchant.business_name} utilise ces informations pour gérer ma participation et mon programme de fidélité.`,
      cta_label: payload.cta_label?.trim() || defaults.ctaLabel,
      target_url: payload.target_url?.trim() || null,
      discount_label: definition.supportsDiscount ? payload.discount_label?.trim() || null : null,
      discount_value: definition.supportsDiscount && Number.isFinite(payload.discount_value) ? Number(payload.discount_value) : null,
      promo_prefix: merchant.business_name.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "") || "ATRIUM",
      success_message: payload.success_message?.trim() || defaults.successMessage,
      poster_headline: payload.poster_headline?.trim() || defaults.posterHeadline,
      poster_body: payload.poster_body?.trim() || defaults.posterBody,
      poster_theme: payload.poster_theme?.trim() || formType,
      game_config: normalizeRcuGameConfig(formType, payload.game_config ?? defaults.gameConfig),
      is_active: true
    });

    return NextResponse.json({ form });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de créer le RCU.";
    const status = message.toLowerCase().includes("déjà utilisé") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
