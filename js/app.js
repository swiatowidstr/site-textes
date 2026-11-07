(() => {
  'use strict';

  const app = document.getElementById('app');
  const ECHELLES = [0.9, 1, 1.15, 1.3, 1.5];
  const cache = new Map();

  let config;
  let textes = [];
  let ui = {};
  let langue = null;
  let premierRendu = true;
  let jeton = 0; // ignore les rendus devenus obsolètes

  // ---------- Utilitaires ----------

  const memoire = {
    get(cle) { try { return localStorage.getItem(cle); } catch { return null; } },
    set(cle, val) { try { localStorage.setItem(cle, val); } catch { /* stockage indisponible */ } }
  };

  async function charger(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(r => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.json();
      }));
    }
    try {
      return await cache.get(url);
    } catch (e) {
      cache.delete(url);
      throw e;
    }
  }

  const infoLangue = code => config.langues.find(l => l.code === code);
  const sens = code => infoLangue(code)?.dir || 'ltr';

  // Libellé d'interface, avec variables {n}
  const t = (cle, vars = {}) => (ui[cle] ?? cle).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

  // Valeur d'un objet { fr: …, en: … } dans la langue courante, sinon dans la langue par défaut
  function traduire(valeur) {
    if (typeof valeur === 'string') return { texte: valeur, langue: null };
    if (valeur && valeur[langue] != null) return { texte: valeur[langue], langue };
    return { texte: valeur?.[config.langueParDefaut] ?? '', langue: config.langueParDefaut };
  }

  const nomSite = () => traduire(config.nom).texte;
  const normaliser = s => s.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  function el(tag, attrs = {}, ...enfants) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const e of enfants.flat()) if (e != null && e !== false) n.append(e);
    return n;
  }

  // Élément affichant une valeur traduite ; marque lang/dir quand c'est la langue de repli
  function elTrad(tag, attrs, valeur) {
    const { texte, langue: l } = traduire(valeur);
    if (l && l !== langue) Object.assign(attrs, { lang: l, dir: sens(l) });
    return el(tag, attrs, texte);
  }

  const attrsRepli = repli => repli ? { lang: config.langueParDefaut, dir: sens(config.langueParDefaut) } : {};
  const lien = (...parties) => '#/' + [langue, ...parties].map(encodeURIComponent).join('/');
  const fleche = c => el('span', { class: 'fleche', 'aria-hidden': 'true' }, c);
  const titrePage = (...enfants) => el('h1', { id: 'titre-page', tabindex: '-1' }, ...enfants);
  const bandeau = () => el('p', { class: 'bandeau', role: 'note' }, t('nonTraduit'));

  // ---------- Langue ----------

  function languePreferee() {
    const memo = memoire.get('langue');
    if (infoLangue(memo)) return memo;
    for (const nav of navigator.languages || [navigator.language]) {
      const code = (nav || '').toLowerCase().split('-')[0];
      if (infoLangue(code)) return code;
    }
    return config.langueParDefaut;
  }

  async function changerLangue(code) {
    if (code === langue) return;
    ui = await charger(`i18n/${code}.json`);
    langue = code;
    memoire.set('langue', code);

    const html = document.documentElement;
    html.lang = code;
    html.dir = sens(code);

    document.getElementById('lien-skip').textContent = t('skip');
    document.getElementById('label-langue').textContent = t('langue');
    document.getElementById('label-taille').textContent = t('tailleTexte');
    document.getElementById('txt-reduire').textContent = t('reduire');
    document.getElementById('txt-agrandir').textContent = t('agrandir');
    document.getElementById('select-langue').value = code;

    const accueil = document.getElementById('lien-accueil');
    accueil.textContent = nomSite();
    accueil.href = lien();

    const sujet = traduire(config.sujet).texte;
    document.getElementById('pied-texte').textContent =
      `© ${new Date().getFullYear()} ${nomSite()}${sujet ? ' — ' + sujet : ''}`;
  }

  // ---------- Données ----------

  async function chargerChapitres(slug) {
    try {
      return { donnees: await charger(`data/textes/${slug}/${langue}.json`), repli: false };
    } catch (e) {
      if (langue === config.langueParDefaut) throw e;
      return { donnees: await charger(`data/textes/${slug}/${config.langueParDefaut}.json`), repli: true };
    }
  }

  // ---------- Vues ----------

  function vueAccueil() {
    document.title = nomSite();

    const statut = el('p', { class: 'vide', role: 'status' });
    const cartes = textes.map(tx => {
      const li = el('li', {}, el('article', { class: 'carte' },
        el('h3', {}, elTrad('a', { href: lien('texte', tx.slug) }, tx.titre)),
        elTrad('p', {}, tx.resume),
        el('p', { class: 'meta' }, t('nbChapitres', { n: tx.chapitres }))
      ));
      li.dataset.recherche = normaliser(traduire(tx.titre).texte);
      return li;
    });

    const champ = el('input', {
      type: 'search', id: 'recherche', autocomplete: 'off',
      oninput: () => {
        const q = normaliser(champ.value.trim());
        let visibles = 0;
        for (const c of cartes) {
          c.hidden = !c.dataset.recherche.includes(q);
          if (!c.hidden) visibles++;
        }
        statut.textContent = visibles ? '' : t('aucunResultat');
      }
    });

    const sujet = traduire(config.sujet).texte;
    return el('div', {},
      titrePage(nomSite()),
      sujet && el('p', { class: 'sujet' }, sujet),
      el('div', { class: 'recherche', role: 'search' },
        el('label', { for: 'recherche' }, t('rechercher')),
        champ
      ),
      el('h2', {}, t('textes')),
      el('ul', { class: 'liste-textes' }, cartes),
      statut
    );
  }

  async function vueSommaire(slug) {
    const tx = textes.find(x => x.slug === slug);
    if (!tx) return vueIntrouvable();
    const { donnees, repli } = await chargerChapitres(slug);
    document.title = `${traduire(tx.titre).texte} — ${nomSite()}`;

    const premier = donnees.chapitres[0];
    return el('div', {},
      el('a', { class: 'retour', href: lien() }, fleche('←'), ' ', t('retourAccueil')),
      elTrad('h1', { id: 'titre-page', tabindex: '-1' }, tx.titre),
      elTrad('p', { class: 'resume' }, tx.resume),
      repli && bandeau(),
      premier && el('p', {}, el('a', { class: 'bouton', href: lien('texte', slug, 'chapitre', premier.numero) },
        t('lire'), ' ', fleche('→'))),
      el('h2', {}, t('sommaire')),
      el('ol', { class: 'sommaire', ...attrsRepli(repli) },
        donnees.chapitres.map(c => el('li', {},
          el('a', { href: lien('texte', slug, 'chapitre', c.numero) }, c.titre))))
    );
  }

  async function vueChapitre(slug, numero) {
    const tx = textes.find(x => x.slug === slug);
    if (!tx) return vueIntrouvable();
    const { donnees, repli } = await chargerChapitres(slug);
    const liste = donnees.chapitres;
    const i = liste.findIndex(c => c.numero === numero);
    if (i < 0) return vueIntrouvable();

    const chap = liste[i];
    const prec = liste[i - 1];
    const suiv = liste[i + 1];
    document.title = `${chap.titre} — ${traduire(tx.titre).texte}`;

    return el('div', {},
      repli && bandeau(),
      el('article', { class: 'lecture', ...attrsRepli(repli) },
        el('p', { class: 'surtitre' }, elTrad('a', { href: lien('texte', slug) }, tx.titre), ` · ${i + 1} / ${liste.length}`),
        titrePage(chap.titre),
        chap.contenu.map(p => el('p', {}, p))
      ),
      el('div', { class: 'nav-chapitres' },
        prec ? el('a', { class: 'bouton', rel: 'prev', href: lien('texte', slug, 'chapitre', prec.numero) },
          fleche('←'), t('precedent')) : el('span'),
        el('a', { class: 'bouton secondaire', href: lien('texte', slug) }, t('retourSommaire')),
        suiv ? el('a', { class: 'bouton', rel: 'next', href: lien('texte', slug, 'chapitre', suiv.numero) },
          t('suivant'), fleche('→')) : el('span')
      )
    );
  }

  function vueIntrouvable() {
    document.title = `${t('introuvable')} — ${nomSite()}`;
    return el('div', {},
      titrePage(t('introuvable')),
      el('p', {}, el('a', { href: lien() }, t('retourAccueil')))
    );
  }

  function vueErreur() {
    return el('div', {},
      titrePage(t('erreur')),
      el('p', {}, el('a', { href: lien() }, t('retourAccueil')))
    );
  }

  // ---------- Routeur ----------
  // #/fr  ·  #/fr/texte/slug  ·  #/fr/texte/slug/chapitre/2

  async function router() {
    const monJeton = ++jeton;
    const [code, ...reste] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

    if (!infoLangue(code)) {
      location.replace('#/' + languePreferee());
      return;
    }

    let vue;
    try {
      await changerLangue(code);
      if (reste.length === 0) vue = vueAccueil();
      else if (reste[0] === 'texte' && reste.length === 2) vue = await vueSommaire(reste[1]);
      else if (reste[0] === 'texte' && reste[2] === 'chapitre' && reste.length === 4) vue = await vueChapitre(reste[1], Number(reste[3]));
      else vue = vueIntrouvable();
    } catch (e) {
      console.error(e);
      vue = vueErreur();
    }
    if (monJeton !== jeton) return;

    app.replaceChildren(vue);
    window.scrollTo(0, 0);
    if (!premierRendu) document.getElementById('titre-page')?.focus();
    premierRendu = false;
  }

  // ---------- Taille du texte ----------

  function appliquerEchelle(index) {
    index = Math.max(0, Math.min(ECHELLES.length - 1, index));
    document.documentElement.style.setProperty('--echelle', ECHELLES[index]);
    document.getElementById('btn-reduire').disabled = index === 0;
    document.getElementById('btn-agrandir').disabled = index === ECHELLES.length - 1;
    memoire.set('echelle', index);
    return index;
  }

  // ---------- Démarrage ----------

  async function demarrer() {
    try {
      config = await charger('config.json');
      textes = await charger('data/textes.json');
    } catch (e) {
      console.error(e);
      app.textContent = 'Erreur de chargement. Lancez le site via un serveur web (voir README.md).';
      return;
    }

    const select = document.getElementById('select-langue');
    select.append(...config.langues.map(l => el('option', { value: l.code, lang: l.code, dir: l.dir }, l.nom)));
    select.addEventListener('change', () => {
      const parties = location.hash.replace(/^#\/?/, '').split('/');
      parties[0] = select.value;
      location.hash = '#/' + parties.join('/');
    });

    const echelleMemo = parseInt(memoire.get('echelle'), 10);
    let echelle = appliquerEchelle(Number.isNaN(echelleMemo) ? 1 : echelleMemo);
    document.getElementById('btn-reduire').addEventListener('click', () => { echelle = appliquerEchelle(echelle - 1); });
    document.getElementById('btn-agrandir').addEventListener('click', () => { echelle = appliquerEchelle(echelle + 1); });

    // Le lien d'évitement ne doit pas modifier le hash (utilisé par le routeur)
    document.getElementById('lien-skip').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('contenu').focus();
    });

    window.addEventListener('hashchange', router);
    router();
  }

  demarrer();
})();
