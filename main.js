/* ============================================================================
   Tobias Collignon — hub
   IntersectionObserver partout, jamais addEventListener('scroll').
   prefers-reduced-motion : l'information n'est JAMAIS derrière le mouvement.
   ============================================================================ */
(() => {
  'use strict';

  // Signe la présence : désarme le filet de sécurité de boot.js, qui sans ça
  // révélerait tout au bout de 3s en supposant que ce fichier n'a jamais tourné.
  document.documentElement.dataset.ready = '1';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Reveal ------------------------------------------------------------ */
  const rvs = document.querySelectorAll('.rv');
  if (REDUCED) {
    rvs.forEach(el => el.classList.add('in'));
  } else {
    const ro = new IntersectionObserver((es) => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        ro.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    rvs.forEach(el => ro.observe(el));
  }

  /* ---- Tracés à la main : ils se dessinent quand on les atteint ---------- */
  document.querySelectorAll('[data-draw]').forEach(el => {
    const path = el.querySelector('path');
    if (!path) return;
    const len = Math.ceil(path.getTotalLength());
    path.style.setProperty('--len', len);
    if (REDUCED) { el.classList.add('draw'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      el.classList.add('draw');
      io.disconnect();
    }, { threshold: 0.9 });
    io.observe(el);
  });

  /* ---- Navbar collante --------------------------------------------------- */
  const nav = document.getElementById('nav');
  const top = document.getElementById('top');
  if (nav && top) {
    const io = new IntersectionObserver(([e]) => {
      nav.classList.toggle('stuck', e.boundingClientRect.top < 0);
    }, { threshold: 0, rootMargin: '-72px 0px 0px 0px' });
    io.observe(top);
  }

  /* ---- Les chiffres se COMPTENT ------------------------------------------
     Purpose, pas décoration (règle web-motion #2) : ces 3 nombres SONT le propos de
     la section — les faire monter force à les lire au lieu de les survoler.
     Layout-safe : la colonne des chiffres fait 3,8rem FIXES (.ch-i), donc le compteur
     ne pousse rien pendant qu'il tourne. Sans ce garde-fou, animer du texte = un
     reflow par frame, et la règle « composited only » saute.
     Sans JS ou en reduced-motion : le nombre final est déjà dans le HTML. */
  const compteurs = document.querySelectorAll('.ch-n');
  if (compteurs.length && !REDUCED) {
    const easeOut = t => 1 - Math.pow(1 - t, 3);      // arrêt doux = naturel
    const io = new IntersectionObserver((es) => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        const cible = parseInt(el.textContent, 10);
        if (!Number.isFinite(cible)) return;          // un compteur ne devine pas
        const D = 850, t0 = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / D);
          // Math.round et pas floor : sinon on n'atteint la cible qu'à la dernière frame.
          el.textContent = Math.round(cible * easeOut(t));
          if (t < 1) requestAnimationFrame(tick);
          else el.textContent = cible;                // la valeur EXACTE, toujours
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 1 });
    compteurs.forEach(n => io.observe(n));
  }

  /* ---- Le dossier répond au curseur --------------------------------------
     C'est un OBJET : ce qui le prouve, c'est qu'il bouge quand on bouge. Le delta
     part sur `.fi-t` uniquement — il s'AJOUTE au repos de `.fi-o` sans jamais
     toucher la fenêtre ni son texte (règle : l'objet porte la 3D, pas la donnée).
     Trois garde-fous : pas de pointeur fin (mobile) → rien ; reduced-motion → rien ;
     et une frame par rAF max, sinon `pointermove` écrit 200 fois par seconde. */
  const scene = document.querySelector('.fold__ico');
  const objet = scene && scene.querySelector('.fi-t');
  const zone = scene && scene.closest('.fold');
  if (objet && zone && !REDUCED && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    let raf = 0, rx = 0, ry = 0;
    const pose = () => {
      raf = 0;
      objet.style.setProperty('--px', rx.toFixed(2) + 'deg');
      objet.style.setProperty('--py', ry.toFixed(2) + 'deg');
    };
    const vise = () => { if (!raf) raf = requestAnimationFrame(pose); };
    zone.addEventListener('pointermove', (e) => {
      const r = zone.getBoundingClientRect();
      // Bornes serrées (±5°/±3,5°) : au-delà, le rabat quitte visiblement le dos et
      // l'objet se démonte. On suggère la parallaxe, on ne fait pas tourner un jouet.
      ry = ((e.clientX - r.left) / r.width - .5) * 10;
      rx = (.5 - (e.clientY - r.top) / r.height) * 7;
      vise();
    });
    // Le curseur part → l'objet revient au repos. Sinon il reste tordu pour toujours.
    zone.addEventListener('pointerleave', () => { rx = ry = 0; vise(); });
  }

  /* ---- Barre CTA mobile --------------------------------------------------- */
  const bar = document.getElementById('bar');
  const hero = document.querySelector('.hero');
  if (bar && hero) {
    new IntersectionObserver(([e]) => {
      bar.classList.toggle('up', !e.isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  /* ---- Slot de conversion, mode "capture" (dormant tant que la clé Brevo
         n'existe pas — voir CONTENT.md). Gère chargement / succès / erreur. */
  const form = document.querySelector('.offer__form');
  if (form) {
    const msg = document.querySelector('.offer__msg');
    const btn = form.querySelector('button');
    const say = (state, text) => { if (msg) { msg.dataset.state = state; msg.textContent = text; } };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = new FormData(form).get('email');
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return say('err', 'Cette adresse ne ressemble pas à un email.');
      }
      const label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
      say('', '');
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}));
          throw new Error(error || 'Envoi impossible pour le moment.');
        }
        form.reset();
        // Double opt-in : rien n'est encore acquis tant qu'elle n'a pas cliqué.
        // Lui dire "c'est bon" serait faux — elle attendrait un pack qui n'arrivera pas.
        say('ok', 'Presque : ouvre ta boîte mail et clique sur le lien de confirmation.');
      } catch (err) {
        say('err', err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    });
  }
})();
