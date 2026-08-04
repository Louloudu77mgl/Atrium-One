import { NextResponse } from "next/server";
import { getAutomationSettings } from "@/lib/automation-settings";
import { getReviewAutomationDecision } from "@/lib/review-automation";
import { sanitizeHansHtml } from "@/lib/sanitize-hans-html";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type HansReplyRequest = {
  review_id?: string;
  review_text?: string;
  rating?: number;
  author_name?: string;
  merchant_name?: string;
  business_type?: string;
  response_tone?: string;
};

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante." },
      { status: 500 }
    );
  }

  const reviewId = new URL(request.url).searchParams.get("review_id");

  if (!reviewId) {
    return NextResponse.json(
      { error: "review_id est requis." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur non connecté." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("generated_replies")
    .select("id, reply_text, generated_text, status, is_edited, edited_at, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Aucune réponse générée pour cet avis.", reply: null },
      { status: 404 }
    );
  }

  return NextResponse.json({
    reply_id: data.id,
    reply_text: data.reply_text,
    generated_text: data.generated_text,
    reply_status: data.status,
    is_edited: data.is_edited,
    edited_at: data.edited_at,
    created_at: data.created_at
  });
}

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: {
    message?: string;
  };
};

function extractReply(body: OpenAIResponseBody) {
  if (body.output_text) {
    return body.output_text.trim();
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

export async function POST(request: Request) {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  if (!openAiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante. Ajoutez-la dans .env.local." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as HansReplyRequest;
  const reviewText = payload.review_text?.trim();
  const rating = Number(payload.rating);
  const authorName = payload.author_name?.trim();
  const merchantName = payload.merchant_name?.trim() || "votre boutique";
  const businessType = payload.business_type?.trim();
  const responseTone = payload.response_tone?.trim() || "chaleureux";

  if (!reviewText || !rating || !businessType) {
    return NextResponse.json(
      { error: "review_text, rating et business_type sont requis." },
      { status: 400 }
    );
  }

  const prompt = [
    `Commerce: ${merchantName}`,
    `Type de commerce: ${businessType}`,
    `Ton de réponse souhaité: ${responseTone}`,
    `Nom du client: ${authorName || "non renseigné"}`,
    `Note de l'avis: ${rating}/5`,
    `Avis client: ${reviewText}`,
    `Signature obligatoire: <p>L’équipe ${merchantName === "votre boutique" ? "de votre boutique" : merchantName}</p>`,
    "",
    "Rédige une réponse Google en français, prête à afficher dans l'interface.",
    "La réponse doit donner l'impression qu'une personne de la boutique a vraiment lu l'avis.",
    "Reprends explicitement 1 à 3 éléments concrets du commentaire client, sans en inventer.",
    "Réponds à la joie, la douleur, la déception, l'attente ou le point précis exprimé par le client.",
    "Adapte fortement la réponse à la note, au sentiment et au contenu réel de l'avis."
  ].join("\n");

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "Tu es Hans, l'agent IA d'AtriumOne. Tu aides les commerçants de proximité à répondre à leurs avis Google avec chaleur, empathie et précision. Ta réponse doit donner l'impression qu'elle a été écrite par quelqu'un qui a vraiment lu l'avis. Reprends les détails concrets du commentaire client. La réponse doit être personnalisée, humaine, professionnelle et rassurante.\n\nObjectif principal :\n- ne jamais produire une réponse générique ou passe-partout\n- répondre concrètement à la joie, la douleur, la déception, l'attente ou le problème du client\n- reprendre explicitement 1 à 3 éléments concrets de l'avis client\n- adapter fortement la réponse à la note, au sentiment et au contenu réel de l'avis\n- rester humain, commerçant, naturel, jamais robotique\n\nMéthode obligatoire, sans l'afficher :\n1. Repère le prénom ou le nom du client si fourni.\n2. Repère l'émotion principale : joie, satisfaction, déception, frustration, colère, inquiétude, attente ou nuance.\n3. Repère 1 à 3 détails concrets dans l'avis : produit, bouquet, livraison, retard, fraîcheur, accueil, prix, commande, conseil, attente, service, occasion, geste apprécié ou problème cité.\n4. Rédige une réponse qui répond précisément à ces détails, sans inventer d'information absente de l'avis.\n\nRègles générales :\n- ton chaleureux, professionnel et adapté au ton demandé\n- 3 à 6 paragraphes courts si nécessaire\n- remercier le client de façon sincère\n- utiliser le prénom ou le nom du client si disponible\n- ne jamais inventer un détail absent de l'avis\n- éviter les phrases vagues si elles ne sont pas reliées à un détail concret\n- ne pas utiliser de formule froide comme « Nous prenons note »\n- ne pas faire de promesse irréaliste\n- ne jamais mentionner l'IA ou AtriumOne dans la réponse finale\n\nAvis négatif :\n- remercier sincèrement le client\n- reconnaître précisément le problème évoqué\n- formuler des excuses naturelles si l'expérience n'a pas été à la hauteur\n- expliquer brièvement que ce n'est pas le niveau attendu par la boutique\n- proposer une solution ou une prise de contact concrète\n- montrer que l'avis aide la boutique à s'améliorer\n- ne jamais être défensif, agressif ou accusateur\n\nAvis positif :\n- remercier chaleureusement le client\n- reprendre les détails positifs cités dans l'avis\n- valoriser l'équipe, le savoir-faire, l'accueil, le conseil ou le produit concerné\n- inviter le client à revenir naturellement\n\nAvis neutre :\n- remercier le client\n- reconnaître le point positif éventuel\n- répondre au point d'amélioration avec précision\n- proposer une meilleure expérience la prochaine fois\n\nStructure conseillée :\n- <p>Bonjour [prénom ou nom],</p>\n- <p>Remerciement sincère + reprise d'un détail concret de l'avis.</p>\n- <p>Réponse précise à la joie, la douleur ou le point d'amélioration.</p>\n- <p>Solution, invitation ou prochaine étape adaptée.</p>\n- signature obligatoire\n\nFormat de sortie obligatoire :\n- retourne uniquement du HTML simple, sans Markdown ni texte hors balises\n- HTML autorisé uniquement : <p>, <br>, <strong>, <em>\n- aucun attribut HTML, aucune classe CSS\n- interdit : <script>, <style>, iframe, liens externes, images\n- la signature est toujours le dernier paragraphe exact : <p>L’équipe [merchant_name]</p>\n- si merchant_name est absent, utiliser : <p>L’équipe de votre boutique</p>",
      input: prompt,
      max_output_tokens: 700
    })
  });

  const responseBody = (await openAiResponse.json()) as OpenAIResponseBody;

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error: responseBody.error?.message ?? "OpenAI n'a pas pu générer la réponse."
      },
      { status: openAiResponse.status }
    );
  }

  const replyText = sanitizeHansHtml(extractReply(responseBody));

  if (!replyText) {
    return NextResponse.json(
      { error: "OpenAI a retourné une réponse vide." },
      { status: 502 }
    );
  }

  let saved = false;
  let saveError: string | undefined;
  let replyId: string | undefined;
  let persistedReplyStatus: string | undefined;
  let persistedReviewStatus: string | undefined;

  if (payload.review_id && hasSupabaseEnv()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const settings = await getAutomationSettings();
      const decision = getReviewAutomationDecision({
        rating,
        reviewText,
        settings
      });
      const replyStatus =
        decision.blockedBySafety
          ? "blocked_by_safety"
          : decision.requiresValidation
            ? "validation_required"
            : "generated";
      const reviewStatus =
        decision.blockedBySafety
          ? "blocked_by_safety"
          : decision.requiresValidation
            ? "validation_required"
            : "generated";
      persistedReplyStatus = replyStatus;
      persistedReviewStatus = reviewStatus;

      const { error: supersedeError } = await supabase
        .from("generated_replies")
        .update({ status: "superseded" })
        .eq("review_id", payload.review_id)
        .in("status", ["generated", "selected", "approved", "validation_required", "blocked_by_safety"]);

      if (supersedeError) {
        saveError = supersedeError.message;
      } else {
        const { data: insertedReply, error: insertError } = await supabase
          .from("generated_replies")
          .insert({
            review_id: payload.review_id,
            generated_text: replyText,
            reply_text: replyText,
            status: replyStatus,
            is_edited: false,
            edited_at: null
          })
          .select("id")
          .single();

        if (insertError) {
          saveError = insertError.message;
        } else {
          replyId = insertedReply.id;

          const { error: reviewUpdateError } = await supabase
            .from("reviews")
            .update({ status: reviewStatus })
            .eq("id", payload.review_id);

          if (reviewUpdateError) {
            saveError = reviewUpdateError.message;
          } else {
            saved = true;
          }
        }
      }
    }
  }

  return NextResponse.json({
    reply_text: replyText,
    reply_id: replyId,
    reply_status: persistedReplyStatus,
    review_status: persistedReviewStatus,
    is_edited: false,
    saved,
    save_error: saveError
  });
}
