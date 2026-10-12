import type { SplunkVersionEntry } from '@/lib/types';

const CHECKED_AT = '2026-10-12';
const SOURCE = 'https://www.splunk.com/en_us/download/splunk-enterprise.html';

export const SPLUNK_VERSIONS: SplunkVersionEntry[] = [
  {
    version: '9.4.x',
    status: 'supported',
    os_support: ['Windows Server 2016+', 'RHEL 8/9', 'Ubuntu 20.04/22.04', 'Debian 11+'],
    architectures: ['x64'],
    source_url: SOURCE,
    checked_at: CHECKED_AT,
    note: 'نسخه جاری پایدار — نسخه دقیق را هنگام دانلود از پورتال رسمی Splunk بررسی کنید',
  },
  {
    version: '9.3.x',
    status: 'supported',
    os_support: ['Windows Server 2016+', 'RHEL 7/8/9', 'Ubuntu 20.04/22.04'],
    architectures: ['x64'],
    source_url: SOURCE,
    checked_at: CHECKED_AT,
    note: 'نسخه پایدار پشتیبانی‌شده',
  },
  {
    version: '9.2.x',
    status: 'supported',
    os_support: ['Windows Server 2016+', 'RHEL 7/8/9', 'Ubuntu 18.04/20.04/22.04'],
    architectures: ['x64'],
    source_url: SOURCE,
    checked_at: CHECKED_AT,
    note: 'نسخه پایدار — برخی ویژگی‌های جدیدتر در دسترس نیست',
  },
  {
    version: '9.1.x',
    status: 'legacy',
    os_support: ['Windows Server 2012 R2+', 'RHEL 7/8', 'Ubuntu 18.04/20.04'],
    architectures: ['x64'],
    source_url: SOURCE,
    checked_at: CHECKED_AT,
    note: 'Legacy — فقط برای محیط‌های موجود؛ نصب جدید توصیه نمی‌شود',
  },
  {
    version: '9.0.x',
    status: 'eol',
    os_support: ['Windows Server 2012 R2+', 'RHEL 7/8', 'Ubuntu 16.04/18.04'],
    architectures: ['x64'],
    source_url: SOURCE,
    checked_at: CHECKED_AT,
    note: 'پایان پشتیبانی — ارتقا اجباری',
  },
];

export const OPERATOR_MATRIX_URL = 'https://github.com/splunk/splunk-operator/releases';
