from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, ListFlowable, ListItem
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from pathlib import Path

out = Path('output/pdf/atriumone-passation-developpeur.pdf')

def try_register_fonts():
    candidates = [
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/SFNS.ttf',
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            try:
                pdfmetrics.registerFont(TTFont('AppFont', str(p)))
                return 'AppFont'
            except Exception:
                pass
    return 'Helvetica'

font_name = try_register_fonts()

doc = SimpleDocTemplate(
    str(out),
    pagesize=A4,
    leftMargin=18*mm,
    rightMargin=18*mm,
    topMargin=18*mm,
    bottomMargin=16*mm,
)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name='TitleHero',
    parent=styles['Title'],
    fontName=font_name,
    fontSize=22,
    leading=28,
    textColor=colors.HexColor('#211432'),
    spaceAfter=8,
    alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    name='Subtitle',
    parent=styles['BodyText'],
    fontName=font_name,
    fontSize=10.5,
    leading=15,
    textColor=colors.HexColor('#5F5472'),
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name='Section',
    parent=styles['Heading2'],
    fontName=font_name,
    fontSize=14,
    leading=18,
    textColor=colors.HexColor('#4C1D95'),
    spaceBefore=10,
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    name='Body',
    parent=styles['BodyText'],
    fontName=font_name,
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#211432'),
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name='Small',
    parent=styles['BodyText'],
    fontName=font_name,
    fontSize=8.8,
    leading=12,
    textColor=colors.HexColor('#6B617F'),
    spaceAfter=3,
))
styles.add(ParagraphStyle(
    name='Callout',
    parent=styles['BodyText'],
    fontName=font_name,
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#4C1D95'),
    backColor=colors.HexColor('#F5F0FF'),
    borderPadding=8,
    borderRadius=8,
    spaceBefore=4,
    spaceAfter=8,
))


def bullets(items, level=0):
    return ListFlowable(
        [ListItem(Paragraph(item, styles['Body'])) for item in items],
        bulletType='bullet',
        start='circle',
        leftIndent=14 + level*8,
        bulletFontName=font_name,
        bulletFontSize=8,
        bulletOffsetY=2,
        spaceBefore=2,
        spaceAfter=6,
    )

story = []
story.append(Paragraph('AtriumOne - Document de passation developpeur', styles['TitleHero']))
story.append(Paragraph('Projet Next.js / TypeScript / Tailwind / Supabase. Ce document resume l etat actuel du projet, les points deja corriges, les integrations externes a finaliser et la procedure de reprise pour un developpeur.', styles['Subtitle']))
story.append(Paragraph('Etat global : lint OK, build OK, plusieurs parcours UX simplifies, mais certaines integrations reelles dependent encore de configurations externes (Meta, Google, provider SMS, Supabase).', styles['Callout']))

story.append(Paragraph('1. Resume executif', styles['Section']))
story.append(bullets([
    'Le projet est transmissible en l etat au developpeur.',
    'Le socle produit, les ecrans principaux et les parcours UX ont ete fortement simplifies.',
    'Le code compile correctement et la base de la plateforme est exploitable.',
    'Les sujets restants concernent surtout les integrations reelles, les credentials et les tests de bout en bout.',
]))

story.append(Paragraph('2. Etat actuel par module', styles['Section']))
story.append(Paragraph('<b>Dashboard / Avis / Insights</b> : pages simplifiees, plus coherentes visuellement, fond commun, micro interactions harmonisees.', styles['Body']))
story.append(Paragraph('<b>SMS</b> : base clients, import CSV, formulaire QR, code promo, affichage de la BDD clients, mais envoi SMS reel non branche.', styles['Body']))
story.append(Paragraph('<b>Instagram</b> : galerie par commerce, import images du site, edition de posts, export PNG, automatisations sociales reliees. Publication reelle depend de la config Meta.', styles['Body']))
story.append(Paragraph('<b>Automatisations</b> : regles sociales et avis en place, planning simplifie, creation de brouillons automatiques. Reste a confirmer les scenarios reels en base.', styles['Body']))
story.append(Paragraph('<b>Authentification</b> : login email OK, Google login corrige en local, mais doit etre revalide avec la vraie configuration Google / Supabase.', styles['Body']))

story.append(Paragraph('3. Actions prioritaires a terminer', styles['Section']))
story.append(bullets([
    'Configurer la vraie app Meta pour la connexion Instagram et la publication reelle.',
    'Configurer completement Google login et revalider les URLs OAuth en environnement cible.',
    'Brancher un vrai provider SMS pour remplacer le test applicatif actuel.',
    'Executer toutes les migrations SQL dans Supabase et verifier les buckets storage / RLS.',
    'Tester les parcours bout en bout : CSV -> base clients -> QR -> code promo -> SMS ; galerie -> idee -> post -> edition -> export -> publication.',
    'Faire une derniere passe de QA produit sur mobile et tablette.',
]))

story.append(Paragraph('4. Pourquoi Instagram ne peut pas encore etre connecte reellement', styles['Section']))
story.append(bullets([
    'AtriumOne a besoin d une app Meta Developers configuree cote serveur.',
    'Le projet attend 3 variables : META_CLIENT_ID, META_CLIENT_SECRET, META_REDIRECT_URI.',
    'Sans ces variables, le bouton de connexion Instagram est volontairement desactive ou redirige vers une explication.',
    'Le compte du commercant doit aussi etre un compte Instagram professionnel relie a une Page Facebook.',
    'Ce n est pas un probleme de front : c est un prerequis de configuration externe.',
]))
story.append(Paragraph('Fichiers utiles : lib/instagram-oauth.ts, app/api/instagram/connect/route.ts, app/api/instagram/callback/route.ts', styles['Small']))

