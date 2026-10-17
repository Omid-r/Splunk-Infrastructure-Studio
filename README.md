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
- **اسنپ‌شات و مقایسه اسکن:** هر job موفق شواهد خودش (هاست + پورت باز) را ثبت می‌کند و `/discovery` تفاوت دو اسکن را به‌صورت جدید/ناپدید/تغییریافته (با پورت‌ها و سرویس‌ها) نشان می‌دهد.
- **نقشه زنده توپولوژی** (React Flow) با node/edge، فیلتر، side panel و داده نمایشی همیشه برچسب‌دار **DEMO DATA**.
- **استودیوی معماری Splunk** — Standalone تا multi-site indexer/search head cluster با فرضیات تقریبی صریح.
- **کاتالوگ نسخه‌ها و بهترین شیوه‌ها** (Read/Plan/Apply با dry-run و پشتیبان‌گیری `.bak`).
- **Local Lab adapter** — محیط آزمایشی واقعی روی فایل‌سیستم محلی (آرتیفکت پیکربندی، شنونده TCP، اعتبارسنجی). این Splunk واقعی نصب نمی‌کند و صادقانه همین را اعلام می‌کند.
- **Lab Runtime (`/lab`)** — نودهای زنده با گیرنده TCP و سرویس مدیریت HTTP روی `127.0.0.1`، فوروارد واقعی بر اساس `outputs.conf`، spool رویداد، ویرایش conf با `btool`/diff/`.bak`، جستجوی توزیع‌شده و **بستهٔ tar.gz** قابل‌انتقال (ustar + gzip با manifest و sha256).
- **عیب‌یاری و ترمیم (`/diagnostics`)** — چک‌های واقعی (reachability، درستی `inputs.conf`، زنده بودن هدف فوروارد، نوشتگی spool، دیسک) با fix تک‌کلیکی، پشتیبان و تأیید جدا برای عملیات مخرب.
- **جعبه‌ابزار شبکه (`/toolbox`)** — ping/traceroute/DNS/TCP/HTTP/پورت‌های محلی با argv ثابت (بدون shell) و مقید به allowlist؛ هر اجرا در audit ثبت می‌شود.
- **محیط آزمایشگاهی (`/lab-env`)** — هشت قدم به‌ترتیب: موجودی دمو → معماری → استقرار → ساخت نود → روشن کردن → تزریق لاگ نمونه از `lab/sample-data` → بستهٔ شواهد → توقف؛ با شاهد و متریک واقعی برای هر قدم.
- **مدیریت کاربران و امنیت (`/admin`)** — قفل ورود پایدار پس از ری‌استارت، نشست‌های قابل‌ابطال، بازنشانی رمز و بررسی زنجیرهٔ audit.
- **Preflight + job queue** با رویدادهای زنده (SSE)، cancel، اعتبارسنجی post-install با وضعیت صادقانه `Not verified`.
- **امنیت:** scrypt، سشن HMAC httpOnly، RBAC، رمزنگاری AES-256-GCM برای credential refs، audit log زنجیره‌دار.

## محیط آزمایشگاهی (Laboratory)

یک نمونهٔ کاملاً جدا (دیتابیس، کانف‌ها، spool و لاگ داخل `lab/.lab-data/`، بدون دست‌زدن به `./data`):

```bash
npm run lab             # http://127.0.0.1:8553  (بدون npm: node lab/start-lab.mjs)
npm run lab:reset       # پاک‌کردن کامل داده‌های آزمایشگاه
node lab/start-lab.mjs --port=8600 --prod
```

پس از راه‌اندازی اولیه، صفحهٔ **محیط آزمایشگاهی** (`/lab-env`) زنجیرهٔ کامل را با نتایج واقعی اجرا می‌کند.
جدول قدم‌ها و نکته‌های امنیتی: `lab/README.md`.

## اسناد

- `lab/README.md` — راهنمای محیط آزمایشگاهی و تزریق لاگ نمونه
- `docs/reference-catalog.md` — بررسی صادقانه مخزن مرجع (Pilot)
- `docs/product-requirements.md` — نیازمندی‌ها
- `docs/architecture.md` — تصمیم‌های فنی (ADR)
- `docs/security-model.md` — مدل امنیت و مجوزها

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `APP_PORT` | `8443` | پورت سرویس |
| `SIS_DATA_DIR` | `data/` | پوشهٔ دیتابیس و آرتیفکت‌ها (آزمایشگاه: `lab/.lab-data`) |
| `SESSION_SECRET` | dev fallback | برای تولید حتماً مقدار تصادفی بگذارید |
| `SECRET_ENCRYPTION_KEY` | dev fallback | کلید AES-256-GCM (hex 64) |
| `AUDIT_RETENTION_DAYS` | `90` | نگهداری لاگ ممیزی |
| `SCAN_MAX_HOSTS` | `1024` | سقف host در هر اسکن |
