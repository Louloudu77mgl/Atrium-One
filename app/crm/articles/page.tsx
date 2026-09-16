import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin";
import { articleSelect, getArticlesForAdmin, slugifyArticleTitle } from "@/lib/articles";
import { appShellStyles } from "@/lib/design-system";
import { getAppNotifications } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function createArticle() {
  "use server";
  const user = await requireAdminUser();
  const supabase = await createServerSupabaseClient();
  const slug = `nouvel-article-${Date.now().toString(36)}`;
  const { data, error } = await supabase.from("articles").insert({ title: "Nouvel article", slug, author_id: user.id }).select("id").single();
  if (error || !data) redirect("/crm/articles?error=creation");
  redirect(`/crm/articles?article=${data.id}`);
}

async function updateArticle(formData: FormData) {
  "use server";
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "draft");
  if (!id) redirect("/crm/articles");
  const supabase = await createServerSupabaseClient();

  if (intent === "delete") {
    await supabase.from("articles").delete().eq("id", id);
    revalidatePath("/crm/articles");
    redirect("/crm/articles");
  }

  const title = String(formData.get("title") ?? "").trim() || "Sans titre";
  const slug = slugifyArticleTitle(String(formData.get("slug") ?? "") || title);
  const status = intent === "publish" ? "published" as const : "draft" as const;
  const { data: existing } = await supabase.from("articles").select("published_at").eq("id", id).maybeSingle();
  const { error } = await supabase.from("articles").update({
    title,
    slug,
    excerpt: String(formData.get("excerpt") ?? "").trim(),
    content: String(formData.get("content") ?? ""),
    cover_image_url: String(formData.get("cover_image_url") ?? "").trim() || null,
    status,
    published_at: status === "published" ? existing?.published_at ?? new Date().toISOString() : null
  }).eq("id", id);
  if (error) redirect(`/crm/articles?article=${id}&error=save`);
  revalidatePath("/crm/articles");
  redirect(`/crm/articles?article=${id}&saved=${status}`);
}

