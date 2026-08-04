"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Toast } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { appShellStyles, badgeStyles, buttonStyles, surfaceStyles, typographyStyles } from "@/lib/design-system";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { buildSmsAudience, estimateSmsParts, type SmsTone } from "@/lib/sms-shared";
import type { CustomerRow, SmsCampaignRow, SmsTemplateRow } from "@/lib/supabase/types";
import { getUserErrorMessage } from "@/lib/user-feedback";

type CampaignStatus = SmsCampaignRow["status"];
type AudienceMode = "all" | "recent" | "winback" | "vip" | "single";

const toneOptions: SmsTone[] = ["chaleureux", "premium", "drôle", "direct", "élégant", "familial"];

function getStatusLabel(status: CampaignStatus) {
  switch (status) {
    case "sent":
      return "Envoyée";
    case "scheduled":
      return "Programmée";
    default:
      return "Brouillon";
  }
}

function getStatusBadge(status: CampaignStatus) {
  switch (status) {
    case "sent":
      return badgeStyles.hans;
    case "scheduled":
      return badgeStyles.warning;
    default:
      return badgeStyles.neutral;
  }
}

function getAudienceLabel(mode: AudienceMode) {
  switch (mode) {
    case "recent":
      return "Clients récents";
    case "winback":
      return "Clients à relancer";
    case "vip":
      return "Clients fidèles";
    case "single":
      return "Tester sur un client";
    default:
      return "Tous les clients opt-in";
  }
}

