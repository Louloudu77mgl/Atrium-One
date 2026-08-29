import { NextResponse } from "next/server";
import { parseHansAutomationBlueprint } from "@/lib/automation-hans-blueprint";
import { getMerchant } from "@/lib/merchants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
};

const instructions = `Tu es Hans, l'architecte d'automatisations d'AtriumOne. Transforme fidèlement la demande du commerçant en un flow exécutable et retourne uniquement un objet JSON valide, sans Markdown.

Tu dois comprendre précisément : l'événement déclencheur, la cadence, les seuils, les conditions, les branches Oui/Non, les actions, leur contenu et le niveau d'autonomie demandé. Ne remplace jamais la demande par un template générique. Les mots « automatiquement », « sans validation » ou « publie directement » imposent mode=automatic. Les formulations « prépare », « brouillon », « je valide », « avec mon accord » ou « ne publie rien sans mon accord » imposent mode=semi_automatic ou draft_only.

Blocs réellement disponibles :
- new_customer : première inscription d'un client au RCU.
- new_visit : nouvelle visite RCU validée.
- new_reward : nouvelle récompense gagnée.
- google_review : veille de nouveaux avis Google. config={interval_count:number, interval_unit:"jour(s)"|"semaine(s)"}.
- customer_returned : visite après une absence. config={days:number}.
- customer_inactive : absence détectée par la veille quotidienne. config={days:number}.
- customer_birthday : date de naissance RCU correspondant au jour courant.
- registration_anniversary : date anniversaire de l'inscription RCU.
- visit_milestone : palier exact de visites RCU. config={visits:number}.
- points_milestone : franchissement d'un palier de points. config={points:number}.
- profile_completed : première inscription RCU avec profil complet.
- consent_granted : consentements e-mail et SMS obtenus à l'inscription.
- game_participation : participation validée à une roue ou une tombola RCU.
- game_reward_won : gain réel obtenu via un jeu RCU.
- reward_used : récompense réellement marquée comme utilisée.
- near_reward : proximité de la prochaine récompense. config={points:number maximum manquant}.
- visit_velocity : fréquence atteinte. config={visits:number, days:number}.
- review_by_rating : nouvel avis avec une note exacte. config={rating:number de 1 à 5}.
- review_keyword : nouvel avis contenant un terme. config={keyword:string}.
- marketing_consent : condition de consentement e-mail.
- review_rating_gte : condition sur la note. config={rating:number de 1 à 5}.
- reward_count : condition sur le nombre de récompenses. config={count:number}.
- visit_comparison : condition sur le nombre réel de visites RCU. config={visits:number minimum}.
- last_visit_age : condition sur le nombre de jours entre le passage actuel et la visite RCU précédente. config={days:number minimum}.
- points_comparison : condition sur le solde réel de points fidélité. config={points:number minimum}.
- customer_status : condition de statut. config={status:"Nouveau"|"Régulier"|"Fidèle"|"Inactif"}.
- customer_contact_field : présence d'une coordonnée. config={field:"E-mail"|"Téléphone"}.
- review_rating_compare : comparaison de note. config={operator:"Au moins"|"Au plus"|"Égale à",rating:number}.
- review_content : recherche dans le texte. config={keyword:string}.
- review_status : état de l'avis. config={status:"Positif"|"Négatif"|"Sensible"}.
- generate_email : rédaction par Hans. config={goal:string}.
- send_email : envoi au client déclencheur. config={subject:string, goal:string}.
- prepare_instagram : création du texte et du visuel. config={theme:string}.
- publish_instagram : publication Instagram.
- generate_review_reply : rédaction de réponse. config={tone:"Chaleureux"|"Professionnel"|"Premium"}.
- publish_review_reply : publication de la réponse sur Google.
- notify_merchant : notification AtriumOne. config={message:string}.
- request_human_validation : notification et mise en attente. config={message:string}.
- schedule_instagram : planification du post préparé. config={delay_hours:number}.
- limit_once : évite de traiter deux fois le même événement.
- cooldown : empêche une nouvelle exécution pour le même client. config={days:number}.
- allowed_window : limite l'exécution aux heures de Paris. config={start_hour:number,end_hour:number}.
- stop_flow : arrête proprement une branche.

Règles de construction :
1. Exactement un déclencheur, placé en premier.
2. Donne toujours un résultat utile. Si une fonction demandée n'existe pas exactement, construis le flow exécutable le plus proche avec les blocs disponibles. Explique l'adaptation dans assumptions et, uniquement si elle change une capacité importante, dans warnings. Ne refuse jamais toute la demande pour une seule étape indisponible.
3. Un e-mail doit être précédé de marketing_consent ; la branche no mène à stop_flow.
4. Une publication Instagram doit être précédée de prepare_instagram.
5. Une publication d'avis doit être précédée de generate_review_reply.
6. Toute condition possède exactement une branche yes et une branche no. Les autres liaisons utilisent default.
7. Respecte les nombres, fréquences, tons, sujets et messages explicitement demandés.
8. Utilise mode=automatic uniquement quand le commerçant demande réellement l'exécution sans validation.
9. Pour une demande de SMS, webhook, Facebook, délai ou planification non disponible, conserve le déclencheur et les conditions demandés puis utilise notify_merchant comme relais opérationnel au point exact où l'action devrait intervenir. Pour une cadence sociale sans déclencheur compatible, choisis l'événement RCU le plus cohérent avec le contexte et indique cette adaptation.
10. title et summary décrivent le flow réellement construit. understanding reformule en une ou deux phrases ce que tu as compris. assumptions contient les choix ou adaptations nécessaires. warnings reste court et ne doit jamais empêcher la création du flow.

Format JSON attendu : {"title":"...","summary":"...","channel":"...","understanding":"...","assumptions":[],"warnings":[],"nodes":[{"key":"trigger","type":"new_customer","title":"...","config":{},"mode":"automatic"}],"edges":[{"source":"trigger","target":"condition","branch":"default","label":""}]}.`;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });

  const merchant = await getMerchant();
  if (!merchant) return NextResponse.json({ error: "Commerce introuvable." }, { status: 404 });

  const payload = await request.json() as { prompt?: string; theme?: string };
  const prompt = payload.prompt?.trim() ?? "";
  const theme = payload.theme?.trim() || "Autre";
  if (prompt.length < 12) return NextResponse.json({ error: "Décrivez plus précisément l’automatisation souhaitée." }, { status: 400 });
  if (prompt.length > 1_500) return NextResponse.json({ error: "Votre demande est trop longue. Limitez-la à 1 500 caractères." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  const modelInput = {
    commerce: {
      nom: merchant.business_name,
      activité: merchant.business_type,
      ville: merchant.city,
      description: merchant.description,
      ton: merchant.response_tone
    },
    catégorieChoisie: theme,
    demandeExacte: prompt
  };

  if (!apiKey) {
    return NextResponse.json({ blueprint: buildClosestFallbackBlueprint(prompt, theme) });
  }

  try {
    const firstText = await generateBlueprintText({ apiKey, input: modelInput });
    let blueprint;
    try {
      blueprint = parseHansAutomationBlueprint(JSON.parse(firstText));
    } catch (firstError) {
      const repairedText = await generateBlueprintText({
        apiKey,
        input: {
          ...modelInput,
          correctionDemandée: firstError instanceof Error ? firstError.message : "JSON ou flow invalide",
          premièrePropositionÀRéparer: firstText.slice(0, 6_000)
        },
        repair: true
      });
      blueprint = parseHansAutomationBlueprint(JSON.parse(repairedText));
    }
    return NextResponse.json({ blueprint });
  } catch {
    return NextResponse.json({ blueprint: buildClosestFallbackBlueprint(prompt, theme) });
  }
}

async function generateBlueprintText({
  apiKey,
  input,
  repair = false
}: {
  apiKey: string;
  input: Record<string, unknown>;
  repair?: boolean;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions: repair
        ? `${instructions}\n\nLa première proposition était invalide. Répare-la sans perdre la demande initiale et retourne obligatoirement un flow valide avec au moins deux étapes.`
        : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 2_400
    })
  });
  const body = await response.json() as OpenAIResponseBody;
  if (!response.ok) throw new Error(body.error?.message ?? "Hans n’a pas pu analyser votre demande.");
  return extractText(body);
}

