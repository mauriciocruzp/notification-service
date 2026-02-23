/**
 * Contrato de eventos Kafka acordado con Spring (SQYD-BackEnd).
 * Topic: sqyd.domain.events (o sqyd.audit.events por dominio)
 *
 * Ejemplo de mensaje:
 * {
 *   "eventType": "AUDIT_CREATED",
 *   "channelType": "IN_APP",
 *   "occurredAt": "2025-02-17T12:00:00Z",
 *   "recipients": [789, 101],
 *   "payload": {
 *     "auditId": 123,
 *     "officeNumber": "OF-2025-001",
 *     "summary": "Nueva auditoría creada"
 *   }
 * }
 *
 * Notas:
 * - channelType: "IN_APP" o "EMAIL"
 * - recipients: array de IDs numéricos/emails, o strings cifrados como JWE compacto (se desencripta en el consumer)
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
    if (!parsed.eventType || !parsed.channelType || !parsed.recipients || !Array.isArray(parsed.recipients) || !parsed.payload) {
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
