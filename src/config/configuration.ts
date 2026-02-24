export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/notifications',
  },
  mqtt: {
    /** URL del broker: local mqtt://localhost:1883 | Amazon MQ mqtts://b-xxx.mq.region.amazonaws.com:8883 o wss://...:61619 */
    url: process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883',
    /** Topic al que suscribirse (ej. sqyd/domain/events) */
    topic: process.env.MQTT_TOPIC ?? 'sqyd/domain/events',
    /** ClientId único para este suscriptor (Amazon MQ requiere clientId único) */
    clientId: process.env.MQTT_CLIENT_ID ?? 'notification-service',
    /** Usuario/contraseña para Amazon MQ (opcional en local) */
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    /** Clave JWE para desencriptar recipients (obligatorio si MQTT está activo) */
    recipientJweKeyB64Url: process.env.MQTT_RECIPIENT_JWE_KEY_B64URL,
    recipientJwePrivateKeyPem: process.env.MQTT_RECIPIENT_JWE_PRIVATE_KEY_PEM,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    jwksUri: process.env.JWKS_URI,
  },
  frontend: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  },
  throttler: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
