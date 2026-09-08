const crypto = require('crypto');
const fs = require('fs');

const serviceAccountPath = '/Users/Emixam/Documents/antigravity/LanderGen/google_service_account.json';
const spreadsheetId = '1fhH67dRN6gjUNl8MVV9DCJRFsat_PYJIqgHczQRO3W4';
const newSheetTitle = 'Retours Formulaires & Thèmes';

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

async function createFormResponsesSheet() {
    const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const token = await getAccessToken(sa);

    // 1. Vérifier si l'onglet existe
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const sheetData = await getRes.json();
    const existing = sheetData.sheets?.find(s => s.properties.title === newSheetTitle);

    if (!existing) {
        console.log(`Création de l'onglet "${newSheetTitle}"...`);
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
                                title: newSheetTitle,
                                gridProperties: {
                                    rowCount: 500,
                                    columnCount: 16
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
        console.log(`L'onglet "${newSheetTitle}" existe déjà.`);
    }

    // 2. En-têtes pour la collecte des formulaires clients & système de notation
    const headers = [
        'Horodatage',
        'Boutique Partenaire',
        'Nom & Prénom',
        'Email',
        'Mobile',
        'Type de Formulaire',
        'Thème Choisi',
        'Note d\'Intérêt Thème (1 à 5 ⭐)',
        'Degré Priorité Accompagnement',
        'Question Personnelle pour Lynda',
        'Situation Actuelle (Point A)',
        'Destination Idéale (Point B)',
        'Obstacles Identifiés',
        'Essais Passés Échoués',
        'Score Traction Thème',
        'Statut Relance Lynda'
    ];

    // Ligne exemple 1 : Un vote client avec notation 5 étoiles
    const rowVote = [
        '08/09/2026 15:42',
        "L'Herboristerie des Alpages",
        'Camille Roussel',
        'camille.r@gmail.com',
        '06 11 22 33 44',
        'Vote Thème Boutique',
        'Libérer la charge mentale & retrouver le sommeil',
        '5 / 5 ⭐⭐⭐⭐⭐',
        'Important',
        'Faites-vous des exercices de respiration guidée ?',
        '-',
        '-',
        '-',
        '-',
        'Note 5/5 (+1 traction)',
        'À inviter à l\'atelier'
    ];

    // Ligne exemple 2 : Un Bilan d'Éveil complet qualifié vers accompagnement
    const rowAudit = [
        '08/09/2026 17:15',
        "L'Herboristerie des Alpages",
        'Sophie Bernard',
        'sophie.bernard@example.com',
        '06 12 34 56 78',
        'Bilan d\'Éveil (Audit)',
        'Libérer la charge mentale & retrouver le sommeil',
        '5 / 5 ⭐⭐⭐⭐⭐',
        'Urgent et vital',
        'Est-il vraiment possible de réapprendre à dormir sans somnifères ?',
        'Nuits hachées, réveil 3h du matin, trapèzes noués et cerveau en boucle.',
        'Retrouver un sommeil réparateur d\'une traite et de l\'énergie le soir.',
        'Manque de méthode pérenne et sensation d\'être seule.',
        'Magnésium et somnifères prescrits qui assomment sans régler la cause.',
        'Prospect Chaud (Accompagnement)',
        'Appel 15 min à planifier'
    ];

    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(newSheetTitle)}!A1:P3?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: [headers, rowVote, rowAudit]
        })
    });

    const updateData = await updateRes.json();
    console.log('Mise à jour :', updateData);
    console.log(`\n🎉 Page "${newSheetTitle}" créée avec succès !`);
    console.log(`🔗 URL directe : https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`);
}

createFormResponsesSheet().catch(console.error);
