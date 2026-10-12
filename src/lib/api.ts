import type { ApiError } from '@/lib/types';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    const message = err?.message ?? `خطای ${res.status}`;
    const e = new Error(message) as Error & { code?: string; status?: number };
    e.code = err?.code;
    e.status = res.status;
    throw e;
  }
  return data as T;
}

export function subscribeEvents(url: string, handlers: {
  snapshot?: (data: never) => void;
  event?: (data: never) => void;
  done?: (data: never) => void;
  onError?: () => void;
}): () => void {
  const source = new EventSource(url);
  (Object.keys(handlers) as (keyof typeof handlers)[]).forEach((key) => {
    if (key === 'onError') return;
    source.addEventListener(key, (e) => {
      const fn = handlers[key] as ((data: never) => void) | undefined;
      if (fn) {
        try {
          fn(JSON.parse((e as MessageEvent).data));
        } catch {
          /* ignore parse errors */
        }
      }
    });
  });
  source.onerror = () => handlers.onError?.();
  return () => source.close();
}
