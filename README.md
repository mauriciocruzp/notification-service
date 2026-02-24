# Notification Service (NestJS + MQTT)

Microservicio de notificaciones que consume eventos desde el backend Spring vía **MQTT** (local con Mosquitto o **Amazon MQ**) y entrega notificaciones in-app al frontend React mediante **REST** y **WebSocket**.

## Arquitectura

```
[React] ←→ REST + WebSocket ←→ [NestJS Notifications] ← consume ← [MQTT broker]
                                      ↓
                              [PostgreSQL]
[Spring Boot] → publica eventos → [MQTT broker]
```

- **Spring Boot**: publica eventos de dominio en un topic MQTT (ej. `sqyd/domain/events`) con `channelType` y `recipients` (JWE).
- **NestJS**: se suscribe al topic, desencripta recipients, crea una notificación y N filas en `notification_recipients`, y emite por WebSocket para `channelType: "IN_APP"`.
- **React**: REST para listar/marcar leídas y WebSocket para `new_notification`.

## Requisitos

- Node.js 18+
- PostgreSQL
- Broker MQTT (local: Mosquitto | producción: Amazon MQ)

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (default: 3000) |
| `DATABASE_URL` | URL de conexión PostgreSQL |
| `MQTT_BROKER_URL` | URL del broker (local: `mqtt://localhost:1883` \| Amazon MQ: `mqtts://b-xxx.mq.region.amazonaws.com:8883` o `wss://...:61619`) |
| `MQTT_TOPIC` | Topic a suscribirse (default: `sqyd/domain/events`) |
| `MQTT_CLIENT_ID` | ClientId único (default: `notification-service`) |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | Usuario/contraseña para Amazon MQ (opcional en local) |
| `MQTT_RECIPIENT_JWE_KEY_B64URL` o `MQTT_RECIPIENT_JWE_PRIVATE_KEY_PEM` | Clave para desencriptar recipients (obligatorio si MQTT está activo) |
| `JWT_SECRET` | Misma clave que Spring Boot para validar JWT |
| `FRONTEND_ORIGIN` | Origen(es) permitidos en CORS |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limiting |

Si `MQTT_BROKER_URL` no está definido, el consumer MQTT no se inicia.

**Amazon MQ**: usar TLS (`mqtts://` puerto 8883 o `wss://` puerto 61619) y configurar `MQTT_USERNAME` y `MQTT_PASSWORD` con el usuario del broker.

### Estructura de las claves JWE (recipients)

Configura **una** de las dos; la misma clave (o par) debe usarse en Spring para cifrar los `recipients` y aquí para descifrarlos.

