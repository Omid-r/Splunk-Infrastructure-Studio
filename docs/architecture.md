# معماری فنی — Splunk Infrastructure Studio

> نسخه 0.1 — 2026-10-12 — تصمیم‌ها با دلیل ثبت شده‌اند.

## 1) تصمیمات معماری (ADRs خلاصه)
| # | تصمیم | دلیل |
|---|---|---|
| ADR-1 | **Next.js 15 (App Router) full-stack + SQLite داخلی Node (`node:sqlite`)** | محیط ویندوز کاربر فقط Node را خواهد داشت؛ بدون Docker/Postgres/Redis قابل اجراست. لایه service تمیز با repository pattern ⇒ مهاجرت به Postgres در فاز بعد بدون بازنویسی UI. (انحراف از پیشنهاد FastAPI+Postgres+Redis پرامپت، به علت محدودیت محیط — مجاز طبق بند «پشته را با دلیل ثبت کن».) |
| ADR-2 | SSE برای رویدادهای زنده (scan/deployment/job) | سبک‌تر از WebSocket، با HTTP ساده، retry-safe، کافی برای one-way progress. |
| ADR-3 | Adapter interface برای discovery/provisioning/deploy | اضافه‌کردن provider جدید (vSphere، cloud…) بدون بازنویسی هسته. هر adapter: `validate()`, `preflight()`, `run()` + dry-run. |
| ADR-4 | اسکن TCP connect واقعی با `net` Node | بدون dependency به Nmap (نصب‌نشدنی روی ویندوز کاربر)، conservative، allowlist server-side. |
| ADR-5 | داده demo جداگانه در seed با flag دائمی `demo: true` | جلوگیری از هرگونه اشتباه داده demo با live. |
| ADR-6 | احراز هویت session داخلی (httpOnly cookie + HMAC) | بدون وابستگی خارجی؛ ساختار برای OIDC/SAML در فاز بعد. |

## 2) ساختار کد (monorepo ساده)
```
src/
  app/                 # App Router — صفحات + route handlers (API)
    (auth)/login/  setup/
    (app)/dashboard/ discovery/ topology/ hosts/[id]/ infrastructure/
           os-install/ architecture/ packages/ deployment/ best-practices/
           audit/ settings/
    api/...            # REST + SSE route handlers (نازک — فقط parse/validate/respond)
  server/              # لایه backend — خارج از app/ قابل تست
    db/                # اتصال node:sqlite، migrations، seed
    core/              # scope guard، job engine (queue+state+SSE hub)، audit
    adapters/          # tcp-scan, ping(demo), ssh(Coming later), vm/k8s (stubs disabled)
    services/          # scans, hosts, topology, architectures, deployments, best-practices
    catalog/           # splunk versions, os images, best-practice rules (versioned JSON+source)
  components/          # UI: design system، wizard، topology، charts
  lib/                 # shared types, validators (zod), utils
data/                  # runtime (gitignored): app.sqlite + artifacts
docs/
```

## 3) مدل داده (حداقل MVP — با SQL migration)
`users, sessions, workspaces, scope_ranges, scope_exclusions, credentials(ref), hosts, host_interfaces, host_ports, observations(evidence: source, confidence, observed_at), scan_profiles, scan_jobs, scan_findings, topology_snapshots, architecture_designs, splunk_catalog, deployment_plans, deployment_jobs, job_events, best_practice_rules, best_practice_runs, audit_events, settings`.

اصول: مشخصات مشاهده‌شده در `observations` با منبع/زمان/confidence؛ هرگز حدس قطعی ثبت نمی‌شود؛ `inferred` از `observed` جداست.

## 4) جریان‌های کلیدی
- **Scan**: POST /api/scans → validate scope (server-side) → job درون‌پردازه‌ای با concurrency محدود → event hub → SSE → نتایج در findings/observations → snapshot توپولوژی → diff با اسکن قبلی.
- **Deploy**: draft plan → preflight (مجموعه بررسی‌های adapter) → نتیجه Critical/Warning/Info → تأیید → enqueue → job engine با cancel/retry/resume → validation step → گزارش واقعی.
- **Best Practice**: rule catalog versioned → evaluate در Plan → diff → تأیید → Apply از طریق adapter → نتیجه واقعی Failed/Applied.

## 5) قرارداد API و خطا
REST JSON؛ خطا: `{ error: { code, message, details? } }`؛ کدها: `SCOPE_VIOLATION, INVALID_INPUT, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, JOB_FAILED, NOT_IMPLEMENTED`؛ تمام mutating endpointها با CSRF token + RBAC سمت سرور.

## 6) محدودیت‌های شناخته‌شده فاز اول
- job engine درون‌پردازه‌ای است (restart = از دست رفتن job در حال اجرا؛ state پایدار می‌ماند و قابل resume).
- SQLite تک‌کاربره توسعه/MVP.
- adapter SSH/WinRM/SNMP/vSphere/K8s پیاده‌سازی نشده و در UI صریحاً Coming later است.
