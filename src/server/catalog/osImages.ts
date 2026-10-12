export interface OsImage {
  id: string;
  name: string;
  version: string;
  arch: string;
  category: 'official' | 'compatible' | 'community' | 'unsupported';
  splunk_compat: string;
  source_url: string;
  checksum_note: string;
  checked_at: string;
}

const CHECKED_AT = '2026-10-12';

export const OS_IMAGES: OsImage[] = [
  {
    id: 'rhel-9', name: 'Red Hat Enterprise Linux', version: '9.x', arch: 'x86_64',
    category: 'official', splunk_compat: '9.2.x – 9.4.x',
    source_url: 'https://access.redhat.com/downloads/content/rhel',
    checksum_note: 'هنگام دانلود ISO، checksum رسمی Red Hat را از پورتال بررسی کنید', checked_at: CHECKED_AT,
  },
  {
    id: 'ubuntu-2204', name: 'Ubuntu Server LTS', version: '22.04', arch: 'x86_64',
    category: 'official', splunk_compat: '9.2.x – 9.4.x',
    source_url: 'https://releases.ubuntu.com/22.04/',
    checksum_note: 'فایل SHA256SUMS رسمی Canonical را Verify کنید', checked_at: CHECKED_AT,
  },
  {
    id: 'win-2022', name: 'Windows Server', version: '2022', arch: 'x64',
    category: 'official', splunk_compat: '9.2.x – 9.4.x',
    source_url: 'https://www.microsoft.com/evalcenter/evaluate-windows-server-2022',
    checksum_note: 'از رسانه/ولت معتبر سازمان با hash اعلام‌شده استفاده کنید', checked_at: CHECKED_AT,
  },
  {
    id: 'debian-12', name: 'Debian', version: '12 (bookworm)', arch: 'x86_64',
    category: 'compatible', splunk_compat: '9.3.x – 9.4.x (طبق ماتریس فروشنده بررسی شود)',
    source_url: 'https://www.debian.org/distrib/',
    checksum_note: 'فایل‌های checksum رسمی Debian را بررسی کنید', checked_at: CHECKED_AT,
  },
  {
    id: 'rocky-9', name: 'Rocky Linux', version: '9.x', arch: 'x86_64',
    category: 'community', splunk_compat: 'غیررسمی — سازگاری تضمین‌شده نیست',
    source_url: 'https://rockylinux.org/download',
    checksum_note: 'قبل از استفاده در production، تست کامل انجام شود', checked_at: CHECKED_AT,
  },
  {
    id: 'win-2012r2', name: 'Windows Server', version: '2012 R2', arch: 'x64',
    category: 'unsupported', splunk_compat: 'فاقد پشتیبانی در نسخه‌های جاری Splunk',
    source_url: 'https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2012-r2',
    checksum_note: '—', checked_at: CHECKED_AT,
  },
];

export const PROVISIONING_CHANNELS = [
  { id: 'redfish', label: 'Redfish / IPMI (iDRAC, iLO)', available: false, reason: 'نیازمند دسترسی out-of-band مدیریتی و آداپتور اختصاصی — Coming later' },
  { id: 'pxe', label: 'PXE / Virtual Media', available: false, reason: 'نیازمند زیرساخت PXE سازمان — Coming later' },
  { id: 'vsphere', label: 'VMware vSphere', available: false, reason: 'آداپتور hypervisor پیاده‌سازی نشده — Coming later' },
  { id: 'proxmox', label: 'Proxmox', available: false, reason: 'آداپتور hypervisor پیاده‌سازی نشده — Coming later' },
  { id: 'kvm', label: 'KVM / libvirt', available: false, reason: 'آداپتور hypervisor پیاده‌سازی نشده — Coming later' },
  { id: 'existing-os', label: 'Existing OS (SSH/WinRM)', available: false, reason: 'اجرای remote از طریق SSH/WinRM در این نسخه Coming later است؛ اسکن و preflight محلی واقعی است' },
];
