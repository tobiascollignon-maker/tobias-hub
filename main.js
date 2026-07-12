/* ============================================================================
   Tobias Collignon — hub
   Trois choses, pas une de plus :
     1. le boot de l'org-chart (LA seule animation qui porte du sens)
     2. le survol/tap d'un nœud → sa branche s'allume, son rôle s'affiche
     3. la barre CTA mobile + les reveals au scroll

   Règles tenues (web-motion) : IntersectionObserver, jamais addEventListener('scroll').
   prefers-reduced-motion : l'info n'est JAMAIS derrière le mouvement.
   ============================================================================ */
(() => {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. Reveals au scroll ---------------------------------------------- */
  const revealables = document.querySelectorAll('.rv');
  if (REDUCED) {
    revealables.forEach(el => el.classList.add('in'));
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        ro.unobserve(e.target);           // une seule fois : pas de yo-yo au scroll
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealables.forEach(el => ro.observe(el));
  }

  /* ---- 2. L'org-chart ----------------------------------------------------- */
  const wrap = document.getElementById('orgwrap');
  const svg = wrap && wrap.querySelector('svg.org');
  const roleBox = document.getElementById('orgrole');

  if (svg) {
    const nodes = [...svg.querySelectorAll('.n')];
    const edges = [...svg.querySelectorAll('.e')];

    // parent de chaque nœud, reconstruit depuis les arêtes (data-to)
    const parentOf = new Map();
    edges.forEach(e => {
      const to = e.dataset.to;
      const path = e.getAttribute('d') || '';
      // le point de départ de la courbe appartient au parent : on retrouve le parent
      // en cherchant le nœud dont le bord droit coïncide — plus simple : on encode
      // l'ordre du DOM, les arêtes sont émises parent→enfant dans gen_org_svg.py
      parentOf.set(to, e);
    });

    /* -- 2a. Boot : la délégation s'écoule de la racine vers les feuilles ---- */
    const depthOf = (el) => {
      const lv = el.dataset.level;
      return lv === 'co-CEO' ? 0 : lv === 'Head' ? 1 : lv === 'lead' ? 2 : 3;
    };

    if (REDUCED) {
      wrap.classList.remove('is-idle');   // tout est là, tracé, immédiatement
    } else {
      // longueur réelle de chaque tracé → dessin propre (pas une valeur devinée)
      edges.forEach(e => {
        const len = Math.ceil(e.getTotalLength());
        e.style.setProperty('--len', len);
      });

      const STAGGER = 70;                 // ms par niveau
      nodes.forEach(n => n.style.setProperty('--d', `${depthOf(n) * STAGGER}ms`));
      edges.forEach(e => {
        const child = svg.querySelector(`.n[data-agent="${CSS.escape(e.dataset.to)}"]`);
        const d = child ? depthOf(child) : 1;
        e.style.setProperty('--d', `${(d - 1) * STAGGER + 40}ms`);
      });

      const boot = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          wrap.classList.remove('is-idle');
          wrap.classList.add('boot');
          boot.disconnect();              // one-shot
          // will-change posé pendant l'anim, retiré après (règle 7 web-motion)
          svg.style.willChange = 'contents';
          setTimeout(() => { svg.style.willChange = 'auto'; }, 1400);
        });
      }, { threshold: 0.18 });
      boot.observe(wrap);
    }

    /* -- 2b. Allumer une branche + afficher le rôle -------------------------
       ⚠️ Zéro innerHTML ici. Les libellés viennent des descriptions d'agents,
       et le repo est PUBLIC : une PR pourrait y glisser du balisage. On
       construit des nœuds DOM et on passe par textContent — rien n'est
       jamais interprété comme du HTML. */
    const DEFAULT_ROLE = roleBox ? roleBox.textContent : '';

    const setRole = (name, rest) => {
      if (!roleBox) return;
      roleBox.textContent = '';
      if (!name) { roleBox.textContent = DEFAULT_ROLE; return; }
      const b = document.createElement('b');
      b.textContent = name;
      roleBox.append(b);
      if (rest) roleBox.append(document.createTextNode(' — ' + rest));
    };

    const clear = () => {
      svg.classList.remove('has-lit');
      nodes.forEach(n => n.classList.remove('lit'));
      edges.forEach(e => e.classList.remove('lit'));
      setRole(null);
    };

    const lightUp = (node) => {
      clear();
      svg.classList.add('has-lit');

      // remonter la chaîne de commandement : le nœud, puis ses ancêtres
      let cur = node;
      const guard = new Set();            // anti-boucle, au cas où
      while (cur && !guard.has(cur)) {
        guard.add(cur);
        cur.classList.add('lit');
        const edge = parentOf.get(cur.dataset.agent);
        if (!edge) break;
        edge.classList.add('lit');
        // le parent est le nœud d'où part cette arête : on le retrouve par la
        // position de départ du tracé (x1,y1) — comparé au bord droit des nœuds
        cur = findParentNode(edge);
      }

      const title = node.querySelector('title');
      const txt = title ? title.textContent : node.dataset.agent;
      const [name, ...rest] = txt.split(' — ');
      setRole(name, rest.join(' — '));
    };

    // retrouve le nœud parent d'une arête via son point de départ
    const nodeBoxes = nodes.map(n => {
      const r = n.querySelector('rect');
      return {
        el: n,
        right: parseFloat(r.getAttribute('x')) + parseFloat(r.getAttribute('width')),
        midY: parseFloat(r.getAttribute('y')) + parseFloat(r.getAttribute('height')) / 2,
      };
    });
    function findParentNode(edge) {
      const m = (edge.getAttribute('d') || '').match(/^M\s*([\d.]+)\s+([\d.]+)/);
      if (!m) return null;
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      let best = null, bestD = 6;          // tolérance de 6 unités SVG
      for (const b of nodeBoxes) {
        const d = Math.abs(b.right - x) + Math.abs(b.midY - y);
        if (d < bestD) { bestD = d; best = b.el; }
      }
      return best;
    }

    nodes.forEach(n => {
      n.addEventListener('mouseenter', () => lightUp(n));
      n.addEventListener('focus', () => lightUp(n));
      n.addEventListener('click', (ev) => { ev.preventDefault(); lightUp(n); });
    });
    svg.addEventListener('mouseleave', clear);
    svg.addEventListener('blur', clear, true);
  }

  /* ---- 3. Barre CTA mobile ------------------------------------------------ */
  const bar = document.getElementById('bar');
  const hero = document.querySelector('.hero');
  if (bar && hero) {
    const bo = new IntersectionObserver(([e]) => {
      bar.classList.toggle('up', !e.isIntersecting);
    }, { threshold: 0 });
    bo.observe(hero);
  }

  /* ---- 4. Le slot de conversion, mode "capture" ---------------------------
     Dormant tant que <section id="offer"> est en mode "follow".
     Quand la clé Brevo existera : data-offer-mode="capture" + le <form> (CONTENT.md).
     Ce code gère alors chargement / succès / erreur — jamais un état muet. */
  const form = document.querySelector('.offer__form');
  if (form) {
    const msg = document.querySelector('.offer__msg');
    const btn = form.querySelector('button');
    const say = (state, text) => {
      if (!msg) return;
      msg.dataset.state = state;
      msg.textContent = text;
    };

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
        say('ok', 'C’est bon. Regarde ta boîte mail.');
      } catch (err) {
        say('err', err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    });
  }
})();
