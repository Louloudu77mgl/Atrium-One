alter table public.merchant_brand_settings
add column if not exists social_template_style text not null default 'editorial';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_template_style_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_template_style_check
check (social_template_style in ('editorial', 'artisan', 'impact'));

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_font_family_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_font_family_check
check (social_font_family in ('Sora', 'Inter', 'DM Sans', 'Manrope', 'Montserrat', 'Poppins', 'Raleway', 'Work Sans', 'Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'Lora', 'Merriweather', 'Georgia', 'Bebas Neue', 'Oswald', 'Anton', 'Caveat', 'Dancing Script', 'Pacifico', 'Trebuchet MS', 'Helvetica Neue'));

notify pgrst, 'reload schema';