function buildClosestFallbackBlueprint(prompt: string, theme: string) {
  const normalized = `${theme} ${prompt}`.toLocaleLowerCase("fr-FR");
  const automatic = wantsAutomaticExecution(normalized);
  const understanding = `Hans a construit l’automatisation disponible la plus proche de votre demande : ${prompt.slice(0, 260)}`;

  if (normalized.includes("avis") || normalized.includes("google")) {
    const nodes = [
      { key: "trigger", type: "google_review", title: "Détecter les nouveaux avis Google", config: { interval_count: 1, interval_unit: "jour(s)" } },
      { key: "generate", type: "generate_review_reply", title: "Hans prépare une réponse adaptée", config: { tone: "Chaleureux" }, mode: automatic ? "automatic" : "semi_automatic" },
      automatic
        ? { key: "finish", type: "publish_review_reply", title: "Publier la réponse sur Google", config: {}, mode: "automatic" }
        : { key: "finish", type: "notify_merchant", title: "Demander la validation du commerçant", config: { message: "Une réponse à un avis est prête à valider." }, mode: "automatic" }
    ];
    return parseHansAutomationBlueprint({
      title: "Traiter les nouveaux avis Google",
      summary: automatic ? "Hans répond automatiquement aux nouveaux avis détectés." : "Hans prépare chaque réponse puis demande votre validation.",
      channel: "Google",
      understanding,
      assumptions: ["En l’absence de fréquence exploitable, la veille est effectuée chaque jour."],
      warnings: [],
      nodes,
      edges: [{ source: "trigger", target: "generate", branch: "default" }, { source: "generate", target: "finish", branch: "default" }]
    });
  }

  if (normalized.includes("instagram") || normalized.includes("publication") || normalized.includes("post")) {
    const trigger = normalized.includes("récompense") || normalized.includes("fidel") ? "new_reward" : normalized.includes("inscri") || normalized.includes("nouveau client") ? "new_customer" : "new_visit";
    const nodes = [
      { key: "trigger", type: trigger, title: trigger === "new_reward" ? "Lorsqu’une récompense est gagnée" : trigger === "new_customer" ? "Lorsqu’un client s’inscrit" : "Lorsqu’une visite est validée", config: {} },
      { key: "prepare", type: "prepare_instagram", title: "Hans prépare la publication demandée", config: { theme: prompt.slice(0, 300) }, mode: automatic ? "automatic" : "semi_automatic" },
      automatic
        ? { key: "finish", type: "publish_instagram", title: "Publier sur Instagram", config: {}, mode: "automatic" }
        : { key: "finish", type: "notify_merchant", title: "Prévenir que la publication est prête", config: { message: "Votre publication Instagram est prête à valider." }, mode: "automatic" }
    ];
    return parseHansAutomationBlueprint({
      title: "Préparer une publication Instagram",
      summary: automatic ? "Hans prépare puis publie le contenu Instagram demandé." : "Hans prépare le contenu Instagram et vous prévient avant publication.",
      channel: "Instagram",
      understanding,
      assumptions: trigger === "new_visit" ? ["La demande ne précisait pas de déclencheur compatible ; Hans utilise une nouvelle visite RCU."] : [],
      warnings: [],
      nodes,
      edges: [{ source: "trigger", target: "prepare", branch: "default" }, { source: "prepare", target: "finish", branch: "default" }]
    });
  }

  if (normalized.includes("email") || normalized.includes("e-mail") || normalized.includes("mail")) {
    return parseHansAutomationBlueprint({
      title: "Envoyer un e-mail personnalisé",
      summary: automatic ? "Hans prépare et envoie l’e-mail demandé aux clients consentants." : "Hans prépare l’e-mail demandé et le conserve pour validation.",
      channel: "RCU + E-mail",
      understanding,
      assumptions: ["Hans utilise l’inscription RCU comme déclencheur et vérifie le consentement e-mail."],
      warnings: [],
      nodes: [
        { key: "trigger", type: "new_customer", title: "Lorsqu’un client s’inscrit au RCU", config: {} },
        { key: "consent", type: "marketing_consent", title: "Vérifier le consentement e-mail", config: {} },
        { key: "generate", type: "generate_email", title: "Hans rédige le message demandé", config: { goal: prompt.slice(0, 500) }, mode: automatic ? "automatic" : "semi_automatic" },
        { key: "send", type: "send_email", title: automatic ? "Envoyer l’e-mail" : "Préparer l’e-mail pour validation", config: { subject: "Un message pour vous", goal: prompt.slice(0, 500) }, mode: automatic ? "automatic" : "semi_automatic" },
        { key: "stop", type: "stop_flow", title: "Ne rien envoyer sans consentement", config: {} }
      ],
      edges: [
        { source: "trigger", target: "consent", branch: "default" },
        { source: "consent", target: "generate", branch: "yes", label: "Oui" },
        { source: "generate", target: "send", branch: "default" },
        { source: "consent", target: "stop", branch: "no", label: "Non" }
      ]
    });
  }

  return parseHansAutomationBlueprint({
    title: "Suivre l’action demandée",
    summary: "Hans détecte l’événement client le plus proche et vous transmet l’action à réaliser.",
    channel: theme || "Automatisation",
    understanding,
    assumptions: ["Aucune action native ne correspondait exactement ; Hans utilise une notification opérationnelle."],
    warnings: [],
    nodes: [
      { key: "trigger", type: "new_customer", title: "Lorsqu’un nouveau client s’inscrit", config: {} },
      { key: "notify", type: "notify_merchant", title: "Transmettre l’action demandée", config: { message: prompt.slice(0, 500) }, mode: "automatic" }
    ],
    edges: [{ source: "trigger", target: "notify", branch: "default" }]
  });
}

function wantsAutomaticExecution(value: string) {
  if (/sans mon accord|avec mon accord|je valide|validation|brouillon|ne publie|ne poste|avant de publier/.test(value)) return false;
  return /automatique|automatiquement|sans validation|publie directement|envoie directement/.test(value);
}

function extractText(body: OpenAIResponseBody) {
  const text = body.output_text?.trim() || body.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("").trim();
  if (!text) throw new Error("Hans a retourné une réponse vide.");
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
