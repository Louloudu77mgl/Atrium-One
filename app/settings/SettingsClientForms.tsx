"use client";

import { useMemo, useState } from "react";
import type { MerchantBrandSettingsRow, MerchantRow } from "@/lib/supabase/types";
import { SocialFontPicker } from "@/components/SocialFontPicker";
import { getSocialFontStack } from "@/lib/social-fonts";

type ActionFn = (formData: FormData) => void | Promise<void>;

const fieldSelect =
  "w-full appearance-none rounded-full border border-[#E4DBF6] bg-white bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236E6A76' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")] bg-[right_14px_center] bg-no-repeat bg-[length:16px] px-4 py-[11px] pr-10 text-[13.5px] font-semibold text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]";
const fieldText =
  "w-full rounded-[12px] border border-[#E4DBF6] bg-white px-[15px] py-[11px] text-[13.5px] font-medium text-[#17131F] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[#6E4DE0]";

export function MerchantIdentityForm({
  merchant,
  action
}: {
  merchant: MerchantRow;
  action: ActionFn;
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(merchant.logo_url ?? null);
  const initials = useMemo(
    () =>
      (merchant.business_name || "AO")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 5)
        .toUpperCase(),
    [merchant.business_name]
  );

  return (
    <form action={action}>
      <div className="flex flex-col gap-5 px-[30px] py-[22px]">
        <div className="grid gap-[18px] md:grid-cols-2">
          <Field label="Enseigne" name="business_name" defaultValue={merchant.business_name} />
          <Field label="Catégorie" name="business_type" defaultValue={merchant.business_type} />
          <Field label="Ville" name="city" defaultValue={merchant.city} />
          <Field label="Téléphone" name="phone" defaultValue={merchant.phone ?? ""} />
        </div>

        <Field label="Site web" name="website_url" defaultValue={merchant.website_url ?? ""} />

        <div>
          <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">Informations utiles pour Hans</label>
          <textarea name="description" defaultValue={merchant.description ?? ""} className={`${fieldText} min-h-[84px] resize-y leading-[1.5]`} />
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">Logo de votre enseigne</label>
          <div className="flex flex-wrap items-center gap-4 rounded-[12px] border-[1.5px] border-dashed border-[#DAC9F5] bg-[#F1ECFB] px-5 py-[18px]">
            <div className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border border-[#EBE6DF] bg-white text-[10px] font-extrabold tracking-[0.02em] text-[#2B1A4A]">
              {logoPreview ? <img src={logoPreview} alt="Aperçu du logo" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-full bg-[#2B1A4A] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#221540]">
                Choisir un fichier
                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    setLogoPreview(file ? URL.createObjectURL(file) : merchant.logo_url ?? null);
                  }}
                />
              </label>
              <span className="text-[13px] text-[#9A96A1]">{logoPreview ? "Logo prêt à être sauvegardé" : "Aucun fichier choisi"}</span>
            </div>
            <span className="basis-full text-[11.5px] text-[#9A96A1]">PNG, JPG, SVG ou WEBP. Le logo sera affiché dans le header, la sidebar et le profil commerce.</span>
          </div>

          <div className="mt-[14px] flex flex-wrap gap-[10px]">
            {["Header", "Sidebar", "Profil commerce"].map((label) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border border-[#EBE6DF] bg-[#F6F3EF] px-[14px] py-[6px] text-xs font-semibold text-[#6E6A76]">
                <span className="flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full border border-[#EBE6DF] bg-white text-[7px] font-extrabold text-[#2B1A4A]">
                  {logoPreview ? <img src={logoPreview} alt={label} className="h-full w-full object-cover" /> : initials.slice(0, 2)}
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">Ton de réponse Hans</label>
          <select name="response_tone" defaultValue={merchant.response_tone ?? "chaleureux"} className={fieldSelect}>
            <option value="chaleureux">Chaleureux</option>
            <option value="premium">Premium</option>
            <option value="professionnel">Professionnel</option>
            <option value="convivial">Convivial</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end px-[30px] pb-[26px] pt-1">
        <button type="submit" className="inline-flex items-center rounded-full bg-[#2B1A4A] px-[18px] py-[10px] text-[13.5px] font-semibold text-white transition hover:bg-[#221540]">
          Sauvegarder
        </button>
      </div>
    </form>
  );
}

export function BrandStyleForm({
  brandSettings,
  businessName,
  logoUrl,
  action
}: {
  brandSettings: MerchantBrandSettingsRow | null;
  businessName: string;
  logoUrl?: string | null;
  action: ActionFn;
}) {
  const [primary, setPrimary] = useState(brandSettings?.primary_color ?? "#4C1D95");
  const [secondary, setSecondary] = useState(brandSettings?.secondary_color ?? "#F3E8FF");
  const [accent, setAccent] = useState(brandSettings?.accent_color ?? "#A855F7");
  const visualStyle = brandSettings?.visual_style ?? "premium";
  const [font, setFont] = useState(brandSettings?.social_font_family ?? "Sora");
  const [tone, setTone] = useState(brandSettings?.tone ?? "professionnel");
  const [showLogo, setShowLogo] = useState(brandSettings?.show_logo_on_social_posts ?? false);
  const [logoPosition, setLogoPosition] = useState<"top_left" | "top_right" | "bottom_left" | "bottom_right">(brandSettings?.social_logo_position ?? "top_left");

  return (
    <form action={action}>
      <div className="flex flex-col gap-5 px-[30px] py-[22px]">
        <div className="grid gap-[22px] lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-5">
            <div className="grid gap-[18px] md:grid-cols-3">
              <ColorField label="Couleur principale" name="primary_color" value={primary} onChange={setPrimary} />
              <ColorField label="Couleur secondaire" name="secondary_color" value={secondary} onChange={setSecondary} />
              <ColorField label="Couleur d'accent" name="accent_color" value={accent} onChange={setAccent} />
            </div>

            <input type="hidden" name="visual_style" value={visualStyle} />
            <div>
              <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">Police des posts</label>
              <SocialFontPicker name="social_font_family" value={font} onChange={setFont} />
            </div>

            <div>
              <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">Ton de communication</label>
              <select name="tone" value={tone} onChange={(event) => setTone(event.target.value as MerchantBrandSettingsRow["tone"])} className={fieldSelect}>
                <option value="professionnel">Professionnel</option>
                <option value="simple">Simple</option>
                <option value="convivial">Convivial</option>
                <option value="haut_de_gamme">Haut de gamme</option>
              </select>
            </div>

            <div className="rounded-[14px] border border-[#E4DBF6] bg-[#FBFAFF] p-4">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className="block text-[13.5px] font-bold text-[#17131F]">Afficher le logo sur les publications</span>
                  <span className="mt-1 block text-[12px] leading-5 text-[#6E6A76]">Le logo sera placé discrètement dans un coin supérieur du visuel.</span>
                </span>
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${showLogo ? "bg-[#6E4DE0]" : "bg-[#D8D2E2]"}`}>
                  <input
                    type="checkbox"
                    name="show_logo_on_social_posts"
                    checked={showLogo}
                    onChange={(event) => setShowLogo(event.target.checked)}
                    className="sr-only"
                  />
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${showLogo ? "left-6" : "left-1"}`} />
                </span>
              </label>

              {showLogo ? (
                <div className="mt-4">
                  <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">Position du logo</label>
                  <select name="social_logo_position" value={logoPosition} onChange={(event) => setLogoPosition(event.target.value as typeof logoPosition)} className={fieldSelect}>
                    <option value="top_left">En haut à gauche</option>
                    <option value="top_right">En haut à droite</option>
                    <option value="bottom_left">En bas à gauche</option>
                    <option value="bottom_right">En bas à droite</option>
                  </select>
                </div>
              ) : (
                <input type="hidden" name="social_logo_position" value={logoPosition} />
              )}
            </div>
          </div>

          <div className="sticky top-5 rounded-[12px] border border-[#EBE6DF] bg-[#F6F3EF] p-[18px]">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[#9A96A1]">Aperçu du post</div>
            <div className="overflow-hidden rounded-[12px] border border-[#EBE6DF] bg-white">
              <div className="flex items-center gap-2 px-3 py-[10px]">
                <span className="h-[22px] w-[22px] rounded-full" style={{ background: primary }} />
                <span className="text-[11.5px] font-bold text-[#17131F]">{businessName}</span>
              </div>
              <div className="relative flex h-[150px] items-end p-3" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, fontFamily: getSocialFontStack(font) }}>
                {showLogo ? (
                  <span className={`absolute flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] bg-white/90 p-1 shadow-sm ${
                    logoPosition.startsWith("bottom") ? "bottom-3" : "top-3"
                  } ${logoPosition.endsWith("right") ? "right-3" : "left-3"}`}>
                    {logoUrl ? <img src={logoUrl} alt="Logo sur la publication" className="h-full w-full object-contain" /> : <span className="text-[9px] font-black text-[#2B1A4A]">{businessName.slice(0, 2).toUpperCase()}</span>}
                  </span>
                ) : null}
                <span className="rounded-full px-[11px] py-[5px] text-[11px] font-bold text-white" style={{ background: accent }}>
                  {getVisualStyleLabel(visualStyle)}
                </span>
              </div>
              <div className="px-3 py-3 text-[12.5px] leading-[1.5] text-[#17131F]" style={{ fontFamily: getSocialFontStack(font) }}>
                {getToneCaption(tone)}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-[#F0EDEA] px-[13px] py-[5px] text-[11.5px] font-bold text-[#6E6A76]">Police · {font}</span>
              <span className="inline-flex rounded-full bg-[#F0EDEA] px-[13px] py-[5px] text-[11.5px] font-bold text-[#6E6A76]">Ton · {getToneLabel(tone)}</span>
              <span className="inline-flex rounded-full bg-[#F0EDEA] px-[13px] py-[5px] text-[11.5px] font-bold text-[#6E6A76]">Logo · {showLogo ? getLogoPositionLabel(logoPosition) : "masqué"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end px-[30px] pb-[26px] pt-1">
        <button type="submit" className="inline-flex items-center rounded-full bg-[#2B1A4A] px-[18px] py-[10px] text-[13.5px] font-semibold text-white transition hover:bg-[#221540]">
          Sauvegarder la charte sociale
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div>
      <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">{label}</label>
      <input name={name} defaultValue={defaultValue} className={fieldText} />
    </div>
  );
}

function ColorField({
  label,
  name,
  value,
  onChange
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-[12.5px] font-semibold text-[#6E6A76]">{label}</label>
      <div className="relative h-11 overflow-hidden rounded-[12px] border border-[#EBE6DF]">
        <input name={name} type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-0 p-0" />
        <span className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-[9px] py-[3px] text-[11.5px] font-bold tracking-[0.02em] text-[#17131F]">
          {value.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function getLogoPositionLabel(value: "top_left" | "top_right" | "bottom_left" | "bottom_right") {
  return {
    top_left: "haut gauche",
    top_right: "haut droite",
    bottom_left: "bas gauche",
    bottom_right: "bas droite"
  }[value];
}

function getVisualStyleLabel(value: string) {
  return {
    moderne: "Studio moderne",
    premium: "Naturel & lumineux",
    dynamique: "Éditorial",
    artisanal: "Dessiné",
    minimaliste: "Illustration",
    chaleureux: "Peinture"
  }[value] ?? "Studio moderne";
}

function getToneLabel(value: string) {
  return {
    professionnel: "Professionnel",
    simple: "Simple",
    convivial: "Convivial",
    haut_de_gamme: "Haut de gamme"
  }[value] ?? "Professionnel";
}

function getToneCaption(value: string) {
  return {
    simple: "Infos utiles, belle sélection en boutique et message clair à retenir. ✨",
    convivial: "Nouveautés en boutique, ambiance chaleureuse et jolies découvertes à partager. 🌸",
    haut_de_gamme: "Nouvelle collection en boutique — compositions de saison soignées, pensées avec élégance. ✨",
    professionnel: "Nouvelle collection en boutique — compositions de saison à découvrir dès aujourd'hui. 🌸"
  }[value] ?? "Nouvelle collection en boutique — compositions de saison à découvrir dès aujourd'hui. 🌸";
}
