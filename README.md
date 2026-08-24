# API Mundial 2026

Es un monolito modular NestJS/Fastify con separación hexagonal pragmática y procesos secundarios en un worker independiente.

## Decisión tecnológica

Node.js + TypeScript, PostgresSQL, Redis, AWS

## Inicio rápido

Requisitos: Docker Desktop con Compose.

```bash
cp .env.example .env
docker compose up --build
```

Servicios: `api` (3000), `worker`, `postgres` (5432), `redis` (6379) y LocalStack/SQS (4566). Swagger queda en `http://localhost:3000/docs`.

Usuario seed: `demo@apuestatotal.test` / `Demo12345!`, balance inicial `PEN 200.00`. Solo es para desarrollo.

## Comandos

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:seed
pnpm dev
pnpm lint
pnpm build
pnpm test
pnpm swagger:generate
```

Las variables y valores documentados están en `.env.example`. Cambie siempre `JWT_SECRET` fuera de desarrollo.

## Arquitectura

Los módulos principales son `auth`, `balance`, `events`, `betslip`, `notifications` y `outbox`; el esquema soporta además usuarios, apuestas, auditoría y movimientos. Las reglas financieras (`Money`, `Odds`, `BetslipCalculator`) no dependen de NestJS, Prisma, Redis ni HTTP. 

PostgreSQL es la autoridad financiera. `place` revalida selecciones y cuotas, ejecuta un débito condicional atómico y persiste apuesta, snapshots, movimiento y outbox en una sola transacción. Redis se limita a caché y rate limiting; una caída de SQS no revierte apuestas confirmadas porque el outbox conserva el trabajo pendiente.

La idempotencia se garantiza con `userId + Idempotency-Key` y un hash canónico del payload. Una repetición idéntica devuelve la apuesta; una llave reutilizada con otro payload produce `IDEMPOTENCY_CONFLICT`.

El worker reclama outbox con `FOR UPDATE SKIP LOCKED`, recupera elementos atascados y publica un sobre con `id = outboxEvent.id` en Amazon SQS. Consume con long polling y procesamiento *at-least-once*; auditoría y notificaciones son idempotentes mediante claves únicas. Las colas `audit-events` y `notifications` tienen sus respectivas DLQ y trasladan mensajes fallidos después de cinco recepciones.

En local, LocalStack crea automáticamente las cuatro colas al iniciar Compose. En AWS real, elimine `AWS_SQS_ENDPOINT`, use URLs reales en `SQS_AUDIT_QUEUE_URL` y `SQS_NOTIFICATION_QUEUE_URL`, y asigne al rol IAM del worker únicamente `sqs:SendMessage`, `sqs:ReceiveMessage`, `sqs:DeleteMessage` y `sqs:GetQueueAttributes` sobre esas colas. El SDK usa la cadena estándar de credenciales de AWS, por lo que no deben almacenarse llaves en producción.

## API

- `POST /auth/login`
- `GET /balance` (JWT)
- `GET /events?from=<ISO>&to=<ISO>&phase=&group=&status=&page=&limit=`
- `GET /events/:eventId`
- `POST /betslip/calculate`
- `POST /betslip/place` (JWT + `Idempotency-Key`)
- `GET /notifications` (JWT)
- `PATCH /notifications/:id/read` (JWT)

Los montos y cuotas se serializan como strings. Los errores incluyen `statusCode`, `code`, `message`, `timestamp`, `path` y `requestId`.

## Postman

Importe `postman/API-Mundial-2026.postman_collection.json` y después `postman/API-Mundial-2026.postman_environment.json`. Seleccione el ambiente **API Mundial 2026 - Local** y ejecute las carpetas en orden. Los tests guardan automáticamente el JWT, un evento, una selección y una notificación en variables del ambiente.


## Pruebas y operación

La caché de eventos tiene TTL configurable e ignora fallos de Redis consultando PostgreSQL. Debe invalidarse tras cualquier actualización/importación de eventos, mercados o selecciones.

