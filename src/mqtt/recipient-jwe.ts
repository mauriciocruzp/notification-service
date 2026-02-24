import { createPrivateKey, KeyObject } from 'crypto';
import type { NotificationRecipientInput } from '../notifications/dto/notification-recipient.dto';

export type RecipientJweConfig = {
  keyB64Url?: string;
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
    'JWE key required: set MQTT_RECIPIENT_JWE_KEY_B64URL or MQTT_RECIPIENT_JWE_PRIVATE_KEY_PEM',
  );
}

export async function decryptRecipient(
  recipientJwe: string,
  config: RecipientJweConfig,
): Promise<NotificationRecipientInput> {
  const key = await buildDecryptKey(config);
  const { compactDecrypt } = await import('jose');
  const { plaintext } = await compactDecrypt(recipientJwe, key);
  return JSON.parse(new TextDecoder().decode(plaintext)) as NotificationRecipientInput;
}
