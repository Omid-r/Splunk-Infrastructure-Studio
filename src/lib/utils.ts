export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function faNum(value: number | string): string {
  return Number(value).toLocaleString('fa-IR');
}

export function faDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'همین حالا';
  if (min < 60) return `${faNum(min)} دقیقه پیش`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${faNum(d)} روز پیش`;
}

export function bytesToGb(mb: number | null | undefined): string {
  if (mb === null || mb === undefined) return 'نامشخص';
  if (mb >= 1024) return `${faNum(Math.round((mb / 1024) * 10) / 10)} گیگابایت`;
  return `${faNum(Math.round(mb))} مگابایت`;
}

export function uptimeText(sec: number | null | undefined): string {
  if (!sec) return 'نامشخص';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${faNum(d)} روز و ${faNum(h)} ساعت`;
  return `${faNum(h)} ساعت`;
}
