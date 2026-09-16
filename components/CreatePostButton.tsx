"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HansGeneratingModal } from "@/components/HansGeneratingModal";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { getUserErrorMessage } from "@/lib/user-feedback";

export function CreatePostButton({
  href,
  className,
  label = "Créer le post"
}: {
  href: string;
  className: string;
  label?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { toast, showToast } = useToast();
  const target = new URL(href, "https://app.atrium-one.fr");
  const isStory = target.pathname === "/social/stories/create" || target.searchParams.get("contentType") === "story";

  async function createPost() {
    if (creating) {
      return;
    }

    setCreating(true);
    showToast("Création du brouillon en cours...", "saving");

    try {
      const idea = Object.fromEntries(target.searchParams.entries());
      const response = await fetch(isStory ? "/api/social/stories" : "/api/social/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isStory ? { idea: { ...idea, contentType: "story" } } : idea)
      });
      const data = (await response.json()) as { post?: { id: string; media_kind?: string }; story?: { id: string }; error?: string };
      const created = isStory ? data.story : data.post;

      if (!response.ok || !created) {
        throw new Error(data.error ?? "Création du brouillon impossible.");
      }

      router.push(isStory || data.post?.media_kind === "story" ? `/social/stories/${created.id}` : `/social/editor/${created.id}`);
    } catch (error) {
      setCreating(false);
      showToast(getUserErrorMessage(error, "Création du brouillon impossible."), "error");
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={creating}
        onClick={() => createPost()}
        className={`${className} ${creating ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {label}
      </button>
      <Toast toast={toast} />
      <HansGeneratingModal
        open={creating}
        title={isStory ? "Hans crée votre Story" : "Hans crée votre post"}
        description={isStory ? "Hans rédige votre Story et compose son visuel 9:16 avec les photos et la charte de votre commerce." : "Hans analyse les avis liés à cette recommandation, rédige le contenu et prépare le visuel avant ouverture du draft."}
      />
    </>
  );
}