| Variable | Estructura | Uso |
|----------|------------|-----|
| **`MQTT_RECIPIENT_JWE_KEY_B64URL`** | Clave simétrica en **Base64url** (sin `+`, `/` ni `=`). Para A256GCM: **32 bytes** (256 bits). | Spring cifra con clave compartida; este servicio decodifica y usa con `jose` para `compactDecrypt`. |
| **`MQTT_RECIPIENT_JWE_PRIVATE_KEY_PEM`** | Clave privada en **PEM** (PKCS#8): `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----`. RSA o EC. | Spring cifra con la pública; aquí se usa la privada para descifrar. |

**Ejemplos**

- **Clave simétrica (Base64url)**  
  Generar: `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`  
  Ejemplo (solo desarrollo): `K7gNU3sdo-OL0wNh8oWhWhTUF0uZyOOQvStFzMcLry0`

- **Clave privada (PEM)**  
  Ejemplo de formato (en `.env` puedes usar `\n` para saltos de línea):
  ```
  -----BEGIN PRIVATE KEY-----
  MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
  -----END PRIVATE KEY-----
  ```
  En una línea: `MQTT_RECIPIENT_JWE_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"`

## MQTT local (Docker Compose)

Para levantar un broker MQTT (Eclipse Mosquitto) en desarrollo:

```bash
docker compose up -d
```

MQTT queda en **localhost:1883**. En `.env`:

- `MQTT_BROKER_URL=mqtt://localhost:1883`
- `MQTT_TOPIC=sqyd/domain/events`

Arranca NestJS con `npm run start:dev`. Para bajar contenedores: `docker compose down`.

## Base de datos

Crear la base y ejecutar migraciones:

```bash
npm run build
npx typeorm migration:run -d dist/database/data-source.js
```

O con `ts-node` sin compilar:

```bash
npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/database/data-source.ts
```

## Ejecución

```bash
npm install
npm run start:dev
```

- **REST**: `http://localhost:3000`
- **Swagger**: `http://localhost:3000/api/docs`
- **WebSocket**: `ws://localhost:3000/ws` (token en `auth.token`, `query.token` o header `Authorization: Bearer <token>`)

## Contrato de eventos MQTT (con Spring)

Topic sugerido: **`sqyd/domain/events`**. Payload del mensaje MQTT (cuerpo del mensaje en JSON):

```json
{
  "eventType": "AUDIT_CREATED",
  "channelType": "IN_APP",
  "occurredAt": "2025-02-17T12:00:00Z",
  "recipients": ["<JWE>", "<JWE>"],
  "payload": {
    "auditId": 123,
    "officeNumber": "OF-2025-001",
    "summary": "Nueva auditoría creada"
  }
}
```

- `eventType`: tipo (AUDIT_CREATED, AUDIT_UPDATED, AUDIT_STATUS_CHANGED, etc.).
- `channelType`: `"IN_APP"` o `"EMAIL"`.
- `occurredAt`: ISO 8601 timestamp del evento.
- `recipients`: array de strings **JWE compacto** (siempre cifrados; se desencriptan con la clave configurada).
- `payload.summary`: texto opcional para título/cuerpo de la notificación.

**Flujo de creación**:
1. Se crea **una fila** en `notifications` con los datos compartidos (type, channel_type, title, body, payload, occurred_at).
2. Se crean **N filas** en `notification_recipients`, una por cada valor en `recipients`.
3. Si `channelType === "IN_APP"`, se emite `new_notification` por WebSocket a los recipients conectados.

## API REST

- `GET /notifications` — Listado paginado (query: `page`, `limit`, `unreadOnly`). Requiere `Authorization: Bearer <JWT>`.
  - Filtra `notification_recipients` por `recipient` (extraído del JWT como string) y hace JOIN con `notifications` donde `channel_type = 'IN_APP'`.
  - Respuesta: array de objetos con `notification` (id, type, channelType, title, body, payload, occurredAt) y `recipient` (id, recipient, readAt).
- `PATCH /notifications/:notificationId/read` — Marcar una como leída para el usuario autenticado.
  - Actualiza `notification_recipients.read_at` donde `notification_id = :notificationId` y `recipient = <credentialId del JWT como string>`.
- `PATCH /notifications/read-all` — Marcar todas como leídas para el usuario autenticado.
  - UPDATE `notification_recipients` SET `read_at = now()` WHERE `recipient = <credentialId como string>` AND `read_at IS NULL` AND `notification_id IN (SELECT id FROM notifications WHERE channel_type = 'IN_APP')`.

El JWT debe contener el identificador del usuario (ej. `credentialId` o `sub` numérico) que se convierte a string para buscar en `notification_recipients.recipient`.

## WebSocket

- Path: `/ws`.
- Autenticación: enviar el mismo JWT en el handshake (`auth: { token: '...' }`, `query.token` o header `Authorization`).
- Al conectar, se extrae `credentialId` del JWT y se asocia el socket al `recipient` (como string).
- Evento recibido: `new_notification` con:
  ```json
  {
    "notification": {
      "id": "...",
      "type": "AUDIT_CREATED",
      "channelType": "IN_APP",
      "title": "...",
      "body": "...",
      "payload": {...},
      "occurredAt": "...",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "recipient": {
      "id": "...",
      "recipient": "789",
      "readAt": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```
- Solo se emiten notificaciones donde `channelType === "IN_APP"` y el `recipient` coincide con el usuario conectado.

## Docker (opcional)

Ejemplo de `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

Para varias instancias NestJS detrás de un balanceador, usar **Redis adapter** en el gateway WebSocket para que el evento `new_notification` llegue al socket correcto en cualquier instancia.
