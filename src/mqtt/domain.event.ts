/**
 * Contrato de eventos de dominio (Spring → MQTT topic).
 * Topic: sqyd/domain/events (o el configurado en MQTT_TOPIC).
 *
 * Ejemplo de mensaje:
 * {
 *   "eventType": "AUDIT_CREATED",
 *   "channelType": "IN_APP",
 *   "occurredAt": "2025-02-17T12:00:00Z",
 *   "recipients": ["<JWE>", "<JWE>"],
 *   "payload": {
 *     "auditId": 123,
 *     "officeNumber": "OF-2025-001",
 *     "summary": "Nueva auditoría creada"
 *   }
 * }
 *
 * - channelType: "IN_APP" o "EMAIL"
 * - recipients: array de strings JWE compacto (siempre cifrados)
 */
export interface DomainEventPayload {
  auditId?: number;
  officeNumber?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface DomainEvent {
  eventType: string;
  channelType: 'IN_APP' | 'EMAIL';
  occurredAt: string;
  recipients: (number | string)[];
  payload: DomainEventPayload;
}

export function parseDomainEvent(raw: string): DomainEvent | null {
  try {
    const parsed = JSON.parse(raw) as DomainEvent;
    if (
      !parsed.eventType ||
      !parsed.channelType ||
      !parsed.recipients ||
      !Array.isArray(parsed.recipients) ||
      !parsed.payload
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildNotificationTitle(eventType: string, summary?: string): string {
  const titles: Record<string, string> = {
    AUDIT_CREATED: 'Nueva auditoría',
    AUDIT_UPDATED: 'Auditoría actualizada',
    AUDIT_STATUS_CHANGED: 'Cambio de estado en auditoría',
  };
  return summary ?? titles[eventType] ?? eventType;
}