function formatDate(value: string | null) {
  if (!value) return "Non publié";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ article?: string; saved?: string; error?: string }> }) {
  await requireAdminUser();
  const params = await searchParams;
  const result = await getArticlesForAdmin()
    .then((articles) => ({ articles, schemaError: false }))
    .catch(() => ({ articles: [], schemaError: true }));
  const selected = result.articles.find((article) => article.id === params.article) ?? result.articles[0] ?? null;

  return (
    <div className={appShellStyles.page}>
      
      <div className={appShellStyles.pageInner}>
        <main className={appShellStyles.content}>
          <div className={appShellStyles.width}>
            <div className="mx-auto max-w-[1380px]">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><span className="text-[11px] font-black uppercase tracking-[.1em] text-[#7B5AA5]">Site public</span><h1 className="mt-1 text-[27px] font-black tracking-[-.035em] text-[#211936]">Articles AtriumOne</h1><p className="mt-1 text-sm font-semibold text-[#716A7F]">Rédigez et publiez directement sur atrium-one.fr.</p></div><a href="https://atrium-one.fr/articles" target="_blank" rel="noreferrer" className="rounded-xl border border-[#DCD3E5] bg-white px-4 py-2.5 text-xs font-black text-[#4C1D95]">Voir les articles ↗</a></div>
              {result.schemaError ? <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">La migration Supabase des articles doit être appliquée avant la première utilisation.</div> : null}
              {params.error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">L’enregistrement n’a pas abouti. Vérifiez que l’adresse de l’article est unique.</div> : null}
              {params.saved ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{params.saved === "published" ? "L’article est publié sur atrium-one.fr." : "Brouillon enregistré."}</div> : null}
              <div className="grid min-h-[700px] overflow-hidden rounded-[22px] border border-[#E8E3DD] bg-white shadow-[0_18px_45px_rgba(31,22,45,.06)] lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="border-b border-[#E8E3DD] bg-[#FAF9F7] p-4 lg:border-b-0 lg:border-r">
                  <form action={createArticle}><button className="min-h-11 w-full rounded-xl bg-[#4C1D95] px-4 text-sm font-black text-white hover:bg-[#5D28AF]">+ Nouvel article</button></form>
                  <div className="mt-5 px-1 text-[11px] font-black uppercase tracking-[.08em] text-[#8F8997]">Vos articles · {result.articles.length}</div>
                  <div className="mt-2 space-y-2">{result.articles.map((article) => <a key={article.id} href={`/crm/articles?article=${article.id}`} className={`block rounded-xl border p-3 ${selected?.id === article.id ? "border-[#B894F2] bg-white shadow-sm" : "border-transparent hover:border-[#DED6E5] hover:bg-white"}`}><strong className="line-clamp-2 block text-[13px] leading-5 text-[#211936]">{article.title}</strong><span className="mt-2 flex items-center justify-between text-[10px] text-[#8A8391]"><b className={`rounded-full px-2 py-1 ${article.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-[#F1ECF8] text-[#6B547D]"}`}>{article.status === "published" ? "Publié" : "Brouillon"}</b><span>{formatDate(article.updated_at).split(" à ")[0]}</span></span></a>)}</div>
                </aside>
                {!selected ? <section className="grid place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#F1ECFB] text-2xl text-[#5C22C5]">✎</div><h2 className="mt-4 text-xl font-black text-[#211936]">Créez votre premier article</h2><p className="mt-2 text-sm text-[#756E7C]">Préparez-le ici, puis choisissez quand le publier.</p></div></section> :
                <form action={updateArticle} className="min-w-0"><input type="hidden" name="id" value={selected.id}/><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE7E2] px-5 py-4 md:px-7"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${selected.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-[#F1ECF8] text-[#6B547D]"}`}>{selected.status === "published" ? "Publié" : "Brouillon"}</span><p className="mt-1 text-[10px] text-[#99919F]">Modifié {formatDate(selected.updated_at)}</p></div><div className="flex flex-wrap gap-2"><button name="intent" value="delete" className="min-h-10 rounded-xl border border-red-200 px-3 text-xs font-black text-red-700">Supprimer</button>{selected.status === "published" ? <a href={`https://atrium-one.fr/articles/${selected.slug}`} target="_blank" rel="noreferrer" className="flex min-h-10 items-center rounded-xl border border-[#DED6E5] px-3 text-xs font-black text-[#4C1D95]">Voir en ligne ↗</a> : null}<button name="intent" value="draft" className="min-h-10 rounded-xl border border-[#D9D0E1] px-4 text-xs font-black text-[#4C1D95]">Enregistrer</button><button name="intent" value="publish" className="min-h-10 rounded-xl bg-[#4C1D95] px-4 text-xs font-black text-white">{selected.status === "published" ? "Mettre à jour" : "Publier"}</button></div></div>
                  <div className="grid gap-8 p-5 md:p-7 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-5">
                    <label className="block"><span className="text-[11px] font-black uppercase tracking-[.07em] text-[#8E8795]">Titre</span><input name="title" defaultValue={selected.title} className="mt-2 w-full rounded-xl border border-[#DDD6E2] px-4 py-3 text-lg font-black outline-none focus:border-[#7C3AED]"/></label>
                    <label className="block"><span className="text-[11px] font-black uppercase tracking-[.07em] text-[#8E8795]">Adresse de l’article</span><div className="mt-2 flex overflow-hidden rounded-xl border border-[#DDD6E2]"><span className="border-r bg-[#F8F6FA] px-3 py-3 text-xs text-[#8B8392]">atrium-one.fr/articles/</span><input name="slug" defaultValue={selected.slug} className="min-w-0 flex-1 px-3 py-3 text-sm font-bold text-[#4C1D95] outline-none"/></div></label>
                    <label className="block"><span className="text-[11px] font-black uppercase tracking-[.07em] text-[#8E8795]">Résumé</span><textarea name="excerpt" defaultValue={selected.excerpt} rows={3} maxLength={280} className="mt-2 w-full rounded-xl border border-[#DDD6E2] px-4 py-3 text-sm leading-6 outline-none focus:border-[#7C3AED]"/></label>
                    <label className="block"><span className="text-[11px] font-black uppercase tracking-[.07em] text-[#8E8795]">Image de couverture — URL facultative</span><input name="cover_image_url" type="url" defaultValue={selected.cover_image_url ?? ""} placeholder="https://…" className="mt-2 w-full rounded-xl border border-[#DDD6E2] px-4 py-3 text-sm outline-none focus:border-[#7C3AED]"/></label>
                    <label className="block"><span className="text-[11px] font-black uppercase tracking-[.07em] text-[#8E8795]">Contenu</span><textarea name="content" defaultValue={selected.content} rows={22} placeholder={"Rédigez ici.\n\n## Un intertitre\n\n- Un élément de liste"} className="mt-2 w-full rounded-xl border border-[#DDD6E2] px-5 py-4 font-mono text-[13px] leading-7 outline-none focus:border-[#7C3AED]"/><span className="mt-2 block text-xs text-[#8B8491]">Intertitres : <b>## Titre</b> · Listes : <b>- Élément</b></span></label>
                  </div><aside className="self-start rounded-2xl border border-[#E8E1EC] bg-[#FCFAFF] p-5 xl:sticky xl:top-6"><span className="text-[10px] font-black uppercase tracking-[.08em] text-[#7B5AA5]">Aperçu éditorial</span>{selected.cover_image_url ? <img src={selected.cover_image_url} alt="" className="mt-4 aspect-video w-full rounded-xl object-cover"/> : null}<h2 className="mt-4 text-2xl font-black leading-tight text-[#211936]">{selected.title}</h2><p className="mt-3 text-sm leading-6 text-[#6E6675]">{selected.excerpt || "Votre résumé apparaîtra ici."}</p><div className="mt-5 border-y border-[#E8E1EC] py-3 text-[11px] font-bold text-[#857D8D]">AtriumOne · {Math.max(1, Math.ceil(selected.content.trim().split(/\s+/).filter(Boolean).length / 220))} min de lecture</div><p className="mt-5 whitespace-pre-line text-sm leading-6 text-[#4F4658]">{selected.content.slice(0, 500) || "Le début de votre article apparaîtra ici."}</p></aside></div>
                </form>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
