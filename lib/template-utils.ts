export const TEMPLATE_FORMATS = [
  { value: "instagram_square", label: "Post Instagram carré 1080x1080" },
  { value: "story", label: "Story 1080x1920" },
  { value: "facebook_post", label: "Post Facebook" }
] as const;

export const TEMPLATE_CATEGORIES = [
  "restaurant",
  "coiffure",
  "beauté",
  "garage",
  "sport",
  "commerce alimentaire",
  "commerce local"
] as const;

export function getDefaultTemplateHtml() {
  return `<div style="width:100%;height:100%;box-sizing:border-box;padding:72px;background:linear-gradient(135deg, {{primary_color}}, {{accent_color}});color:white;font-family:Inter,Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
  <div style="display:flex;align-items:center;gap:18px;">
    <img src="{{image_url}}" style="width:132px;height:132px;border-radius:32px;object-fit:cover;background:rgba(255,255,255,.18);" />
    <div style="font-size:34px;font-weight:800;">{{business_name}}</div>
  </div>
  <div>
    <div style="font-size:76px;line-height:.95;font-weight:950;letter-spacing:-3px;">{{post_title}}</div>
    <div style="margin-top:28px;font-size:34px;line-height:1.25;font-weight:650;max-width:840px;">{{post_text}}</div>
  </div>
  <div style="display:inline-flex;width:max-content;border-radius:999px;background:{{secondary_color}};color:{{primary_color}};padding:22px 34px;font-size:30px;font-weight:900;">{{cta}}</div>
</div>`;
}
