/* ============================================================================
   Tobias Collignon — hub
   IntersectionObserver partout, jamais addEventListener('scroll').
   prefers-reduced-motion : l'information n'est JAMAIS derrière le mouvement.
   ============================================================================ */
(() => {
  'use strict';
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

  /* ---- L'org-chart : replié par défaut ----------------------------------
     Il prend beaucoup de place. Qui veut le voir l'ouvre ; les autres passent.
     On anime la hauteur, mais on ne coupe jamais l'accès au contenu. */
  const panel = document.getElementById('orgpanel');
  const toggle = document.getElementById('orgtoggle');
  const wrap = document.getElementById('orgwrap');
  const svg = wrap && wrap.querySelector('svg.org');
  const roleBox = document.getElementById('orgrole');
  let booted = false;

  const bootChart = () => {
    if (booted || !svg) return;
    booted = true;
    if (REDUCED) { wrap.classList.remove('is-idle'); return; }
    svg.querySelectorAll('.e').forEach(e => {
      e.style.setProperty('--len', Math.ceil(e.getTotalLength()));
    });
    const depth = (el) => {
      const l = el.dataset.level;
      return l === 'co-CEO' ? 0 : l === 'Head' ? 1 : l === 'lead' ? 2 : 3;
    };
    const S = 70;
    svg.querySelectorAll('.n').forEach(n => n.style.setProperty('--d', `${depth(n) * S}ms`));
    svg.querySelectorAll('.e').forEach(e => {
      const child = svg.querySelector(`.n[data-agent="${CSS.escape(e.dataset.to)}"]`);
      e.style.setProperty('--d', `${((child ? depth(child) : 1) - 1) * S + 40}ms`);
    });
    wrap.classList.remove('is-idle');
    wrap.classList.add('boot');
  };

  if (panel && toggle) {
    panel.style.height = '0px';
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.querySelector('span').textContent = open ? "Déplier l'organigramme" : "Replier l'organigramme";
      if (open) {
        panel.style.height = panel.scrollHeight + 'px';
        requestAnimationFrame(() => { panel.style.height = '0px'; });
      } else {
        const inner = panel.firstElementChild;
        panel.style.height = inner.offsetHeight + 'px';
        bootChart();
        // une fois ouvert, on libère la hauteur : le contenu peut respirer
        panel.addEventListener('transitionend', function done(ev) {
          if (ev.propertyName !== 'height') return;
          if (toggle.getAttribute('aria-expanded') === 'true') panel.style.height = 'auto';
          panel.removeEventListener('transitionend', done);
        });
      }
    });
  }

  /* ---- Allumer une branche + afficher le rôle ---------------------------
     Zéro innerHTML : le repo est public, une PR pourrait injecter du balisage
     via la description d'un agent. On construit des nœuds DOM. */
  if (svg) {
    const nodes = [...svg.querySelectorAll('.n')];
    const edges = [...svg.querySelectorAll('.e')];
    const edgeTo = new Map(edges.map(e => [e.dataset.to, e]));
    const DEFAULT = roleBox ? roleBox.textContent : '';

    const boxes = nodes.map(n => {
      const r = n.querySelector('rect');
      return {
        el: n,
        right: parseFloat(r.getAttribute('x')) + parseFloat(r.getAttribute('width')),
        midY: parseFloat(r.getAttribute('y')) + parseFloat(r.getAttribute('height')) / 2,
      };
    });
    const parentOf = (edge) => {
      const m = (edge.getAttribute('d') || '').match(/^M\s*([\d.]+)\s+([\d.]+)/);
      if (!m) return null;
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      let best = null, bd = 6;
      for (const b of boxes) {
        const d = Math.abs(b.right - x) + Math.abs(b.midY - y);
        if (d < bd) { bd = d; best = b.el; }
      }
      return best;
    };

    const setRole = (name, rest) => {
      if (!roleBox) return;
      roleBox.textContent = '';
      if (!name) { roleBox.textContent = DEFAULT; return; }
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
      let cur = node;
      const seen = new Set();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        cur.classList.add('lit');
        const edge = edgeTo.get(cur.dataset.agent);
        if (!edge) break;
        edge.classList.add('lit');
        cur = parentOf(edge);
      }
      const t = node.querySelector('title');
      const [name, ...rest] = (t ? t.textContent : node.dataset.agent).split(' — ');
      setRole(name, rest.join(' — '));
    };

    nodes.forEach(n => {
      n.addEventListener('mouseenter', () => lightUp(n));
      n.addEventListener('focus', () => lightUp(n));
      n.addEventListener('click', (e) => { e.preventDefault(); lightUp(n); });
    });
    svg.addEventListener('mouseleave', clear);
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
