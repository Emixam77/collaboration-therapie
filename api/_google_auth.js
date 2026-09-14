import crypto from 'crypto';
import { SA_CLIENT_EMAIL, SA_KEY_IV, SA_KEY_ENC } from './_sa_creds.js';

export const SPREADSHEET_ID = '1TprsCw9JAqZjLwCYvo7c4QQ1FsLv5lVSwZLsvmcNSwQ';

function getPrivateKey() {
  const key = crypto.createHash('sha256').update('lynda-collab-sheet-secret-2026').digest();
  const iv = Buffer.from(SA_KEY_IV, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(SA_KEY_ENC, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function getGoogleAccessToken() {
  const privateKey = getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: SA_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${b64Header}.${b64Claim}`);
  signer.end();
  const jwt = `${b64Header}.${b64Claim}.${signer.sign(privateKey, 'base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Échec obtention token Google : " + JSON.stringify(data));
  }
  return data.access_token;
}

export async function appendSpreadsheetValues(range, values) {
  const token = await getGoogleAccessToken();
  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur append Google Sheets (${res.status}): ${errText}`);
  }

  return await res.json();
}

export async function updateSpreadsheetValues(range, values) {
  const token = await getGoogleAccessToken();
  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: range,
      majorDimension: 'ROWS',
      values: values
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur update Google Sheets (${res.status}): ${errText}`);
  }

  return await res.json();
}
