alter table public.merchant_brand_settings
add column if not exists social_font_family text not null default 'Sora';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_font_family_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_font_family_check
check (social_font_family in ('Sora', 'Inter', 'Georgia', 'Trebuchet MS', 'Helvetica Neue'));
