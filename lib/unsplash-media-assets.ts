import type { MediaAssetRow } from "@/lib/supabase/types";

const now = "2026-06-16T08:00:00.000Z";

export const unsplashMediaAssets: MediaAssetRow[] = [
  asset("unsplash-restaurant-salle", "Restaurant chaleureux avec salle accueillante", "Restaurant", ["featured", "restaurant", "intérieur", "salle", "ambiance", "dîner", "convivial"], "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-restaurant-plat", "Plat dressé premium", "Restaurant", ["featured", "restaurant", "plat", "produit", "menu", "gastronomie", "qualité"], "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-restaurant-cuisine", "Équipe en cuisine pendant le service", "Restaurant", ["featured", "restaurant", "équipe", "cuisine", "préparation", "savoir-faire", "service"], "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-restaurant-table", "Table de restaurant prête à accueillir", "Restaurant", ["restaurant", "réservation", "table", "accueil", "expérience", "soirée"], "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-restaurant-brunch", "Brunch coloré et généreux", "Restaurant", ["restaurant", "brunch", "plat", "frais", "menu", "moment", "instagram"], "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-restaurant-dessert", "Dessert maison gourmand", "Restaurant", ["restaurant", "dessert", "produit", "gourmand", "fait maison", "qualité"], "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-restaurant-pizza", "Pizza artisanale sortie du four", "Restaurant", ["restaurant", "pizza", "four", "artisanal", "chaud", "produit"], "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-cafe-comptoir", "Comptoir café de proximité", "Commerce de proximité", ["featured", "café", "restaurant", "local", "comptoir", "accueil", "matin"], "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-cafe-latte", "Café latte servi au comptoir", "Commerce alimentaire", ["café", "boisson", "produit", "pause", "commerce alimentaire", "chaleureux"], "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-cafe-client", "Client dans un café lumineux", "Client", ["café", "client", "sourire", "accueil", "expérience", "intérieur"], "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=85"),

  asset("unsplash-coiffure-salon", "Salon de coiffure lumineux", "Coiffure", ["featured", "coiffure", "salon", "intérieur", "premium", "accueil"], "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-coiffure-client", "Moment client en salon de coiffure", "Coiffure", ["featured", "coiffure", "client", "service", "coupe", "cheveux", "sourire"], "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-coiffure-coupe", "Coiffeur réalisant une coupe", "Coiffure", ["coiffure", "coupe", "cheveux", "équipe", "savoir-faire", "service"], "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-coiffure-produits", "Produits capillaires en salon", "Coiffure", ["coiffure", "produit", "cheveux", "soin", "premium", "vente"], "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-coiffure-brushing", "Brushing et soin cheveux", "Coiffure", ["coiffure", "brushing", "cheveux", "soin", "client", "résultat"], "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1200&q=85"),

  asset("unsplash-beaute-soin", "Soin beauté premium", "Beauté", ["featured", "beauté", "soin", "client", "bien-être", "premium", "détente"], "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-beaute-produits", "Produits beauté élégants", "Beauté", ["featured", "beauté", "produit", "soin", "cosmétique", "premium"], "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-beaute-spa", "Ambiance spa et détente", "Beauté", ["beauté", "spa", "massage", "détente", "bien-être", "intérieur"], "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-beaute-maquillage", "Maquillage professionnel", "Beauté", ["beauté", "maquillage", "cosmétique", "client", "résultat", "service"], "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-beaute-manucure", "Manucure soignée", "Beauté", ["beauté", "ongles", "manucure", "service", "client", "détail"], "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=85"),

  asset("unsplash-garage-auto", "Garage automobile professionnel", "Garage", ["featured", "garage", "auto", "atelier", "réparation", "confiance", "mécanique"], "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-garage-detail", "Détail mécanique en atelier", "Garage", ["garage", "mécanique", "produit", "réparation", "atelier", "expertise"], "https://images.unsplash.com/photo-1504222490345-c075b6008014?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-garage-mecanicien", "Mécanicien au travail", "Garage", ["featured", "garage", "mécanicien", "équipe", "service", "réparation", "atelier"], "https://images.unsplash.com/photo-1625047509168-a7026f36de04?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-garage-pneu", "Entretien pneus automobile", "Garage", ["garage", "auto", "pneu", "entretien", "sécurité", "réparation"], "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-garage-diagnostic", "Diagnostic automobile moderne", "Garage", ["garage", "diagnostic", "auto", "technique", "confiance", "service"], "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=85"),

  asset("unsplash-sport-salle", "Salle de sport moderne", "Sport", ["featured", "sport", "fitness", "intérieur", "entraînement", "salle"], "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-sport-equipe", "Coaching sportif personnalisé", "Sport", ["sport", "fitness", "client", "équipe", "coaching", "motivation"], "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-sport-yoga", "Cours de yoga collectif", "Sport", ["sport", "yoga", "bien-être", "cours", "client", "calme"], "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-sport-running", "Entraînement dynamique", "Sport", ["sport", "running", "dynamique", "motivation", "extérieur", "challenge"], "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-sport-musculation", "Espace musculation", "Sport", ["sport", "musculation", "salle", "entraînement", "résultat", "fitness"], "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85"),

  asset("unsplash-boulangerie", "Boulangerie artisanale", "Commerce alimentaire", ["featured", "commerce alimentaire", "boulangerie", "produit", "pain", "artisan", "frais"], "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-fruits", "Produits frais de saison", "Commerce alimentaire", ["featured", "commerce alimentaire", "produit", "alimentaire", "frais", "local", "qualité"], "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-epicerie", "Épicerie de proximité", "Commerce alimentaire", ["commerce alimentaire", "épicerie", "rayon", "produit", "local", "boutique"], "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-fromage", "Produits artisanaux en vitrine", "Commerce alimentaire", ["commerce alimentaire", "fromage", "produit", "artisan", "vitrine", "qualité"], "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-marche", "Marché de produits locaux", "Commerce alimentaire", ["commerce alimentaire", "marché", "local", "frais", "extérieur", "produit"], "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=85"),

  asset("unsplash-boutique-vitrine", "Vitrine de boutique locale", "Commerce de proximité", ["featured", "commerce de proximité", "boutique", "extérieur", "local", "vitrine"], "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-boutique-interieur", "Intérieur de commerce chaleureux", "Intérieur", ["featured", "commerce de proximité", "boutique", "intérieur", "rayon", "accueil"], "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-equipe-commerce", "Équipe en boutique", "Équipe", ["featured", "commerce de proximité", "humain", "équipe", "accueil", "sourire"], "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-client-sourire", "Client satisfait en commerce", "Client", ["featured", "client", "sourire", "accueil", "commerce de proximité", "confiance"], "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-produit-premium", "Produit mis en avant", "Produit", ["featured", "produit", "premium", "commerce de proximité", "qualité", "détail"], "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-interieur-premium", "Intérieur premium lumineux", "Intérieur", ["featured", "intérieur", "ambiance", "premium", "local", "design"], "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-exterieur-commerce", "Façade commerce de proximité", "Extérieur", ["commerce de proximité", "extérieur", "façade", "local", "rue", "vitrine"], "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-boutique-caisse", "Accueil et caisse en boutique", "Commerce de proximité", ["commerce de proximité", "accueil", "caisse", "client", "service", "boutique"], "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-boutique-rayons", "Rayons de boutique bien rangés", "Commerce de proximité", ["commerce de proximité", "rayon", "produit", "boutique", "intérieur", "choix"], "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-fleuriste", "Bouquets en boutique fleuriste", "Produit", ["commerce de proximité", "fleur", "fleuriste", "produit", "couleur", "cadeau"], "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85"),
  asset("unsplash-librairie", "Librairie indépendante", "Commerce de proximité", ["commerce de proximité", "librairie", "livre", "boutique", "calme", "local"], "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1200&q=85")
];

function asset(id: string, title: string, category: string, tags: string[], url: string): MediaAssetRow {
  return {
    id,
    url,
    title,
    category,
    tags,
    created_at: now,
    uploaded_by: null
  };
}
