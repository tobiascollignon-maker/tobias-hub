// Vercel serverless function — capture email → Brevo, en DOUBLE OPT-IN.
//
// ⛔ POURQUOI LE DOUBLE OPT-IN N'EST PAS OPTIONNEL
// La version précédente ajoutait le contact ET lui envoyait le mail immédiatement.
// Cet endpoint est PUBLIC : n'importe qui peut y POSTER l'adresse de n'importe qui.
// Conséquences : (1) on inscrit un tiers à une liste marketing SANS son consentement
// — RGPD, et Tobias est le responsable de traitement ; (2) on devient un relais de spam
// (bombarder une victime via ce domaine brûle la réputation d'expéditeur et fait bannir
// le compte Brevo). Le DOI ferme les deux : Brevo envoie un mail de CONFIRMATION, et la
// personne n'entre dans la liste que si ELLE clique. Un tiers ne peut plus être inscrit
// à sa place.
//
// Variables d'environnement (Vercel → Settings → Environment Variables ; JAMAIS un fichier) :
//   BREVO_API_KEY        clé API v3 (Brevo → Settings → SMTP & API → API Keys)
//   BREVO_LIST_ID        id de la liste d'arrivée (après confirmation)
//   BREVO_DOI_TEMPLATE   id du template de CONFIRMATION (type "Double opt-in")
//   BREVO_REDIRECT_URL   page d'atterrissage après le clic de confirmation
//
// La livraison du lead magnet se fait par l'automation Brevo déclenchée à l'entrée
// dans la liste — pas ici. Cet endpoint ne fait qu'une chose : demander le consentement.

const ORIGINS = ['https://tobias-hub.vercel.app'];

// Limitation de débit — best effort. ⚠️ La mémoire est PAR INSTANCE lambda : ça freine
// un script naïf, ça n'arrête pas un attaquant distribué. C'est le DOI qui protège
// vraiment ; ceci ne fait qu'économiser le quota.
const hits = new Map();
const RATE = { max: 5, windowMs: 60 * 60 * 1000 };

function rateLimited(ip) {
  const now = Date.now();
  const seen = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (seen.length >= RATE.max) return true;
  seen.push(now);
  hits.set(ip, seen);
  if (hits.size > 5000) hits.clear(); // garde-fou mémoire
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Même origine uniquement. Contournable au curl, mais ça élimine le bruit de fond.
  const origin = req.headers.origin;
  if (origin && !ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};

  // Pot de miel : un champ invisible pour l'humain, irrésistible pour un bot.
  if (body.website) return res.status(200).json({ ok: true }); // on ne dit pas qu'on a vu

  const email = body.email;
  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Cette adresse ne semble pas valide.' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnu';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans un moment.' });
  }

  const KEY = process.env.BREVO_API_KEY;
  const LIST_ID = Number(process.env.BREVO_LIST_ID);
  const TEMPLATE_ID = Number(process.env.BREVO_DOI_TEMPLATE);
  const REDIRECT = process.env.BREVO_REDIRECT_URL;

  // ⛔ On ne nomme JAMAIS la variable manquante dans la réponse : on n'offre pas la carte
  // de nos variables d'environnement à un inconnu. Le détail va dans les logs, pas au client.
  if (!KEY || !LIST_ID || !TEMPLATE_ID || !REDIRECT) {
    console.error('Config Brevo incomplète', {
      KEY: !!KEY, LIST_ID: !!LIST_ID, TEMPLATE_ID: !!TEMPLATE_ID, REDIRECT: !!REDIRECT,
    });
    return res.status(503).json({ error: 'Inscription indisponible pour le moment.' });
  }

  try {
    // Brevo envoie le mail de CONFIRMATION. Le contact n'entre dans la liste qu'au clic.
    const r = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        email,
        includeListIds: [LIST_ID],
        templateId: TEMPLATE_ID,
        redirectionUrl: REDIRECT,
      }),
    });

    // ⚠️ La version précédente ne regardait PAS ce que Brevo répondait : un quota dépassé
    // renvoyait quand même {ok:true}, et la page affichait "regarde ta boîte mail" alors
    // que rien n'était parti. On ne déclare un succès que si Brevo en confirme un.
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Brevo a refusé', r.status, detail);
      return res.status(502).json({ error: "L'inscription n'a pas pu aboutir. Réessaie plus tard." });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Brevo injoignable', e);
    return res.status(502).json({ error: "L'inscription n'a pas pu aboutir. Réessaie plus tard." });
  }
}
