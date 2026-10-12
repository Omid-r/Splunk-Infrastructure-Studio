# کاتالوگ مرجع — مخزن Omid-r/Pilot (پروژه Dr-Splunk)

> تاریخ بررسی: 2026-10-12
> منبع: https://github.com/Omid-r/Pilot — فایل `splunk-cluster-doctor-&-architecture-studio.zip` (3,710,377 بایت)
> روش: دانلود و استخراج ZIP، خواندن مستقیم کد (server.ts، ماژول‌های server/، کامپوننت‌های src/، داده‌های src/data/)
> قانون کاتالوگ: هر قابلیت فقط با شواهد کد ثبت شده؛ هرجا از روی کد قابل اثبات نیست «تأییدنشده» اعلام شده است.

---

## 1) شناسنامه پروژه مرجع

| مورد | مقدار | شواهد |
|---|---|---|
| نام فایل ZIP | `splunk-cluster-doctor-&-architecture-studio.zip` | ریشه مخزن GitHub |
| توضیحات مخزن | "Splunk Automation" | GitHub API |
| نام داخلی اپ | metadata.json: "Cyber Attacks Threat Monitoring Dashboard" | `metadata.json` — با محتوای واقعی ZIP ناسازگار است؛ سند `REAL-OFFLINE-CONTROL-PLANE.md` نام «Dr-Splunk» را تأیید می‌کند |
| مولد کد | Google AI Studio (Gemini) — بنر در README، dependency `@google/genai` | `README.md`، `package.json` |
| وضعیت ساخت | شاخه `feature/real-offline-orchestrator` به‌صورت draft؛ خود سند می‌گوید build کامل اجرا نشده | `REAL-OFFLINE-CONTROL-PLANE.md` (بخش Validation limitation)، `.github/workflows/build-offline-rhel.yml` |
| **مجوز** | **فایل LICENSE وجود ندارد** — نه در ریشه مخزن، نه در ZIP | فهرست ریشه GitHub API و ZIP |
| دیتابیس امنیتی کامیت‌شده | `data/security-db.json` شامل کاربران demo با `passwordHash` و `salt` | `data/security-db.json` (4,502 بایت)؛ `.gitignore` خود پروژه هم این فایل را باید نادیده می‌گرفته ولی در ZIP حضور دارد |

**نتیجه مجوز:** بدون LICENSE، کد تحت «همه حقوق محفوظ» است. طبق قانون 0.6 پرامپت: هیچ کدی از پروژه مرجع کپی نمی‌شود؛ فقط رفتارها و نیازمندی‌ها برای طراحی محصول جدید استخراج می‌شوند.

---

## 2) پشته فنی پروژه مرجع

| لایه | تکنولوژی | شواهد |
|---|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS 4 + motion + lucide-react | `package.json` |
| Backend | Express 4 به‌صورت یک فایل یکپارچه `server.ts` به حجم 228,618 بایت | `server.ts`، `package.json` |
| ماژول‌های سرور | `server/securityEngine.ts` (21KB)، `server/realControlPlane.ts` (30KB) | پوشه `server/` |
| هوش مصنوعی | `@google/genai` + `GEMINI_API_KEY` (AI Studio lock-in) | `package.json`، `.env.example` |
| Lockfile | `bun.lock` (توسعه با Bun) | ریشه ZIP |
| دیتای اولیه | 20 فایل TS در `src/data/` (mock/seed) — جمعاً ~620KB | `src/data/` |
| بسته‌بندی RHEL | `scripts/build-rhel-package.js` + GitHub Actions `build-offline-rhel.yml` | `scripts/`، `.github/workflows/` |
| محصول Splunk داخلی | `public/splunk_cluster_doctor-1.0.0.spl` (5,268 بایت) | `public/` |

---

## 3) سطح API پروژه مرجع (شواهد: `grep app.get/post` روی `server.ts`)

