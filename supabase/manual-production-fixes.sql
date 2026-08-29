alter table public.google_connections
add column if not exists granted_scopes text[] not null default '{}';

alter table public.google_connections
add column if not exists last_error text;

alter table public.reviews
add column if not exists source_review_id text;

alter table public.merchant_brand_settings
add column if not exists social_font_family text not null default 'Sora';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_font_family_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_font_family_check
check (social_font_family in ('Sora', 'Inter', 'DM Sans', 'Manrope', 'Montserrat', 'Poppins', 'Raleway', 'Work Sans', 'Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'Lora', 'Merriweather', 'Georgia', 'Bebas Neue', 'Oswald', 'Anton', 'Caveat', 'Dancing Script', 'Pacifico', 'Trebuchet MS', 'Helvetica Neue'));

alter table public.merchant_brand_settings
add column if not exists social_template_style text not null default 'editorial';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_template_style_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_template_style_check
check (social_template_style in ('editorial', 'artisan', 'impact'));

alter table public.merchant_brand_settings
add column if not exists show_logo_on_social_posts boolean not null default false;

alter table public.merchant_brand_settings
add column if not exists social_logo_position text not null default 'top_left';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_logo_position_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_logo_position_check
check (social_logo_position in ('top_left', 'top_right', 'bottom_left', 'bottom_right'));

notify pgrst, 'reload schema';