export function SmsCampaignsClient({
  customers: initialCustomers,
  campaigns: initialCampaigns,
  templates
}: {
  customers: CustomerRow[];
  campaigns: SmsCampaignRow[];
  templates: SmsTemplateRow[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [csvText, setCsvText] = useState("");
  const { toast, showToast } = useToast();
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState("Relance clients fidèles");
  const [objective, setObjective] = useState("Inviter des clients à revenir cette semaine avec un message très personnel.");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("winback");
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomers[0]?.id ?? "");
  const [tone, setTone] = useState<SmsTone>("chaleureux");
  const [previewSms, setPreviewSms] = useState("");
  const [previewPhone, setPreviewPhone] = useState(initialCustomers[0]?.phone ?? "");
  const [manualFirstName, setManualFirstName] = useState("Camille");
  const [manualLastName, setManualLastName] = useState("");
  const [manualPhone, setManualPhone] = useState("06 12 34 56 78");
  const [manualProduct, setManualProduct] = useState("pain au chocolat");
  const [manualNotes, setManualNotes] = useState("Client fidèle du week-end");
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0] ?? null,
    [customers, selectedCustomerId]
  );

  const audienceCustomers = useMemo(
    () => buildSmsAudience(customers, audienceMode, selectedCustomerId),
    [audienceMode, customers, selectedCustomerId]
  );

  const smsMetrics = estimateSmsParts(previewSms);

  async function onCsvFileChange(file: File | null) {
    if (!file) {
      return;
    }

    setCsvText(await file.text());
  }

  async function importCsv() {
    if (!csvText.trim()) {
      showToast("Collez un CSV ou importez un fichier avant de continuer.", "error");
      return;
    }

    showToast("Import des clients en cours...", "saving");

    const response = await fetchWithTimeout("/api/sms/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText })
    });
    const data = (await response.json()) as { customers?: CustomerRow[]; imported?: number; error?: string };

    if (!response.ok || !data.customers) {
      showToast(data.error ?? "Import impossible pour le moment.", "error");
      return;
    }

    setCustomers(data.customers);
    setSelectedCustomerId(data.customers[0]?.id ?? "");
    setPreviewPhone(data.customers[0]?.phone ?? "");
    showToast(`${data.imported ?? data.customers.length} clients importés.`, "success");
  }

  async function generateSmsPreview() {
    if (!selectedCustomer) {
      showToast("Ajoutez d’abord au moins un client test.", "error");
      return;
    }

    setGeneratingPreview(true);
    showToast("Hans prépare un SMS personnalisé...", "saving");

    try {
      const response = await fetchWithTimeout("/api/sms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustomer?.id,
          customer: selectedCustomer ? undefined : {
            first_name: manualFirstName,
            last_name: manualLastName,
            phone: manualPhone,
            favorite_products: manualProduct ? [manualProduct] : [],
            notes: manualNotes
          },
          tone,
          objective,
          audience_mode: audienceMode
        })
      });
      const data = (await response.json()) as { message?: string; phone?: string; error?: string };

      if (!response.ok || !data.message) {
        throw new Error(data.error ?? "Hans n’a pas pu générer le SMS.");
      }

      setPreviewSms(data.message);
      setPreviewPhone(data.phone ?? selectedCustomer?.phone ?? manualPhone);
      showToast("SMS Hans généré", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error), "error");
    } finally {
      setGeneratingPreview(false);
    }
  }

  async function saveCampaign(status: CampaignStatus) {
    setCreatingCampaign(true);
    showToast(status === "scheduled" ? "Programmation de la campagne..." : "Enregistrement du brouillon...", "saving");

    try {
      const response = await fetchWithTimeout("/api/sms/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: campaignTitle,
          objective,
          audience_mode: audienceMode,
          audience_label: getAudienceLabel(audienceMode),
          tone,
          message_template: previewSms || templates[0]?.template_text || "",
          test_customer_id: selectedCustomer?.id ?? null,
          status
        })
      });
      const data = (await response.json()) as { campaign?: SmsCampaignRow; error?: string };

      if (!response.ok || !data.campaign) {
        throw new Error(data.error ?? "Impossible d’enregistrer la campagne.");
      }

      setCampaigns((current) => [data.campaign!, ...current.filter((campaign) => campaign.id !== data.campaign!.id)]);
      showToast(status === "scheduled" ? "Campagne programmée" : "Campagne enregistrée", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error), "error");
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function sendTestSms() {
    if (!selectedCustomer || !previewSms.trim()) {
      showToast("Générez d’abord un SMS de test.", "error");
      return;
    }

    setSendingTest(true);
    showToast("Envoi du test en cours...", "saving");

    try {
      const response = await fetchWithTimeout("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustomer?.id,
          customer: selectedCustomer ? undefined : {
            first_name: manualFirstName,
            last_name: manualLastName,
            phone: manualPhone,
            favorite_products: manualProduct ? [manualProduct] : [],
            notes: manualNotes
          },
          message: previewSms,
          campaign_title: campaignTitle
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Impossible d’envoyer le test.");
      }

      showToast("Test SMS enregistré dans AtriumOne", "success");
    } catch (error) {
      showToast(getUserErrorMessage(error), "error");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className={appShellStyles.width}>
      <section className={surfaceStyles.hero}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className={`${typographyStyles.kicker} mb-2`}>Campagnes SMS</p>
            <h1 className={typographyStyles.h1}>Hans vous aide à contacter les bons clients, avec le bon message.</h1>
            <p className={`${typographyStyles.body} mt-2`}>
              Importez votre base, choisissez les clients à contacter, laissez Hans rédiger un SMS très personnalisé, puis testez avant envoi.
            </p>
          </div>
          <button type="button" onClick={() => window.scrollTo({ top: 560, behavior: "smooth" })} className={buttonStyles.primary}>
            Créer une campagne SMS
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Clients opt-in</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">
            {customers.filter((customer) => customer.opt_in_sms && !customer.sms_unsubscribed).length}
          </div>
          <p className={`${typographyStyles.body} mt-2`}>Seuls ces clients peuvent recevoir une campagne.</p>
        </article>
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Campagnes brouillon</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">
            {campaigns.filter((campaign) => campaign.status === "draft").length}
          </div>
          <p className={`${typographyStyles.body} mt-2`}>Préparez vos messages tranquillement avant envoi.</p>
        </article>
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Programmées</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">
            {campaigns.filter((campaign) => campaign.status === "scheduled").length}
          </div>
          <p className={`${typographyStyles.body} mt-2`}>Les prochaines campagnes déjà calées dans AtriumOne.</p>
        </article>
        <article className={surfaceStyles.kpi}>
          <div className={typographyStyles.kicker}>Envoyées</div>
          <div className="mt-3 text-[30px] font-black tracking-[-0.04em] text-[var(--color-text)]">
            {campaigns.filter((campaign) => campaign.status === "sent").length}
          </div>
          <p className={`${typographyStyles.body} mt-2`}>Gardez un historique simple de vos campagnes SMS.</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={surfaceStyles.section}>
          <div className="mb-4 flex items-center gap-3">
            <span className={surfaceStyles.icon}>
              <Icon name="document" className="h-5 w-5" />
            </span>
            <div>
              <h2 className={typographyStyles.h2}>Créer une campagne SMS</h2>
              <p className={`${typographyStyles.body} mt-1`}>Un parcours simple en 4 étapes pour un commerçant non-tech.</p>
            </div>
          </div>

          <div className="space-y-4">
            <section className={`${surfaceStyles.subtle} p-4`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={badgeStyles.hans}>1</span>
                <h3 className={typographyStyles.h3}>Objectif</h3>
              </div>
              <input value={campaignTitle} onChange={(event) => setCampaignTitle(event.target.value)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm" placeholder="Ex. Relance clients fidèles" />
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} className="ao-input ao-focus mt-3 w-full resize-none px-3.5 py-2.5 text-sm" placeholder="Décrivez l’objectif de la campagne" />
            </section>

            <section className={`${surfaceStyles.subtle} p-4`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={badgeStyles.hans}>2</span>
                <h3 className={typographyStyles.h3}>Clients</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className={`${typographyStyles.caption} mb-1 block`}>Choisir les clients à contacter</span>
                  <select value={audienceMode} onChange={(event) => setAudienceMode(event.target.value as AudienceMode)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm">
                    <option value="all">Tous les clients opt-in</option>
                    <option value="recent">Clients récents</option>
                    <option value="winback">Clients à relancer</option>
                    <option value="vip">Clients fidèles</option>
                    <option value="single">Tester sur un client</option>
                  </select>
                </label>
                <label className="block">
                  <span className={`${typographyStyles.caption} mb-1 block`}>Client test</span>
                  <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm">
                    {customers.length === 0 ? <option value="">Aucun client importé</option> : null}
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.first_name} {customer.last_name} · {customer.phone}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className={`${typographyStyles.body} mt-3`}>{audienceCustomers.length} client{audienceCustomers.length > 1 ? "s" : ""} sont éligibles pour cette campagne.</p>
              {customers.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-white p-4">
                  <div className="text-sm font-bold text-[var(--color-text)]">Tester sans base clients</div>
                  <p className={`${typographyStyles.body} mt-1`}>Ajoutez un client test rapide pour générer votre premier SMS tout de suite.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input value={manualFirstName} onChange={(event) => setManualFirstName(event.target.value)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm" placeholder="Prénom" />
                    <input value={manualLastName} onChange={(event) => setManualLastName(event.target.value)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm" placeholder="Nom" />
                    <input value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm" placeholder="Téléphone" />
                    <input value={manualProduct} onChange={(event) => setManualProduct(event.target.value)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm" placeholder="Produit ou service" />
                    <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} rows={2} className="ao-input ao-focus md:col-span-2 w-full resize-none px-3.5 py-2.5 text-sm" placeholder="Notes utiles pour Hans" />
                  </div>
                </div>
              ) : null}
            </section>

            <section className={`${surfaceStyles.subtle} p-4`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={badgeStyles.hans}>3</span>
                <h3 className={typographyStyles.h3}>Message Hans</h3>
              </div>
              <label className="block">
                <span className={`${typographyStyles.caption} mb-1 block`}>Ton du message</span>
                <select value={tone} onChange={(event) => setTone(event.target.value as SmsTone)} className="ao-input ao-focus w-full px-3.5 py-2.5 text-sm">
                  {toneOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" onClick={generateSmsPreview} disabled={generatingPreview} className={`${buttonStyles.primary} disabled:opacity-60`}>
                  {generatingPreview ? "Hans écrit..." : "Générer avec Hans"}
                </button>
                <button type="button" onClick={() => setPreviewSms(templates[0]?.template_text ?? "")} className={buttonStyles.secondary}>
                  Utiliser un modèle
                </button>
              </div>
              <textarea value={previewSms} onChange={(event) => setPreviewSms(event.target.value)} rows={5} className="ao-input ao-focus mt-4 w-full resize-y px-3.5 py-2.5 text-sm" placeholder="Le SMS généré par Hans apparaîtra ici" />
            </section>

            <section className={`${surfaceStyles.subtle} p-4`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={badgeStyles.hans}>4</span>
                <h3 className={typographyStyles.h3}>Test & envoi</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className={typographyStyles.caption}>Client test</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">{selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : `${manualFirstName} ${manualLastName}`.trim()}</div>
                  <div className={`${typographyStyles.caption} mt-1`}>{previewPhone || manualPhone}</div>
                </div>
                <div>
                  <div className={typographyStyles.caption}>Facturation estimée</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">{smsMetrics.characters} caractères · {smsMetrics.parts} SMS</div>
                  <div className={`${typographyStyles.caption} mt-1`}>STOP automatiquement ajouté dans le message Hans.</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={sendTestSms} disabled={sendingTest} className={`${buttonStyles.primary} disabled:opacity-60`}>
                  {sendingTest ? "Envoi..." : "Tester sur un client"}
                </button>
                <button type="button" onClick={() => void saveCampaign("draft")} disabled={creatingCampaign} className={`${buttonStyles.secondary} disabled:opacity-60`}>
                  Enregistrer en brouillon
                </button>
                <button type="button" onClick={() => void saveCampaign("scheduled")} disabled={creatingCampaign} className={`${buttonStyles.secondary} disabled:opacity-60`}>
                  Programmer l’envoi
                </button>
              </div>
            </section>
          </div>
        </section>

        <div className="space-y-6">
          <details className={surfaceStyles.section}>
            <summary className="cursor-pointer list-none text-sm font-bold text-[var(--color-primary)]">Voir plus d’options</summary>
            <div className="mt-5 space-y-6">
          <section className={surfaceStyles.section}>
            <div className="mb-4 flex items-center gap-3">
              <span className={surfaceStyles.icon}>
                <Icon name="message" className="h-5 w-5" />
              </span>
              <div>
                <h2 className={typographyStyles.h2}>Importer vos clients</h2>
                <p className={`${typographyStyles.body} mt-1`}>Collez un CSV ou importez un fichier. Hans tolère les colonnes approximatives.</p>
              </div>
            </div>
            <input type="file" accept=".csv,text/csv" onChange={(event) => void onCsvFileChange(event.target.files?.[0] ?? null)} className="mb-3 block text-sm" />
            <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={8} className="ao-input ao-focus w-full resize-y px-3.5 py-2.5 text-sm" placeholder={"prenom;nom;telephone;produit acheté;date d’achat;notes;opt-in"} />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={importCsv} className={buttonStyles.primary}>Importer le CSV</button>
              <button type="button" onClick={() => setCsvText("prenom;nom;telephone;produit acheté;date d’achat;notes;opt-in\nThomas;Bernard;06 12 34 56 78;coupe mulet;02/05/2026;Apprécie une coupe courte sur les côtés;oui")} className={buttonStyles.tertiary}>
                Charger un exemple
              </button>
            </div>
          </section>

            </div>
          </details>
        </div>
      </section>

      <section className={surfaceStyles.section}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className={typographyStyles.h2}>Campagnes passées et en cours</h2>
            <p className={`${typographyStyles.body} mt-1`}>Retrouvez vos brouillons, campagnes programmées et campagnes déjà envoyées.</p>
          </div>
        </div>
        {campaigns.length === 0 ? (
          <div className={`${surfaceStyles.empty} px-5 py-8 text-center`}>
            <div className={typographyStyles.h3}>Aucune campagne pour le moment</div>
            <p className={`${typographyStyles.body} mt-2`}>Commencez par créer votre première campagne SMS avec Hans.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className={`${surfaceStyles.subtle} p-5`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={getStatusBadge(campaign.status)}>{getStatusLabel(campaign.status)}</span>
                  <span className={badgeStyles.neutral}>{campaign.audience_label}</span>
                </div>
                <h3 className={typographyStyles.h3}>{campaign.title}</h3>
                <p className={`${typographyStyles.body} mt-2`}>{campaign.objective}</p>
                <div className={`${typographyStyles.caption} mt-3`}>
                  Ton : {campaign.tone} · {campaign.status === "scheduled" && campaign.scheduled_at ? `prévue le ${new Date(campaign.scheduled_at).toLocaleDateString("fr-FR")}` : campaign.status === "sent" && campaign.sent_at ? `envoyée le ${new Date(campaign.sent_at).toLocaleDateString("fr-FR")}` : "brouillon"}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Toast toast={toast} />
    </div>
  );
}
