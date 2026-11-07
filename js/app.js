(() => {
  'use strict';

  const app = document.getElementById('app');
  const barre = document.getElementById('progression');
  const ECHELLES = [0.9, 1, 1.15, 1.3, 1.5];
  const cache = new Map();

  let config;
  let livre;
  let ui = {};
  let langue = null;
  let vueCourante = null;
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
  const titreLivre = () => traduire(livre.titre).texte;

  function el(tag, attrs = {}, ...enfants) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const e of enfants.flat(Infinity)) if (e != null && e !== false) n.append(e);
    return n;
  }

  // Attributs lang/dir à poser quand un contenu s'affiche dans la langue de repli
  function attrsLangue(l) {
    return l && l !== langue ? { lang: l, dir: sens(l) } : {};
  }

  // Élément affichant une valeur traduite
  function elTrad(tag, attrs, valeur) {
    const { texte, langue: l } = traduire(valeur);
    return el(tag, { ...attrs, ...attrsLangue(l) }, texte);
  }

  // Marque un élément pour l'apparition au défilement ; i décale l'animation (effet en cascade)
  function revele(noeud, i = 0) {
    noeud.classList.add('reveal');
    noeud.style.setProperty('--i', Math.min(i, 8));
    return noeud;
  }

  const lien = (...parties) => '#/' + [langue, ...parties].map(encodeURIComponent).join('/');
  const fleche = c => el('span', { class: 'fleche', 'aria-hidden': 'true' }, c);
  const titrePage = (attrs, ...enfants) => el('h1', { id: 'titre-page', tabindex: '-1', ...attrs }, ...enfants);
  const bandeau = () => el('p', { class: 'bandeau', role: 'note' }, t('nonTraduit'));

  function formatPrix(prix) {
    try {
      return new Intl.NumberFormat(langue, { style: 'currency', currency: config.devise }).format(prix);
    } catch {
      return `${prix} ${config.devise}`;
    }
  }

  function icone(chemin) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icone');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', chemin);
    svg.append(p);
    return svg;
  }
  const ICONE_CADENAS = 'M6 10h12v10H6zM8.5 10V7a3.5 3.5 0 0 1 7 0v3';

  // ---------- Achat ----------

  const lienAchatValide = url => typeof url === 'string' && /^https:\/\/\S+$/.test(url);

  // Bouton d'achat Lemon Squeezy : ouvre la fenêtre de paiement par-dessus la page
  function boutonAchat(lienAchat, prix) {
    if (!lienAchatValide(lienAchat)) {
      return el('span', { class: 'bouton', 'aria-disabled': 'true' }, t('bientot'));
    }
    const url = new URL(lienAchat);
    url.searchParams.set('embed', '1');
    return el('a', { class: 'bouton lemonsqueezy-button', href: url.href }, t('acheter', { prix: formatPrix(prix) }));
  }

  function activerPaiement() {
    try { window.createLemonSqueezy?.(); } catch (e) { console.error(e); }
  }

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

    const texte = (id, val) => { document.getElementById(id).textContent = val; };
    texte('lien-skip', t('skip'));
    texte('label-langue', t('langue'));
    texte('label-taille', t('tailleTexte'));
    texte('txt-reduire', t('reduire'));
    texte('txt-agrandir', t('agrandir'));
    texte('lien-accueil', nomSite());
    texte('nav-livre', t('livre'));
    texte('nav-chapitres', t('chapitres'));
    texte('nav-boutique', t('boutique'));
    texte('lien-mentions', t('mentions'));
    texte('pied-texte', `© ${new Date().getFullYear()} ${livre.auteur} · ${nomSite()}`);

    document.getElementById('nav-principale').setAttribute('aria-label', t('navPrincipale'));
    document.getElementById('select-langue').value = code;
    document.getElementById('lien-accueil').href = lien();
    document.getElementById('nav-livre').href = lien();
    document.getElementById('nav-chapitres').href = lien('chapitres');
    document.getElementById('nav-boutique').href = lien('boutique');
    document.getElementById('lien-mentions').href = lien('mentions');
  }

  // ---------- Données ----------

  // Fichier par langue, avec repli sur la langue par défaut
  async function chargerTraduit(chemin) {
    try {
      return { donnees: await charger(`${chemin}/${langue}.json`), repli: false };
    } catch (e) {
      if (langue === config.langueParDefaut) throw e;
      return { donnees: await charger(`${chemin}/${config.langueParDefaut}.json`), repli: true };
    }
  }

  const premierGratuit = () => livre.chapitres.find(c => c.gratuit);

  // ---------- Composants ----------

  function listeChapitres() {
    return el('ol', { class: 'liste-chapitres' },
      livre.chapitres.map((c, i) => revele(el('li', {},
        el('a', { href: lien('chapitre', c.numero) },
          el('span', { class: 'num-chap' }, String(c.numero).padStart(2, '0')),
          elTrad('span', { class: 'titre-chap' }, c.titre),
          el('span', { class: 'infos-chap' },
            el('span', { class: 'badge' }, c.gratuit ? t('gratuit') : t('extrait')),
            !c.gratuit && el('span', { class: 'prix' }, formatPrix(c.prix)))
        )), i))
    );
  }

  function offreComplete(niveau) {
    return revele(el('div', { class: 'offre' },
      el('div', {},
        el(niveau, {}, t('packTitre')),
        el('p', {}, t('packTexte')),
        el('p', {}, t('formats', { formats: config.formats }))
      ),
      el('div', { class: 'offre-achat' },
        el('span', { class: 'prix' }, formatPrix(livre.pack.prix)),
        boutonAchat(livre.pack.lienAchat, livre.pack.prix)
      )
    ));
  }

  const mentionPaiement = () => el('p', { class: 'mention-paiement' }, icone(ICONE_CADENAS), t('paiementSecurise'));

  // ---------- Vues ----------

  function vueAccueil() {
    document.title = `${titreLivre()} — ${nomSite()}`;
    const pres = traduire(livre.presentation);
    const gratuit = premierGratuit();

    return el('div', {},
      el('section', { class: 'hero' },
        revele(el('div', { class: 'cadre-couverture' },
          el('img', { class: 'couverture', src: livre.couverture, alt: titreLivre(), width: 600, height: 900 }))),
        el('div', {},
          [
            el('p', { class: 'surtitre' }, t('ebook')),
            elTrad('h1', { id: 'titre-page', tabindex: '-1' }, livre.titre),
            el('p', { class: 'auteur' }, t('par', { auteur: livre.auteur })),
            el('hr', { class: 'filet-orne' }),
            elTrad('p', { class: 'accroche' }, livre.accroche),
            el('div', { class: 'presentation', ...attrsLangue(pres.langue) }, (pres.texte || []).map(p => el('p', {}, p))),
            el('div', { class: 'boutons' },
              gratuit && el('a', { class: 'bouton', href: lien('chapitre', gratuit.numero) },
                t('lireGratuit', { n: gratuit.numero }), fleche('→')),
              el('a', { class: 'bouton secondaire', href: lien('boutique') }, t('voirBoutique'))
            )
          ].map((n, i) => revele(n, i + 1))
        ),
        el('span', { class: 'indicateur', 'aria-hidden': 'true' })
      ),
      el('section', { class: 'section', 'aria-labelledby': 'titre-sommaire' },
        el('h2', { id: 'titre-sommaire' }, t('sommaire')),
        listeChapitres()
      ),
      el('section', { class: 'section' }, offreComplete('h2'))
    );
  }

  function vueChapitres() {
    document.title = `${t('sommaire')} — ${titreLivre()}`;
    return el('div', { class: 'lecture' },
      elTrad('p', { class: 'surtitre' }, livre.titre),
      titrePage({}, t('sommaire')),
      el('hr', { class: 'filet-orne' }),
      listeChapitres(),
      el('div', { class: 'section' }, offreComplete('h2'))
    );
  }

  async function vueChapitre(numero) {
    const i = livre.chapitres.findIndex(c => c.numero === numero);
    if (i < 0) return vueIntrouvable();
    const chap = livre.chapitres[i];
    const prec = livre.chapitres[i - 1];
    const suiv = livre.chapitres[i + 1];
    const { donnees, repli } = await chargerTraduit(`data/chapitres/${chap.numero}`);
    const titre = traduire(chap.titre);
    document.title = `${titre.texte} — ${titreLivre()}`;

    return el('div', {},
      el('article', { class: 'lecture' },
        el('p', { class: 'surtitre' }, t('chapitreN', { n: chap.numero }), ` · ${i + 1} / ${livre.chapitres.length}`),
        titrePage(attrsLangue(titre.langue), titre.texte),
        el('hr', { class: 'filet-orne' }),
        repli && bandeau(),
        el('div', {
          class: chap.gratuit ? 'texte-livre' : 'texte-livre coupe',
          ...(repli ? attrsLangue(config.langueParDefaut) : {})
        }, donnees.contenu.map(p => el('p', {}, p))),

        !chap.gratuit && el('aside', { class: 'achat-chapitre', 'aria-labelledby': 'titre-achat' },
          el('p', { id: 'titre-achat' }, t('suiteEbook')),
          el('div', { class: 'boutons' },
            boutonAchat(chap.lienAchat, chap.prix),
            el('a', { class: 'bouton secondaire', href: lien('boutique') },
              `${t('packTitre')} · ${formatPrix(livre.pack.prix)}`)
          ),
          el('p', { class: 'details' }, t('formats', { formats: config.formats }))
        ),

        el('div', { class: 'nav-chapitres' },
          prec ? el('a', { class: 'bouton secondaire', rel: 'prev', href: lien('chapitre', prec.numero) },
            fleche('←'), t('precedent')) : el('span'),
          el('a', { class: 'bouton secondaire', href: lien('chapitres') }, t('retourSommaire')),
          suiv ? el('a', { class: 'bouton secondaire', rel: 'next', href: lien('chapitre', suiv.numero) },
            t('suivant'), fleche('→')) : el('span')
        )
      )
    );
  }

  function vueBoutique() {
    document.title = `${t('boutique')} — ${nomSite()}`;
    return el('div', {},
      elTrad('p', { class: 'surtitre' }, livre.titre),
      titrePage({}, t('boutique')),
      el('p', { class: 'intro' }, t('boutiqueIntro')),
      el('div', { class: 'section' }, offreComplete('h2')),
      el('h2', {}, t('chapitres')),
      el('ul', { class: 'grille' },
        livre.chapitres.map((c, i) => revele(el('li', {},
          el('article', { class: 'fiche' },
            el('p', { class: 'surtitre' }, t('chapitreN', { n: c.numero })),
            elTrad('h3', {}, c.titre),
            el('p', {}, c.gratuit
              ? el('span', { class: 'badge' }, t('gratuit'))
              : el('span', { class: 'prix' }, formatPrix(c.prix))),
            el('div', { class: 'bas' },
              c.gratuit
                ? el('a', { class: 'bouton', href: lien('chapitre', c.numero) }, t('lire'))
                : [boutonAchat(c.lienAchat, c.prix),
                   el('a', { href: lien('chapitre', c.numero) }, t('lireExtrait'))]
            )
          )), i))
      ),
      mentionPaiement()
    );
  }

  async function vueMentions() {
    document.title = `${t('mentions')} — ${nomSite()}`;
    const { donnees, repli } = await chargerTraduit('data/mentions');
    return el('div', { class: 'mentions' },
      titrePage({}, t('mentions')),
      repli && bandeau(),
      el('div', repli ? attrsLangue(config.langueParDefaut) : {},
        donnees.sections.map(s => [el('h2', {}, s.titre), s.contenu.map(p => el('p', {}, p))]))
    );
  }

  function vueIntrouvable() {
    document.title = `${t('introuvable')} — ${nomSite()}`;
    return el('div', {},
      titrePage({}, t('introuvable')),
      el('p', {}, el('a', { href: lien() }, t('retourAccueil')))
    );
  }

  function vueErreur() {
    return el('div', {},
      titrePage({}, t('erreur')),
      el('p', {}, el('a', { href: lien() }, t('retourAccueil')))
    );
  }

  // ---------- Routeur ----------
  // #/fr · #/fr/chapitres · #/fr/chapitre/2 · #/fr/boutique · #/fr/mentions

  async function router() {
    const monJeton = ++jeton;
    const [code, ...reste] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

    if (!infoLangue(code)) {
      location.replace('#/' + languePreferee());
      return;
    }

    let vue;
    let rubrique = null;
    try {
      await changerLangue(code);
      const [page, param] = reste;
      if (reste.length === 0) { vue = vueAccueil(); rubrique = 'livre'; }
      else if (page === 'chapitres' && reste.length === 1) { vue = vueChapitres(); rubrique = 'chapitres'; }
      else if (page === 'chapitre' && reste.length === 2) { vue = await vueChapitre(Number(param)); rubrique = 'chapitres'; }
      else if (page === 'boutique' && reste.length === 1) { vue = vueBoutique(); rubrique = 'boutique'; }
      else if (page === 'mentions' && reste.length === 1) vue = await vueMentions();
      else vue = vueIntrouvable();
      vueCourante = page === 'chapitre' ? 'lecture' : null;
    } catch (e) {
      console.error(e);
      vue = vueErreur();
      vueCourante = null;
    }
    if (monJeton !== jeton) return;

    for (const r of ['livre', 'chapitres', 'boutique']) {
      const a = document.getElementById('nav-' + r);
      if (r === rubrique) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }

    const afficher = () => {
      app.replaceChildren(vue);
      window.scrollTo(0, 0);
    };
    if (!premierRendu && document.startViewTransition && animations()) {
      await document.startViewTransition(afficher).updateCallbackDone;
    } else {
      afficher();
    }

    observerApparitions(app);
    inclinerCouverture(app.querySelector('.cadre-couverture'));
    majProgression();
    activerPaiement();
    if (!premierRendu) document.getElementById('titre-page')?.focus({ preventScroll: true });
    premierRendu = false;
  }

  // ---------- Effets (désactivés si « réduire les animations ») ----------

  const animations = () => document.documentElement.classList.contains('anim');
  let observateur = null;

  function observerApparitions(racine) {
    if (!animations()) return;
    observateur?.disconnect();
    observateur = new IntersectionObserver(entrees => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('visible');
        observateur.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    racine.querySelectorAll('.reveal').forEach(n => observateur.observe(n));
  }

  // Légère inclinaison 3D de la couverture qui suit la souris
  function inclinerCouverture(cadre) {
    if (!cadre || !animations() || !matchMedia('(hover: hover)').matches) return;
    cadre.addEventListener('pointermove', e => {
      const r = cadre.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cadre.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      cadre.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      cadre.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(0)}%`);
    });
    cadre.addEventListener('pointerleave', () => {
      cadre.style.removeProperty('--rx');
      cadre.style.removeProperty('--ry');
    });
  }

  // ---------- Barre de progression de lecture ----------

  function majProgression() {
    if (vueCourante !== 'lecture') { barre.style.width = '0'; return; }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    barre.style.width = max > 0 ? `${Math.min(100, (window.scrollY / max) * 100)}%` : '100%';
  }

  let attenteProgression = false;
  window.addEventListener('scroll', () => {
    if (attenteProgression) return;
    attenteProgression = true;
    requestAnimationFrame(() => {
      majProgression();
      document.querySelector('.entete').classList.toggle('defile', window.scrollY > 8);
      attenteProgression = false;
    });
  }, { passive: true });

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
      livre = await charger('data/livre.json');
    } catch (e) {
      console.error(e);
      app.textContent = 'Erreur de chargement. Lancez le site via un serveur web (voir README.md).';
      return;
    }

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      document.documentElement.classList.add('anim');
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

    // lemon.js est chargé en différé : on branche les boutons déjà affichés quand il arrive
    window.addEventListener('load', activerPaiement);
    window.addEventListener('hashchange', router);
    router();
  }

  demarrer();
})();
