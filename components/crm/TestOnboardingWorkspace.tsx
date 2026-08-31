"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LeadOption = { id: string; name: string; email: string | null; business_id: string | null; commercial_status: string };
type Connection = { status?: string | null; last_error?: string | null } | null;
type ConnectionState = {
  account: { account_enabled: boolean; onboarding_status: string } | null;
  modules: Array<{ module_key: string; enabled: boolean }>;
  google: Connection & { google_account_email?: string | null; google_location_id?: string | null; google_location_name?: string | null; last_sync_at?: string | null };
  instagram: Connection & { instagram_username?: string | null; last_checked_at?: string | null };
  gmail: Connection & { gmail_address?: string | null; last_checked_at?: string | null };
} | null;
type Task = { id: string; title: string; detail: string; owner: "Louis" | "Client" | "Ensemble"; warning?: string; link?: { label: string; href: string } };
type Stage = { title: string; subtitle: string; tasks: Task[] };

const productionCallbacks = [
  ["Google Business", "https://app.atrium-one.fr/api/google/callback"],
  ["Gmail", "https://app.atrium-one.fr/api/gmail/callback"],
  ["Instagram", "https://app.atrium-one.fr/api/instagram/callback"]
] as const;

const stages: Stage[] = [
  {
    title: "1. Préparer le dossier du commerce",
    subtitle: "À obtenir avant le rendez-vous d’onboarding.",
    tasks: [
      { id: "identity", title: "Compléter la fiche prospect", detail: "Nom légal/commercial, activité, ville, téléphone, e-mail, site et interlocuteur principal.", owner: "Louis" },
      { id: "google-email", title: "Identifier le compte Google administrateur", detail: "Noter l’adresse Google qui possède ou gère réellement la fiche Google Business Profile.", owner: "Client" },
      { id: "gmail-email", title: "Choisir l’adresse Gmail d’envoi", detail: "Elle peut être identique au compte Google Business, mais ce n’est pas obligatoire.", owner: "Client" },
      { id: "instagram-handle", title: "Identifier le compte Instagram", detail: "Noter le @ exact et vérifier que le client peut s’y connecter et valider une autorisation.", owner: "Client" },
      { id: "brand-assets", title: "Récupérer les éléments de marque", detail: "Logo, site, courte description, ton de réponse et couleurs principales.", owner: "Ensemble" },
      { id: "no-password", title: "Confirmer qu’aucun mot de passe n’est collecté", detail: "Le client saisit lui-même ses identifiants Google, Gmail, Instagram et ses codes 2FA dans les fenêtres officielles OAuth.", owner: "Louis", warning: "Ne jamais demander ni stocker de mot de passe, code 2FA ou code de récupération." }
    ]
  },
  {
    title: "2. Autoriser les comptes de test",
    subtitle: "Seulement tant que les applications Google ou Meta ne sont pas publiées en production.",
    tasks: [
      { id: "google-test-user", title: "Ajouter l’adresse Google aux utilisateurs test", detail: "Google Cloud → Google Auth Platform → Audience → Test users → Add users. Utiliser exactement l’adresse qui autorisera Google Business et/ou Gmail.", owner: "Louis", link: { label: "Ouvrir Google Audience", href: "https://console.cloud.google.com/auth/audience" } },
      { id: "meta-tester", title: "Ajouter le compte Instagram comme testeur Meta", detail: "Meta for Developers → application AtriumOne → App roles / Roles → ajouter le compte Instagram professionnel autorisé.", owner: "Louis", link: { label: "Ouvrir Meta for Developers", href: "https://developers.facebook.com/apps/" } },
      { id: "meta-invite", title: "Faire accepter l’invitation Meta", detail: "Le client ouvre son compte Instagram et accepte l’invitation de testeur avant de lancer la connexion dans AtriumOne.", owner: "Client" },
      { id: "professional-account", title: "Vérifier le type de compte Instagram", detail: "Le compte doit être Professionnel : Business ou Creator. AtriumOne refuse les comptes personnels pour la publication.", owner: "Client", link: { label: "Aide Meta", href: "https://www.facebook.com/help/instagram/502981923235522" } },
      { id: "live-skip", title: "Ignorer les allowlists si les apps sont Live", detail: "Quand Meta et Google sont publiés et les permissions approuvées, les nouveaux clients ne doivent plus être ajoutés manuellement comme testeurs.", owner: "Louis" }
    ]
  },
  {
    title: "3. Créer et ouvrir l’accès AtriumOne",
    subtitle: "Le compte produit et la fiche CRM restent deux objets distincts.",
    tasks: [
      { id: "signup", title: "Faire créer le compte depuis le site AtriumOne", detail: "Le client utilise son e-mail professionnel. La nouvelle inscription doit apparaître automatiquement dans le CRM en attente d’onboarding.", owner: "Client" },
      { id: "association", title: "Vérifier l’association au bon prospect", detail: "Contrôler le rapprochement par e-mail exact. En cas de signal faible, associer manuellement depuis la fiche lead.", owner: "Louis" },
      { id: "profile", title: "Compléter le profil commerçant", detail: "Nom, catégorie, ville, téléphone, description, site, logo et ton de réponse dans les Réglages AtriumOne.", owner: "Ensemble" },
      { id: "global-access", title: "Activer le compte global", detail: "Fiche lead → Accès AtriumOne → Activer AtriumOne. Sans ce toggle, tous les modules restent bloqués.", owner: "Louis" },
      { id: "modules", title: "Activer seulement les modules du test", detail: "Base recommandée : Avis Google, Instagram, Hans et Emailing. Ajouter Automatisations/RCU uniquement quand leur onboarding est prévu.", owner: "Louis" }
    ]
  },
  {
    title: "4. Connecter les comptes dans la session client",
    subtitle: "Le client effectue les consentements depuis son propre espace AtriumOne.",
    tasks: [
      { id: "open-integrations", title: "Ouvrir Intégrations dans la session du client", detail: "Se connecter avec le compte commerçant puis ouvrir /integrations. Le compte CRM administrateur ne doit pas effectuer ces OAuth à sa place.", owner: "Ensemble" },
      { id: "google-connect", title: "Connecter Google Business Profile", detail: "Cliquer Connecter Google, choisir le compte qui gère la fiche, accepter business.manage puis sélectionner la bonne fiche si plusieurs établissements sont proposés.", owner: "Client" },
      { id: "google-sync", title: "Vérifier la première synchronisation Google", detail: "Le nom de l’établissement doit apparaître et les avis doivent être importés sans erreur 403 ni fiche introuvable.", owner: "Louis" },
      { id: "instagram-connect", title: "Connecter Instagram", detail: "Depuis Instagram dans AtriumOne, lancer Configurer Instagram et autoriser instagram_business_basic + instagram_business_content_publish.", owner: "Client" },
      { id: "instagram-check", title: "Contrôler le @ Instagram enregistré", detail: "Le compte affiché dans AtriumOne doit être exactement celui du commerce et son statut doit être Connecté.", owner: "Louis" },
      { id: "gmail-connect", title: "Connecter Gmail", detail: "Depuis Intégrations/Emailing, sélectionner l’adresse expéditrice et autoriser uniquement l’envoi gmail.send. AtriumOne ne lit pas la boîte de réception.", owner: "Client" },
      { id: "gmail-test", title: "Envoyer l’e-mail de test", detail: "Utiliser le bouton de test Gmail et vérifier la réception, l’expéditeur et l’absence d’erreur d’autorisation.", owner: "Louis" }
    ]
  },
  {
    title: "5. Valider le test avant lancement",
    subtitle: "Contrôle fonctionnel avec une action sûre par module.",
    tasks: [
      { id: "review-check", title: "Avis Google", detail: "Vérifier l’import d’avis et préparer une réponse brouillon. Ne publier qu’avec l’accord du client pendant la démonstration.", owner: "Ensemble" },
      { id: "instagram-draft", title: "Instagram", detail: "Générer un brouillon, vérifier le visuel et la légende, puis publier un contenu test uniquement avec validation explicite.", owner: "Ensemble" },
      { id: "hans-settings", title: "Hans", detail: "Contrôler le nom, l’activité, la description, le ton de réponse et le site utilisés pour personnaliser les générations.", owner: "Louis" },
      { id: "email-draft", title: "Emailing", detail: "Créer une campagne test envoyée à une adresse interne avant d’utiliser une base clients réelle.", owner: "Ensemble" },
      { id: "permissions-check", title: "Permissions modules", detail: "Se reconnecter avec le compte client : les modules ON fonctionnent et les modules OFF restent verrouillés.", owner: "Louis" },
      { id: "timeline-log", title: "Consigner l’onboarding dans le CRM", detail: "Créer le rendez-vous effectué, une note synthétique et les tâches de suivi J+7, J+15 et J+30.", owner: "Louis" }
    ]
  },
  {
    title: "6. Piloter les 30 jours",
    subtitle: "Cadence recommandée pour mesurer l’usage et éviter les connexions expirées.",
    tasks: [
      { id: "start-date", title: "Fixer la date de début et la date de fin", detail: "Le test dure 30 jours à partir de l’activation opérationnelle, pas simplement de la création du compte.", owner: "Louis" },
      { id: "day-7", title: "J+7 — adoption", detail: "Contrôler les connexions, les premières actions et les points de blocage. Reconnecter Google/Gmail si l’app OAuth est encore en mode Testing.", owner: "Louis", warning: "En mode Google OAuth Testing externe, les refresh tokens peuvent expirer après 7 jours." },
      { id: "day-15", title: "J+15 — valeur", detail: "Mesurer les avis traités, contenus générés/publiés, campagnes envoyées et temps gagné.", owner: "Ensemble" },
      { id: "day-30", title: "J+30 — bilan", detail: "Faire le bilan, qualifier les objections et décider : signature, prolongation exceptionnelle ou arrêt.", owner: "Ensemble" },
      { id: "opportunity", title: "Mettre à jour l’opportunité", detail: "Renseigner le MRR et le statut. Si le client signe, utiliser Affaire closée pour transformer automatiquement le prospect en Client.", owner: "Louis" }
    ]
  },
  {
    title: "7. Clôturer proprement",
    subtitle: "Conserver uniquement les accès nécessaires après le test.",
    tasks: [
      { id: "won", title: "Si le test est gagné", detail: "Marquer l’opportunité Gagnée, confirmer les modules souscrits et laisser les connexions actives.", owner: "Louis" },
      { id: "lost", title: "Si le test s’arrête", detail: "Marquer l’opportunité Perdue, couper account_enabled ou les modules concernés et documenter la raison.", owner: "Louis" },
      { id: "disconnect", title: "Révoquer les connexions si demandé", detail: "Déconnecter Google, Instagram et Gmail depuis AtriumOne. Ne jamais supprimer le compte Auth ou le commerce sans demande distincte.", owner: "Ensemble" },
      { id: "remove-testers", title: "Nettoyer les testeurs développeur", detail: "Après déconnexion et fin définitive, retirer l’adresse Google et le compte Instagram des listes de test si elles sont toujours utilisées.", owner: "Louis" }
    ]
  }
];

