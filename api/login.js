export default async function handler(req, res) {
  // Activer CORS pour requêtes locales ou Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Méthode non autorisée. Utilisez POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Veuillez saisir votre identifiant et mot de passe.' });
    }

    const SPREADSHEET_ID = '1TprsCw9JAqZjLwCYvo7c4QQ1FsLv5lVSwZLsvmcNSwQ';

    // 1. Vérification d'abord du compte Super-Admin Lynda
    try {
      const adminUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Acc%C3%A8s%20Admin&_ts=${Date.now()}`;
      const adminRes = await fetch(adminUrl);
      const adminText = await adminRes.text();
      const adminJsonStr = adminText.substring(adminText.indexOf('{'), adminText.lastIndexOf('}') + 1);
      const adminData = JSON.parse(adminJsonStr);
      const adminRows = adminData.table?.rows || [];

      for (const row of adminRows) {
        const u = String(row.c?.[0]?.v || '').trim().toLowerCase();
        const p = String(row.c?.[1]?.v || '').trim();
        if (u && u !== 'identifiant admin' && u === username && p === password) {
          return res.status(200).json({
            ok: true,
            role: 'admin',
            nom: 'Lynda',
            message: 'Connexion Super-Admin réussie'
          });
        }
      }
    } catch (e) {
      console.error('Erreur vérification admin :', e);
    }

    // 2. Vérification des comptes Magasins Partenaires
    const shopsUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Syst%C3%A8me%20Atelier&_ts=${Date.now()}`;
    const shopsRes = await fetch(shopsUrl);
    const shopsText = await shopsRes.text();
    const shopsJsonStr = shopsText.substring(shopsText.indexOf('{'), shopsText.lastIndexOf('}') + 1);
    const shopsData = JSON.parse(shopsJsonStr);
    const shopRows = shopsData.table?.rows || [];

    for (let i = 0; i < shopRows.length; i++) {
      const row = shopRows[i];
      const getVal = idx => (row.c && row.c[idx] && row.c[idx].v !== undefined) ? row.c[idx].v : '';
      
      const shopUser = String(getVal(20) || '').trim().toLowerCase(); // Colonne U (index 20)
      const shopPass = String(getVal(21) || '').trim();              // Colonne V (index 21)

      if (shopUser && shopUser !== 'identifiant magasin' && shopUser === username && shopPass === password) {
        const id = String(getVal(0) || `mag-${String(i + 1).padStart(2, '0')}`);
        const nom = String(getVal(1) || 'Magasin Partenaire');
        const ville = String(getVal(2) || '');
        const responsable = String(getVal(3) || 'Gérant·e');
        const formule = String(getVal(22) || 'Atelier Lynda (Standard)'); // Colonne W
        const statutAbonnement = String(getVal(23) || 'Actif');          // Colonne X
        const dateEcheance = String(getVal(24) || '-');                 // Colonne Y
        const compteEncaissement = String(getVal(25) || 'Non configuré'); // Colonne Z

        return res.status(200).json({
          ok: true,
          role: 'shop',
          shopId: id,
          shopNom: nom,
          ville: ville,
          responsable: responsable,
          formule: formule,
          statutAbonnement: statutAbonnement,
          dateEcheance: dateEcheance,
          compteEncaissement: compteEncaissement,
          message: `Connexion réussie pour ${nom}`
        });
      }
    }

    return res.status(401).json({
      ok: false,
      error: 'Identifiant ou mot de passe incorrect. Vérifiez vos identifiants auprès de Lynda.'
    });

  } catch (err) {
    console.error('Erreur login handler :', err);
    return res.status(500).json({
      ok: false,
      error: 'Erreur interne lors de la vérification de vos identifiants.'
    });
  }
}
