import {
  Anton,
  Bebas_Neue,
  Caveat,
  Cormorant_Garamond,
  DM_Sans,
  Dancing_Script,
  Inter,
  Libre_Baskerville,
  Lora,
  Manrope,
  Merriweather,
  Montserrat,
  Oswald,
  Pacifico,
  Playfair_Display,
  Poppins,
  Raleway,
  Sora,
  Work_Sans
} from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-social-sora" });
const inter = Inter({ subsets: ["latin"], variable: "--font-social-inter" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-social-dm-sans" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-social-manrope" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-social-montserrat" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-social-poppins" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-social-raleway" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-social-work-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-social-playfair" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-social-cormorant" });
const libre = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-social-libre" });
const lora = Lora({ subsets: ["latin"], variable: "--font-social-lora" });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--font-social-merriweather" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-social-bebas" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-social-oswald" });
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-social-anton" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-social-caveat" });
const dancing = Dancing_Script({ subsets: ["latin"], variable: "--font-social-dancing" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-social-pacifico" });

const socialFonts = [
  sora,
  inter,
  dmSans,
  manrope,
  montserrat,
  poppins,
  raleway,
  workSans,
  playfair,
  cormorant,
  libre,
  lora,
  merriweather,
  bebas,
  oswald,
  anton,
  caveat,
  dancing,
  pacifico
];

export const socialFontVariables = socialFonts.map((font) => font.variable).join(" ");
