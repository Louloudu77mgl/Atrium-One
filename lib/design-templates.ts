import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DesignTemplateRow, MerchantBrandSettingsRow, MerchantRow, SocialPostRow } from "@/lib/supabase/types";
import { getDefaultTemplateHtml } from "@/lib/template-utils";
export { TEMPLATE_CATEGORIES, TEMPLATE_FORMATS, getDefaultTemplateHtml } from "@/lib/template-utils";

export async function getDesignTemplates() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("design_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return [];
    }

    throw new Error(error.message);
  }

  return data;
}

export function selectTemplateForMerchant(templates: DesignTemplateRow[], merchant?: MerchantRow | null) {
  const businessType = merchant?.business_type.toLowerCase() ?? "";
  const matchingTemplate = templates.find((template) => businessType.includes(template.category.toLowerCase()));
  return matchingTemplate ?? templates[0] ?? null;
}

export function renderTemplateHtml({
  template,
  post,
  merchant,
  brand,
  imageUrl
}: {
  template?: DesignTemplateRow | null;
  post: Pick<SocialPostRow, "title" | "caption" | "cta" | "visual_text" | "primary_color" | "secondary_color" | "accent_color">;
  merchant?: MerchantRow | null;
  brand?: MerchantBrandSettingsRow | null;
  imageUrl?: string | null;
}) {
  const html = template?.html_content ?? getDefaultTemplateHtml();
  const variables: Record<string, string> = {
    business_name: merchant?.business_name ?? "Votre commerce",
    post_title: post.title,
    post_text: post.visual_text ?? post.caption,
    cta: post.cta ?? "Passez nous voir",
    image_url: imageUrl ?? "",
    primary_color: post.primary_color ?? brand?.primary_color ?? "#4C1D95",
    secondary_color: post.secondary_color ?? brand?.secondary_color ?? "#F3E8FF",
    accent_color: post.accent_color ?? brand?.accent_color ?? "#A855F7"
  };

  return Object.entries(variables).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, escapeHtml(value)),
    html
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
