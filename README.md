# tobias-hub

La page perso de Tobias Collignon — le lien qui vit dans ses bios.
**Conçue et codée par son système d'agents.** C'est pour ça que ce repo est public : la page
affirme que le système existe, et voici sa sortie.

→ https://tobias-hub.vercel.app

---

## Zéro build

HTML, CSS et JS écrits à la main. Pas de framework, pas de `node_modules`, pas d'étape de build.
Vercel sert les fichiers statiques et détecte `/api` tout seul.

```bash
python3 -m http.server 4321      # et ouvrir http://localhost:4321
```

Déploiement : `git push` → Vercel rebuild (~30 s). C'est tout.

---

## ⛔ Ce qu'il ne faut PAS "corriger"

Un agent qui passera ici plus tard va vouloir améliorer trois choses. Les trois sont des
décisions, pas des oublis.

### 1. La palette beige + orange

Elle ressemble au cliché du design généré par IA (fond crème, accent chaud). **C'est la charte
de marque de Tobias, verrouillée**, avec des hex exacts :

```
#F7F2EA fond · #FFFFFF surfaces · #F97316 accent (le SEUL) · #FCE9D6 accent pâle
#2B2B2B texte · #6B6659 secondaire · #E4D9C8 liserés
```

Le skill `taste` interdit cette palette **sauf** *« quand le brief nomme explicitement ces
couleurs »*. C'est le cas ici, par hex. La dérogation est intentionnelle.
La distinction ne vient pas de la palette mais **de la typo** (Bricolage Grotesque, un grotesque
à largeur variable — le cliché IA utilise un serif) **et de l'org-chart**.

### 2. La règle de l'orange

> **L'orange n'est jamais une couleur de texte.**
> Il est soit une **MARQUE** (un tracé : le trait du hero, les connecteurs du diagramme),
> soit une **SURFACE** (un aplat : le bouton, le nœud racine).

Le texte du bouton est **anthracite, pas blanc** — et ce n'est pas un caprice :
blanc sur `#F97316` = **2,80:1**, ça échoue au niveau AA. Anthracite = **5,05:1**, ça passe.
Mettre du blanc dessus rendrait le seul CTA de la page illisible en plein soleil.

### 3. Pas de mode sombre

La charte interdit les fonds sombres. `taste` recommande le double mode ; la charte prime
(`taste` défère explicitement aux chartes verrouillées). Clair uniquement.

---

## Les chiffres ne sont pas tapés à la main

Le compte d'agents, l'org-chart et les libellés viennent de `.claude/agents/` dans le vault,
via deux scripts :

```bash
python3 scripts/org_map.py         # valide la carte contre le disque — CASSE si ça diverge
python3 scripts/gen_org_svg.py "<chemin>/tobias-hub/index.html"
```

`gen_org_svg.py` réécrit **le SVG, le bloc de comptages, et toutes les mentions en prose**
(« 39 agents IA » dans la meta, l'og, le schema, le hero). Après toute modif des agents,
relance-le : sinon le chiffre dérive et la page ment.

`org_map.py` **fait échouer le build** si un agent existe sur le disque sans être dans la carte
(ou l'inverse). Ce n'est pas de la paranoïa : le miroir précédent se disait `generated: true`
tout en étant périmé de 15 agents.

⛔ **Ne jamais éditer à la main** le bloc entre `<!--ORG:START-->` / `<!--COUNTS:START-->`.

---

## Le slot de conversion

Un seul composant (`<section id="offer">`), référencé 3 fois (CTA du hero, barre mobile, la
section). Pour changer d'offre : voir **[CONTENT.md](./CONTENT.md)**. Le CSS ne bouge jamais.

Mode actuel : `follow`. Passera en `capture` quand `BREVO_API_KEY` existera.

---

## Ce que la page ne dira jamais

0 client, 0 vente à ce jour — et la page le **dit**. Donc :

- ⛔ aucun logo client, aucun témoignage, aucun chiffre de résultat, aucun « ils nous font confiance »
- ⛔ aucune promesse de résultat (cadre légal belge)
- ⛔ Webivis n'est **pas** « une agence de sites vitrines » → *studio d'acquisition local, boosté à l'IA*
- ⛔ StudyForge ne promet **aucune note**
- ⛔ le système d'agents ne « gère pas toute l'entreprise » : il pilote contenu, prospection et build

L'honnêteté n'est pas une contrainte ici — c'est le produit. Une fausse preuve détruirait la
seule chose que cette page vend.
