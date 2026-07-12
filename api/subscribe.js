// Vercel serverless function — capture email → Brevo (liste + email de livraison transactionnel).
// Gratuit (plan Brevo free : 300 mails/j). Requiert les env vars sur Vercel :
//   BREVO_API_KEY     (clé API v3 — Brevo > Settings > SMTP & API > API Keys)
//   BREVO_LIST_ID     (défaut 2)
//   BREVO_TEMPLATE_ID (défaut 1 — template "Perso — Livraison pack gratuit")
// Le <form> de la landing POST { email } ici (voir SOP brevo_landing_vercel_sync.md).

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let email;
  try { email = (req.body && req.body.email) || JSON.parse(req.body || '{}').email; } catch (_) {}
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  const KEY = process.env.BREVO_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'BREVO_API_KEY manquante' });
  const LIST_ID = Number(process.env.BREVO_LIST_ID || 2);
  const TEMPLATE_ID = Number(process.env.BREVO_TEMPLATE_ID || 1);
  const H = { 'api-key': KEY, 'content-type': 'application/json', accept: 'application/json' };

  try {
    // 1) Ajoute / met à jour le contact dans la liste
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST', headers: H,
      body: JSON.stringify({ email, listIds: [LIST_ID], updateEnabled: true }),
    });
    // 2) Envoie l'email de livraison (template transactionnel)
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: H,
      body: JSON.stringify({ to: [{ email }], templateId: TEMPLATE_ID }),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
