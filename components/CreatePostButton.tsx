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

  async function createPost() {
    if (creating) {
      return;
    }

    setCreating(true);
    showToast("Création du brouillon en cours...", "saving");

    try {
      const url = new URL(href, window.location.origin);
      const response = await fetch("/api/social/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(url.searchParams.entries()))
      });
      const data = (await response.json()) as { post?: { id: string }; error?: string };

      if (!response.ok || !data.post) {
        throw new Error(data.error ?? "Création du brouillon impossible.");
      }

      router.push(`/social/editor/${data.post.id}`);
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
        onClick={() => void createPost()}
        className={`${className} ${creating ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {label}
      </button>
      <Toast toast={toast} />
      <HansGeneratingModal
        open={creating}
        title="Hans crée votre post"
        description="Hans analyse les avis liés à cette recommandation, rédige le contenu et prépare le visuel avant ouverture du draft."
      />
    </>
  );
}
