import { SPREADSHEET_ID, getGoogleAccessToken, appendSpreadsheetValues } from './_google_auth.js';

export function genererIdentifiant(prenom, nomMagasin) {
  const cleanPrenom = String(prenom || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  let cleanMag = String(nomMagasin || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(l'|le |la |les |d'|de |du )/g, '')
    .replace(/[^a-z0-9]/g, '');

  const tri = cleanMag.slice(0, 3) || 'mag';
  return `${cleanPrenom}-${tri}`;
}

export default async function handler(req, res) {
  // CORS
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
    const nomMagasin = String(body.nomMagasin || '').trim();
    const prenom = String(body.prenom || '').trim();
    const adresse = String(body.adresse || body.ville || '').trim();
    const capacite = parseInt(body.capacite, 10) || 10;
    const motDePasse = String(body.motDePasse || '').trim();

    if (!nomMagasin || !prenom || !adresse || !motDePasse) {
      return res.status(400).json({
        ok: false,
        error: 'Veuillez renseigner tous les champs obligatoires (nom du magasin, prénom, adresse, mot de passe).'
      });
    }

    // 1. Déterminer le prochain ID magasin (auto-incrément)
    const token = await getGoogleAccessToken();
    const rangeId = encodeURIComponent('Système Atelier!A2:A');
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${rangeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataId = await getRes.json();
    const existingIds = dataId.values || [];

    let maxNum = 0;
    for (const row of existingIds) {
      const val = String(row[0] || '').trim();
      const match = val.match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = maxNum + 1;
    const nextId = `mag-${String(nextNum).padStart(2, '0')}`;

    // 2. Générer l'identifiant anti-doublon (prénom + 3 lettres magasin)
    const username = genererIdentifiant(prenom, nomMagasin);

    // 3. Dates
    const d = new Date();
    const todayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const nextMonth = new Date(d);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const echeanceStr = `${String(nextMonth.getDate()).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;

    // 4. Ligne complète pour "Système Atelier"
    const rowAtelier = [
      nextId,                                                              // A: ID Magasin
      nomMagasin,                                                          // B: Boutique Partenaire
      adresse,                                                             // C: Ville
      prenom,                                                              // D: Responsable Magasin
      35,                                                                  // E: Tarif Fixé par Lynda (€)
      capacite,                                                            // F: Capacité Salle
      "Initiation & Découverte des Bienfaits Naturels",                    // G: Thème 1 (Titre)
      `Atelier pratique et bienveillant animé en boutique par ${prenom}.`, // H: Thème 1 (Description)
      35,                                                                  // I: Thème 1 (Tarif €)
      "Gestion du Stress & Sérénité au Quotidien",                         // J: Thème 2 (Titre)
      "Techniques simples de relaxation et respiration.",                  // K: Thème 2 (Description)
      35,                                                                  // L: Thème 2 (Tarif €)
      "Équilibre Énergétique & Vitalité Naturelle",                        // M: Thème 3 (Titre)
      "Conseils et rituels personnalisés pour retrouver son énergie.",     // N: Thème 3 (Description)
      35,                                                                  // O: Thème 3 (Tarif €)
      "Phase de Vote",                                                     // P: Statut Atelier
      "En attente choix date",                                             // Q: Date & Heure Retenue
      `0 / ${capacite}`,                                                   // R: Places Réservées
      0,                                                                   // S: Recettes Stripe (€)
      `https://collaboration-therapie.vercel.app/?magasin=${nextId}`,       // T: Lien Privé Magasin
      username,                                                            // U: Identifiant Magasin
      motDePasse,                                                          // V: Mot de passe
      "Magasin Autonome (49€/m)",                                          // W: Formule / Mode
      "Actif",                                                             // X: Statut Abonnement
      echeanceStr,                                                         // Y: Date Échéance
      "Stripe Magasin"                                                     // Z: Compte Encaissement Magasin
    ];

    // 5. Ligne pour "Accès Admin" (Identifiant, Mot de passe, Rôle, ID Magasin, Nom Magasin)
    const rowAdmin = [
      username,
      motDePasse,
      "collaboratrice",
      nextId,
      nomMagasin
    ];

    // 6. Écriture simultanée dans Google Sheets
    await appendSpreadsheetValues('Système Atelier!A:Z', [rowAtelier]);
    await appendSpreadsheetValues('Accès Admin!A:E', [rowAdmin]);

    const lienPartenaire = `https://collaboration-therapie.vercel.app/?magasin=${nextId}`;
    const lienClient = `https://collaboration-therapie.vercel.app/client?magasin=${nextId}`;

    return res.status(200).json({
      ok: true,
      idMagasin: nextId,
      nomMagasin: nomMagasin,
      responsable: prenom,
      adresse: adresse,
      capacite: capacite,
      identifiant: username,
      motDePasse: motDePasse,
      lienPartenaire: lienPartenaire,
      lienClient: lienClient,
      message: `Boutique ${nomMagasin} créée avec succès dans votre Google Sheet !`
    });

  } catch (err) {
    console.error('Erreur creer-partenaire handler :', err);
    return res.status(500).json({
      ok: false,
      error: 'Erreur interne lors de l\'enregistrement dans Google Sheet: ' + (err.message || err)
    });
  }
}
