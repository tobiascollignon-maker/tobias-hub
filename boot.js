/* ============================================================================
   boot.js — pose la classe .js sur <html> AVANT le premier rendu.
   Chargé SYNCHRONE dans <head> (pas de defer) : sinon les blocs .rv clignotent.

   ⛔ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL NE DOIT PAS REDEVENIR INLINE
   La CSP de vercel.json impose `script-src 'self'` — sans 'unsafe-inline'.
   Un <script> inline est donc BLOQUÉ EN SILENCE : aucune erreur, aucune page
   blanche. Simplement, .js n'est jamais posée — et les 18 règles CSS qui en
   dépendent meurent d'un coup (tous les flottants, et surtout les DEUX tracés
   orange à la main, qui deviennent invisibles au lieu de simplement s'arrêter).
   C'est arrivé. La page a tourné plusieurs jours sans sa signature visuelle.

   Si tu remets ce code en inline, tu reproduis le bug à l'identique.
   ============================================================================ */
document.documentElement.classList.add('js');

/* ── LE FILET ──────────────────────────────────────────────────────────────
   .js active `.js .rv{opacity:0}` : 9 blocs de la page sont CACHÉS tant que
   main.js ne les révèle pas au scroll. Donc si main.js ne tourne jamais
   (réseau coupé, erreur JS, nouvelle règle CSP), la page s'affiche presque
   VIDE — un échec bien pire que l'absence d'animation.

   Alors on se donne 3 secondes. Passé ce délai, si main.js n'a pas signé sa
   présence, on révèle tout de force. Le contenu n'est jamais l'otage d'une
   animation qui n'est pas venue. ── */
setTimeout(function () {
  if (document.documentElement.dataset.ready) return; // main.js a bien démarré
  document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
  console.warn('[hub] main.js n’a pas démarré — contenu révélé par le filet de sécurité.');
}, 3000);
