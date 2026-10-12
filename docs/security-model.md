# مدل امنیت — Splunk Infrastructure Studio

> نسخه 0.1 — 2026-10-12

## 1) مرزها و تهدیدها ( خلاصه threat model )
| مرز | تهدید | کنترل |
|---|---|---|
| ورودی کاربر (scope/target) | اسکن خارج از مجوز، SSRF، تزریق دستور | scope allowlist server-side + اعتبارسنجی CIDR/IP + execFile بدون shell + عدم پذیرش command آزاد |
| احراز هویت | brute force، session hijack | hash رمز با scrypt (node:crypto)، rate limit + lock، session httpOnly/SameSite=strict با امضای HMAC، timeout |
| مجوز | افزایش سطح دسترسی | RBAC سمت سرور روی همه routeها؛ deny by default |
| اسرار | نشت credential | هرگز plaintext در DB/log/frontend؛ فیلد فقط عبارت است از reference به vault داخلی (کلید رمزنگاری‌شده با کلید محیطی `SECRET_ENCRYPTION_KEY`)؛ نمایش فقط «تنظیم شده/نشده» |
| اجرای job | دسترسی غیرمجاز به هدف | destructive action فقط با confirmation دوم + ثبت دلیل + audit؛ dry-run پیش از Apply |
| داده در حال انتقال | شنود | TLS در production (راهنمای cert در README)؛ dev روی localhost |
| لاگ‌ها | نشت secret در log | sanitization خروجی adapterها؛ تست sanitization |
| supply chain | وابستگی مخرب | حداقل dependency؛ lockfile؛ نصب از npm رسمی |

## 2) اصول غیرقابل مذاکره (از پرامپت)
1. هیچ brute force / credential guessing / exploit / stealth scan / lateral movement / persistence / auth bypass — ابزار فقط برای کشف و مدیریت مجاز دارایی‌ها.
2. کشف دستگاه به معنی مجوز مدیریت آن نیست.
3. باز بودن پورت یا پاسخ ping هرگز به‌عنوان احراز هویت نمایش داده نمی‌شود.
4. بدون شواهد → `Unknown` / `Not verified`؛ هرگز حدس قطعی.
5. Success فقط از نتیجه واقعی task؛ شکست پنهان نمی‌شود.

## 3) RBAC (ادامه در کد: src/server/core/rbac.ts)
نقش‌ها: `viewer, network_operator, splunk_admin, infra_admin, auditor, admin`.
ماتریس اقدام‌ها در کد ثبت شده؛ نمونه: اجرای اسکن=f network_operator+؛ deploy=splunk_admin/infra_admin؛ مدیریت کاربران=admin؛ audit خواندنی=auditor/admin.

## 4) Audit
رویدادهای ثبت‌شده (append-only، hash-chain ساده برای یکپارچگی): login/logout/_failed_login، ایجاد/تغییر scope، اجرای/لغو/خطای اسکن، مشاهده host، ایجاد/تغییر/حذف credential reference، deploy plan/job/approve/override، apply best practice، تغییر تنظیمات، خروجی داده (export). هر رکورد: actor، timestamp، action، target، نتیجه، correlation id.

## 5) اسرار و پیکربندی
- `.env.example` بدون مقدار واقعی؛ کلیدها: `SECRET_ENCRYPTION_KEY` (64 hex)، `SESSION_SECRET`، `APP_PORT=8443`، `TLS_*` اختیاری.
- مخزن هیچ‌وقت secret نمی‌پذیرد (pre-commit در CI فاز بعد).
- داده runtime در `data/` و gitignored.

## 6) درس‌های اعمال‌شده از پروژه مرجع
- حذف endpoint اجرای ترمینال آزاد (آسیب‌پذیری اصلی Dr-Splunk) — فقط taskهای allowlisted.
- seed فقط در runtime؛ هیچ DB کاربری در git.
- مسیر Coming later به‌جای دکمه ظاهری.