### 3.1 احراز هویت و مدیریت کاربران — Implemented
| Endpoint | وضعیت | شواهد |
|---|---|---|
| `POST /api/auth/login` | Implemented — هش SHA-512+salt، rate limit، lock | `server.ts:1096`، `server/securityEngine.ts` (`hashPassword`، `checkRateLimit`، `recordFailedLogin`) |
| `GET /api/auth/me` / `POST logout` / `POST change-password` | Implemented (با `requireAuth`) | `server.ts:1188-1242` |
| `GET/POST/PUT/DELETE /api/admin/users*` | Implemented (فقط `super_admin`) | `server.ts:1242-1432` |
| `GET /api/admin/audit-logs` | Implemented | `server.ts:1432` |
| `GET /api/admin/security-status` | Implemented | `server.ts:1448` |
| `GET/POST /api/admin/license*` | Implemented — لایسنس امضاشده با کلید `data/master-signing.key` | `server.ts:1458-1569`، `securityEngine.ts:111` (`generateSignedLicenseKey`) |

نقش‌های تعریف‌شده در `securityEngine.ts`: `super_admin`، `cluster_admin`، `operator`، `auditor` — نگاشت مناسب به RBAC محصول جدید.

### 3.2 مانیتورینگ و کنترل Splunk — Implemented (روی هاست کنترل‌کننده)
| Endpoint | وضعیت |
|---|---|
| `GET /api/splunk/status` `confs` `btool` `logs` `env` `system-audit` | Implemented — خواندن فایل‌های واقعی Splunk |
| `POST /api/splunk/control` | Implemented — start/stop/restart |
| `POST /api/splunk/confs/save` | Implemented — خطرناک: ویرایش مستقیم conf |
| `GET /api/splunk/detect-version` | Implemented |

### 3.3 کلاستر موازی (multi-instance Splunk روی یک هاست) — Implemented
`parallel-cluster/*`: status، start، stop، deep-diagnostics، fix-individual-issue، execute-runbook، ai-auto-heal، auto-heal-all، reset، deep-runtime-audit، packages، install، copy-configs، start-daemon (`server.ts:1970-2645`، `3766-4029`)

### 3.4 جعبه‌ابزار شبکه — Partially implemented
| Endpoint | وضعیت | شواهد |
|---|---|---|
| `POST /api/toolbox/port-scan` | Implemented — TCP probe با لیست پورت ثابت | `server.ts:4319` |
| `POST /api/toolbox/ping` / `traceroute` | Implemented (exec ابزارهای سیستم) | `server.ts:4381`، `4425` |
| `GET /api/toolbox/network-map` | Partially implemented — مبتنی بر خروجی `ss` همان هاست، نه کشف شبکه‌ای گسترده | `server.ts:4480` |
| `POST /api/toolbox/flows` | UI-only/Mock محتمل — تأیید backend عمیق نشد | `server.ts:4242` |

### 3.5 Deploy و نصب آفلاین — Implemented (محیط RHEL/air-gapped)
`container-engine/install-offline`، `k8s/deploy-splunk` + `k8s/status`، `tools/offline-install-all`، `download/rhel-package` + `rebuild-rhel-package`، `deploy/direct|container|kubernetes` در `/api/real/*`

سند `REAL-OFFLINE-CONTROL-PLANE.md` قانون «عدم شبیه‌سازی» را صریح اعلام می‌کند: «A missing Splunk binary… is reported as a failure. The backend no longer reports a successful sandbox action» — اصل بسیار خوبی که در محصول جدید حفظ می‌شود.

### 3.6 Control Plane واقعی (`/api/real/*`) — Implemented
`server/realControlPlane.ts`: `registerRealControlPlane(app)` با execFile بدون shell، `ALLOWED_PORTS` ثابت، `expandCidr` با سقف 1024 هاست، TCP probe با تایم‌اوت، پشتیبانی SSH/رول‌اوت kubectl.

### 3.7 نقاط ضعف امنیتی شناسایی‌شده (درس برای محصول جدید)
| مشکل | شواهد | درس |
|---|---|---|
| اجرای فرمان آزاد از طریق API | `POST /api/system/terminal/exec` در `server.ts:490` و `1044` | هرگز command string آزاد از کاربر به shell ندهیم — فقط taskهای تعریف‌شده |
| `security-db.json` کامیت‌شده با هش/سالت کاربران | `data/security-db.json` | seed فقط در runtime، هرگز در git |
| routeهای تکراری/مرده | `probe-cluster` دو بار (`server.ts:3898` و `4081`)؛ `tools/validate` دو بار (`3931` و `4929`)؛ مسیرهای system command در دو ناحیه | کد یکپارچه و تست‌شده |
| لایسنس ساده با امضای HMAC سمت سرور | `securityEngine.ts:111` | برای MVP جدید: activation key اختیاری، نه مسیر اصلی |
| وابستگی به Gemini API | `GEMINI_API_KEY` در `.env.example` | هوش مصنوعی اختیاری و در فاز بعد؛ MVP بدون وابستگی خارجی |
| بدون HTTPS/TLS | هیچ موردی در server.ts یافت نشد | TLS در محصول جدید الزامی |