export function TestOnboardingWorkspace({ leads, initialLeadId, connectionState, providerState }: { leads: LeadOption[]; initialLeadId: string | null; connectionState: ConnectionState; providerState: { googleConfigured: boolean; instagramConfigured: boolean; gmailConfigured: boolean } }) {
  const router = useRouter();
  const selectedLead = leads.find((lead) => lead.id === initialLeadId) ?? null;
  const storageKey = `atriumone:test-onboarding:${selectedLead?.id ?? "generic"}`;
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const taskIds = useMemo(() => stages.flatMap((stage) => stage.tasks.map((task) => task.id)), []);

  useEffect(() => {
    try { setCompleted(new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[])); }
    catch { setCompleted(new Set()); }
    setLoaded(true);
  }, [storageKey]);

  function toggle(id: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  function selectLead(id: string) { router.push(id ? `/crm/onboarding-test?lead=${id}` : "/crm/onboarding-test"); }
  function reset() { if (confirm("Réinitialiser la checklist de ce client ?")) { localStorage.removeItem(storageKey); setCompleted(new Set()); } }
  const progress = loaded ? Math.round((completed.size / taskIds.length) * 100) : 0;

  return <div>
    <header className="border-b border-[#E8E4DB] bg-white px-5 py-5 lg:px-8">
      <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">Campagne test · Septembre → Décembre 2026</div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black tracking-[-.03em]">Onboarding client test · 30 jours</h1><p className="mt-1 max-w-3xl text-sm font-semibold text-[#6B617F]">Le mode opératoire complet pour préparer les accès développeur, connecter les comptes du commerce et lancer un test mesurable.</p></div><button type="button" onClick={() => window.print()} className="ao-btn-secondary px-4 py-2.5 text-xs font-black">Imprimer le guide</button></div>
    </header>

    <main className="space-y-5 p-5 lg:p-8">
      <section className="grid gap-4 rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm lg:grid-cols-[minmax(280px,1fr)_minmax(320px,1.4fr)]">
        <div><label className="ao-label">Prospect à onboarder<select value={initialLeadId ?? ""} onChange={(event) => selectLead(event.target.value)} className="ao-select mt-1 h-11 w-full px-3"><option value="">Guide sans prospect</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.commercial_status}</option>)}</select></label>{selectedLead ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2 py-1 font-black ${selectedLead.business_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{selectedLead.business_id ? "Compte AtriumOne créé" : "Aucun compte AtriumOne"}</span><Link href={`/crm/leads/${selectedLead.id}`} className="font-black text-[#6D28D9]">Ouvrir la fiche →</Link></div> : <p className="mt-2 text-xs font-semibold text-[#8B7AA8]">Sélectionne un prospect pour afficher son état réel et conserver une checklist dédiée sur cet appareil.</p>}</div>
        <div className="rounded-xl bg-[#F8F5FF] p-4"><div className="flex items-center justify-between"><div><div className="text-xs font-black">Progression de l’onboarding</div><div className="mt-0.5 text-[10px] font-semibold text-[#8B7AA8]">{completed.size} / {taskIds.length} étapes cochées</div></div><div className="text-2xl font-black text-[#7C3AED]">{progress}%</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} /></div><button type="button" onClick={reset} className="mt-3 text-[10px] font-black text-[#8B7AA8] hover:text-red-600">Réinitialiser cette checklist</button></div>
      </section>

      <section className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-black">Préparation technique AtriumOne</h2><p className="mt-1 text-xs font-semibold text-[#6B617F]">Ces réglages concernent le projet AtriumOne et ne sont pas à refaire pour chaque client.</p></div><div className="flex flex-wrap gap-2"><Readiness label="Google OAuth" ready={providerState.googleConfigured} /><Readiness label="Instagram OAuth" ready={providerState.instagramConfigured} /><Readiness label="Gmail OAuth" ready={providerState.gmailConfigured} /></div></div><div className="mt-4 grid gap-3 lg:grid-cols-3"><InfraCard title="Google Cloud" text="Activer Gmail API, My Business Account Management API et My Business Business Information API. Conserver business.manage et gmail.send dans l’écran de consentement." href="https://console.cloud.google.com/apis/library" /><InfraCard title="Meta for Developers" text="Configurer Instagram API with Instagram Login et les permissions instagram_business_basic + instagram_business_content_publish." href="https://developers.facebook.com/apps/" /><InfraCard title="URLs OAuth production" text="Les trois URL ci-dessous doivent être déclarées exactement dans les consoles développeur." /></div><div className="mt-3 grid gap-2 lg:grid-cols-3">{productionCallbacks.map(([label, url]) => <div key={label} className="rounded-lg bg-[#FAF9F7] px-3 py-2"><div className="text-[10px] font-black uppercase text-[#8B7AA8]">{label}</div><code className="mt-1 block break-all text-[11px] font-bold text-[#4C1D95]">{url}</code></div>)}</div></section>

      {selectedLead ? <LiveState state={connectionState} /> : null}

      <div className="space-y-4">{stages.map((stage) => <section key={stage.title} className="overflow-hidden rounded-xl border border-[#E8E4DB] bg-white shadow-sm"><div className="border-b border-[#EEEAE2] px-4 py-3"><h2 className="text-sm font-black">{stage.title}</h2><p className="mt-0.5 text-[11px] font-semibold text-[#8B7AA8]">{stage.subtitle}</p></div><div className="divide-y divide-[#F0EDE7]">{stage.tasks.map((task) => <label key={task.id} className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-[#FCFBFF] ${completed.has(task.id) ? "bg-emerald-50/35" : ""}`}><input type="checkbox" checked={completed.has(task.id)} onChange={() => toggle(task.id)} className="mt-0.5 h-4 w-4 accent-[#7C3AED]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-black ${completed.has(task.id) ? "text-[#6B617F] line-through" : ""}`}>{task.title}</span><Owner value={task.owner} /></div><p className="mt-1 text-xs leading-5 text-[#6B617F]">{task.detail}</p>{task.warning ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">⚠ {task.warning}</div> : null}</div>{task.link ? <a href={task.link.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="shrink-0 rounded-lg bg-[#F3E8FF] px-3 py-2 text-[10px] font-black text-[#6D28D9]">{task.link.label}</a> : null}</label>)}</div></section>)}</div>

      <section className="rounded-xl border border-[#C4B5FD] bg-[#F5F3FF] p-4"><h2 className="text-sm font-black text-[#4C1D95]">Point critique pour un test de 30 jours</h2><p className="mt-2 text-xs leading-5 text-[#5B4778]">Si le projet Google OAuth reste en statut externe <strong>Testing</strong>, les refresh tokens accordés avec Google Business ou Gmail peuvent expirer après 7 jours. Pour un test continu de 30 jours, publie l’application OAuth avec le niveau de vérification nécessaire ou prévois explicitement une reconnexion à J+7, J+14 et J+21.</p><div className="mt-3 flex flex-wrap gap-2"><a href="https://developers.google.com/identity/protocols/oauth2#expiration" target="_blank" rel="noreferrer" className="text-[11px] font-black text-[#6D28D9]">Documentation Google OAuth ↗</a><a href="https://developers.google.com/my-business/content/basic-setup" target="_blank" rel="noreferrer" className="text-[11px] font-black text-[#6D28D9]">Configuration Google Business ↗</a><a href="https://developers.google.com/workspace/gmail/api/auth/scopes" target="_blank" rel="noreferrer" className="text-[11px] font-black text-[#6D28D9]">Permissions Gmail ↗</a></div></section>
    </main>
  </div>;
}

function Readiness({ label, ready }: { label: string; ready: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ready ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{ready ? "✓" : "!"} {label}</span>; }
function InfraCard({ title, text, href }: { title: string; text: string; href?: string }) { const body = <><div className="text-xs font-black">{title}</div><p className="mt-1 text-[11px] leading-5 text-[#6B617F]">{text}</p>{href ? <div className="mt-2 text-[10px] font-black text-[#6D28D9]">Ouvrir la console ↗</div> : null}</>; return href ? <a href={href} target="_blank" rel="noreferrer" className="rounded-lg border border-[#EEEAE2] p-3 transition hover:border-[#C4B5FD] hover:bg-[#FAF8FF]">{body}</a> : <div className="rounded-lg border border-[#EEEAE2] p-3">{body}</div>; }
function Owner({ value }: { value: Task["owner"] }) { const tone = value === "Louis" ? "bg-violet-50 text-violet-700" : value === "Client" ? "bg-cyan-50 text-cyan-700" : "bg-fuchsia-50 text-fuchsia-700"; return <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${tone}`}>{value}</span>; }
function LiveState({ state }: { state: ConnectionState }) { if (!state) return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">Ce prospect n’a pas encore de compte AtriumOne associé. Commence par l’inscription et le rapprochement CRM.</section>; const enabledModules = state.modules.filter((module) => module.enabled).map((module) => module.module_key); return <section className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm"><div><h2 className="text-sm font-black">État réel du client sélectionné</h2><p className="mt-1 text-xs font-semibold text-[#6B617F]">Lecture directe des connexions enregistrées, sans exposer de jeton ni de secret.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatusCard title="Compte" ready={state.account?.account_enabled === true} value={state.account?.account_enabled ? `Actif · ${state.account.onboarding_status}` : state.account ? `Désactivé · ${state.account.onboarding_status}` : "Accès non configuré"} /><StatusCard title="Google Business" ready={state.google?.status === "connected" && Boolean(state.google.google_location_id)} value={state.google?.google_location_name ?? state.google?.google_account_email ?? state.google?.status ?? "Non connecté"} error={state.google?.last_error} /><StatusCard title="Instagram" ready={["connected", "expiring"].includes(state.instagram?.status ?? "")} value={state.instagram?.instagram_username ? `@${state.instagram.instagram_username}` : state.instagram?.status ?? "Non connecté"} error={state.instagram?.last_error} /><StatusCard title="Gmail" ready={state.gmail?.status === "connected"} value={state.gmail?.gmail_address ?? state.gmail?.status ?? "Non connecté"} error={state.gmail?.last_error} /></div><div className="mt-3 text-[10px] font-semibold text-[#8B7AA8]">Modules ON : {enabledModules.length ? enabledModules.join(" · ") : "aucun"}</div></section>; }
function StatusCard({ title, ready, value, error }: { title: string; ready: boolean; value: string; error?: string | null }) { return <div className={`rounded-lg border p-3 ${ready ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-black uppercase tracking-wide text-[#8B7AA8]">{title}</div><span className={`h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} /></div><div className="mt-2 truncate text-xs font-black">{value}</div>{error ? <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-red-600">{error}</p> : null}</div>; }
