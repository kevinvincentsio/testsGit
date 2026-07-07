# Panier Malin — assistant de courses pour drive

Extension de navigateur qui, **à la demande**, optimise ton panier sur un site de
drive (Chronodrive, Intermarché, Leclerc Drive). Tu es sur le site, connecté, tu
cliques sur **« Optimiser mon panier »** : le bot lit ton panier, les promos du
jour et tes goûts, compose un panier optimisé, le remplit — puis **tu vérifies et
tu commandes toi-même**. Le bot ne valide jamais la commande et ne paie jamais.

## Pourquoi une extension (et pas un bot cloud)

Elle tourne dans **ton navigateur, sur ton IP, dans ta session déjà connectée**.
Pour le site, c'est toi : pas de captcha à contourner, pas de mot de passe à
stocker, pas de serveur à héberger. C'est l'approche la plus simple et la plus
robuste face aux protections anti-bot (Datadome & co.).

## Comment le panier est choisi

Le choix **ne se limite pas à l'historique**. Le cerveau (l'API Claude) raisonne,
par ordre d'importance, sur :

1. le **régime, les allergies et les aversions** (respectés strictement) ;
2. le **réassort des indispensables** selon leur cadence de consommation ;
3. les **promotions du jour** intéressantes ;
4. les **fruits et légumes de saison** (table France intégrée, `core/season.js`) ;
5. **2 à 4 recettes concrètes** à cuisiner sur la période, dont les ingrédients
   sont ajoutés au panier ;
6. le **profil de goûts appris** — un signal parmi d'autres, pas une contrainte :
   le bot introduit de la variété et des nouveautés pertinentes ;
7. le **budget** indiqué, s'il y en a un.

## Apprentissage continu

Le profil (`Réglages → Profil de goûts appris`) s'enrichit tout seul à chaque
passage, à partir de tes actions :

- un article que **tu ajoutes** à la main → goût positif fort ;
- un article que **tu retires** → signal négatif ;
- tes **passages successifs** calibrent les cadences.

Le bot ne retire jamais un article que tu as ajouté toi-même — seulement ceux
qu'il avait ajoutés et qui ne sont plus pertinents. Le profil est un texte
lisible et **modifiable à la main** : ta version fait foi.

## Installation (mode développeur)

1. Ouvre `chrome://extensions` (Chrome / Edge / Brave).
2. Active **« Mode développeur »** (en haut à droite).
3. **« Charger l'extension non empaquetée »** → sélectionne le dossier
   [`extension/`](extension).
4. Clique l'icône de l'extension → **⚙︎ Réglages** :
   - colle ta **clé API Anthropic** (console.anthropic.com ; stockée uniquement
     dans ton navigateur ; coût ≈ quelques centimes par passage) ;
   - renseigne ton foyer, régime, allergies, indispensables, budget.

## Utilisation

1. Va sur la page **panier** de ton drive, **connecté**.
2. Clique l'extension → **« Optimiser mon panier »**.
3. Attends le résumé (articles, recettes, économies), **vérifie le panier sur le
   site**, ajuste si besoin, puis **commande**.

## ⚠️ Validation des sélecteurs (important)

Les sites de drive changent souvent leur HTML. Les sélecteurs CSS de chaque
enseigne (`extension/content/stores/chronodrive.js`, `intermarche.js`,
`leclerc.js`) sont des **points de départ à valider** sur le site réel :

- ouvre le site, clic droit → **Inspecter** sur le champ de recherche, une carte
  produit, le bouton « Ajouter », une ligne du panier ;
- ajuste les sélecteurs correspondants dans la config de l'enseigne.

Le moteur générique (`content/stores/base.js`) ne change pas ; seule la config
par enseigne évolue. Chronodrive est l'enseigne pré-câblée en priorité.

## Architecture

```
extension/
├── manifest.json           # MV3 : permissions, content scripts, popup, options
├── background.js           # orchestrateur : scrape → apprentissage → plan → apply → notif
├── popup.html/js/css       # bouton « Run » + résumé du passage
├── options.html/js         # préférences, clé API, modèle, profil appris
├── core/
│   ├── planner.js          # appels API Claude : panier cible + mise à jour du profil
│   ├── season.js           # produits de saison (France) par mois
│   └── store.js            # chrome.storage : prefs, IA, profil, historique, dernier plan
└── content/
    ├── content.js          # reçoit les ordres, lit/agit sur la page
    └── stores/
        ├── base.js         # moteur générique piloté par config de sélecteurs
        ├── chronodrive.js  # config Chronodrive (prioritaire)
        ├── intermarche.js  # config Intermarché
        └── leclerc.js      # config Leclerc Drive
```

## Sécurité & confidentialité

- La **clé API** et toutes tes données restent dans `chrome.storage.local` (ce
  navigateur). Rien n'est envoyé ailleurs qu'à l'API Anthropic (le cerveau) et au
  site de drive (tes propres requêtes).
- Le bot **ne commande jamais** et **ne paie jamais** : la validation finale est
  toujours la tienne.

## Réglages de l'IA

Modèle par défaut : **Claude Opus 4.8** (meilleur raisonnement). Tu peux basculer
sur **Sonnet 5** (bon, moins cher) ou **Haiku 4.5** (rapide, basique) dans les
réglages, et ajuster l'effort de réflexion.

## Limites connues (V1)

- Sélecteurs à valider par enseigne (voir plus haut).
- À lancer depuis la page panier, connecté ; les recherches d'articles utilisent
  le champ de recherche du site.
- Pas de validation de commande automatique — c'est volontaire.
