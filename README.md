# [NOM DU SITE]

Site statique multilingue (20 langues) qui répertorie des textes découpés en chapitres.
HTML/CSS/JS natif : il n'y a ni dépendance ni étape de build.

## Lancer en local

Les fichiers JSON sont chargés avec `fetch`, ce qui ne marche pas en ouvrant `index.html` en double-clic. Lance plutôt un petit serveur :

```
python -m http.server 8000
```

Ouvre ensuite http://localhost:8000

## Personnaliser

Tous les réglages se trouvent dans `config.json` :

- `nom` et `sujet` : une chaîne, ou un objet par langue (`{ "fr": "…", "en": "…" }`).
- `langueParDefaut` : langue utilisée pour une première visite si le navigateur ne correspond à aucune langue, et pour le repli quand un contenu n'est pas traduit.
- `langues` : liste des langues (`code`, nom affiché dans la langue, `dir` = `ltr` ou `rtl`).

Les couleurs sont définies en variables au début de `css/style.css`.

## Ajouter un texte

1. Dans `data/textes.json`, ajoute une entrée :
   ```json
   { "slug": "mon-texte", "chapitres": 2,
     "titre":  { "fr": "Mon texte", "en": "My text" },
     "resume": { "fr": "…", "en": "…" } }
   ```
2. Crée `data/textes/mon-texte/fr.json` (puis `en.json`, `ar.json`…) :
   ```json
   { "chapitres": [
       { "numero": 1, "titre": "Chapitre 1", "contenu": ["Paragraphe 1", "Paragraphe 2"] }
   ] }
   ```

Le fichier de la langue par défaut est obligatoire. Pour les autres langues, si le fichier n'existe pas, le site affiche la version par défaut avec un bandeau « non traduit ».

## Ajouter un chapitre

Ajoute un objet dans le tableau `chapitres` de chaque fichier de langue du texte, puis mets à jour le nombre `chapitres` dans `data/textes.json`.

## Ajouter une langue

1. Ajoute-la dans `config.json` → `langues`.
2. Copie `i18n/fr.json` vers `i18n/{code}.json` et traduis les libellés.

## Mise en ligne

Dépose le dossier tel quel sur GitHub Pages, Netlify ou tout autre hébergement statique.
