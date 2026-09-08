const crypto = require('crypto');
const fs = require('fs');

const serviceAccountPath = '/Users/Emixam/Documents/antigravity/LanderGen/google_service_account.json';
const spreadsheetId = '1fhH67dRN6gjUNl8MVV9DCJRFsat_PYJIqgHczQRO3W4';
const sheetTitle = 'Système Atelier';

async function getAccessToken(sa) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
    const signInput = `${b64Header}.${b64Claim}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    signer.end();
    const signature = signer.sign(sa.private_key, 'base64url');
    const jwt = `${signInput}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });

    const tokenData = await res.json();
    if (!tokenData.access_token) {
        throw new Error("Token introuvable : " + JSON.stringify(tokenData));
    }
    return tokenData.access_token;
}

async function createSystemeAtelierSheet() {
    const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const token = await getAccessToken(sa);

    // 1. Vérifier si l'onglet existe déjà
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const sheetData = await getRes.json();
    const existing = sheetData.sheets?.find(s => s.properties.title === sheetTitle);

    if (!existing) {
        console.log(`Création de l'onglet "${sheetTitle}"...`);
        const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: sheetTitle,
                                gridProperties: {
                                    rowCount: 100,
                                    columnCount: 20
                                }
                            }
                        }
                    }
                ]
            })
        });
        const addResult = await addRes.json();
        console.log('Résultat création:', addResult);
    } else {
        console.log(`L'onglet "${sheetTitle}" existe déjà.`);
    }

    // 2. Définir les en-têtes et les données de pilotage de Lynda
    const headers = [
        'ID Magasin',
        'Boutique Partenaire',
        'Ville',
        'Responsable Magasin',
        'Tarif Fixé par Lynda (€)',
        'Capacité Salle',
        'Thème 1 (Titre)',
        'Thème 1 (Description)',
        'Thème 1 (Tarif €)',
        'Thème 2 (Titre)',
        'Thème 2 (Description)',
        'Thème 2 (Tarif €)',
        'Thème 3 (Titre)',
        'Thème 3 (Description)',
        'Thème 3 (Tarif €)',
        'Statut Atelier',
        'Date & Heure Retenue',
        'Places Réservées',
        'Recettes Stripe (€)',
        'Lien Privé Magasin'
    ];

    const row1 = [
        'mag-01',
        "L'Herboristerie des Alpages",
        'Annecy (74)',
        'Marion V.',
        35,
        10,
        'Libérer la charge mentale & retrouver le sommeil',
        'Techniques douces de respiration, libération des tensions nerveuses et rituels du soir.',
        35,
        'Comprendre et apaiser ses émotions par le corps',
        'Identifier les nœuds somatiques et dialoguer avec son corps.',
        35,
        'Détox énergétique & ancrage de saison',
        'Atelier pratique pour traverser les transitions saisonnières.',
        35,
        'Planifié',
        'Samedi 26 Septembre 2026 - 14h30',
        '7 / 10',
        245,
        'https://app.lynda-therapie.com/mag-01'
    ];

    const row2 = [
        'mag-02',
        "L'Atelier Harmonie & Thés",
        'Lyon (69)',
        'Alexandre M.',
        30,
        8,
        'Pleine conscience & dégustation méditative',
        'Ralentir le rythme quotidien grâce à la sensorialité des plantes.',
        30,
        'Auto-massage des tempes & stress urbain',
        'Exercices simples pour détendre la nuque et les tempes.',
        30,
        'Respiration vagale & lâcher-prise',
        'Retrouver un calme intérieur immédiat en 5 minutes par jour.',
        30,
        'Phase de Vote (9/6)',
        'En attente choix date',
        '0 / 8',
        0,
        'https://app.lynda-therapie.com/mag-02'
    ];

    const row3 = [
        'mag-03',
        'Maison Sérénité Nature',
        'Chambéry (73)',
        'Émilie B.',
        40,
        12,
        'Sommeil profond & libération des ruminations',
        'Comprendre l’impact du système nerveux sur les insomnies.',
        40,
        'Gestion de la charge mentale des mamans actives',
        'Désamorcer le sentiment de submersion sans culpabiliser.',
        40,
        'Énergie vitale & immunité automnale',
        'Pratiques holistiques d’ancrage et plantes adaptogènes.',
        40,
        'Nouveau Magasin',
        'À définir',
        '0 / 12',
        0,
        'https://app.lynda-therapie.com/mag-03'
    ];

    // 3. Injecter les données
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1:T4?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: [headers, row1, row2, row3]
        })
    });

    const updateData = await updateRes.json();
    console.log('Mise à jour des données :', updateData);
    console.log(`\n🎉 Page "${sheetTitle}" configurée et alimentée avec succès dans le Google Sheet !`);
    console.log(`🔗 URL directe : https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`);
}

createSystemeAtelierSheet().catch(console.error);
