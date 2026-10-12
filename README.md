# Splunk Infrastructure Studio

پلتفرم فارسی (RTL) برای کشف کنترل‌شده شبکه، طراحی معماری Splunk و استقرار گام‌به‌گام — با اصل صداقت: هر دکمه یا کار واقعی انجام می‌دهد یا صریحاً غیرفعال/Coming later است.

## پیش‌نیاز

- **Node.js 22 LTS** (یا جدیدتر) — شامل `node:sqlite` داخلی است؛ نیازی به Docker/Postgres/Python نیست.
- در نصب Node تیک **Add to PATH** را بزنید.

## راه‌اندازی

```bash
npm install
cp .env.example .env        # در ویندوز: copy .env.example .env
npm run dev                 # http://127.0.0.1:8443
```

اولین بازدید → setup wizard (ساخت ادمین، تعریف workspace، allowlist اسکن) → ورود.

### TLS در توسعه (اختیاری، فقط آزمایشی)

```bash
npm run dev:https
```

self-signed است و مرورگر هشدار می‌دهد — فقط برای محیط آزمایشی.

### تولید

```bash
npm run build
APP_PORT=8443 node scripts/start.mjs
```

برای HTTPS واقعی، برنامه را پشت reverse proxy معتبر (nginx/Caddy) قرار دهید.

## قابلیت‌ها

- **کشف کنترل‌شده:** Quick/Standard/Credentialed با TCP connect واقعی؛ allowlist و exclude سمت سرور؛ هرگز بدون `/0`.
- **نقشه زنده توپولوژی** (React Flow) با node/edge، فیلتر، side panel و داده نمایشی همیشه برچسب‌دار **DEMO DATA**.
- **استودیوی معماری Splunk** — Standalone تا multi-site indexer/search head cluster با فرضیات تقریبی صریح.
- **کاتالوگ نسخه‌ها و بهترین شیوه‌ها** (Read/Plan/Apply با dry-run و پشتیبان‌گیری `.bak`).
- **Local Lab adapter** — محیط آزمایشی واقعی روی فایل‌سیستم محلی (آرتیفکت پیکربندی، شنونده TCP، اعتبارسنجی). این Splunk واقعی نصب نمی‌کند و صادقانه همین را اعلام می‌کند.
- **Preflight + job queue** با رویدادهای زنده (SSE)، cancel، اعتبارسنجی post-install با وضعیت صادقانه `Not verified`.
- **امنیت:** scrypt، سشن HMAC httpOnly، RBAC، رمزنگاری AES-256-GCM برای credential refs، audit log زنجیره‌دار.

## اسناد

- `docs/reference-catalog.md` — بررسی صادقانه مخزن مرجع (Pilot)
- `docs/product-requirements.md` — نیازمندی‌ها
- `docs/architecture.md` — تصمیم‌های فنی (ADR)
- `docs/security-model.md` — مدل امنیت و مجوزها

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `APP_PORT` | `8443` | پورت سرویس |
| `SESSION_SECRET` | dev fallback | برای تولید حتماً مقدار تصادفی بگذارید |
| `SECRET_ENCRYPTION_KEY` | dev fallback | کلید AES-256-GCM (hex 64) |
| `AUDIT_RETENTION_DAYS` | `90` | نگهداری لاگ ممیزی |
| `SCAN_MAX_HOSTS` | `1024` | سقف host در هر اسکن |
