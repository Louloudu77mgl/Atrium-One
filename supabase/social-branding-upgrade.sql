alter table public.merchant_brand_settings
add column if not exists social_font_family text not null default 'Sora';

alter table public.merchant_brand_settings
add column if not exists show_logo_on_social_posts boolean not null default false;

alter table public.merchant_brand_settings
add column if not exists social_logo_position text not null default 'top_left';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_font_family_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_font_family_check
check (social_font_family in ('Sora', 'Inter', 'Georgia', 'Trebuchet MS', 'Helvetica Neue'));

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_logo_position_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_logo_position_check
check (social_logo_position in ('top_left', 'top_right', 'bottom_left', 'bottom_right'));

notify pgrst, 'reload schema';
