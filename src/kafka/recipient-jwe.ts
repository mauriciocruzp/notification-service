import { createPrivateKey, KeyObject } from 'crypto';

export type RecipientJweConfig = {
  /**
   * Clave simétrica en base64url (recomendado 32 bytes para A256GCM con alg=dir).
   */
  keyB64Url?: string;
  /**
   * Private key PEM para JWE con RSA/ECDH, etc.
   */
  privateKeyPem?: string;
};

async function buildDecryptKey(config: RecipientJweConfig): Promise<Uint8Array | KeyObject> {
  if (config.privateKeyPem?.trim()) {
    return createPrivateKey(config.privateKeyPem);
  }
  if (config.keyB64Url?.trim()) {
    const { base64url } = await import('jose');
    return base64url.decode(config.keyB64Url.trim());
  }
  throw new Error(
    'JWE key required: set KAFKA_RECIPIENT_JWE_KEY_B64URL or KAFKA_RECIPIENT_JWE_PRIVATE_KEY_PEM',
  );
}

/**
 * Desencripta un recipient que siempre viene como JWE compacto.
 * Lanza si no hay clave configurada o si el JWE es inválido.
 */
export async function decryptRecipient(
  recipientJwe: string,
  config: RecipientJweConfig,
): Promise<string> {
  const key = await buildDecryptKey(config);
  const { compactDecrypt } = await import('jose');
  const { plaintext } = await compactDecrypt(recipientJwe, key);
  return new TextDecoder().decode(plaintext);
}

