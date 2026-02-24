export interface DomainEvent {
  eventType: string;
  channelType: string;
  occurredAt: string;
  recipient: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export function parseDomainEvent(raw: string): DomainEvent | null {
  try {
    const parsed = JSON.parse(raw) as DomainEvent;
    if (
      !parsed.eventType ||
      !parsed.channelType ||
      !parsed.recipient ||
      typeof parsed.recipient !== 'string' ||
      !parsed.title ||
      !parsed.body ||
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
