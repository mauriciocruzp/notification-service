# Notification Service (NestJS + AWS MSK)

Microservicio de notificaciones que consume eventos desde el backend Spring vía **AWS MSK (Kafka)** y entrega notificaciones in-app al frontend React mediante **REST** y **WebSocket**.

## Arquitectura

```
[React] ←→ REST + WebSocket ←→ [NestJS Notifications] ← consume ← [AWS MSK]
                                      ↓
                              [PostgreSQL]
[Spring Boot] → produce eventos → [AWS MSK]
```

- **Spring Boot**: publica eventos de dominio (ej. auditoría creada/actualizada) en un topic Kafka con `channelType` y `recipients`.
- **NestJS**: consume el topic, crea una notificación compartida y N filas en `notification_recipients` (una por cada recipient), y emite en tiempo real por WebSocket solo para `channelType: "IN_APP"`.
- **React**: usa REST para listar/marcar leídas (filtrando por `recipient` del JWT) y WebSocket para recibir `new_notification`.

## Requisitos

- Node.js 18+
- PostgreSQL
- Kafka (local o AWS MSK)

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (default: 3000) |
| `DATABASE_URL` | URL de conexión PostgreSQL |
| `KAFKA_BROKERS` | Brokers Kafka separados por coma (ej. `localhost:9092` o `b-1.xxx.kafka.amazonaws.com:9092`) |
| `KAFKA_GROUP_ID` | Consumer group (default: `notification-service`) |
| `KAFKA_TOPIC` | Topic a consumir (default: `sqyd.domain.events`) |
| `JWT_SECRET` | Misma clave que Spring Boot para validar JWT |
| `FRONTEND_ORIGIN` | Origen(es) permitidos en CORS (separados por coma) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limiting (segundos y peticiones por ventana) |

Si `KAFKA_BROKERS` no está definido, el consumer no se inicia (útil para desarrollo sin Kafka).

**Inicio de sesión AWS (IAM)** para MSK: el consumer usa solo IAM. Opciones:
- **Variables de entorno**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (y opcionalmente `AWS_SESSION_TOKEN`).
- **Perfil**: `AWS_PROFILE=nombre-perfil` (credenciales en `~/.aws/credentials`, p. ej. tras `aws configure`).
- **En EC2/ECS/Lambda**: no hace falta configurar nada; se usa el rol IAM de la instancia o tarea.

## Kafka local (Docker Compose)

Para levantar Apache Kafka en el mismo proyecto (desarrollo local):

```bash
docker compose up -d
```

Esto inicia **Zookeeper** (puerto 2181) y **Kafka** (puerto 9092) y crea el topic `sqyd.domain.events` si no existe. En tu `.env` usa:

- `KAFKA_BROKERS=localhost:9092`
- `KAFKA_SSL_ENABLED=false` (sin SASL en local)

Luego arranca el servicio NestJS con `npm run start:dev`. Para bajar los contenedores: `docker compose down`.

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

## Contrato de eventos Kafka (con Spring)

Topic sugerido: **`sqyd.domain.events`**.

Mensaje JSON de ejemplo:

```json
{
  "eventType": "AUDIT_CREATED",
  "channelType": "IN_APP",
  "occurredAt": "2025-02-17T12:00:00Z",
  "recipients": [789, 101],
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
- `recipients`: array de IDs numéricos (si `channelType` es `"IN_APP"`) o emails como strings (si es `"EMAIL"`).
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
