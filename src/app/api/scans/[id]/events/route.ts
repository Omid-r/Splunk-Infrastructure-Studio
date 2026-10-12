import { getDb } from '@/server/db';
import { eventsAfter } from '@/server/core/jobs';
import { getScan } from '@/server/services/scans';
import { requireAuth } from '@/server/http';

export const dynamic = 'force-dynamic';

function isTerminal(status: string): boolean {
  return ['success', 'warning', 'failed', 'cancelled'].includes(status);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const job = getScan(id);
  if (!job) {
    return new Response('not found', { status: 404 });
  }

  let lastId: string | null = new URL(req.url).searchParams.get('last') ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      send('snapshot', { scan: getScan(id) });
      let ticks = 0;
      while (true) {
        const current = getScan(id);
        if (!current) break;
        const events = eventsAfter(id, lastId);
        for (const ev of events) {
          lastId = ev.id;
          send('event', ev);
        }
        send('snapshot', { scan: current });
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
      void getDb();
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
