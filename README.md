# [NOM DU SITE]

Site statique en 20 langues pour publier un livre chapitre par chapitre et vendre chaque chapitre en ebook.
Il est écrit en HTML/CSS/JS natif : il n'y a ni dépendance ni étape de build. Les paiements passent par **Lemon Squeezy**, dont la fenêtre de paiement s'ouvre sur la page.

## Lancer en local

```
python -m http.server 8000
```

Ouvre ensuite http://localhost:8000. Le double-clic sur `index.html` ne fonctionne pas, car les JSON sont chargés avec `fetch`.

## Remplir le livre

| Quoi | Où |
|---|---|
| Nom du site, devise, formats, langues | `config.json` |
| Titre, auteur, accroche, présentation, prix, liens d'achat | `data/livre.json` |
| Texte d'un chapitre, par langue | `data/chapitres/{numéro}/{code}.json` |
| Couverture | `img/couverture.svg` (ou une autre image : modifie `couverture` dans `livre.json`) |
| Mentions légales | `data/mentions/fr.json` (à compléter et à faire valider) |

**Important : pour un chapitre payant, ne mets que l'extrait dans `data/chapitres/…`.**
Le dépôt GitHub est public, donc tout ce qui s'y trouve est lisible par tous. Le chapitre complet ne doit exister que dans le fichier EPUB/PDF déposé sur Lemon Squeezy.

Les fichiers de la langue par défaut (`fr`) sont obligatoires. Pour les autres langues, si un fichier manque, le site affiche la version française avec un bandeau « non traduit ».

## Brancher Lemon Squeezy

1. Crée un compte sur lemonsqueezy.com et une boutique (Store).
2. Crée un produit par chapitre, plus un pour le livre complet. Dans chaque produit, ajoute les fichiers EPUB + PDF dans *Files*.
3. Pour chaque produit, va dans *Share* et copie le lien d'achat (`https://<boutique>.lemonsqueezy.com/buy/…`).
4. Colle chaque lien dans `data/livre.json` → `lienAchat` du chapitre ou du `pack`, et vérifie que le `prix` affiché est le même que dans Lemon Squeezy.

Tant que `lienAchat` est vide, le bouton affiche « Bientôt disponible ».

## Ajouter une langue

1. Ajoute-la dans `config.json` → `langues` (`code`, nom dans la langue, `dir` = `ltr` ou `rtl`).
2. Copie `i18n/fr.json` vers `i18n/{code}.json` et traduis les libellés.

## Mettre en ligne

Le site est publié par GitHub Pages depuis la branche `main`. Un `git push` suffit, et la mise à jour prend 1 à 2 minutes.
