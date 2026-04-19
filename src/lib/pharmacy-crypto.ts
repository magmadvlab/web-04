/**
 * pharmacy-crypto.ts
 *
 * Decifratura client-side degli ordini farmacia via Web Crypto API.
 * La chiave privata NON transita mai sulla rete — rimane solo nel browser.
 *
 * Algoritmo: RSA-OAEP + AES-256-GCM
 * Mirror client-side di api-farmacia/src/core/encryption/prescription-crypto.service.ts
 *
 * Flusso:
 *  1. importPrivateKey(pem)                   → CryptoKey RSA (non estraibile)
 *  2. decryptEnvelope(envelope, cryptoKey)    → SensitiveOrderData (JSON)
 *
 * Differenza Node.js ↔ Web Crypto API:
 *  - Node: encryptedData (hex) e authTag (hex) sono separati
 *  - Web Crypto: vuole ciphertext || authTag concatenati in un unico buffer
 */

// ─── Tipi condivisi col backend ────────────────────────────────────────────

export interface EncryptedEnvelope {
  /** Ciphertext AES-256-GCM (hex) — SENZA auth tag */
  encryptedData: string;
  /** Chiave AES cifrata con la chiave pubblica RSA della farmacia (base64) */
  encryptedAesKey: string;
  /** IV AES-GCM 12 byte (hex) */
  iv: string;
  /** GCM authentication tag 16 byte (hex) */
  authTag: string;
  /** SHA-256 della chiave pubblica usata per la cifratura */
  farmaciaKeyFingerprint: string;
  /** 'RSA-OAEP+AES-256-GCM' */
  algoritmo: string;
  /** Versione schema — per retrocompatibilità */
  versione: number;
}

export interface SensitiveOrderData {
  pazienteNome: string;
  pazienteCognome: string;
  pazienteTelefono?: string;
  pazienteCodiceFiscale?: string;
  farmaci: Array<{
    farmacoId?: number;
    nomeCommerciale: string;
    principioAttivo?: string;
    quantita: number;
    posologia?: string;
  }>;
  farmaciDaBanco?: Array<{
    farmacoId?: number;
    nomeCommerciale: string;
    quantita: number;
  }>;
  numeroRicetta?: string;
  codiceNre?: string;
  noteMedico?: string;
  /** URL foto talloncino OTC — mai visibile al delivery */
  fotoTalloncinoUrl?: string;
}

// ─── Helper di conversione ─────────────────────────────────────────────────

/**
 * Converte una chiave privata PKCS#8 in formato PEM in ArrayBuffer per Web Crypto.
 * Gestisce sia "-----BEGIN PRIVATE KEY-----" (PKCS#8) che
 * "-----BEGIN RSA PRIVATE KEY-----" (PKCS#1, meno comune).
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

/** Converte stringa hex (es. "a3f2...") in Uint8Array<ArrayBuffer> */
function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2)
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

/** Converte stringa base64 in ArrayBuffer */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// ─── API pubblica ──────────────────────────────────────────────────────────

/**
 * Importa la chiave privata RSA dal formato PEM (PKCS#8) tramite Web Crypto API.
 *
 * La chiave viene marcata come NON estraibile (extractable: false):
 * una volta importata, il browser non la esporrà più in nessuna forma.
 *
 * @throws Se il PEM non è valido o il formato non è PKCS#8
 */
export async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(privateKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false, // non estraibile — massima sicurezza
      ['decrypt'],
    );
  } catch {
    throw new Error(
      'Chiave privata non valida o formato non supportato. ' +
        'Verificare che sia in formato PKCS#8 PEM (-----BEGIN PRIVATE KEY-----).',
    );
  }
}

/**
 * Decifra un envelope RSA-OAEP+AES-256-GCM interamente nel browser.
 *
 * Passaggi:
 *  1. Decifra la chiave AES con RSA-OAEP (chiave privata farmacia)
 *  2. Importa la chiave AES grezza come CryptoKey
 *  3. Concatena ciphertext + authTag (Web Crypto vuole i due blocchi uniti)
 *  4. Decifra con AES-256-GCM (verifica l'integrità tramite authTag)
 *  5. Restituisce il JSON dei dati sensibili tipizzato come SensitiveOrderData
 *
 * @param envelope - L'envelope cifrato restituito dall'API
 * @param privateKey - La CryptoKey RSA importata con importPrivateKey()
 * @throws Se la chiave non corrisponde o i dati sono corrotti
 */
export async function decryptEnvelope(
  envelope: EncryptedEnvelope,
  privateKey: CryptoKey,
): Promise<SensitiveOrderData> {
  // Step 1 — Decifra la chiave AES con RSA-OAEP
  const aesKeyBytes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToArrayBuffer(envelope.encryptedAesKey),
  );

  // Step 2 — Importa la chiave AES grezza
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  // Step 3 — Web Crypto AES-GCM vuole: ciphertext || authTag concatenati in un buffer
  //          Node.js li tiene separati; dobbiamo riunirli qui
  const ciphertext = hexToUint8Array(envelope.encryptedData);
  const authTag = hexToUint8Array(envelope.authTag);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  // Step 4 — Decifra e verifica integrità con AES-256-GCM
  const plainBuf = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: hexToUint8Array(envelope.iv),
      tagLength: 128, // 16 byte
    },
    aesKey,
    combined,
  );

  // Step 5 — Decodifica e parsa il JSON
  return JSON.parse(new TextDecoder().decode(plainBuf)) as SensitiveOrderData;
}

/**
 * Legge il contenuto testuale di un file .pem selezionato dall'utente.
 * Usato con <input type="file"> per caricare la chiave privata localmente.
 */
export function readPemFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.readAsText(file);
  });
}
