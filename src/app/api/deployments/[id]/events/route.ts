import { eventsAfter } from '@/server/core/jobs';
import { getDeployment } from '@/server/services/deployments';
import { requireAuth } from '@/server/http';

export const dynamic = 'force-dynamic';

function isTerminal(status: string): boolean {
  return ['success', 'warning', 'failed', 'cancelled'].includes(status);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  if (!getDeployment(id)) return new Response('not found', { status: 404 });

  let lastId: string | null = new URL(req.url).searchParams.get('last') ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      send('snapshot', { deployment: getDeployment(id) });
      let ticks = 0;
      while (true) {
        const current = getDeployment(id);
        if (!current) break;
        for (const ev of eventsAfter(id, lastId)) {
          lastId = ev.id;
          send('event', ev);
        }
        send('snapshot', { deployment: current });
        if (isTerminal(current.status)) {
          send('done', { status: current.status });
          break;
        }
        if (ticks > 3600) break;
        await new Promise((r) => setTimeout(r, 700));
        ticks++;
      }
      controller.close();
    },
    cancel() {
      /* client disconnected */
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
