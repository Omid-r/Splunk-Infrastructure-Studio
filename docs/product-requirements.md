# Splunk Infrastructure Studio — مشخصات محصول و مسیر کاربر

> نسخه 0.1 — 2026-10-12
> مبنای طراحی: پرامپت جامع کاربر + درس‌های `docs/reference-catalog.md` از پروژه مرجع Dr-Splunk.

## 1) چشم‌انداز
پلتفرم یکپارچه‌ای که مهندس شبکه و مدیر Splunk را از **تعریف Workspace و scope مجاز** تا **کشف کنترل‌شده، نقشه زنده زیرساخت، طراحی معماری Splunk، preflight، deploy و مانیتورینگ نهایی** هدایت می‌کند. زبان UI فاز اول: فارسی با RTL واقعی. اصل مسلم: **کشف دستگاه ≠ داشتن مجوز مدیریت آن**؛ هیچ دسترسی‌ای بدون credential صریح و تأییدشده ایجاد نمی‌شود.

## 2) شخصیت‌ها و نقش‌ها (RBAC)
| نقش | دسترسی |
|---|---|
| Viewer | مشاهده داشبورد، نقشه، گزارش‌ها |
| Network Operator | اجرای discovery در scope مجاز، refresh inventory |
| Splunk Admin | طراحی معماری، deploy، Best Practice روی Splunk |
| Infrastructure Admin | provisioning/نصب OS، deploy |
| Security/Auditor | خواندن audit log، security status |
| Admin | همه موارد + مدیریت کاربران و تنظیمات |

## 3) مسیر کاربر (Wizard 12 مرحله‌ای — با امکان بازگشت امن و ذخیره draft)
1. **Workspace و scope** — نام محیط، سایت، timezone، مالک + CIDR/subnet/IP مجاز + لیست exclude. تأیید صریح scope پیش از اسکن. `0.0.0.0/0` هرگز پیش‌فرض/مجاز نیست.
2. **Discovery** — سه پروفایل: Quick Discovery (TCP connect پورت‌های منتخب)، Standard Inventory (+DNS/reverse/SNMP read-only)، Credentialed Inventory (+SSH/WinRM با credential ثبت‌شده). تنظیم سرعت، concurrency، timeout، retry، port range. پیشرفت زنده SSE.
3. **Network Map** — گراف زنده نودها/edgeها، side panel، فیلتر و grouping، stale label، diff بین دو اسکن، خروجی PNG/SVG/JSON/CSV. دموی ۶ سرور با برچسب دائمی DEMO DATA.
4. **جزئیات host** — تب‌های Overview/Network/Access/Software/Relationships/Actions/Audit.
5. **مسیر زیرساخت** — ۶ مسیر: Existing OS، Bare Metal (Redfish/PXE)، VM، Docker/Podman، Kubernetes (Splunk Operator)، Hybrid/Existing Splunk. پیاده‌سازی‌نشده = disabled + علت.
6. **انتخاب/نصب OS** — کاتالوگ نسخه‌های سازگار، دسته‌بندی پشتیبانی، checksum، تأیید جداگانه wipe.
7. **Architecture Studio** — پرسش‌نامه sizing (ingest، retention، کاربران search، HA/multisite، RPO/RTO)، پیشنهاد توپولوژی با نقش‌ها + دلیل هر node، مقایسه گزینه‌ها، خروجی PNG/SVG/JSON. برآوردها «تقریبی» برچسب می‌خورند.
8. **انتخاب Splunk** — کاتالوگ نسخه از منبع versioned رسمی، سازگاری OS/CPU/Operator، لینک منبع و تاریخ بررسی.
9. **Best Practices** — سه حالت Read/Plan/Apply + dry-run، diff، تأیید جداگانه برای اعمال مخرب، نتیجه Pending/Applied/Failed/Skipped.
10. **Preflight + Deploy** — گزارش preflight (Critical/Warning/Info)، Deployment Plan (ترتیب، diff، rollback)، job queue با حالت‌های زنده، idempotent، cancel/retry/resume.
11. **Post-install Validation** — فقط از خروجی واقعی: service status، cluster health، data flow، licensing، TLS، time sync. هر تست نشده = Not verified.
12. **داشبورد عملیاتی** — KPIها، توپولوژی زنده، وضعیت نقش‌ها، ingest rate، alertها، audit timeline، next actions.

## 4) معیارهای پذیرش MVP (خلاصه الزام‌آور)
- نصب/اجرا فقط با README + `.env.example`؛ پورت `APP_PORT` پیش‌فرض 8443.
- اسکن واقعی فقط روی scope مجاز (اعتبارسنجی server-side حتی در فراخوانی مستقیم API).
- job واقعی با progress/result پایدار؛ هیچ Success ساختگی برای دکمه پیاده‌سازی‌نشده.
- داده DEMO همیشه برچسب‌دار و جدا از داده واقعی.
- destructive action فقط با confirmation + audit.
- تست اصلی، type-check و lint پاس شود؛ آداپتورهای تست با mock، هرگز روی شبکه واقعی.

## 5) خارج از scope فاز اول
اتصال OIDC/SAML/MFA واقعی (ساختار آماده، فاز بعد)، adapterهای cloud/hypervisor واقعی (Coming later)، Splunk Operator روی K8s واقعی (Coming later)، AI assistant (فاز بعد).