---

## 4) رابط کاربری پروژه مرجع

`src/App.tsx` (178KB یک‌فایله) + 44 کامپوننت. بزرگ‌ترین‌ها:

| کامپوننت | حجم | نقش |
|---|---|---|
| `AdminSecurityPanel.tsx` | 180KB | پنل امنیت و مدیریت کاربران |
| `SplunkSchematicBlueprintDiagram.tsx` | 178KB | دیاگرام شماتیک معماری |
| `SplunkClusterDeployerWizard.tsx` | 81KB | ویزارد deploy کلاستر |
| `SplunkFleetDiscoveryProvisioner.tsx` / `SplunkManagementNodesHub.tsx` | ~79KB | کشش fleet و مدیریت نودها |
| `SplunkDiagnosticAndAIAutoHealer.tsx` | 68KB | تشخیص و ترمیم خودکار |
| `NetworkToolbox.tsx` | 65KB | ابزارهای شبکه |
| `TopologyGraph.tsx` + `ComponentNetworkMap.tsx` | ~40KB | گراف توپولوژی (سطح کامپوننت Splunk) |
| `ParallelSplunkProvisioningStudio.tsx` | 118KB | استودیوی provisioning |

**ارزیابی صادقانه:** UI بسیار پرحجم، با stateهای موقت فراوان و modal تو در تو؛ برند Apple-like با RTL ناقص در برخی بخش‌ها (متن فارسی/انگلیسی مخلوط). پرامپت صریحاً می‌گوید: «محصول جدید طراحی و مرتب‌سازی شود، نه اینکه همان رابط گیج‌کننده با رنگ‌های جدید تکرار شود».

---

## 5) داده‌های آماده (src/data/) — Mock/Seed
`initialConfigs.ts` (69KB)، `splunkDeployerData.ts` (71KB)، `splunkDocs.ts` (60KB)، `logAnalysisEngine.ts` (67KB)، `splunkTarGzBase64.ts` (7KB — فایل tar.gz توکار base64، احتمالاً آرتیفکت نمونه)، `visualTopologyData.ts` و 14 فایل دیگر. **همه این داده‌ها فقط برای مطالعه رفتار به‌کار می‌روند و کپی نمی‌شوند.**

---

## 6) خلاصه نیازمندی‌های استخراج‌شده برای محصول جدید
از رفتارهای اثبات‌شده پروژه مرجع، این نیازها برای **Splunk Infrastructure Studio** جدید تأیید شد:
1. مدیریت کاربران با نقش‌ها + audit log (بهبود: RBAC کامل سمت سرور، همه endpointها).
2. کنترل واقعی سرویس Splunk + خواندن confها + btool (بهبود: read-only پیش‌فرض، Apply فقط با dry-run و تأیید).
3. توپولوژی بصری با نود/adge و side panel (بهبود: گراف hostهای کشف‌شده با شواهد، نه فقط کامپوننت‌های ثابت).
4. جعبه‌ابزار شبکه (بهبود: scope allowlist اجباری سمت سرور، بدون exec آزاد).
5. نصب آفلاین/ air-gapped (بهبود: adapter معتبر + عدم موفقیت ساختگی — اصل non-simulation حفظ می‌شود).
6. چند نسخه Splunk هم‌زمان (parallel) → در محصول جدید به‌صورت معماری توزیع‌شده واقعی.

## 7) موارد تأییدنشده / gaps پروژه مرجع
- هیچ تست خودکاری (unit/integration/E2E) یافت نشد.
- نبود PostgreSQL/migration/model داده رسمی — همه state در JSON و حافظه.
- نبود i18n، نبود workspace/environment scoped.
- نبود engine اسکن job-based با persistence و diff بین دو اسکن.
- build کامل (npm install && lint) طبق اعتراف خود سند اجرا نشده.
