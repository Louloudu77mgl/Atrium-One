alter table public.merchant_brand_settings
add column if not exists social_font_family text not null default 'Sora';

alter table public.merchant_brand_settings
drop constraint if exists merchant_brand_settings_social_font_family_check;

alter table public.merchant_brand_settings
add constraint merchant_brand_settings_social_font_family_check
check (social_font_family in ('Sora', 'Inter', 'DM Sans', 'Manrope', 'Montserrat', 'Poppins', 'Raleway', 'Work Sans', 'Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'Lora', 'Merriweather', 'Georgia', 'Bebas Neue', 'Oswald', 'Anton', 'Caveat', 'Dancing Script', 'Pacifico', 'Trebuchet MS', 'Helvetica Neue'));
