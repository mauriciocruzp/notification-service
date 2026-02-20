# Guía Paso a Paso: Configuración de AWS MSK

Esta guía te ayudará a configurar Amazon MSK (Managed Streaming for Apache Kafka) para tu servicio de notificaciones.

## Tabla de Contenidos

1. [Crear el Cluster MSK en AWS](#1-crear-el-cluster-msk-en-aws)
2. [Configurar Seguridad del Cluster](#2-configurar-seguridad-del-cluster)
3. [Obtener los Endpoints de los Brokers](#3-obtener-los-endpoints-de-los-brokers)
4. [Configurar Autenticación](#4-configurar-autenticación)
5. [Configurar Variables de Entorno](#5-configurar-variables-de-entorno)
6. [Probar la Conexión](#6-probar-la-conexión)

---

## 1. Crear el Cluster MSK en AWS

### Paso 1.1: Acceder a la Consola de AWS MSK

1. Inicia sesión en la [Consola de AWS](https://console.aws.amazon.com/)
2. Navega a **Amazon MSK** (busca "MSK" en la barra de búsqueda)
3. Haz clic en **"Create cluster"**

### Paso 1.2: Configuración Básica

- **Cluster name**: `notification-service-msk` (o el nombre que prefieras)
- **Kafka version**: Selecciona la versión más reciente (ej. `3.5.1`)
- **Apache Kafka version**: Se selecciona automáticamente según la versión de Kafka

### Paso 1.3: Configuración de Red

- **VPC**: Selecciona la VPC donde está tu aplicación (debe ser la misma donde está tu servicio NestJS)
- **Subnets**: Selecciona al menos 2 subnets en diferentes zonas de disponibilidad (AZ)
  - Ejemplo: `subnet-xxx` (us-east-1a) y `subnet-yyy` (us-east-1b)
- **Security groups**: 
  - Crea un nuevo security group o usa uno existente
  - **IMPORTANTE**: Asegúrate de que permita tráfico en el puerto 9092 (o el puerto que uses)
- **Public access**: 
  - Si necesitas acceso público (desde fuera de AWS), debes habilitarlo aquí
  - **⚠️ REQUISITO**: Para habilitar acceso público, DEBES tener:
    1. ✅ **Autenticación habilitada** (SASL/SCRAM o IAM) - ver Paso 1.5
    2. ✅ **Encriptación en tránsito (TLS)** - ver Paso 1.5
    3. ✅ **Security groups configurados** correctamente
  - Si no cumples estos requisitos, verás el warning: *"To turn on public access, ensure that the cluster has valid security settings and configuration properties."*

### Paso 1.4: Configuración de Broker

- **Broker instance type**: 
  - Para desarrollo/pruebas: `kafka.t3.small` o `kafka.m5.large`
  - Para producción: `kafka.m5.large` o superior según tu carga
- **Number of broker nodes**: Mínimo 2 (recomendado 3 para alta disponibilidad)
- **Storage**: 
  - **Storage type**: EBS
  - **Volume size**: 20 GB mínimo (ajusta según necesidades)
  - **Provisioned throughput**: 250 MB/s (o según necesidades)

### Paso 1.5: Configuración de Seguridad

**Método de autenticación**: Selecciona uno de estos:

#### Opción A: SASL/SCRAM (Recomendado para empezar)
- Selecciona **"SASL/SCRAM authentication"**
- Crea usuarios SCRAM:
  - Usuario: `kafka-user` (o el que prefieras)
  - Contraseña: Genera una contraseña segura (guárdala, la necesitarás)

#### Opción B: IAM (Recomendado para producción)
- Selecciona **"IAM access control"**
- Requiere configuración adicional de políticas IAM (ver sección 4.2)

**Encriptación**:
- **Encryption in transit**: ✅ **OBLIGATORIO si habilitas acceso público** - Debe estar habilitado (TLS)
- **Encryption at rest**: Opcional pero recomendado

**⚠️ IMPORTANTE - Acceso Público:**
Si en el Paso 1.3 habilitaste "Public access", AWS requiere que tengas:
1. ✅ **Autenticación** configurada (SASL/SCRAM o IAM) - Debes seleccionar una de las opciones anteriores
2. ✅ **Encriptación en tránsito** habilitada - Debe estar activada
3. ✅ **Security groups** con reglas apropiadas

Si intentas habilitar acceso público sin cumplir estos requisitos, verás el warning y no podrás continuar.

### Paso 1.6: Monitoreo y Logging

- **Enhanced monitoring**: Opcional pero recomendado
- **CloudWatch Logs**: Opcional (útil para debugging)

### Paso 1.7: Revisar y Crear

1. Revisa todas las configuraciones
2. Haz clic en **"Create cluster"**
3. **Espera 15-30 minutos** mientras se crea el cluster

---

## 2. Configurar Seguridad del Cluster

### Paso 2.1: Configurar Security Group

1. Ve a **EC2** → **Security Groups**
2. Encuentra el security group asociado a tu cluster MSK
3. Edita las reglas de entrada:
   - **Type**: Custom TCP
   - **Port**: 9092 (o 9094 para TLS)
   - **Source**: El security group de tu aplicación NestJS o tu IP
   - **Description**: "Allow Kafka from notification service"

### Paso 2.2: Verificar VPC y Subnets

- Asegúrate de que tu aplicación NestJS esté en la misma VPC o tenga acceso a la VPC del MSK
- Si están en VPCs diferentes, configura VPC peering o Transit Gateway

---

## 3. Obtener los Endpoints de los Brokers

### Paso 3.1: Obtener los Endpoints desde la Consola

**⚠️ IMPORTANTE**: No uses los hostnames de la tabla "Brokers" (esos resuelven a IPs privadas 172.30.x.x). Necesitas el **Bootstrap broker string** que AWS proporciona específicamente.

1. Ve a **Amazon MSK** → Tu cluster → **Properties**.
2. **Haz scroll hacia abajo** hasta encontrar la sección **"Bootstrap broker string"** o **"Client information"** / **"Connectivity"**. También puede estar en una pestaña separada **"Client information"**.
3. Verás **múltiples listas** según el tipo de acceso y autenticación:
   - **Private** (IPs privadas, solo desde dentro de la VPC)
   - **Public** (IPs públicas, desde internet)
   - Y para cada uno, diferentes puertos según autenticación:
     - **9092**: Plaintext (no recomendado)
     - **9094**: TLS con SASL/SCRAM
     - **9096**: TLS con SASL/SCRAM (alternativo)
     - **9098**: TLS con IAM authentication ← **Este es el que necesitas si usas IAM**
4. **Desde tu PC** (desarrollo local), copia el string de **"Public"** con puerto **9098** (para IAM) o **9094** (para SASL/SCRAM).
5. Pégalo en `KAFKA_BROKERS` en tu `.env` (una sola línea, separado por comas).

**Ejemplo para IAM (puerto 9098)**:
```
KAFKA_BROKERS=b-1.public-xxx.c18.kafka.us-east-1.amazonaws.com:9098,b-2.public-xxx.c18.kafka.us-east-1.amazonaws.com:9098,b-3.public-xxx.c18.kafka.us-east-1.amazonaws.com:9098
```

**Nota**: Si los hostnames tienen "public" en el nombre o son diferentes a los de la tabla Brokers, esos son los correctos para acceso público.

### Paso 3.2: Obtener Endpoints mediante AWS CLI

```bash
aws kafka get-bootstrap-brokers --cluster-arn arn:aws:kafka:us-east-1:ACCOUNT_ID:cluster/CLUSTER_NAME/CLUSTER_ID
```

Esto devuelve un JSON con diferentes bootstrap strings. Para acceso público con IAM, busca el campo que contenga `:9098` en la respuesta. Ejemplo:

```bash
aws kafka get-bootstrap-brokers \
  --cluster-arn arn:aws:kafka:us-east-1:130007375982:cluster/notification-service-msk/aa07f17b-f63c-418a-a6d1-419a0a09f02f-18 \
  --query 'BootstrapBrokerStringPublicTls' \
  --output text
```

**Nota**: 
- Para **IAM**: usa el string con puerto **9098** (campo `BootstrapBrokerStringPublicTls` o similar).
- Para **SASL/SCRAM**: usa el string con puerto **9094** o **9096**.

---

## 4. Configurar Autenticación

**Importante:** En la consola MSK → **Security settings** verás qué está habilitado:
- Si **IAM role-based authentication: Enabled** y **SASL/SCRAM: Not enabled** → usa **Opción B (IAM)** con puerto **9098**.
- Si **SASL/SCRAM: Enabled** → usa **Opción A** con puerto **9094**.

### Opción A: SASL/SCRAM (usuario y contraseña en MSK)

#### Paso 4.1: Instalar Dependencias

Ya tienes `kafkajs` instalado, pero necesitas el paquete para SASL:

```bash
npm install kafkajs
```

#### Paso 4.2: Configurar Variables de Entorno

Agrega estas variables a tu `.env`:

```env
# Kafka SASL/SCRAM
KAFKA_BROKERS=b-1.xxx.c1.kafka.us-east-1.amazonaws.com:9094,b-2.xxx.c1.kafka.us-east-1.amazonaws.com:9094,b-3.xxx.c1.kafka.us-east-1.amazonaws.com:9094
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_SASL_USERNAME=kafka-user
KAFKA_SASL_PASSWORD=tu-contraseña-segura
KAFKA_SSL_ENABLED=true
```

**Nota**: El código ya está actualizado para usar estas variables.

### Opción B: IAM (cluster con "IAM role-based authentication: Enabled")

El proyecto usa `aws-msk-iam-sasl-signer-js` y puerto **9098**. No uses usuario/contraseña de Kafka.

#### Paso 4.1: Variables de entorno

```env
KAFKA_BROKERS=b-1.xxx.c18.kafka.us-east-1.amazonaws.com:9098,b-2.xxx.c18.kafka.us-east-1.amazonaws.com:9098,b-3.xxx.c18.kafka.us-east-1.amazonaws.com:9098
KAFKA_SSL_ENABLED=true
KAFKA_SASL_MECHANISM=aws
KAFKA_AWS_REGION=us-east-1
```

Credenciales AWS: configura `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en el entorno (o `aws configure`) para el usuario/rol que tenga permisos sobre MSK.

#### Paso 4.2: Política IAM para el cluster (en MSK)

En **MSK** → tu cluster → **Security settings** → **Edit cluster policy** (o **Configure** junto a IAM), asigna una política que permita a tu usuario/rol conectarse y consumir. Ejemplo de política para el cluster:

1. Ve a **IAM** → **Policies** → **Create policy**
2. Usa el siguiente JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:Connect",
        "kafka-cluster:AlterCluster",
        "kafka-cluster:DescribeCluster"
      ],
      "Resource": "arn:aws:kafka:*:*:cluster/*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:*Topic*",
        "kafka-cluster:WriteData",
        "kafka-cluster:ReadData"
      ],
      "Resource": "arn:aws:kafka:*:*:topic/*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:AlterGroup",
        "kafka-cluster:DescribeGroup"
      ],
      "Resource": "arn:aws:kafka:*:*:group/*/*"
    }
  ]
}
```

3. Nómbrala: `MSKFullAccess` (o el nombre que prefieras)

#### Paso 4.3: Asignar política al usuario/rol IAM

- En **IAM** → Policies → crea una política con el JSON de arriba (o usa `AmazonMSKReadOnlyAccess` / `AmazonMSKFullAccess` para pruebas).
- Asígnala al **usuario IAM** (desarrollo local) o al **rol** de la aplicación (EC2/ECS/Lambda).

#### Paso 4.4: Security group

El security group del MSK debe permitir **entrada en el puerto 9098** (TCP) desde tu IP o desde el security group de tu app.

---

## 5. Configurar Variables de Entorno

### Paso 5.1: Actualizar `.env`

Edita tu archivo `.env` con los valores obtenidos:

```env
# AWS MSK / Kafka
KAFKA_BROKERS=b-1.xxx.c1.kafka.us-east-1.amazonaws.com:9094,b-2.xxx.c1.kafka.us-east-1.amazonaws.com:9094,b-3.xxx.c1.kafka.us-east-1.amazonaws.com:9094
KAFKA_GROUP_ID=notification-service
KAFKA_TOPIC=sqyd.domain.events

# Si usas SASL/SCRAM:
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_SASL_USERNAME=kafka-user
KAFKA_SASL_PASSWORD=tu-contraseña-segura
KAFKA_SSL_ENABLED=true

# Si usas IAM:
# KAFKA_SASL_MECHANISM=aws
# KAFKA_AWS_REGION=us-east-1
# KAFKA_SSL_ENABLED=true
```

### Paso 5.2: Verificar Configuración

Asegúrate de que:
- Los brokers están separados por comas
- El puerto es correcto (9092 sin TLS, 9094/9096/9098 con TLS)
- Las credenciales son correctas

---

## 6. Probar la Conexión

### Paso 6.1: Verificar que el Topic Existe

Si el topic no existe, créalo desde AWS CLI o desde otra aplicación:

```bash
# Usando AWS CLI (requiere configuración previa)
aws kafka create-topic \
  --cluster-arn arn:aws:kafka:us-east-1:ACCOUNT:cluster/CLUSTER_NAME/CLUSTER_ID \
  --topic-name sqyd.domain.events \
  --partitions 3 \
  --replication-factor 2
```

O desde otra aplicación Kafka que ya esté conectada.

### Paso 6.2: Iniciar tu Aplicación

```bash
npm run start:dev
```

### Paso 6.3: Verificar Logs

Deberías ver en los logs:

```
[KafkaConsumerService] Kafka consumer subscribed to sqyd.domain.events
```

Si ves errores de conexión:
- Verifica los security groups
- Verifica que las credenciales sean correctas
- Verifica que el puerto sea correcto (9094 para TLS)
- Verifica que la VPC permita la comunicación

### Paso 6.4: Probar con un Mensaje de Prueba

Puedes usar `kafkajs` o `kafka-console-producer` para enviar un mensaje de prueba:

```bash
# Instalar kafka-console-producer (si no lo tienes)
# O usar una herramienta como kafkacat/kcat

# Ejemplo de mensaje JSON esperado:
{
  "eventType": "AUDIT_CREATED",
  "channelType": "IN_APP",
  "occurredAt": "2026-02-19T10:00:00Z",
  "recipients": ["123", "456"],
  "payload": {
    "summary": "Nueva auditoría creada",
    "auditId": "789"
  }
}
```

---

## Troubleshooting

### Warning: "To turn on public access, ensure that the cluster has valid security settings"

Este warning aparece cuando intentas habilitar acceso público sin cumplir los requisitos de seguridad. Para resolverlo:

1. **Habilita autenticación** (Paso 1.5):
   - Selecciona **SASL/SCRAM** o **IAM access control**
   - Crea usuarios SCRAM si eliges SASL/SCRAM

2. **Habilita encriptación en tránsito**:
   - Marca ✅ **Encryption in transit** (TLS)
   - Esto es obligatorio para acceso público

3. **Configura Security Groups**:
   - Asegúrate de tener un security group creado
   - Configura reglas de entrada para el puerto correcto (9094 para TLS, 9098 para IAM)

4. **Vuelve a intentar habilitar acceso público**:
   - Una vez cumplidos los requisitos, el warning desaparecerá
   - Podrás habilitar "Public access" sin problemas

**Nota**: Si tu aplicación está dentro de AWS (misma VPC), normalmente NO necesitas acceso público. Solo habilítalo si necesitas conectarte desde fuera de AWS (desarrollo local, CI/CD, etc.).

### Error: "Connection timeout" (desde tu PC / desarrollo local)

Si la app corre **en tu máquina** (fuera de AWS), el timeout suele deberse a que MSK no es alcanzable por red. Revisa en este orden:

1. **Acceso público del cluster**
   - En **MSK** → tu cluster → **Properties** → **Networking**.
   - Debe estar **"Public access"** en **On**.
   - Si está en Off, solo se puede conectar desde dentro de la VPC (EC2, ECS, etc.).

2. **Bootstrap broker string: usa el de acceso público**
   - En **MSK** → tu cluster → **Properties** → **Bootstrap broker string**.
   - Hay dos listas: **Private** (IPs 172.30.x.x, 10.x.x.x) y **Public**.
   - **Desde tu PC** debes usar **solo el bloque "Public"** (TLS, puerto 9094). Si usas el Private, verás `ETIMEDOUT 172.30.x.x:9094` porque esas IPs no son accesibles desde internet.
   - Copia el string **Public** con TLS (puerto 9094) y pégalo en `KAFKA_BROKERS` (una sola línea, brokers separados por coma).

3. **Security group del MSK**
   - Ve a **EC2** → **Security Groups** y localiza el que usa el cluster MSK.
   - En **Inbound rules** añade (o ajusta):
     - **Type**: Custom TCP  
     - **Port**: 9094  
     - **Source**: Tu IP (ej. `123.45.67.89/32`) o, solo para pruebas, `0.0.0.0/0`.
   - Guarda y espera unos segundos; vuelve a probar la app.

4. **Puerto en `.env`**
   - Con TLS y SASL/SCRAM debe ser **9094** en todos los brokers de `KAFKA_BROKERS`.

Si la app corre **dentro de AWS** (misma VPC que MSK), no hace falta acceso público; usa el bootstrap **Private** y que el security group del MSK permita tráfico en **9094** desde el security group de la app.

**Resumen**: Si en el error aparece `ETIMEDOUT 172.30.x.x` o `10.x.x.x`, estás usando el bootstrap **privado**. Para desarrollo en tu PC, cambia en la consola MSK al string **Public** (TLS, 9094 o 9098) y actualiza `KAFKA_BROKERS`.

**Si usas IAM (puerto 9098)**:
- Usa el bootstrap string **Public** con puerto **9098** en `KAFKA_BROKERS`.
- El security group del MSK debe permitir **entrada TCP en el puerto 9098** desde tu IP (o `0.0.0.0/0` solo para pruebas).

### Error: "SASL authentication failed"

- Verifica que `KAFKA_SASL_USERNAME` y `KAFKA_SASL_PASSWORD` sean correctos
- Verifica que `KAFKA_SASL_MECHANISM` sea `scram-sha-512` o `scram-sha-256` según tu configuración

### Error: "Topic does not exist"

- Crea el topic antes de iniciar el consumer
- Verifica que `KAFKA_TOPIC` tenga el nombre correcto

### Error: "SSL/TLS error"

- Asegúrate de que `KAFKA_SSL_ENABLED=true`
- Verifica que estés usando el puerto correcto (9094 o 9096 para TLS)

---

## Recursos Adicionales

- [Documentación oficial de AWS MSK](https://docs.aws.amazon.com/msk/)
- [Documentación de KafkaJS](https://kafka.js.org/)
- [Guía de autenticación MSK](https://docs.aws.amazon.com/msk/latest/developerguide/msk-authentication.html)

---

## Próximos Pasos

1. Configurar alertas en CloudWatch para monitorear el cluster
2. Configurar auto-scaling si es necesario
3. Configurar backups y retención de mensajes
4. Implementar dead letter queue para mensajes fallidos
5. Configurar métricas personalizadas para monitoreo
