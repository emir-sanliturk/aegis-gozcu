import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
    });
  });

  app.get('/readyz', async (_request, reply) => {
    const ready =
      process.env.NODE_ENV === 'production' ||
      process.env.AEGIS_READY === 'true';

    if (!ready) {
      return reply.code(503).send({
        status: 'not_ready',
      });
    }

    return reply.code(200).send({
      status: 'ready',
    });
  });
}
