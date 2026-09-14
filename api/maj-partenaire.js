import { SPREADSHEET_ID, getGoogleAccessToken, updateSpreadsheetValues } from './_google_auth.js';

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
    const idMagasin = String(body.idMagasin || '').trim();

    if (!idMagasin) {
      return res.status(400).json({ ok: false, error: 'ID du magasin manquant.' });
    }

    const token = await getGoogleAccessToken();
    const rangeAll = encodeURIComponent('Système Atelier!A2:Z');
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${rangeAll}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataAll = await getRes.json();
    const rows = dataAll.values || [];

    let targetRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const rowId = String(rows[i][0] || '').trim().toLowerCase();
      if (rowId === idMagasin.toLowerCase()) {
        targetRowIndex = i + 2; // Ligne 1 = header, index 0 = ligne 2
        break;
      }
    }

    if (targetRowIndex === -1) {
      return res.status(404).json({ ok: false, error: `Boutique ${idMagasin} introuvable dans Système Atelier.` });
    }

    const currentRow = rows[targetRowIndex - 2] || [];

    const tarif = body.tarif !== undefined ? Number(body.tarif) : Number(currentRow[4] || 35);
    const capacite = body.capacite !== undefined ? Number(body.capacite) : Number(currentRow[5] || 10);
    const theme1Titre = body.theme1Titre !== undefined ? String(body.theme1Titre) : String(currentRow[6] || '');
    const theme1Desc = body.theme1Desc !== undefined ? String(body.theme1Desc) : String(currentRow[7] || '');
    const theme1Tarif = body.theme1Tarif !== undefined ? Number(body.theme1Tarif) : Number(currentRow[8] || tarif);
    const theme2Titre = body.theme2Titre !== undefined ? String(body.theme2Titre) : String(currentRow[9] || '');
    const theme2Desc = body.theme2Desc !== undefined ? String(body.theme2Desc) : String(currentRow[10] || '');
    const theme2Tarif = body.theme2Tarif !== undefined ? Number(body.theme2Tarif) : Number(currentRow[11] || tarif);
    const theme3Titre = body.theme3Titre !== undefined ? String(body.theme3Titre) : String(currentRow[12] || '');
    const theme3Desc = body.theme3Desc !== undefined ? String(body.theme3Desc) : String(currentRow[13] || '');
    const theme3Tarif = body.theme3Tarif !== undefined ? Number(body.theme3Tarif) : Number(currentRow[14] || tarif);
    const statut = body.statut !== undefined ? String(body.statut) : String(currentRow[15] || 'Phase de Vote');
    const dateHeure = body.dateHeure !== undefined ? String(body.dateHeure) : String(currentRow[16] || '');

    // Range E{row}:Q{row} (colonnes 4 à 16)
    const updateValues = [
      [
        tarif,
        capacite,
        theme1Titre,
        theme1Desc,
        theme1Tarif,
        theme2Titre,
        theme2Desc,
        theme2Tarif,
        theme3Titre,
        theme3Desc,
        theme3Tarif,
        statut,
        dateHeure
      ]
    ];

    const updateRange = `Système Atelier!E${targetRowIndex}:Q${targetRowIndex}`;
    await updateSpreadsheetValues(updateRange, updateValues);

    return res.status(200).json({
      ok: true,
      idMagasin,
      message: `Boutique ${idMagasin} mise à jour avec succès dans Google Sheets !`,
      updated: {
        tarif,
        capacite,
        theme1Titre,
        theme2Titre,
        theme3Titre,
        statut,
        dateHeure
      }
    });

  } catch (err) {
    console.error('Erreur maj-partenaire handler :', err);
    return res.status(500).json({
      ok: false,
      error: 'Erreur interne lors de la mise à jour Google Sheet: ' + (err.message || err)
    });
  }
}
