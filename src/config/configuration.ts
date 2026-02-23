export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/notifications',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter((b) => b.length > 0),
    groupId: process.env.KAFKA_GROUP_ID ?? 'notification-service',
    topic: process.env.KAFKA_TOPIC ?? 'sqyd.domain.events',
    ssl: process.env.KAFKA_SSL_ENABLED === 'true',
    // IAM: solo region; SASL/SCRAM: mechanism + username + password
    authMode: process.env.KAFKA_SASL_MECHANISM === 'aws' ? 'iam' : (process.env.KAFKA_SASL_USERNAME ? 'sasl' : undefined),
    awsRegion: process.env.KAFKA_AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
    sasl:
      process.env.KAFKA_SASL_MECHANISM === 'aws'
        ? { mechanism: 'aws' as const, awsRegion: process.env.KAFKA_AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1' }
        : process.env.KAFKA_SASL_MECHANISM && process.env.KAFKA_SASL_USERNAME
          ? {
              mechanism: process.env.KAFKA_SASL_MECHANISM as 'plain' | 'scram-sha-256' | 'scram-sha-512',
              username: process.env.KAFKA_SASL_USERNAME,
              password: process.env.KAFKA_SASL_PASSWORD,
            }
          : undefined,
    recipientJweKeyB64Url: process.env.KAFKA_RECIPIENT_JWE_KEY_B64URL,
    recipientJwePrivateKeyPem: process.env.KAFKA_RECIPIENT_JWE_PRIVATE_KEY_PEM,
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