story.append(Paragraph('5. Pourquoi les CSV SMS pouvaient bloquer', styles['Section']))
story.append(bullets([
    'Si les tables SMS n existent pas dans Supabase, l import est refuse.',
    'Les anciens ecrans pouvaient donner une impression de module pret alors que la base n etait pas initialisee.',
    'Le parseur CSV a ete assoupli, mais il faut quand meme le schema SQL pour que l import persiste en base.',
    'Le module SMS est maintenant testable meme sans base clients grace a un client test saisi a la main.',
]))
story.append(Paragraph('Fichiers utiles : app/api/sms/import/route.ts, app/api/sms/generate/route.ts, app/api/sms/test/route.ts, lib/sms-shared.ts', styles['Small']))

story.append(PageBreak())

story.append(Paragraph('6. SQL a executer dans Supabase', styles['Section']))
story.append(bullets([
    'supabase/schema.sql',
    'supabase/sms-module.sql',
    'supabase/social-instagram-gallery-upgrade.sql',
    'supabase/automations-social-upgrade.sql',
    'supabase/ux-sms-instagram-auth-upgrade.sql',
]))
story.append(Paragraph('Ordre recommande : schema principal d abord, puis SMS, puis Instagram / galerie, puis automatisations, puis upgrade UX final.', styles['Body']))

story.append(Paragraph('7. Variables d environnement a fournir au developpeur', styles['Section']))
story.append(bullets([
    'NEXT_PUBLIC_APP_URL',
    'Variables Supabase (URL, anon key, eventuellement service role si utilise ailleurs)',
    'OPENAI_API_KEY',
    'OPENAI_MODEL et / ou modele image si personnalise',
    'META_CLIENT_ID',
    'META_CLIENT_SECRET',
    'META_REDIRECT_URI',
    'Variables Google OAuth / Google Business si le projet les utilise en production',
]))
story.append(Paragraph('Le plus propre est de fournir soit le fichier .env.local, soit un .env.example accompagne des vraies valeurs par canal securise.', styles['Body']))

story.append(Paragraph('8. Comment recuperer le projet en l etat', styles['Section']))
story.append(bullets([
    'Recuperer le dossier complet du projet.',
    'Lancer npm install.',
    'Ajouter le fichier .env.local.',
    'Executer les scripts SQL dans Supabase.',
    'Verifier que les buckets storage existent bien.',
    'Lancer npm run dev pour le local.',
    'Verifier ensuite npm run lint puis npm run build.',
]))

story.append(Paragraph('9. Buckets / stockage a verifier', styles['Section']))
story.append(bullets([
    'merchant-logos',
    'social-post-images',
    'social-visuals',
]))
story.append(Paragraph('Le developpeur doit verifier les droits de lecture / ecriture et les URLs publiques ou signees selon les usages.', styles['Body']))

story.append(Paragraph('10. Checklist de reprise pour le developpeur', styles['Section']))
story.append(bullets([
    'Setup local : installation, variables d environnement, lancement du projet.',
    'Base de donnees : SQL, RLS, storage, test d un user / merchant.',
    'Auth : email + Google login.',
    'Instagram : OAuth Meta, detection du compte professionnel, publication reelle.',
    'SMS : import CSV, creation formulaire QR, code promo, test SMS, futur provider reel.',
    'Automatisations : creation de brouillons sociaux et verification du planning.',
    'QA finale : desktop, tablette, mobile.',
]))

story.append(Paragraph('11. Ameliorations deja realisees avant passation', styles['Section']))
story.append(bullets([
    'Design system global plus coherent.',
    'Fond de page harmonise entre les modules.',
    'Dashboard et pages Avis / Insights simplifiees pour un commercant non tech.',
    'Gestion des erreurs et feedback utilisateur plus propres.',
    'Reduction de plusieurs comportements de chargement agressifs.',
    'Connexion Google locale mieux geree sur localhost.',
    'Module SMS debloque meme sans base clients initiale.',
    'Prompts d images Instagram durcis : pas de personnes, pas de nom d enseigne, creativite renforcee.',
]))

story.append(Paragraph('12. Fichiers particulierement importants', styles['Section']))
story.append(bullets([
    'app/settings/page.tsx',
    'app/social/page.tsx',
    'app/social/editor/[postId]/VisualPostEditor.tsx',
    'app/sms-campaigns/SmsCampaignsClient.tsx',
    'app/automations/SocialAutomationPanel.tsx',
    'app/auth/google/route.ts',
    'app/auth/callback/route.ts',
    'app/api/instagram/connect/route.ts',
    'app/api/instagram/callback/route.ts',
    'lib/social-visuals.ts',
    'lib/sms-shared.ts',
    'lib/auth/google-login.ts',
]))

story.append(Paragraph('13. Statut technique au moment de la passation', styles['Section']))
story.append(bullets([
    'npm run lint : OK',
    'npm run build : OK',
    'Le serveur local demarre correctement sur localhost:3000 quand les permissions port sont disponibles.',
]))

story.append(Paragraph('14. Message de transmission recommande', styles['Section']))
story.append(Paragraph('"Voici le projet AtriumOne dans son etat actuel. Le produit est globalement structure et buildable. Les principaux sujets restants concernent les integrations reelles (Meta, Google, SMS provider, Supabase complet) et les tests de bout en bout. Le PDF de passation et la liste des SQL a executer sont inclus."', styles['Body']))


def add_page_number(canvas, doc):
    canvas.setFont(font_name, 8)
    canvas.setFillColor(colors.HexColor('#8A7F73'))
    canvas.drawRightString(195*mm, 10*mm, f'Page {doc.page}')


doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(out)
