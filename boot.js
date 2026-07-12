/* ============================================================================
   boot.js — pose la classe .js sur <html> AVANT le premier rendu.
   Chargé SYNCHRONE dans <head> (pas de defer) : sinon les .rv clignotent.

   ⛔ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL NE DOIT PAS REDEVENIR INLINE
   La CSP de vercel.json impose `script-src 'self'` — sans 'unsafe-inline'.
   Un <script> inline est donc BLOQUÉ EN SILENCE : aucune erreur, aucune page
   blanche. Simplement, .js n'est jamais posée — et les 18 règles CSS qui en
   dépendent meurent d'un coup (tous les flottants, les deux tracés à la main).
   C'est arrivé. La page a tourné plusieurs jours sans son trait orange.

   Si tu remets ce code en inline, tu reproduis le bug à l'identique.
   ============================================================================ */
document.documentElement.classList.add('js');
