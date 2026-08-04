export const MEDIA_CATEGORIES = [
  "Restaurant",
  "Coiffure",
  "Beauté",
  "Garage",
  "Sport",
  "Commerce alimentaire",
  "Commerce de proximité",
  "Équipe",
  "Client",
  "Produit",
  "Intérieur",
  "Extérieur"
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
