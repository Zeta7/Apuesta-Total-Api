import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

export async function requestIdHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const incoming = request.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
  request.id = requestId;
  void reply.header('x-request-id', requestId);
  await Promise.resolve();
}
