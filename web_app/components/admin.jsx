// Tusyen - Admin Role UI v2
// Admin screens use real API data when an admin session is active.

const SYS_FALLBACK = {
  students:0,
  teachers:0,
  parents:0,
  active:0,
  trends:{
    students:null,
    teachers:null,
    parents:null,
    active:null,
  },
};

const METRICS_FALLBACK = [
  { label:'Pangkalan Data', val:null, color:'#9B8DB8', unit:'', hint:'Belum disemak', tone:'neutral', detail:'Status belum dimuat.', threshold:'Baik: connected. Kritikal: error atau tiada sambungan.' },
  { label:'Cache (Redis)',  val:null, color:'#9B8DB8', unit:'', hint:'Belum disemak', tone:'neutral', detail:'Status belum dimuat.', threshold:'Baik: connected. Kritikal: error atau tiada sambungan.' },
  { label:'Notifikasi',     val:null, color:'#9B8DB8', unit:'', hint:'Belum disemak', tone:'neutral', detail:'Status belum dimuat.', threshold:'Baik: connected/ok atau sengaja disabled. Amaran: degraded/unknown.' },
  { label:'Storan',         val:null, color:'#9B8DB8', unit:'', hint:'Belum disemak', tone:'neutral', detail:'Saiz storan belum dimuat.', threshold:'API semasa hanya memaparkan saiz DB dan jumlah fail; tiada ambang kapasiti.' },
];

const ROLE_LABEL = { student:'Pelajar', teacher:'Guru', parent:'Ibu Bapa', admin:'Admin' };
const ROLE_VALUE = { 'Pelajar':'student', 'Guru':'teacher', 'Ibu Bapa':'parent', 'Admin':'admin' };
const ROLE_OPTIONS = [
  { value:'student', label:'Pelajar' },
  { value:'teacher', label:'Guru' },
  { value:'parent',  label:'Ibu Bapa' },
  { value:'admin',   label:'Admin' },
];

const ROLE_DESCRIPTIONS = {
  student:'Pelajar boleh menyertai kelas, membuka pelajaran, menjawab kuiz, dan membina rekod kemajuan.',
  teacher:'Guru boleh mengurus kelas sendiri, menyiarkan kandungan, memberi tugasan, dan melihat kemajuan pelajar.',
  parent:'Ibu bapa boleh memantau pelajar yang dipautkan serta menerima ringkasan dan amaran berkaitan.',
  admin:'Admin boleh mengurus pengguna, kelas, kandungan global, konfigurasi sistem, dan tindakan penyelenggaraan.',
};

const ROLE_STYLE = {
  'Pelajar':  { bg:'rgba(139,92,246,.12)', border:'rgba(139,92,246,.3)', text:'#A78BFA' },
  'Guru':     { bg:'rgba(56,189,248,.12)', border:'rgba(56,189,248,.3)', text:'#38BDF8' },
  'Ibu Bapa': { bg:'rgba(245,166,35,.12)', border:'rgba(245,166,35,.3)', text:'#F5A623' },
  'Admin':    { bg:'rgba(34,197,94,.12)', border:'rgba(34,197,94,.3)', text:'#22C55E' },
};

const inputBase = {
  width:'100%',
  boxSizing:'border-box',
  background:C.surface,
  border:`1px solid ${C.border}`,
  borderRadius:10,
  padding:'8px 10px',
  minHeight:44,
  color:C.text,
  fontFamily:'Nunito',
  fontWeight:700,
  fontSize:12,
  outline:'none',
};

const metricNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const optionalNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const fmt = (value) => new Intl.NumberFormat('ms-MY').format(metricNumber(value));

const fmtOptional = (value) => {
  const number = optionalNumber(value);
  return number === null ? 'Tidak tersedia' : new Intl.NumberFormat('ms-MY').format(number);
};

const formatDateTime = (value) => {
  if (!value) return 'Tiada data';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Tiada data';
  return date.toLocaleString('ms-MY', { dateStyle:'medium', timeStyle:'short' });
};

const initials = (label) => `${label || '?'}`.slice(0, 2).toUpperCase();

const logIcon = (type) => type === 'success' ? '✓' : type === 'warn' ? '⚠' : 'ℹ';

const logColor = (type) => type === 'success' ? C.green : type === 'warn' ? C.gold : C.blue;

const statusText = (value) => value ? 'Aktif' : 'Tidak aktif';

const compactText = (value, max = 58, fallback = 'Tiada data') => {
  const text = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 3)).trim()}...`;
};

const isInternalIdentifier = (value) => /(?:qaqc|qa|test|demo|playwright|automation|abcdef|\d{8,})/i.test(`${value || ''}`);

const shortId = (value) => {
  const text = `${value || ''}`.trim();
  if (!text) return '';
  if (isInternalIdentifier(text)) return '';
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
};

const normalizeRoleValue = (role) => ROLE_VALUE[role] || role;

const roleFallbackLabel = (role, fallback = 'Pengguna') => ROLE_LABEL[normalizeRoleValue(role)] || fallback;

const titleCaseWords = (value) => `${value || ''}`
  .toLowerCase()
  .replace(/\b\w/g, letter => letter.toUpperCase());

const stripInternalTokens = (value) => {
  let text = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, ' ')
    .replace(/\b[0-9a-f]{10,}\b/gi, ' ')
    .replace(/\b(?:full|btn|seed|record|item|row|tmp|temp)[-_.]+[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]+--[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]{2,}\d{3,}\b/gi, ' ')
    .replace(/\babcdef[a-z0-9]*\b/gi, ' ')
    .replace(/\b(?:qa|test|demo)[-_.]?(?:subject|subjek|lesson|pelajaran|teacher|guru|student|pelajar|parent|ibu|admin|classroom|class|kelas|syllabus|silibus|content|kandungan|topic|topik|subtopic|post|pos|quiz|kuiz|deck|event|log|alert|amaran|achievement|headline|specialty|credential|bio)(?:[-_.]?\d{4,}|[-_.][a-z0-9]{3,})*\b/gi, ' ')
    .replace(/\b(?:qaqc|qa|test|demo|run|device|playwright|automation|e2e)[-_.]?\d{8,}(?:[-_.][a-z0-9]{3,})*\b/gi, ' ')
    .replace(/\b20\d{6,}(?:[-_.][a-z0-9]{3,})*\b/g, ' ')
    .replace(/\b\d{10,}(?:[-_.][a-z0-9]{3,})*\b/gi, ' ')
    .replace(/\b[a-z0-9]{20,}\b/gi, ' ')
    .replace(/\b(?:qaqc|playwright|automation|e2e|internal|generated|autogen|fixture|smoke|tmp|uuid|token)\b/gi, ' ')
    .replace(/\b(?:qa|test|demo)\s+(?=(user|admin|student|teacher|parent|pelajar|guru|ibu|kelas|class|classroom|lesson|pelajaran|content|kandungan|syllabus|silibus|topik|post|pos|quiz|kuiz|deck|event|log))/gi, ' ')
    .replace(/\s+[A-Z0-9]{5,8}$/g, (match, offset, fullText) => {
      const suffix = match.trim();
      const wordsBefore = fullText.slice(0, offset).trim().split(/\s+/).filter(Boolean).length;
      return /[0-9]/.test(suffix) || (suffix.length >= 6 && wordsBefore >= 3) ? '' : match;
    })
    .replace(/\s+\([A-Z0-9]{5,12}\)$/g, match => /[0-9]/.test(match) ? '' : match)
    .replace(/[._-]{2,}/g, ' ')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text;
};

const cleanDisplayText = (value, max = 58, fallback = 'Tiada data') => {
  const cleaned = stripInternalTokens(value);
  if (/^(?:subject|subjek|topic|topik|subtopic|lesson|pelajaran|content|class|classroom|kelas|user|record|item|abcdef|qa|qaqc|test|demo|internal)$/i.test(cleaned)) return fallback;
  return compactText(cleaned, max, fallback);
};
const cleanEmailDisplay = (email, max = 42, fallback = 'Tiada e-mel', role) => {
  const text = `${email || ''}`.trim();
  if (!text) return fallback;
  const atIndex = text.indexOf('@');
  if (atIndex < 1) return cleanDisplayText(text, max, fallback);
  const local = text.slice(0, atIndex);
  const domain = text.slice(atIndex + 1);
  const firstToken = local.split(/[._-]+/).filter(Boolean)[0] || local;
  const roleLocal = {
    student:'pelajar',
    teacher:'guru',
    parent:'ibu-bapa',
    admin:'admin',
  }[normalizeRoleValue(role)] || ({
    student:'pelajar',
    teacher:'guru',
    parent:'ibu-bapa',
    admin:'admin',
  }[firstToken.toLowerCase()]);
  const isInternal = /(?:qaqc|qa|test|demo|run|device|playwright|automation|e2e)|\d{8,}/i.test(local)
    || /(?:^|\.)tusyen\.test$/i.test(domain);
  if (isInternal) {
    const cleanLocal = roleLocal || cleanDisplayText(firstToken, 18, 'akaun').toLowerCase().replace(/\s+/g, '.');
    return compactText(`${cleanLocal}@${domain}`, max, fallback);
  }
  const cleanLocal = stripInternalTokens(local).replace(/[._-]+/g, '.').replace(/^\.+|\.+$/g, '') || local;
  return compactText(`${cleanLocal}@${domain}`, max, fallback);
};

const displayNameFromEmail = (email, role) => {
  const fallback = roleFallbackLabel(role);
  const local = `${email || ''}`.split('@')[0];
  if (/(?:^|[._-])(?:qa|qaqc|test|demo|playwright|automation)(?:[._-]|$)|(?:abcdef|[0-9a-f]{10,})/i.test(local)) return fallback;
  const cleanLocal = stripInternalTokens(local).replace(/[._-]+/g, ' ').trim();
  if (!cleanLocal || /^(student|teacher|parent|admin|pelajar|guru|ibu bapa|user|demo|test|qa|qaqc)$/i.test(cleanLocal)) return fallback;
  return compactText(titleCaseWords(cleanLocal), 34, fallback);
};

const cleanPersonName = (name, email, role, fallback = 'Pengguna') => {
  const address = `${email || ''}`.trim();
  const cleanName = cleanDisplayText(name, 42, '');
  if (/^(student|teacher|parent|admin|user|pelajar|guru|ibu bapa|pengguna)$/i.test(cleanName)) {
    return displayNameFromEmail(address, role) || fallback;
  }
  if (cleanName && cleanName.toLowerCase() !== address.toLowerCase()) return cleanName;
  return displayNameFromEmail(address, role) || fallback;
};

const cleanUserName = (u = {}) => {
  const role = u.roleValue || u.role;
  return cleanPersonName(
    u.full_name || u.fullName || u.name || '',
    u.email,
    role,
    roleFallbackLabel(role)
  );
};

const cleanTeacherDisplayName = (name, email = '', fallback = 'Guru') => {
  const cleaned = cleanPersonName(name, email, 'teacher', fallback);
  if (!cleaned || cleaned === fallback) return fallback;
  return /^cikgu\b/i.test(cleaned) ? cleaned : `Cikgu ${cleaned}`;
};

const cleanSubjectLabel = (value, fallback = 'Subjek') => cleanDisplayText(value, 34, fallback);

const cleanClassName = (value, fallback = 'Kelas tanpa nama') => cleanDisplayText(value, 54, fallback);

const cleanContentTitle = (value, fallback = 'Tanpa tajuk') => cleanDisplayText(value, 68, fallback);

const cleanContentSummary = (value, max = 120) => cleanDisplayText(value, max, '');

const cleanPersonLogLabel = (value, role, fallback = 'Pengguna') => {
  const text = `${value || ''}`.trim();
  if (text.includes('@')) {
    const name = displayNameFromEmail(text, role);
    if (role || name !== 'Pengguna') return name;
    return cleanEmailDisplay(text, 42, fallback, role);
  }
  return cleanPersonName(text, '', role, fallback);
};

const cleanLogMessage = (message) => {
  const raw = `${message || ''}`.replace(/\s+/g, ' ').trim();
  if (!raw) return 'Aktiviti sistem';
  const separator = raw.indexOf(':');
  if (separator > 0) {
    const prefix = cleanDisplayText(raw.slice(0, separator), 38, 'Aktiviti sistem');
    const detail = raw.slice(separator + 1).trim();
    const lowerPrefix = prefix.toLowerCase();
    let cleanDetail = cleanDisplayText(detail, 72, '');
    if (lowerPrefix.includes('pelajaran')) cleanDetail = cleanContentTitle(detail, 'Pelajaran');
    else if (lowerPrefix.includes('kelas')) cleanDetail = cleanClassName(detail);
    else if (lowerPrefix.includes('pelajar')) cleanDetail = cleanPersonLogLabel(detail, 'student', 'Pelajar');
    else if (lowerPrefix.includes('pengguna') || lowerPrefix.includes('akaun')) cleanDetail = cleanPersonLogLabel(detail, undefined, 'Pengguna');
    return cleanDetail ? `${prefix}: ${cleanDetail}` : prefix;
  }
  return cleanDisplayText(raw, 96, 'Aktiviti sistem');
};

const isValidAdminEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(`${value || ''}`.trim());

const validateAdminUserForm = (value = {}, mode = 'create') => {
  const errors = {};
  if (!`${value.fullName || ''}`.trim()) errors.fullName = 'Masukkan nama penuh yang boleh dikenali oleh pentadbir.';
  if (mode !== 'edit' && !isValidAdminEmail(value.email)) errors.email = 'Masukkan alamat e-mel yang sah, contohnya nama@domain.com.';
  const password = `${value.password || ''}`;
  if (mode === 'create' && !password.trim()) errors.password = 'Tetapkan kata laluan sementara untuk akaun baharu.';
  if (password.trim() && password.trim().length < 8) errors.password = 'Kata laluan mesti sekurang-kurangnya 8 aksara.';
  return errors;
};

const mapAdminUser = (u) => ({
  id: u.id,
  name: cleanUserName(u),
  rawName: u.full_name || u.fullName || u.name || '',
  shortId: shortId(u.id),
  email: u.email || '',
  displayEmail: cleanEmailDisplay(u.email, 42, 'Tiada e-mel', u.role),
  role: ROLE_LABEL[u.role] || u.role || 'Pelajar',
  roleValue: ROLE_VALUE[u.role] || u.role || 'student',
  last: u.last || window.timeAgo(u.last_login) || 'Belum log masuk',
  active: Boolean(u.is_active ?? u.active),
});

const mapAdminLog = (log) => {
  const rawMsg = log.message || log.msg || 'Aktiviti sistem';
  return {
    type: log.type || 'info',
    msg: cleanLogMessage(rawMsg),
    rawMsg,
    time: window.timeAgo(log.event_at || log.created_at) || 'Baru sahaja',
  };
};

const patchAdminUser = (userId, payload) => {
  if (window.tusyenApi.updateAdminUser) return window.tusyenApi.updateAdminUser(userId, payload);
  return window.tusyenApi.updateUser(userId, payload);
};

const deactivateAdminParentLink = (linkId) => {
  if (window.tusyenApi.deactivateAdminParentLink) return window.tusyenApi.deactivateAdminParentLink(linkId);
  if (window.tusyenApi.deactivateParentLink) return window.tusyenApi.deactivateParentLink(linkId);
  return window.tusyenApi.deleteAdminParentLink(linkId);
};

const enrollAdminClassroomStudent = (classroomId, identifier) => {
  const value = `${identifier || ''}`.trim();
  const payload = value.includes('@') ? { email:value } : { studentId:value };
  if (window.tusyenApi.enrollAdminClassroomStudent) return window.tusyenApi.enrollAdminClassroomStudent(classroomId, payload);
  if (window.tusyenApi.adminClassroomEnroll) return window.tusyenApi.adminClassroomEnroll(classroomId, payload);
  return window.tusyenApi.addStudentToAdminClassroom(classroomId, value);
};

const contentSummary = (content) => {
  if (!content) return '';
  if (typeof content === 'string') return cleanContentSummary(content);
  return cleanContentSummary(content.summary || content.description || '');
};

const Field = ({ label, children, style }) => (
  <label style={{
    display:'grid',
    gap:4,
    fontSize:10,
    color:C.textMuted,
    fontWeight:900,
    textTransform:'uppercase',
    letterSpacing:.5,
    ...style,
  }}>
    {label}
    {children}
  </label>
);

const Badge = ({ children, tone = 'neutral', style, title, ariaLabel }) => {
  const colors = {
    neutral: { bg:C.accDim, border:C.border, color:C.accPale },
    good:    { bg:'rgba(34,197,94,.10)', border:'rgba(34,197,94,.28)', color:C.green },
    warn:    { bg:'rgba(245,166,35,.10)', border:'rgba(245,166,35,.28)', color:C.gold },
    bad:     { bg:'rgba(239,68,68,.10)', border:'rgba(239,68,68,.28)', color:C.red },
  }[tone] || {};
  return (
    <span title={title} aria-label={ariaLabel} style={{
      display:'inline-flex',
      alignItems:'center',
      border:`1px solid ${colors.border}`,
      background:colors.bg,
      color:colors.color,
      borderRadius:999,
      padding:'2px 7px',
      fontSize:10,
      fontWeight:900,
      whiteSpace:'nowrap',
      ...style,
    }}>{children}</span>
  );
};

const SmallButton = ({ children, onClick, disabled, danger, success, style, title, ariaLabel, ...props }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={ariaLabel}
    {...props}
    style={{
      background: danger ? 'rgba(239,68,68,.10)' : success ? 'rgba(34,197,94,.10)' : C.accDim,
      border:`1px solid ${danger ? 'rgba(239,68,68,.28)' : success ? 'rgba(34,197,94,.28)' : C.border}`,
      borderRadius:9,
      padding:'6px 9px',
      minHeight:44,
      minWidth:44,
      boxSizing:'border-box',
      color: danger ? C.red : success ? C.green : C.accPale,
      fontFamily:'Nunito',
      fontWeight:900,
      fontSize:10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .55 : 1,
      whiteSpace:'nowrap',
      ...style,
    }}
  >{children}</button>
);

const InlineNotice = ({ message, error }) => {
  if (!message) return null;
  return (
    <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} style={{
      fontSize:11,
      color:error ? C.red : C.green,
      fontWeight:900,
      marginBottom:8,
      lineHeight:1.35,
    }}>{message}</div>
  );
};

const ConfirmModal = ({
  title,
  children,
  confirmLabel = 'Sahkan',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  danger,
  busy,
  expectedText,
  expectedLabel = 'Taip nilai pengesahan',
  maxWidth = 420,
}) => {
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => setTyped(''), [expectedText, title]);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  const canConfirm = !expectedText || typed.trim() === expectedText;
  return (
    <div
      role="presentation"
      onClick={() => !busy && onCancel?.()}
      style={{
        position:'fixed',
        inset:0,
        zIndex:500,
        background:'rgba(2,6,23,.68)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        onClick={e => e.stopPropagation()}
        className="tv2-pop"
        style={{
          width:'100%',
          maxWidth,
          background:C.bg,
          border:`1px solid ${danger ? 'rgba(239,68,68,.45)' : C.borderB}`,
          borderRadius:16,
          padding:16,
          boxShadow:'0 24px 70px rgba(0,0,0,.42)',
        }}
      >
        <div id="admin-confirm-title" style={{ fontSize:16, color:danger ? C.red : C.text, fontWeight:900, marginBottom:8 }}>
          {title}
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.45, marginBottom:12 }}>
          {children}
        </div>
        {expectedText && (
          <Field label={expectedLabel} style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.textFaint, fontWeight:600, textTransform:'none', letterSpacing:0, marginBottom:4 }}>
              {expectedText}
            </div>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoFocus
              style={inputBase}
            />
          </Field>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <SmallButton onClick={onCancel} disabled={busy}>{cancelLabel}</SmallButton>
          <SmallButton
            danger={danger}
            success={!danger}
            disabled={busy || !canConfirm}
            onClick={onConfirm}
          >
            {busy ? 'Memproses...' : confirmLabel}
          </SmallButton>
        </div>
      </div>
    </div>
  );
};

const AdminDrawer = ({ title, subtitle, children, onClose, footer, width = 540 }) => {
  const narrow = useNarrow(720);
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position:'fixed',
        inset:0,
        zIndex:490,
        background:'rgba(2,6,23,.68)',
        display:'flex',
        justifyContent:narrow ? 'center' : 'flex-end',
        alignItems:narrow ? 'flex-end' : 'stretch',
        padding:narrow ? '44px 10px 0' : 0,
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
        onClick={e => e.stopPropagation()}
        className={narrow ? 'tv2-sheetup' : 'tv2-slidedown'}
        style={{
          width:narrow ? '100%' : width,
          maxWidth:'100%',
          maxHeight:narrow ? '88vh' : '100vh',
          height:narrow ? 'auto' : '100%',
          background:C.bg,
          border:narrow ? `1px solid ${C.borderB}` : 'none',
          borderLeft:narrow ? undefined : `1px solid ${C.borderB}`,
          borderRadius:narrow ? '18px 18px 0 0' : '18px 0 0 18px',
          boxShadow:'0 24px 70px rgba(0,0,0,.42)',
          display:'flex',
          flexDirection:'column',
          overflow:'hidden',
        }}
      >
        {narrow && <div style={{ width:42, height:4, borderRadius:999, background:C.borderB, margin:'10px auto 0', flexShrink:0 }} />}
        <div style={{
          padding:'14px 16px',
          borderBottom:`1px solid ${C.border}`,
          display:'flex',
          alignItems:'flex-start',
          gap:10,
          background:C.surface,
          flexShrink:0,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div id="admin-drawer-title" style={{ fontSize:16, color:C.text, fontWeight:900, lineHeight:1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize:11, color:C.textFaint, fontWeight:700, marginTop:2, overflowWrap:'anywhere' }}>{subtitle}</div>}
          </div>
          <SmallButton onClick={onClose}>Tutup</SmallButton>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {children}
        </div>
        {footer && (
          <div style={{ borderTop:`1px solid ${C.border}`, padding:12, background:C.surface, flexShrink:0 }}>
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
};

const AdminActionMenu = ({ label = 'Tindakan', ariaLabel, items = [], align = 'right', disabled }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const itemRefs = React.useRef([]);
  const visibleItems = items.filter(item => !item.hidden);
  const focusTrigger = React.useCallback(() => {
    setTimeout(() => ref.current?.querySelector('[data-admin-menu-trigger]')?.focus(), 0);
  }, []);
  const closeMenu = React.useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) focusTrigger();
  }, [focusTrigger]);
  const focusItem = React.useCallback((startIndex, direction = 1) => {
    if (!visibleItems.length) return;
    for (let step = 0; step < visibleItems.length; step += 1) {
      const nextIndex = (startIndex + (step * direction) + visibleItems.length) % visibleItems.length;
      if (!visibleItems[nextIndex]?.disabled) {
        itemRefs.current[nextIndex]?.focus();
        return;
      }
    }
  }, [visibleItems]);
  React.useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') closeMenu(true);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeMenu]);

  React.useEffect(() => {
    if (open) setTimeout(() => focusItem(0, 1), 0);
  }, [open, focusItem]);

  const openFromKey = (event, index, direction) => {
    event.preventDefault();
    if (disabled || visibleItems.length === 0) return;
    setOpen(true);
    setTimeout(() => focusItem(index, direction), 0);
  };

  const onMenuKeyDown = (event, index) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index + 1, 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index - 1, -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0, 1);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusItem(visibleItems.length - 1, -1);
    }
  };

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex', justifyContent:align === 'left' ? 'flex-start' : 'flex-end' }}>
      <SmallButton
        onClick={() => setOpen(v => !v)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') openFromKey(event, 0, 1);
          if (event.key === 'ArrowUp') openFromKey(event, visibleItems.length - 1, -1);
        }}
        disabled={disabled || visibleItems.length === 0}
        ariaLabel={ariaLabel || label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-admin-menu-trigger="true"
        style={{ minWidth:44 }}
      >
        {label}
      </SmallButton>
      {open && (
        <div
          role="menu"
          className="tv2-slidedown"
          style={{
            position:'absolute',
            top:'calc(100% + 6px)',
            [align]:0,
            zIndex:260,
            minWidth:178,
            padding:6,
            background:C.bg,
            border:`1px solid ${C.borderB}`,
            borderRadius:12,
            boxShadow:'0 18px 42px rgba(0,0,0,.34)',
          }}
        >
          {visibleItems.map((item, index) => {
            const danger = item.tone === 'danger';
            const success = item.tone === 'success';
            return (
              <button
                key={`${item.label}-${index}`}
                role="menuitem"
                ref={node => { itemRefs.current[index] = node; }}
                disabled={item.disabled}
                tabIndex={item.disabled ? -1 : 0}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick?.();
                }}
                onKeyDown={event => onMenuKeyDown(event, index)}
                style={{
                  width:'100%',
                  minHeight:44,
                  display:'grid',
                  gap:2,
                  textAlign:'left',
                  background:'transparent',
                  border:'none',
                  borderRadius:8,
                  padding:'8px 9px',
                  color:danger ? C.red : success ? C.green : C.text,
                  fontFamily:'Nunito',
                  fontWeight:900,
                  fontSize:11,
                  cursor:item.disabled ? 'not-allowed' : 'pointer',
                  opacity:item.disabled ? .5 : 1,
                }}
              >
                <span>{item.label}</span>
                {item.description && <span style={{ color:C.textFaint, fontWeight:700, fontSize:9, lineHeight:1.25 }}>{item.description}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminCombobox = ({
  options = [],
  value,
  onChange,
  placeholder = 'Cari...',
  emptyLabel = 'Tiada pilihan',
  loading,
  query,
  onQueryChange,
}) => {
  const [localQuery, setLocalQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const idRef = React.useRef(`admin-combo-${Math.random().toString(36).slice(2)}`);
  const activeQuery = query !== undefined ? query : localQuery;
  const setQuery = onQueryChange || setLocalQuery;
  const selected = options.find(option => option.value === value);
  const normalized = activeQuery.trim().toLowerCase();
  const filtered = normalized
    ? options.filter(option => `${option.label || ''} ${option.description || ''}`.toLowerCase().includes(normalized))
    : options;
  const listId = idRef.current;
  React.useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div ref={ref} style={{ position:'relative', display:'grid', gap:6 }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={activeQuery}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder={selected ? selected.label : placeholder}
        style={inputBase}
      />
      {selected && (
        <div style={{
          display:'flex',
          justifyContent:'space-between',
          gap:8,
          alignItems:'center',
          background:C.accDim,
          border:`1px solid ${C.border}`,
          borderRadius:9,
          padding:'6px 8px',
        }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, color:C.text, fontWeight:900, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selected.label}</div>
            {selected.description && <div style={{ fontSize:9, color:C.textFaint, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selected.description}</div>}
          </div>
          <button
            type="button"
            onClick={() => { onChange(''); setQuery(''); }}
            aria-label="Kosongkan pilihan"
            style={{ minWidth:44, minHeight:44, background:'transparent', border:'none', color:C.textFaint, cursor:'pointer', fontWeight:900, fontFamily:'Nunito' }}
          >x</button>
        </div>
      )}
      {open && (
        <div
          id={listId}
          role="listbox"
          className="tv2-slidedown"
          style={{
            position:'absolute',
            top:46,
            left:0,
            right:0,
            zIndex:250,
            maxHeight:220,
            overflowY:'auto',
            background:C.bg,
            border:`1px solid ${C.borderB}`,
            borderRadius:12,
            padding:6,
            boxShadow:'0 18px 42px rgba(0,0,0,.34)',
          }}
        >
          {loading ? (
            <div style={{ padding:9, color:C.textFaint, fontSize:11, fontWeight:800 }}>Mencari...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:9, color:C.textFaint, fontSize:11, fontWeight:800 }}>{emptyLabel}</div>
          ) : filtered.slice(0, 40).map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange(option.value, option);
                setQuery('');
                setOpen(false);
              }}
              style={{
                width:'100%',
                border:'none',
                background:value === option.value ? C.accDim : 'transparent',
                color:C.text,
                borderRadius:8,
                padding:'8px',
                minHeight:44,
                textAlign:'left',
                cursor:'pointer',
                fontFamily:'Nunito',
              }}
            >
              <div style={{ fontSize:11, fontWeight:900, lineHeight:1.25, overflowWrap:'anywhere' }}>{option.label}</div>
              {option.description && <div style={{ fontSize:9, color:C.textFaint, fontWeight:700, marginTop:1, overflowWrap:'anywhere' }}>{option.description}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const statusTone = (value) => {
  const text = `${value || ''}`.toLowerCase();
  if (['connected', 'healthy', 'ok', 'enabled', 'active'].some(word => text.includes(word))) return 'good';
  if (['error', 'failed', 'down', 'inactive', 'disabled'].some(word => text.includes(word))) return 'bad';
  if (['degraded', 'unknown', 'warn'].some(word => text.includes(word))) return 'warn';
  return 'neutral';
};

const serviceHintLabel = (value) => ({
  connected:'Bersambung',
  healthy:'Sihat',
  ok:'Baik',
  enabled:'Aktif',
  active:'Aktif',
  error:'Ralat',
  failed:'Gagal',
  down:'Tergendala',
  inactive:'Tidak aktif',
  disabled:'Dimatikan',
  degraded:'Terganggu',
  unknown:'Tidak pasti',
}[`${value || ''}`.toLowerCase()] || value || 'Tidak pasti');

const HealthStatusCard = ({ metric }) => {
  const tone = metric.tone || statusTone(metric.hint);
  const color = tone === 'good' ? C.green : tone === 'bad' ? C.red : tone === 'warn' ? C.gold : C.accPale;
  return (
    <Card style={{ padding:12, minHeight:112 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, color:C.text, fontWeight:900, lineHeight:1.25 }}>{metric.label}</div>
          <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, marginTop:2 }}>{metric.detail || 'Status perkhidmatan.'}</div>
        </div>
        <span style={{
          width:10,
          height:10,
          borderRadius:999,
          flexShrink:0,
          background:color,
          boxShadow:`0 0 12px ${color}80`,
          marginTop:3,
        }} />
      </div>
      <Badge tone={tone === 'bad' ? 'bad' : tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'neutral'}>
        {serviceHintLabel(metric.hint)}
      </Badge>
      <div style={{ fontSize:9, color:C.textFaint, fontWeight:700, marginTop:8, lineHeight:1.3 }}>
        {metric.threshold || 'Ambang tidak disediakan oleh API.'}
      </div>
    </Card>
  );
};

const ContentStatusBadge = ({ status }) => {
  const tone = status === 'archive' ? 'warn' : status === 'draft' ? 'neutral' : 'good';
  const label = status === 'archive' ? 'Arkib' : status === 'draft' ? 'Draf' : 'Diterbitkan';
  return <Badge tone={tone}>{label}</Badge>;
};

const maskConfigValue = () => 'Disembunyikan';

const userOption = (user) => ({
  value:user.id,
  label:user.name || displayNameFromEmail(user.email, user.role) || 'Pengguna',
  description:user.displayEmail || cleanEmailDisplay(user.email, 42, '', user.role),
});

const TrendPill = ({ value, label }) => {
  const number = optionalNumber(value);
  if (number === null) {
    return (
      <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:8 }}>
        Trend belum tersedia
      </div>
    );
  }
  const tone = number > 0 ? 'good' : number < 0 ? 'bad' : 'neutral';
  const prefix = number > 0 ? '+' : '';
  return (
    <Badge tone={tone} style={{ marginTop:8 }}>
      {prefix}{fmt(number)} {label}
    </Badge>
  );
};

const HealthMetricRow = ({ metric, showBar = true }) => {
  const value = optionalNumber(metric.val);
  const tone = metric.tone || (value !== null && value >= 80 ? 'good' : value !== null ? 'warn' : 'neutral');
  const color = metric.color || (tone === 'good' ? C.green : tone === 'bad' ? C.red : tone === 'warn' ? C.gold : '#9B8DB8');
  const threshold = metric.threshold || 'Ambang tidak disediakan oleh API.';
  return (
    <div title={threshold} aria-label={`${metric.label}: ${serviceHintLabel(metric.hint)}. ${threshold}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:5 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontWeight:800, fontSize:13, color:C.text }}>
          {metric.label}
          <span
            title={threshold}
            aria-label={`Ambang ${metric.label}: ${threshold}`}
            style={{
              width:17,
              height:17,
              borderRadius:999,
              border:`1px solid ${C.border}`,
              color:C.textFaint,
              display:'inline-flex',
              alignItems:'center',
              justifyContent:'center',
              fontSize:10,
              fontWeight:900,
            }}
          >?</span>
        </span>
        <Badge tone={tone === 'bad' ? 'bad' : tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : 'neutral'}>
          {serviceHintLabel(metric.hint)}
        </Badge>
      </div>
      {metric.detail && (
        <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginBottom:6, lineHeight:1.3 }}>
          {metric.detail}
        </div>
      )}
      {showBar && (
        <div style={{ position:'relative', height:8, borderRadius:999, background:C.accDim, overflow:'hidden' }}>
          {value !== null && (
            <div style={{
              height:'100%',
              width:`${Math.max(0, Math.min(100, value))}%`,
              borderRadius:999,
              background:`linear-gradient(90deg, color-mix(in srgb,${color} 60%,#000), ${color})`,
              boxShadow:`0 0 8px ${color}80`,
              transition:'width .6s ease',
            }} />
          )}
        </div>
      )}
    </div>
  );
};

const useAdminStats = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return SYS_FALLBACK;
    const { stats: s } = await window.tusyenApi.adminStats();
    if (!s) return SYS_FALLBACK;
    const active = metricNumber(s.activities_today);
    const previousActive = optionalNumber(s.activities_previous_day);
    return {
      students: metricNumber(s.total_students),
      teachers: metricNumber(s.total_teachers),
      parents:  metricNumber(s.total_parents),
      active,
      trends:{
        students: optionalNumber(s.new_students_7d),
        teachers: optionalNumber(s.new_teachers_7d),
        parents: optionalNumber(s.new_parents_7d),
        active: previousActive === null ? null : active - previousActive,
      },
    };
  }, [], SYS_FALLBACK);
};

const useAdminHealth = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return METRICS_FALLBACK;
    const h = await window.tusyenApi.adminHealth();
    if (!h) return METRICS_FALLBACK;
    const upDb = h.database === 'connected';
    const upCache = h.cache === 'connected';
    const notif = h.notifications || {};
    const upNotif = notif.enabled === false || notif.connected === true || notif.status === 'ok';
    const dbSize = h.storage?.database_size || 'Tidak pasti';
    const files = optionalNumber(h.storage?.total_files);
    return [
      { label:'Pangkalan Data', val:null, color:upDb ? C.green : C.red, hint:h.database || 'unknown', tone:upDb ? 'good' : 'bad', detail:'Status sambungan pangkalan data.', threshold:'Baik: connected. Kritikal: error atau tiada sambungan.' },
      { label:'Cache (Redis)',  val:null, color:upCache ? C.blue : C.red, hint:h.cache || 'unknown', tone:upCache ? 'good' : 'bad', detail:'Status sambungan Redis cache.', threshold:'Baik: connected. Kritikal: error atau tiada sambungan.' },
      { label:'Notifikasi',     val:null, color:upNotif ? '#A78BFA' : C.gold, hint:notif.enabled === false ? 'disabled' : (notif.connected ? 'connected' : (notif.status || 'degraded')), tone:upNotif ? 'good' : 'warn', detail:notif.enabled === false ? 'Notifikasi dimatikan melalui konfigurasi.' : 'Status sambungan ntfy.', threshold:'Baik: connected/ok atau disabled secara sengaja. Amaran: degraded/unknown.' },
      { label:'Storan',         val:null, color:C.gold, hint:dbSize, tone:'neutral', detail:`Fail aktif: ${files === null ? 'Tidak tersedia' : fmt(files)}`, threshold:'API semasa hanya memaparkan saiz DB dan jumlah fail; tiada ambang kapasiti.' },
    ];
  }, [], METRICS_FALLBACK);
};

const useAdminLogs = ({ limit = 12, offset = 0 } = {}) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return { logs:[], total:0, limit, offset };
    const data = await window.tusyenApi.adminLogs({ limit, offset });
    return {
      logs: (data.logs || []).map(mapAdminLog),
      total: metricNumber(data.total, (data.logs || []).length),
      limit: metricNumber(data.limit, limit),
      offset: metricNumber(data.offset, offset),
    };
  }, [limit, offset], { logs:[], total:0, limit, offset });
};

const useAdminUsers = ({ filter, search, page, limit }) => {
  const state = useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return { users:[], total:0 };
    const role = filter === 'Semua' ? undefined : ROLE_VALUE[filter];
    const data = await window.tusyenApi.adminUsers({
      role,
      search: search.trim() || undefined,
      limit,
      offset: page * limit,
    });
    return {
      users: (data.users || []).map(mapAdminUser),
      total: metricNumber(data.total, (data.users || []).length),
    };
  }, [filter, search, page, limit], { users:[], total:0 });
  return {
    users: state.data?.users || [],
    total: state.data?.total || 0,
    loading: state.loading,
    error: state.error,
    refresh: state.refresh,
  };
};

const useAdminSyllabus = ({ subject, formLevel }) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return [];
    const data = await window.tusyenApi.adminSyllabus({
      subject: subject.trim() || undefined,
      formLevel: formLevel === 'Semua' ? undefined : formLevel,
    });
    return data.syllabus || [];
  }, [subject, formLevel], []);
};

const useAdminLessons = ({ subject, formLevel }) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return [];
    const data = await window.tusyenApi.adminLessons({
      subject: subject.trim() || undefined,
      formLevel: formLevel === 'Semua' ? undefined : formLevel,
      limit:30,
    });
    return data.lessons || [];
  }, [subject, formLevel], []);
};

const useAdminSystem = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return null;
    return window.tusyenApi.adminSystem();
  }, [], null);
};

const createEmptyQuizQuestion = () => ({
  id:`q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type:'multiple_choice',
  questionText:'',
  options:['', '', '', ''],
  correctOption:'0',
  trueFalseAnswer:'true',
  explanation:'',
});

const normalizeAdminQuizQuestion = (question) => {
  const questionText = `${question.questionText || ''}`.trim();
  if (!questionText) return null;

  if (question.type === 'true_false') {
    return {
      questionText,
      questionType:'true_false',
      correctAnswer: question.trueFalseAnswer === 'true',
      explanation: `${question.explanation || ''}`.trim(),
    };
  }

  const options = (question.options || []).map(option => `${option || ''}`.trim()).filter(Boolean);
  if (options.length < 2) {
    throw new Error('MCQ perlukan sekurang-kurangnya dua pilihan jawapan.');
  }

  const correctAnswer = Math.max(0, Math.min(options.length - 1, Number(question.correctOption) || 0));
  return {
    questionText,
    questionType:'multiple_choice',
    options,
    correctAnswer,
    explanation: `${question.explanation || ''}`.trim(),
  };
};

const AdminDash = ({ go }) => {
  const statsState = useAdminStats();
  const healthState = useAdminHealth();
  const auditPageSize = 20;
  const [logOffset, setLogOffset] = React.useState(0);
  const [loadedLogs, setLoadedLogs] = React.useState([]);
  const [loadedLogTotal, setLoadedLogTotal] = React.useState(0);
  const [logFilter, setLogFilter] = React.useState('all');
  const logsState = useAdminLogs({ limit:auditPageSize, offset:logOffset });
  const narrow = useNarrow(520);
  const [actionBusy, setActionBusy] = React.useState('');
  const [notice, setNotice] = React.useState(null);
  const [confirmCache, setConfirmCache] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(null);
  const SYS = statsState.data || SYS_FALLBACK;
  const METRICS = healthState.data || METRICS_FALLBACK;
  const LOGS = loadedLogs;
  const logTotal = metricNumber(loadedLogTotal, LOGS.length);
  const hasMoreLogs = LOGS.length < logTotal;
  const logCounts = React.useMemo(() => LOGS.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, { all:LOGS.length }), [LOGS]);
  const logFilters = [
    { id:'all', label:'Semua' },
    { id:'warn', label:'Amaran' },
    { id:'success', label:'Berjaya' },
    { id:'info', label:'Maklumat' },
  ];
  const logTypeLabel = { warn:'Amaran', success:'Berjaya', info:'Maklumat' };
  const filteredLogs = LOGS.filter(log => logFilter === 'all' || log.type === logFilter);
  const groupedLogs = ['warn', 'success', 'info']
    .map(type => ({ type, logs:filteredLogs.filter(log => log.type === type) }))
    .filter(group => group.logs.length > 0);

  React.useEffect(() => {
    if (logsState.loading || logsState.error) return;
    const nextLogs = logsState.data?.logs || [];
    setLoadedLogTotal(metricNumber(logsState.data?.total, nextLogs.length));
    setLoadedLogs(prev => logOffset === 0 ? nextLogs : [...prev, ...nextLogs]);
  }, [logsState.data, logsState.loading, logsState.error, logOffset]);

  const refreshAll = React.useCallback(() => {
    statsState.refresh();
    healthState.refresh();
    setLoadedLogs([]);
    setLoadedLogTotal(0);
    setLogOffset(0);
    logsState.refresh();
    setLastRefresh(new Date());
  }, [statsState.refresh, healthState.refresh, logsState.refresh]);

  React.useEffect(() => {
    const id = setInterval(refreshAll, 30000);
    return () => clearInterval(id);
  }, [refreshAll]);

  React.useEffect(() => {
    if (!statsState.loading && !healthState.loading && !logsState.loading) setLastRefresh(new Date());
  }, [statsState.loading, healthState.loading, logsState.loading, logOffset]);

  const clearCache = async (confirmed = false) => {
    if (confirmed !== true) {
      setConfirmCache(true);
      return;
    }
    setActionBusy('cache');
    setNotice({ message:'Membersihkan cache...', error:false });
    try {
      await window.tusyenApi.clearAdminCache();
      setNotice({ message:'Cache berjaya dibersihkan.', error:false });
      refreshAll();
    } catch (err) {
      setNotice({ message:err.message || 'Tidak dapat membersihkan cache.', error:true });
    } finally {
      setActionBusy('');
    }
  };

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:8, flexWrap:narrow ? 'wrap' : 'nowrap' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>Panel Admin</div>
          <div style={{ fontSize:21, fontWeight:900, color:C.text, lineHeight:1.15 }}>Tusyen Online</div>
          <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:2 }}>
            {lastRefresh ? `Kemas kini terakhir: ${formatDateTime(lastRefresh.toISOString())}` : 'Auto-refresh setiap 30s'}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <SmallButton onClick={refreshAll}>Segar</SmallButton>
          <Badge tone={healthState.error ? 'warn' : 'good'}>
            {healthState.error ? 'Semak' : 'Sistem Aktif'}
          </Badge>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr' : '1fr 1fr', gap:8, marginBottom:14 }}>
        {statsState.error ? (
          <ErrorRetry message="Statistik admin tidak dapat dimuat." onRetry={statsState.refresh} />
        ) : statsState.loading ? [0,1,2,3].map(i => (
          <Card key={i} style={{ padding:14 }}>
            <Skeleton width={58} height={26} radius={8} style={{ marginBottom:8 }} />
            <Skeleton width="68%" height={12} radius={6} />
          </Card>
        )) : [
          { v:SYS.students, l:'Pelajar', c:C.acc, trend:SYS.trends?.students, trendLabel:'baru 7 hari' },
          { v:SYS.teachers, l:'Guru', c:C.blue, trend:SYS.trends?.teachers, trendLabel:'baru 7 hari' },
          { v:SYS.parents,  l:'Ibu Bapa', c:C.gold, trend:SYS.trends?.parents, trendLabel:'baru 7 hari' },
          { v:SYS.active,   l:'Aktif Hari Ini', c:C.green, trend:SYS.trends?.active, trendLabel:'vs 24j lalu' },
        ].map((s) => (
          <Card key={s.l} style={{ padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
              <div>
                <div style={{ fontWeight:900, fontSize:26, color:s.c, lineHeight:1 }}>{fmt(s.v)}</div>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:3 }}>{s.l}</div>
                <TrendPill value={s.trend} label={s.trendLabel} />
              </div>
              <div style={{
                width:28, height:28, borderRadius:9, background:C.accDim,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:900, color:s.c,
              }}>{initials(s.l)}</div>
            </div>
          </Card>
        ))}
      </div>

      <SectionLabel>Kesihatan Sistem</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap:8, marginBottom:14 }}>
        {healthState.loading ? [0,1,2,3].map(i => (
          <Card key={i} style={{ padding:12, minHeight:112 }}>
            <Skeleton width="66%" height={13} radius={7} style={{ marginBottom:8 }} />
            <Skeleton width="82%" height={10} radius={5} style={{ marginBottom:12 }} />
            <Skeleton width={72} height={18} radius={999} />
          </Card>
        )) : METRICS.map((m, i) => (
          <HealthStatusCard key={m.label || i} metric={m} />
        ))}
      </div>

      <SectionLabel>Log Sistem</SectionLabel>
      <Card style={{ marginBottom:14, padding:'10px 14px' }}>
        {logsState.loading && LOGS.length === 0 ? [0,1,2,3,4].map(i => (
          <div key={i} style={{
            display:'flex', gap:8, padding:'7px 0',
            borderBottom: i < 4 ? `1px solid ${C.border}` : 'none',
          }}>
            <Skeleton width={20} height={20} radius={8} />
            <div style={{ flex:1 }}>
              <Skeleton width={i % 2 ? '72%' : '86%'} height={12} radius={6} style={{ marginBottom:6 }} />
              <Skeleton width={54} height={10} radius={5} />
            </div>
          </div>
        )) : logsState.error ? (
          <ErrorRetry message="Log sistem tidak dapat dimuat." onRetry={logsState.refresh} />
        ) : LOGS.length === 0 ? (
          <div style={{ color:C.textFaint, fontSize:12, fontWeight:800, padding:'10px 0' }}>
            Tiada aktiviti sistem terkini.
          </div>
        ) : (
          <>
            <div style={{
              display:'flex',
              gap:6,
              flexWrap:'wrap',
              paddingBottom:8,
              marginBottom:2,
            }}>
              {logFilters.map(item => (
                <button key={item.id} onClick={() => setLogFilter(item.id)} aria-pressed={logFilter === item.id} style={{
                  background:logFilter === item.id ? C.accDim : 'transparent',
                  border:`1px solid ${logFilter === item.id ? C.borderB : C.border}`,
                  borderRadius:999,
                  color:logFilter === item.id ? C.accPale : C.textMuted,
                  padding:'8px 11px',
                  minHeight:44,
                  flex:narrow ? '1 1 126px' : '0 0 auto',
                  fontFamily:'Nunito',
                  fontSize:11,
                  fontWeight:900,
                  cursor:'pointer',
                }}>
                  {item.label} ({fmt(logCounts[item.id] || 0)})
                </button>
              ))}
            </div>
            {groupedLogs.length === 0 ? (
              <div style={{ color:C.textFaint, fontSize:12, fontWeight:800, padding:'10px 0' }}>
                Tiada log untuk penapis ini.
              </div>
            ) : groupedLogs.map(group => (
              <div key={group.type} style={{ marginBottom:8 }}>
                <div style={{ fontSize:10, color:logColor(group.type), fontWeight:900, textTransform:'uppercase', letterSpacing:.5, margin:'7px 0 2px' }}>
                  {logTypeLabel[group.type] || group.type}
                </div>
                {group.logs.map((log, i) => (
                  <div key={`${group.type}-${log.msg}-${i}`} style={{
                    display:'flex', gap:8, padding:'7px 0',
                    borderBottom: i < group.logs.length - 1 ? `1px solid ${C.border}` : 'none',
                    alignItems:'flex-start',
                  }}>
                    <span style={{
                      width:20, height:20, borderRadius:8, flexShrink:0,
                      background:`color-mix(in srgb, ${logColor(log.type)} 16%, transparent)`,
                      color:logColor(log.type), border:`1px solid color-mix(in srgb, ${logColor(log.type)} 35%, transparent)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:9, fontWeight:900,
                    }}>{logIcon(log.type)}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div title={log.msg} style={{ fontSize:12, color:C.text, fontWeight:700, lineHeight:1.35, overflowWrap:'anywhere' }}>{log.msg}</div>
                      <div style={{ fontSize:10, color:C.textFaint, marginTop:1 }}>{log.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, paddingTop:10, flexWrap:'wrap' }}>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>
                Memaparkan {fmt(filteredLogs.length)} daripada {fmt(logTotal)} log
              </div>
              {hasMoreLogs && (
                <SmallButton disabled={logsState.loading} onClick={() => setLogOffset(LOGS.length)}>
                  {logsState.loading ? 'Memuat...' : 'Muat 20 lagi'}
                </SmallButton>
              )}
            </div>
          </>
        )}
      </Card>

      <SectionLabel>Tindakan Pantas</SectionLabel>
      <InlineNotice message={notice?.message} error={notice?.error} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        {[
          { label:'Urus Pengguna',  icon:'👥', screen:'users',   badge:'Buka',    tone:'neutral' },
          { label:'Kelola Silibus', icon:'📚', screen:'content', badge:'Buka',    tone:'neutral' },
          { label:'Paksa Sinkron',  icon:'🔄', disabled:true,    badge:'Peranti', tone:'warn', note:'Gunakan sync dari peranti pengguna.' },
          { label:'Bersih Cache',   icon:'🧹', action:clearCache, disabled:actionBusy === 'cache', badge:actionBusy === 'cache' ? 'Proses' : 'Sedia', tone:'good', note:'Kosongkan Redis cache.' },
        ].map((a) => (
          <Card
            key={a.label}
            style={{ padding:12, opacity:a.disabled ? .64 : 1 }}
            onClick={a.disabled ? undefined : (a.screen ? () => go(a.screen) : a.action)}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, gap:8 }}>
              <div style={{
                width:30, height:30, borderRadius:10, background:C.accDim,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16,
              }}>{a.icon}</div>
              <Badge tone={a.tone}>{a.badge}</Badge>
            </div>
            <div style={{ fontSize:12, fontWeight:900, color:C.text, lineHeight:1.2 }}>{a.label}</div>
            {a.note && <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:4, lineHeight:1.25 }}>{a.note}</div>}
          </Card>
        ))}
      </div>
      {confirmCache && (
        <ConfirmModal
          title="Bersihkan cache?"
          confirmLabel="Bersih Cache"
          danger
          busy={actionBusy === 'cache'}
          onCancel={() => setConfirmCache(false)}
          onConfirm={async () => { setConfirmCache(false); await clearCache(true); }}
        >
          Cache laporan dan leaderboard akan dijana semula selepas tindakan ini.
        </ConfirmModal>
      )}
    </div>
  );
};

const FormFieldError = ({ id, children }) => {
  if (!children) return null;
  return (
    <div id={id} role="alert" style={{ fontSize:10, color:C.red, fontWeight:800, lineHeight:1.35 }}>
      {children}
    </div>
  );
};

const UserForm = ({ mode, value, onChange, onSave, onCancel, saving, errors = {} }) => {
  const passwordHelp = mode === 'create'
    ? 'Gunakan sekurang-kurangnya 8 aksara. Kongsi kata laluan sementara melalui saluran selamat dan minta pengguna menukarnya selepas log masuk.'
    : 'Biarkan kosong jika kata laluan tidak perlu diubah. Isi hanya apabila admin perlu menetapkan semula akses.';
  return (
    <Card style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontWeight:900, fontSize:13, color:C.accPale }}>
          {mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna'}
        </div>
        <Badge tone={value.isActive ? 'good' : 'warn'}>{statusText(value.isActive)}</Badge>
      </div>
      <div style={{ display:'grid', gap:8 }}>
        <Field label="Nama Penuh">
          <input
            value={value.fullName}
            onChange={e => onChange(prev => ({ ...prev, fullName:e.target.value }))}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'admin-user-name-error' : undefined}
            style={inputBase}
          />
          <FormFieldError id="admin-user-name-error">{errors.fullName}</FormFieldError>
        </Field>
        <Field label="E-mel">
          <input
            type="email"
            value={value.email}
            onChange={e => onChange(prev => ({ ...prev, email:e.target.value }))}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'admin-user-email-error' : undefined}
            style={inputBase}
          />
          <FormFieldError id="admin-user-email-error">{errors.email}</FormFieldError>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Peranan">
            <select
              value={value.roleValue}
              onChange={e => onChange(prev => ({ ...prev, roleValue:e.target.value }))}
              style={inputBase}
            >
              {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={value.isActive ? 'true' : 'false'}
              onChange={e => onChange(prev => ({ ...prev, isActive:e.target.value === 'true' }))}
              style={inputBase}
            >
              <option value="true">Aktif</option>
              <option value="false">Tidak aktif</option>
            </select>
          </Field>
        </div>
        <div style={{
          border:`1px solid ${C.border}`,
          background:C.surface,
          borderRadius:10,
          padding:'8px 10px',
          fontSize:11,
          color:C.textMuted,
          fontWeight:800,
          lineHeight:1.4,
        }}>
          <span style={{ color:C.accPale, fontWeight:900 }}>{ROLE_OPTIONS.find(r => r.value === value.roleValue)?.label || 'Peranan'}:</span>{' '}
          {ROLE_DESCRIPTIONS[value.roleValue] || 'Pilih peranan untuk menentukan akses pengguna.'}
        </div>
        <Field label={mode === 'create' ? 'Kata Laluan Sementara' : 'Reset Kata Laluan'}>
          <input
            type="password"
            value={value.password || ''}
            onChange={e => onChange(prev => ({ ...prev, password:e.target.value }))}
            placeholder={mode === 'create' ? 'Minimum 8 aksara' : 'Biarkan kosong jika tidak reset'}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'admin-user-password-error admin-user-password-help' : 'admin-user-password-help'}
            style={inputBase}
          />
          <div id="admin-user-password-help" style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.35 }}>
            {passwordHelp}
          </div>
          <FormFieldError id="admin-user-password-error">{errors.password}</FormFieldError>
        </Field>
        <div style={{ display:'flex', gap:8 }}>
          <GlowButton onClick={onSave} disabled={saving} style={{ flex:1, padding:'10px 12px', fontSize:13 }}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </GlowButton>
          <SmallButton onClick={onCancel} style={{ padding:'0 14px' }}>Batal</SmallButton>
        </div>
      </div>
    </Card>
  );
};

const UserEditModal = ({ value, onChange, onSave, onCancel, saving, errors = {} }) => {
  if (!value) return null;
  return (
    <div
      role="presentation"
      onClick={() => !saving && onCancel?.()}
      style={{
        position:'fixed',
        inset:0,
        zIndex:520,
        background:'rgba(2,6,23,.68)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-edit-title"
        onClick={e => e.stopPropagation()}
        className="tv2-pop"
        style={{
          width:'100%',
          maxWidth:430,
          background:C.bg,
          border:`1px solid ${C.borderB}`,
          borderRadius:16,
          padding:16,
          boxShadow:'0 24px 70px rgba(0,0,0,.42)',
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:12 }}>
          <div style={{ minWidth:0 }}>
            <div id="admin-user-edit-title" style={{ fontWeight:900, fontSize:16, color:C.text }}>Edit Pengguna</div>
            <div title={value.email || ''} style={{ fontSize:11, color:C.textFaint, fontWeight:700, overflowWrap:'anywhere', marginTop:2 }}>
              {cleanEmailDisplay(value.email, 48, 'Tiada e-mel', value.roleValue)}
            </div>
          </div>
          <Badge tone={value.isActive ? 'good' : 'warn'}>{statusText(value.isActive)}</Badge>
        </div>
        <div style={{ display:'grid', gap:9 }}>
          <Field label="Nama Penuh">
            <input
              value={value.fullName}
              onChange={e => onChange(prev => ({ ...prev, fullName:e.target.value }))}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'admin-edit-user-name-error' : undefined}
              autoFocus
              style={inputBase}
            />
            <FormFieldError id="admin-edit-user-name-error">{errors.fullName}</FormFieldError>
          </Field>
          <Field label="Peranan">
            <select
              value={value.roleValue}
              onChange={e => onChange(prev => ({ ...prev, roleValue:e.target.value }))}
              style={inputBase}
            >
              {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <div style={{
            border:`1px solid ${C.border}`,
            background:C.surface,
            borderRadius:10,
            padding:'8px 10px',
            fontSize:11,
            color:C.textMuted,
            fontWeight:800,
            lineHeight:1.4,
          }}>
            <span style={{ color:C.accPale, fontWeight:900 }}>{ROLE_OPTIONS.find(r => r.value === value.roleValue)?.label || 'Peranan'}:</span>{' '}
            {ROLE_DESCRIPTIONS[value.roleValue] || 'Pilih peranan untuk menentukan akses pengguna.'}
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
            <SmallButton onClick={onCancel} disabled={saving}>Batal</SmallButton>
            <GlowButton onClick={onSave} disabled={saving} style={{ padding:'10px 14px', fontSize:13, flex:'0 0 auto' }}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </GlowButton>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div style={{
    display:'flex',
    justifyContent:'space-between',
    flexWrap:'wrap',
    gap:12,
    padding:'7px 0',
    borderBottom:`1px solid ${C.border}`,
  }}>
    <div style={{ fontSize:11, color:C.textMuted, fontWeight:900 }}>{label}</div>
    <div style={{ minWidth:0, fontSize:11, color:C.text, fontWeight:800, textAlign:'right', overflowWrap:'anywhere' }}>
      {value || 'Tiada data'}
    </div>
  </div>
);

const UserDetailModal = ({ detail, onClose, onRetry }) => {
  if (!detail?.id) return null;
  const data = detail.data || {};
  const user = data.user || detail.user || {};
  const userDisplayName = cleanUserName(user);
  const userDisplayEmail = cleanEmailDisplay(user.email, 48, 'Tiada e-mel', user.role);
  const links = data.parentLinks || [];
  const owned = data.classroomsOwned || [];
  const enrolled = data.classroomEnrollments || [];
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position:'fixed',
        inset:0,
        zIndex:480,
        background:'rgba(2,6,23,.68)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-detail-title"
        onClick={e => e.stopPropagation()}
        className="tv2-pop"
        style={{
          width:'100%',
          maxWidth:520,
          maxHeight:'86vh',
          overflowY:'auto',
          background:C.bg,
          border:`1px solid ${C.borderB}`,
          borderRadius:16,
          padding:16,
          boxShadow:'0 24px 70px rgba(0,0,0,.42)',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <Avatar name={userDisplayName} size={42} src={user.avatar_url} />
          <div style={{ flex:1, minWidth:0 }}>
            <div id="admin-user-detail-title" style={{ fontSize:15, color:C.text, fontWeight:900, lineHeight:1.2 }}>
              {userDisplayName}
            </div>
            <div title={userDisplayEmail} style={{ fontSize:11, color:C.textFaint, fontWeight:800, overflowWrap:'anywhere' }}>{userDisplayEmail}</div>
          </div>
          <SmallButton onClick={onClose}>Tutup</SmallButton>
        </div>

        {detail.loading ? (
          <div style={{ display:'grid', gap:8 }}>
            {[0,1,2,3,4].map(i => <Skeleton key={i} width="100%" height={22} radius={8} />)}
          </div>
        ) : detail.error ? (
          <ErrorRetry message={detail.error} onRetry={onRetry} />
        ) : (
          <>
            <SectionLabel>Profil</SectionLabel>
            <Card style={{ marginBottom:12, padding:'10px 14px' }}>
              <DetailRow label="Ref Pengguna" value={shortId(user.id || detail.id)} />
              <DetailRow label="Peranan" value={ROLE_LABEL[user.role] || user.role} />
              <DetailRow label="Status" value={statusText(Boolean(user.is_active ?? user.active))} />
              <DetailRow label="Telefon" value={user.phone_number || user.phoneNumber} />
              <DetailRow label="Tarikh lahir" value={user.date_of_birth || user.dateOfBirth} />
              <DetailRow label="Dicipta" value={formatDateTime(user.created_at || user.createdAt)} />
              <DetailRow label="Log masuk terakhir" value={formatDateTime(user.last_login || user.lastLogin)} />
            </Card>

            <SectionLabel>Kelas & Pautan</SectionLabel>
            <Card style={{ padding:'10px 14px' }}>
              <div style={{ display:'grid', gap:8 }}>
                <div>
                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:900, marginBottom:5 }}>Kelas diajar</div>
                  {owned.length === 0 ? (
                    <div style={{ fontSize:11, color:C.textFaint, fontWeight:800 }}>Tiada kelas diajar.</div>
                  ) : owned.map(c => (
                    <div key={c.id} style={{ fontSize:11, color:C.text, fontWeight:800, padding:'4px 0' }}>
                      {cleanClassName(c.name)} - {cleanSubjectLabel(c.subject)} T{c.form_level || '-'}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:900, marginBottom:5 }}>Kelas disertai</div>
                  {enrolled.length === 0 ? (
                    <div style={{ fontSize:11, color:C.textFaint, fontWeight:800 }}>Tiada kelas disertai.</div>
                  ) : enrolled.map(c => (
                    <div key={c.id} style={{ fontSize:11, color:C.text, fontWeight:800, padding:'4px 0' }}>
                      {cleanClassName(c.name)} - {cleanSubjectLabel(c.subject)} T{c.form_level || '-'}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:900, marginBottom:5 }}>Pautan ibu bapa-pelajar</div>
                  {links.length === 0 ? (
                    <div style={{ fontSize:11, color:C.textFaint, fontWeight:800 }}>Tiada pautan aktif.</div>
                  ) : links.map(link => (
                    <div key={link.id} style={{ fontSize:11, color:C.text, fontWeight:800, padding:'4px 0' }}>
                      {cleanPersonName(link.parent_name || link.parentName, link.parent_email || link.parentEmail, 'parent', 'Ibu Bapa')} -> {cleanPersonName(link.student_name || link.studentName, link.student_email || link.studentEmail, 'student', 'Pelajar')}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

const AdminUsers = () => {
  const [searchText, setSearchText] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('Semua');
  const [page, setPage] = React.useState(0);
  const [editing, setEditing] = React.useState(null);
  const [creating, setCreating] = React.useState(null);
  const [formErrors, setFormErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [mutationError, setMutationError] = React.useState(null);
  const [selected, setSelected] = React.useState(new Set());
  const [confirmBulk, setConfirmBulk] = React.useState(null);
  const [confirmStatus, setConfirmStatus] = React.useState(null);
  const [detail, setDetail] = React.useState({ id:null, loading:false, error:null, data:null, user:null });
  const narrow = useNarrow(760);
  const filters = ['Semua','Pelajar','Guru','Ibu Bapa','Admin'];
  const pageSize = 25;
  const { users, total, loading, error, refresh } = useAdminUsers({ filter, search, page, limit:pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min(total, (page + 1) * pageSize);
  const visibleRoleCounts = React.useMemo(() => users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {}), [users]);

  React.useEffect(() => setPage(0), [filter, search]);
  React.useEffect(() => setSelected(new Set()), [filter, search, page]);
  React.useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const startCreate = () => {
    setCreating({ fullName:'', email:'', password:'', roleValue:'student', isActive:true });
    setEditing(null);
    setFormErrors({});
    setMessage('');
    setMutationError(null);
  };

  const startEdit = (u) => {
    setEditing({ ...u, fullName:u.rawName || u.name, password:'', isActive:u.active, roleValue:u.roleValue });
    setCreating(null);
    setFormErrors({});
    setMessage('');
    setMutationError(null);
  };

  const applySearch = () => {
    setSearch(searchText.trim());
  };

  const clearSearch = () => {
    setSearchText('');
    setSearch('');
  };

  const openDetail = async (u) => {
    if (!u?.id) return;
    setDetail({ id:u.id, loading:true, error:null, data:null, user:u });
    try {
      const data = await window.tusyenApi.adminUser(u.id);
      setDetail({ id:u.id, loading:false, error:null, data, user:u });
    } catch (err) {
      setDetail({ id:u.id, loading:false, error:err.message || 'Butiran pengguna tidak dapat dimuat.', data:null, user:u });
    }
  };

  const saveCreate = async () => {
    if (!creating) return;
    const errors = validateAdminUserForm(creating, 'create');
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setMutationError({ message:'Semak medan bertanda sebelum mencipta pengguna.' });
      return;
    }
    setSaving(true);
    setMessage('');
    setMutationError(null);
    try {
      await window.tusyenApi.createAdminUser({
        fullName: creating.fullName,
        email: creating.email,
        password: creating.password,
        role: creating.roleValue,
        isActive: creating.isActive,
      });
      setMessage('Pengguna baharu berjaya dicipta.');
      setCreating(null);
      refresh();
    } catch (err) {
      setMutationError({ message: err.message || 'Tidak dapat mencipta pengguna.', retry: saveCreate });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const errors = validateAdminUserForm(editing, 'edit');
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setMutationError({ message:'Semak medan bertanda sebelum menyimpan pengguna.' });
      return;
    }
    setSaving(true);
    setMessage('');
    setMutationError(null);
    try {
      const payload = {
        full_name: editing.fullName.trim(),
        role: editing.roleValue,
      };
      await patchAdminUser(editing.id, payload);
      setMessage('Pengguna dikemas kini.');
      setEditing(null);
      refresh();
    } catch (err) {
      setMutationError({ message: err.message || 'Tidak dapat menyimpan pengguna.', retry: saveEdit });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    if (!u.id) return;
    setMessage('');
    setMutationError(null);
    try {
      await window.tusyenApi.toggleUserStatus(u.id, !u.active);
      setMessage(u.active ? 'Pengguna dinyahaktifkan.' : 'Pengguna diaktifkan.');
      setConfirmStatus(null);
      refresh();
    } catch (err) {
      setMutationError({ message: err.message || 'Tidak dapat menukar status.', retry: () => toggleStatus(u) });
    }
  };

  const requestStatus = (u) => {
    if (!u?.id) return;
    setConfirmStatus({ user:u, isActive:!u.active });
  };

  const requestBulkStatus = (isActive) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const names = users.filter(u => ids.includes(u.id)).map(u => u.name).slice(0, 4);
    setConfirmBulk({ isActive, ids, names });
  };

  const bulkStatus = async (isActive, ids = Array.from(selected)) => {
    if (ids.length === 0) return;
    setSaving(true);
    setMessage('');
    setMutationError(null);
    try {
      await window.tusyenApi.updateUserStatuses(ids, isActive);
      setMessage(`${ids.length} pengguna ${isActive ? 'diaktifkan' : 'dinyahaktifkan'}.`);
      setSelected(new Set());
      setConfirmBulk(null);
      refresh();
    } catch (err) {
      setMutationError({ message: err.message || 'Tindakan pukal gagal.', retry: () => bulkStatus(isActive, ids) });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableUsers = users.filter(u => u.id);
  const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selected.has(u.id));
  const togglePageSelection = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) selectableUsers.forEach(u => next.delete(u.id));
      else selectableUsers.forEach(u => next.add(u.id));
      return next;
    });
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px 0', flexShrink:0, position:'sticky', top:0, zIndex:30, background:C.bg, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:narrow ? 'wrap' : 'nowrap' }}>
          <div style={{
            flex:'1 1 220px', minWidth:0, display:'flex', alignItems:'center', gap:8,
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:12, padding:'8px 10px',
            minHeight:44,
          }}>
            <span style={{ fontSize:14, color:C.textFaint, fontWeight:600 }}>🔍</span>
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySearch(); }}
              placeholder="Cari nama atau e-mel..."
              aria-label="Cari pengguna mengikut nama atau e-mel"
              style={{
                flex:1, minWidth:0, background:'none', border:'none', outline:'none',
                fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:C.text,
                minHeight:44,
              }}
            />
            {(searchText || search) && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Kosongkan carian pengguna"
                style={{
                background:'none', border:'none', cursor:'pointer',
                fontSize:13, color:C.textFaint, fontFamily:'Nunito', padding:0,
                minWidth:44, minHeight:44, fontWeight:900,
              }}>x</button>
            )}
          </div>
          <SmallButton onClick={applySearch} disabled={loading && searchText.trim() === search} style={{ flex:narrow ? '1 1 108px' : '0 0 auto' }}>Cari</SmallButton>
          <SmallButton onClick={startCreate} style={{ padding:'0 11px', flex:narrow ? '1 1 108px' : '0 0 auto' }}>Tambah</SmallButton>
        </div>

        {narrow ? (
          <Field label="Tapis Peranan" style={{ marginBottom:8 }}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={inputBase}>
              {filters.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        ) : (
          <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} style={{
                background: filter === f ? C.accDim : 'transparent',
                border:`1.5px solid ${filter === f ? C.borderB : C.border}`,
                borderRadius:20, padding:'8px 14px',
                minHeight:44,
                fontSize:11, fontWeight:800, cursor:'pointer',
                color: filter === f ? C.accPale : C.textMuted,
                fontFamily:'Nunito', transition:'all .2s',
              }}>{f}</button>
            ))}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <div style={{ flex:'1 1 180px', minWidth:0, fontSize:11, color:C.textFaint, fontWeight:800, lineHeight:1.35 }}>
            <div>{fmt(total)} pengguna</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5 }}>
              <Badge tone="neutral">Pelajar {fmt(visibleRoleCounts.Pelajar || 0)}</Badge>
              <Badge tone="neutral">Guru {fmt(visibleRoleCounts.Guru || 0)}</Badge>
              <Badge tone="neutral">Ibu Bapa {fmt(visibleRoleCounts['Ibu Bapa'] || 0)}</Badge>
            </div>
            <div>Memaparkan {fmt(pageStart)}-{fmt(pageEnd)} · {pageSize} setiap halaman</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:narrow ? 'flex-start' : 'flex-end' }}>
            <SmallButton disabled={page <= 0 || loading} onClick={() => setPage(0)} ariaLabel="Halaman pengguna pertama">«</SmallButton>
            <SmallButton disabled={page <= 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))} ariaLabel="Halaman pengguna sebelumnya">Sebelum</SmallButton>
            <span style={{ fontSize:10, color:C.textMuted, fontWeight:900 }}>{page + 1}/{totalPages}</span>
            <SmallButton disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)} ariaLabel="Halaman pengguna seterusnya">Seterus</SmallButton>
            <SmallButton disabled={page + 1 >= totalPages || loading} onClick={() => setPage(totalPages - 1)} ariaLabel="Halaman pengguna terakhir">»</SmallButton>
          </div>
        </div>

        {selected.size > 0 && (
          <Card style={{ padding:9, marginBottom:8, background:'rgba(139,92,246,.08)', borderColor:C.borderB }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 160px', fontSize:11, color:C.text, fontWeight:900 }}>
                {selected.size} dipilih pada halaman ini
                <div style={{ fontSize:9, color:C.textFaint, fontWeight:700, marginTop:1 }}>Tindakan pukal perlu disahkan dahulu.</div>
              </div>
              <SmallButton disabled={saving} onClick={() => setSelected(new Set())}>Kosongkan</SmallButton>
              <SmallButton success disabled={saving} onClick={() => requestBulkStatus(true)}>Aktifkan</SmallButton>
              <SmallButton disabled={saving} onClick={() => requestBulkStatus(false)} style={{ color:C.red, borderColor:'rgba(239,68,68,.22)', background:'transparent' }}>Nyahaktif</SmallButton>
            </div>
          </Card>
        )}

        <InlineNotice message={message} />
        {error && (
          <div style={{ marginBottom:8 }}>
            <ErrorRetry message="Senarai pengguna tidak dapat dimuat." onRetry={refresh} />
          </div>
        )}
        {mutationError && (
          <div style={{ marginBottom:8 }}>
            <ErrorRetry message={mutationError.message} onRetry={mutationError.retry} />
          </div>
        )}

        {creating && (
          <UserForm
            mode="create"
            value={creating}
            onChange={(updater) => { setFormErrors({}); setMutationError(null); setCreating(updater); }}
            onSave={saveCreate}
            onCancel={() => { setCreating(null); setFormErrors({}); setMutationError(null); }}
            saving={saving}
            errors={formErrors}
          />
        )}
        {editing && (
          <UserEditModal
            value={editing}
            onChange={(updater) => { setFormErrors({}); setMutationError(null); setEditing(updater); }}
            onSave={saveEdit}
            onCancel={() => { setEditing(null); setFormErrors({}); setMutationError(null); }}
            saving={saving}
            errors={formErrors}
          />
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 10px' }}>
        {loading ? [0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:9, padding:'10px 0',
            borderBottom: i < 5 ? `1px solid ${C.border}` : 'none',
          }}>
            <Skeleton width={16} height={16} radius={4} />
            <Skeleton width={34} height={34} radius={17} />
            <div style={{ flex:1, minWidth:0 }}>
              <Skeleton width={i % 2 ? '52%' : '68%'} height={13} radius={7} style={{ marginBottom:7 }} />
              <Skeleton width="72%" height={10} radius={5} />
            </div>
            <Skeleton width={50} height={22} radius={8} />
            <Skeleton width={58} height={24} radius={8} />
          </div>
        )) : users.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:C.textFaint, fontSize:13, fontWeight:700 }}>
            Tiada pengguna ditemui
          </div>
        ) : (
          <>
            <div style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 0',
              borderBottom:`1px solid ${C.border}`,
            }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={togglePageSelection}
                aria-label="Pilih semua pengguna pada halaman ini"
                style={{ accentColor:C.acc, width:44, height:44, margin:0, flexShrink:0 }}
              />
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>
                Pilih semua halaman ini
              </div>
            </div>
            {!narrow && (
              <div style={{
                display:'grid',
                gridTemplateColumns:'34px 42px minmax(220px, 1.6fr) 126px 108px 132px 72px',
                gap:10,
                alignItems:'center',
                padding:'8px 0',
                borderBottom:`1px solid ${C.border}`,
                color:C.textFaint,
                fontSize:10,
                fontWeight:900,
                textTransform:'uppercase',
                letterSpacing:.5,
              }}>
                <span />
                <span />
                <span>Pengguna</span>
                <span>Peranan</span>
                <span>Status</span>
                <span>Log masuk</span>
                <span style={{ textAlign:'right' }}>Aksi</span>
              </div>
            )}
            {users.map((u, i) => {
              const rs = ROLE_STYLE[u.role] || ROLE_STYLE.Pelajar;
              const selectedRow = selected.has(u.id);
              return (
                <div key={u.id || i} style={{
                  display:'grid',
                  gridTemplateColumns:narrow ? '44px 34px minmax(0, 1fr) minmax(44px, auto)' : '44px 42px minmax(220px, 1.6fr) 126px 108px 132px 72px',
                  alignItems:'center',
                  gap:narrow ? 8 : 10,
                  padding:'10px 0',
                  borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none',
                  minWidth:0,
                }}>
                  <input
                    type="checkbox"
                    checked={selectedRow}
                    disabled={!u.id}
                    onChange={() => toggleSelected(u.id)}
                    aria-label={`Pilih pengguna ${u.name}`}
                    style={{ accentColor:C.acc, width:44, height:44, margin:0, flexShrink:0 }}
                  />
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <Avatar name={u.name} size={34} />
                    {u.active && (
                      <div style={{
                        position:'absolute', bottom:0, right:0,
                        width:9, height:9, borderRadius:'50%',
                        background:C.green, border:`2px solid ${C.bg}`,
                      }} />
                    )}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div title={u.name} style={{ fontWeight:800, fontSize:12, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</div>
                    <div title={u.displayEmail || 'Tiada e-mel'} style={{
                      fontSize:10,
                      color:C.textFaint,
                      fontWeight:600,
                      marginTop:1,
                      whiteSpace:narrow ? 'normal' : 'nowrap',
                      overflow:narrow ? 'visible' : 'hidden',
                      textOverflow:'ellipsis',
                      overflowWrap:'anywhere',
                      lineHeight:1.3,
                    }}>
                      {u.displayEmail || 'Tiada e-mel'}{narrow ? ` · ${u.last}` : ''}
                    </div>
                    {narrow && (
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
                        <Badge tone={u.active ? 'good' : 'warn'}>{statusText(u.active)}</Badge>
                        {u.shortId && <Badge tone="neutral">Ref {u.shortId}</Badge>}
                        <span style={{
                          background:rs.bg, border:`1px solid ${rs.border}`,
                          borderRadius:999,
                          padding:'2px 7px',
                          fontSize:10,
                          fontWeight:900,
                          color:rs.text,
                        }}>{u.role}</span>
                      </div>
                    )}
                  </div>

                  {!narrow && <div style={{
                    background:rs.bg, border:`1px solid ${rs.border}`,
                    borderRadius:8, padding:'3px 7px', flexShrink:0,
                    fontSize:10, fontWeight:900, color:rs.text,
                  }}>{u.role}</div>}

                  {!narrow && <Badge tone={u.active ? 'good' : 'warn'}>{statusText(u.active)}</Badge>}
                  {!narrow && <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.last}</div>}
                  <AdminActionMenu
                    label="Aksi"
                    ariaLabel={`Tindakan untuk ${u.name}`}
                    disabled={!u.id}
                    items={[
                      { label:'Lihat butiran', onClick:() => openDetail(u) },
                      { label:'Edit pengguna', onClick:() => startEdit(u) },
                      {
                        label:u.active ? 'Nyahaktifkan akaun' : 'Aktifkan akaun',
                        tone:u.active ? 'danger' : 'success',
                        description:u.active ? 'Sekat akses tanpa memadam rekod.' : 'Benarkan akses semula.',
                        onClick:() => requestStatus(u),
                      },
                    ]}
                  />
                </div>
              );
            })}
          </>
        )}
        <div style={{ padding:'12px 0 4px', fontSize:10, color:C.textFaint, fontWeight:600, lineHeight:1.5 }}>
          Akaun tidak boleh dipadam secara kekal — gunakan Nyahaktif untuk menyekat akses tanpa kehilangan rekod pelajar.
        </div>
      </div>
      {confirmBulk && (
        <ConfirmModal
          title={confirmBulk.isActive ? 'Aktifkan pengguna dipilih?' : 'Nyahaktifkan pengguna dipilih?'}
          confirmLabel={confirmBulk.isActive ? 'Aktifkan' : 'Nyahaktifkan'}
          danger={!confirmBulk.isActive}
          busy={saving}
          onCancel={() => setConfirmBulk(null)}
          onConfirm={() => bulkStatus(confirmBulk.isActive, confirmBulk.ids)}
        >
          Tindakan ini akan menukar status {confirmBulk.ids.length} akaun. {confirmBulk.isActive ? 'Akaun akan boleh mengakses sistem semula.' : 'Sesi aktif akan dibatalkan dan akses disekat tanpa memadam rekod.'}
          {confirmBulk.names.length > 0 ? ` Termasuk: ${confirmBulk.names.join(', ')}${confirmBulk.ids.length > confirmBulk.names.length ? ', ...' : ''}` : ''}
        </ConfirmModal>
      )}
      {confirmStatus && (
        <ConfirmModal
          title={confirmStatus.isActive ? 'Aktifkan akaun pengguna?' : 'Nyahaktifkan akaun pengguna?'}
          confirmLabel={confirmStatus.isActive ? 'Aktifkan' : 'Nyahaktifkan'}
          danger={!confirmStatus.isActive}
          onCancel={() => setConfirmStatus(null)}
          onConfirm={() => toggleStatus(confirmStatus.user)}
        >
          {confirmStatus.isActive
            ? `${confirmStatus.user.name} akan boleh mengakses sistem semula.`
            : `${confirmStatus.user.name} akan disekat daripada log masuk tanpa memadam rekod pembelajaran.`}
        </ConfirmModal>
      )}
      <UserDetailModal
        detail={detail}
        onClose={() => setDetail({ id:null, loading:false, error:null, data:null, user:null })}
        onRetry={() => openDetail(detail.user)}
      />
    </div>
  );
};

// ─── LessonPreviewModal ──────────────────────────────────────────────────────

const LessonPreviewModal = ({ lesson, onClose }) => {
  const diffLabel = { easy:'Mudah', medium:'Sederhana', hard:'Sukar' };
  const qTypeLabel = { multiple_choice:'Pelbagai Pilihan', true_false:'Benar/Palsu', fill_blank:'Isi Tempat Kosong' };
  const questions = lesson?.questions || lesson?.quizData?.questions || [];
  return (
    <AdminDrawer title={cleanContentTitle(lesson?.title, 'Pratonton Pelajaran')} subtitle="Pratonton pelajaran" onClose={onClose} width={620}>
        <div style={{ fontWeight:900, fontSize:13, color:C.accPale, marginBottom:6 }}>Kandungan Diterbitkan</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          {lesson?.subject && <span style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:800, color:C.accPale }}>{cleanSubjectLabel(lesson.subject)}</span>}
          {lesson?.form_level && <span style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:800, color:C.accPale }}>Tingkatan {lesson.form_level}</span>}
          {lesson?.difficulty && <span style={{ background:'rgba(245,166,35,.12)', border:'1px solid rgba(245,166,35,.3)', borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:800, color:C.gold }}>{diffLabel[lesson.difficulty] || lesson.difficulty}</span>}
          {lesson?.estimated_minutes && <span style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:800, color:C.textMuted }}>⏱ {lesson.estimated_minutes} min</span>}
          {(lesson?.question_count ?? questions.length) > 0 && <span style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:800, color:C.textMuted }}>{lesson?.question_count ?? questions.length} soalan</span>}
        </div>
        {contentSummary(lesson?.content || { summary:lesson?.summary }) && (
          <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.6, marginBottom:14 }}>{contentSummary(lesson?.content || { summary:lesson?.summary })}</div>
        )}
        <SectionLabel>Soalan</SectionLabel>
        {questions.length ? questions.map((q, i) => (
          <Card key={q.id || i} style={{ marginBottom:8, padding:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:6 }}>
              <div style={{ fontWeight:700, fontSize:13, color:C.text, flex:1 }}>{i+1}. {cleanDisplayText(q.questionText || q.question_text || q.text, 120, 'Soalan')}</div>
              <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                {(q.questionType || q.question_type || q.type) && <Badge tone="neutral">{qTypeLabel[q.questionType || q.question_type || q.type] || q.questionType || q.question_type}</Badge>}
                {q.points && <Badge tone="good">{q.points} mata</Badge>}
              </div>
            </div>
          </Card>
        )) : (
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Tiada soalan dimuat. Buka edit untuk lihat soalan penuh.</div>
        )}
    </AdminDrawer>
  );
};

// ─── AdminAssignLessonModal ──────────────────────────────────────────────────

const AdminAssignLessonModal = ({ lesson, onClose }) => {
  const classroomsState = useAsync(() => window.tusyenApi.adminClassrooms({}), []);
  const classrooms = (classroomsState.data?.classrooms || []).filter(c => c.is_active !== false);
  const [classroomId, setClassroomId] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [isRequired, setIsRequired] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [isError, setIsError] = React.useState(false);

  React.useEffect(() => {
    if (classrooms.length && !classroomId) setClassroomId(classrooms[0].id);
  }, [classrooms.length]);

  const submit = async (e) => {
    e.preventDefault();
    if (!classroomId) { setIsError(true); setNotice('Pilih kelas dahulu.'); return; }
    setBusy(true); setNotice(''); setIsError(false);
    try {
      await window.tusyenApi.assignLessonToClassroom(classroomId, lesson.id, { dueDate: dueDate || null, isRequired });
      setIsError(false);
      setNotice('✅ Berjaya ditugaskan ke kelas.');
      setTimeout(onClose, 1500);
    } catch (err) {
      setIsError(true);
      setNotice(err.message || 'Tidak dapat menugaskan pelajaran.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, padding:24, width:'100%', maxWidth:420 }}>
        <div style={{ fontWeight:900, fontSize:17, color:C.text, marginBottom:4 }}>Tugaskan Pelajaran ke Kelas</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginBottom:16 }}>{cleanContentTitle(lesson?.title, 'Pelajaran tanpa tajuk')}</div>
        {classroomsState.loading ? <Skeleton width="100%" height={36} radius={8} style={{ marginBottom:12 }} /> : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Field label="Kelas">
              <select value={classroomId} onChange={e => setClassroomId(e.target.value)} style={{ ...inputBase }}>
                {classrooms.map(c => <option key={c.id} value={c.id}>{cleanClassName(c.name)}{c.subject ? ` - ${c.subject}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Tarikh Akhir (pilihan)">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...inputBase }} />
            </Field>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:700, color:C.text, cursor:'pointer' }}>
              <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} />
              Wajib diselesaikan
            </label>
            {notice && <div style={{ fontSize:11, fontWeight:900, color: isError ? C.red : C.green }}>{notice}</div>}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <GlowButton type="submit" disabled={busy || !classroomId}>{busy ? 'Menugaskan...' : 'Tugaskan'}</GlowButton>
              <button type="button" onClick={onClose} style={{ flex:1, background:'transparent', border:`1px solid ${C.border}`, borderRadius:12, padding:'11px 12px', color:C.textMuted, fontFamily:'Nunito', fontWeight:800, fontSize:13, cursor:'pointer' }}>Batal</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

const PreviewRow = ({ label, value }) => (
  <div style={{
    display:'grid',
    gridTemplateColumns:'128px minmax(0, 1fr)',
    gap:8,
    padding:'6px 0',
    borderBottom:`1px solid ${C.border}`,
    fontSize:11,
    lineHeight:1.35,
  }}>
    <div style={{ color:C.textFaint, fontWeight:900 }}>{label}</div>
    <div style={{ color:C.text, fontWeight:800, overflowWrap:'anywhere' }}>{value === 0 ? 0 : (value || 'Tiada data')}</div>
  </div>
);

const ContentPublishPreview = ({ type, syllabusForm, lessonForm, syllabusItems = [], quizQuestions = [], quizDraft }) => {
  const selectedSyllabus = syllabusItems.find(item => item.id === lessonForm.syllabusId) || syllabusItems[0] || null;
  const draftHasQuestion = Boolean(`${quizDraft?.questionText || ''}`.trim());
  const questionCount = quizQuestions.length + (draftHasQuestion ? 1 : 0);
  const difficultyLabel = { easy:'Mudah', medium:'Sederhana', hard:'Sukar' }[lessonForm.difficulty] || lessonForm.difficulty;
  const syllabusTitle = selectedSyllabus
    ? `${cleanSubjectLabel(selectedSyllabus.subject)} T${selectedSyllabus.form_level || '-'}: ${cleanContentTitle(selectedSyllabus.topic, 'Topik tanpa tajuk')}`
    : 'Silibus belum dipilih';
  return (
    <div style={{ display:'grid', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <ContentStatusBadge status="draft" />
        <span style={{ color:C.textFaint, fontWeight:900 }}>ke</span>
        <ContentStatusBadge status="published" />
      </div>
      <Card style={{ padding:12, background:C.surface }}>
        <div style={{ fontSize:12, color:C.accPale, fontWeight:900, marginBottom:6 }}>
          {type === 'lesson' ? 'Pratonton Pelajaran KSSM' : 'Pratonton Silibus KSSM'}
        </div>
        {type === 'lesson' ? (
          <>
            <PreviewRow label="Silibus KSSM" value={syllabusTitle} />
            <PreviewRow label="Tajuk pelajaran" value={cleanContentTitle(lessonForm.title, 'Pelajaran tanpa tajuk')} />
            <PreviewRow label="Ringkasan" value={cleanContentSummary(lessonForm.summary, 180) || 'Tiada ringkasan'} />
            <PreviewRow label="Tahap" value={difficultyLabel} />
            <PreviewRow label="Anggaran masa" value={`${Number(lessonForm.estimatedMinutes) || 15} minit`} />
            <PreviewRow label="Kuiz" value={`${questionCount} soalan`} />
          </>
        ) : (
          <>
            <PreviewRow label="Subjek KSSM" value={cleanSubjectLabel(syllabusForm.subject)} />
            <PreviewRow label="Tingkatan" value={`Tingkatan ${syllabusForm.formLevel || '-'}`} />
            <PreviewRow label="Topik" value={cleanContentTitle(syllabusForm.topic, 'Topik tanpa tajuk')} />
            <PreviewRow label="Subtopik" value={cleanDisplayText(syllabusForm.subtopic, 80, 'Tiada subtopik')} />
            <PreviewRow label="Urutan" value={Number(syllabusForm.orderIndex) || 0} />
            <PreviewRow label="Ringkasan" value={cleanContentSummary(syllabusForm.summary, 180) || 'Tiada ringkasan'} />
          </>
        )}
      </Card>
      <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
        Selepas disahkan, kandungan ini akan muncul dalam senarai aktif untuk aliran peranan yang berkaitan.
      </div>
    </div>
  );
};

const AdminContent = () => {
  const [tab, setTab] = React.useState('syllabus');
  const [subject, setSubject] = React.useState('');
  const [formLevel, setFormLevel] = React.useState('Semua');
  const syllabusState = useAdminSyllabus({ subject, formLevel });
  const lessonsState = useAdminLessons({ subject, formLevel });
  const [syllabusForm, setSyllabusForm] = React.useState({
    subject:'Matematik',
    formLevel:'4',
    topic:'',
    subtopic:'',
    orderIndex:'1',
    summary:'',
  });
  const [lessonForm, setLessonForm] = React.useState({
    syllabusId:'',
    title:'',
    difficulty:'medium',
    estimatedMinutes:'15',
    summary:'',
  });
  const [quizDraft, setQuizDraft] = React.useState(createEmptyQuizQuestion);
  const [quizQuestions, setQuizQuestions] = React.useState([]);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [confirmPublish, setConfirmPublish] = React.useState(null);
  const [previewLesson, setPreviewLesson] = React.useState(null);
  const [assignAdminLesson, setAssignAdminLesson] = React.useState(null);
  const [busy, setBusy] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [noticeError, setNoticeError] = React.useState(false);
  const narrow = useNarrow(560);

  const refreshContent = () => {
    syllabusState.refresh();
    lessonsState.refresh();
  };

  const setSuccess = (msg) => { setNotice(msg); setNoticeError(false); };
  const setError   = (msg) => { setNotice(msg); setNoticeError(true);  };

  const syllabusValidation = () => {
    const issues = [];
    if (!syllabusForm.subject.trim()) issues.push('Subjek diperlukan.');
    if (!syllabusForm.topic.trim()) issues.push('Topik diperlukan.');
    if (!Number(syllabusForm.formLevel)) issues.push('Tingkatan tidak sah.');
    return issues;
  };

  const lessonValidation = () => {
    const issues = [];
    const syllabusId = lessonForm.syllabusId || syllabusState.data?.[0]?.id;
    if (!syllabusId) issues.push('Pilih item silibus.');
    if (!lessonForm.title.trim()) issues.push('Tajuk pelajaran diperlukan.');
    if (!lessonForm.summary.trim()) issues.push('Ringkasan kandungan masih kosong.');
    try {
      const questions = quizQuestions.map(normalizeAdminQuizQuestion).filter(Boolean);
      const draftQuestion = normalizeAdminQuizQuestion(quizDraft);
      if (draftQuestion) questions.push(draftQuestion);
      if (questions.length === 0) issues.push('Tambah sekurang-kurangnya satu soalan kuiz.');
    } catch (err) {
      issues.push(err.message || 'Kuiz belum lengkap.');
    }
    return issues;
  };

  const requestPublishSyllabus = () => {
    const issues = syllabusValidation();
    setConfirmPublish({ type:'syllabus', issues });
  };

  const submitSyllabusForm = (event) => {
    event.preventDefault();
    requestPublishSyllabus();
  };

  const requestPublishLesson = () => {
    const issues = lessonValidation();
    setConfirmPublish({ type:'lesson', issues });
  };

  const createSyllabus = async () => {
    setBusy('syllabus');
    setNotice('');
    try {
      await window.tusyenApi.createSyllabusItem({
        subject: syllabusForm.subject.trim(),
        formLevel: Number(syllabusForm.formLevel),
        topic: syllabusForm.topic.trim(),
        subtopic: syllabusForm.subtopic.trim() || null,
        orderIndex: Number(syllabusForm.orderIndex) || 0,
        content: { summary: syllabusForm.summary.trim() },
      });
      setSuccess('Item silibus diterbitkan.');
      setConfirmPublish(null);
      setSyllabusForm(prev => ({ ...prev, topic:'', subtopic:'', summary:'' }));
      refreshContent();
    } catch (err) {
      setError(err.message || 'Tidak dapat mencipta silibus.');
    } finally {
      setBusy('');
    }
  };

  const requestDeleteSyllabus = (item) => {
    setConfirmDelete({ type:'syllabus', item });
  };

  const createLesson = async () => {
    const issues = lessonValidation();
    if (issues.length) {
      setConfirmPublish({ type:'lesson', issues });
      return;
    }
    const syllabusId = lessonForm.syllabusId || syllabusState.data?.[0]?.id;
    setBusy('lesson');
    setNotice('');
    try {
      if (!syllabusId) throw new Error('Pilih item silibus dahulu.');
      const questions = quizQuestions.map(normalizeAdminQuizQuestion).filter(Boolean);
      const draftQuestion = normalizeAdminQuizQuestion(quizDraft);
      if (draftQuestion) questions.push(draftQuestion);
      await window.tusyenApi.createAdminLesson({
        syllabusId,
        title: lessonForm.title.trim(),
        content: { summary: lessonForm.summary.trim() },
        difficulty: lessonForm.difficulty,
        estimatedMinutes: Number(lessonForm.estimatedMinutes) || 15,
        quizData: { questions },
      });
      setSuccess('Pelajaran diterbitkan.');
      setConfirmPublish(null);
      setLessonForm(prev => ({ ...prev, title:'', summary:'' }));
      setQuizDraft(createEmptyQuizQuestion());
      setQuizQuestions([]);
      refreshContent();
    } catch (err) {
      setError(err.message || 'Tidak dapat mencipta pelajaran.');
    } finally {
      setBusy('');
    }
  };

  const requestDeleteLesson = (lesson) => {
    setConfirmDelete({ type:'lesson', item:lesson });
  };

  const confirmContentDelete = async () => {
    if (!confirmDelete?.item?.id) return;
    const { type, item } = confirmDelete;
    setBusy(item.id);
    setNotice('');
    try {
      if (type === 'lesson') {
        await window.tusyenApi.deleteAdminLesson(item.id);
        setSuccess('Pelajaran dinyahterbitkan.');
      } else {
        await window.tusyenApi.deleteSyllabusItem(item.id);
        setSuccess('Item silibus dinyahterbitkan.');
      }
      setConfirmDelete(null);
      refreshContent();
    } catch (err) {
      setError(err.message || (type === 'lesson' ? 'Tidak dapat memadam pelajaran.' : 'Tidak dapat memadam silibus.'));
    } finally {
      setBusy('');
    }
  };

  const updateQuizOption = (index, value) => {
    setQuizDraft(prev => ({
      ...prev,
      options: prev.options.map((option, optionIndex) => optionIndex === index ? value : option),
    }));
  };

  const addQuizQuestion = () => {
    try {
      const normalized = normalizeAdminQuizQuestion(quizDraft);
      if (!normalized) throw new Error('Isi soalan kuiz dahulu.');
      setQuizQuestions(prev => [...prev, { ...quizDraft, id:`q-${Date.now()}-${prev.length}` }]);
      setQuizDraft(createEmptyQuizQuestion());
      setSuccess('Soalan kuiz ditambah.');
    } catch (err) {
      setError(err.message || 'Tidak dapat menambah soalan.');
    }
  };

  const removeQuizQuestion = (id) => {
    setQuizQuestions(prev => prev.filter(question => question.id !== id));
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px 0', flexShrink:0, position:'sticky', top:0, zIndex:30, background:C.bg, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr' : 'minmax(0, 1fr) 96px', gap:8, marginBottom:8 }}>
          <Field label="Subjek">
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Semua subjek"
              style={inputBase}
            />
          </Field>
          <Field label="Tingkatan">
            <select value={formLevel} onChange={e => setFormLevel(e.target.value)} style={inputBase}>
              <option>Semua</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
          {[
            { id:'syllabus', label:'Silibus' },
            { id:'lessons', label:'Pelajaran' },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} aria-pressed={tab === item.id} style={{
              background:tab === item.id ? C.accDim : 'transparent',
              border:`1.5px solid ${tab === item.id ? C.borderB : C.border}`,
              borderRadius:12,
              padding:'8px 0',
              minHeight:44,
              color:tab === item.id ? C.accPale : C.textMuted,
              fontFamily:'Nunito',
              fontWeight:900,
              fontSize:12,
              cursor:'pointer',
            }}>{item.label}</button>
          ))}
        </div>
        <InlineNotice message={notice} error={noticeError} />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 10px' }}>
        {tab === 'syllabus' && (
          <>
            <Card style={{ marginBottom:12 }}>
              <div style={{ fontWeight:900, fontSize:13, color:C.accPale, marginBottom:8 }}>Cipta Item Silibus</div>
              <form onSubmit={submitSyllabusForm} style={{ display:'grid', gap:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr 1fr' : 'minmax(0, 1fr) 86px 70px', gap:8 }}>
                  <Field label="Subjek" style={narrow ? { gridColumn:'1 / -1' } : undefined}>
                    <input required value={syllabusForm.subject} onChange={e => setSyllabusForm(prev => ({ ...prev, subject:e.target.value }))} style={inputBase} />
                  </Field>
                  <Field label="Ting.">
                    <select value={syllabusForm.formLevel} onChange={e => setSyllabusForm(prev => ({ ...prev, formLevel:e.target.value }))} style={inputBase}>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </Field>
                  <Field label="Urutan">
                    <input type="number" value={syllabusForm.orderIndex} onChange={e => setSyllabusForm(prev => ({ ...prev, orderIndex:e.target.value }))} style={inputBase} />
                  </Field>
                </div>
                <Field label="Topik">
                  <input required value={syllabusForm.topic} onChange={e => setSyllabusForm(prev => ({ ...prev, topic:e.target.value }))} style={inputBase} />
                </Field>
                <Field label="Subtopik">
                  <input value={syllabusForm.subtopic} onChange={e => setSyllabusForm(prev => ({ ...prev, subtopic:e.target.value }))} style={inputBase} />
                </Field>
                <Field label="Ringkasan">
                  <textarea value={syllabusForm.summary} onChange={e => setSyllabusForm(prev => ({ ...prev, summary:e.target.value }))} rows={3} style={{ ...inputBase, resize:'vertical' }} />
                </Field>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <ContentStatusBadge status="draft" />
                  <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, textAlign:'right' }}>Draf - semak pratonton - diterbitkan.</div>
                </div>
                <GlowButton disabled={busy === 'syllabus'} style={{ padding:'10px 12px', fontSize:13 }}>
                  {busy === 'syllabus' ? 'Menerbitkan...' : 'Semak & Terbitkan Silibus'}
                </GlowButton>
              </form>
            </Card>

            <SectionLabel>Senarai Silibus</SectionLabel>
            {syllabusState.loading ? [0,1,2].map(i => (
              <Card key={i} style={{ marginBottom:8 }}>
                <Skeleton width="70%" height={13} radius={7} style={{ marginBottom:8 }} />
                <Skeleton width="48%" height={10} radius={5} />
              </Card>
            )) : syllabusState.error ? (
              <ErrorRetry message="Silibus tidak dapat dimuat." onRetry={syllabusState.refresh} />
            ) : (syllabusState.data || []).length === 0 ? (
              <div style={{ textAlign:'center', padding:'26px 0', color:C.textFaint, fontSize:12, fontWeight:800 }}>Tiada item silibus.</div>
            ) : (syllabusState.data || []).map(item => (
              <Card key={item.id} style={{ marginBottom:8, padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div title={cleanContentTitle(item.topic, 'Topik tanpa tajuk')} style={{ fontSize:13, color:C.text, fontWeight:900, lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cleanContentTitle(item.topic, 'Topik tanpa tajuk')}</div>
                    <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:2, overflowWrap:'anywhere' }}>
                      {cleanSubjectLabel(item.subject)} - Tingkatan {item.form_level || '-'}{item.subtopic ? ` - ${cleanDisplayText(item.subtopic, 42, '')}` : ''}
                    </div>
                    {contentSummary(item.content) && (
                      <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginTop:6, lineHeight:1.35, overflowWrap:'anywhere' }}>{compactText(contentSummary(item.content), 120, '')}</div>
                    )}
                  </div>
                  <div style={{ display:'grid', gap:5, justifyItems:'end', flexShrink:0 }}>
                    <ContentStatusBadge status={(item.is_active ?? item.isActive) === false ? 'archive' : 'published'} />
                    {shortId(item.id) && <Badge tone="neutral">Ref {shortId(item.id)}</Badge>}
                    <AdminActionMenu
                      label="Aksi"
                      ariaLabel={`Tindakan silibus ${cleanContentTitle(item.topic, 'tanpa tajuk')}`}
                      disabled={busy === item.id}
                      items={[
                        {
                          label:'Arkibkan silibus',
                          tone:'danger',
                          description:'Sembunyikan daripada katalog aktif.',
                          onClick:() => requestDeleteSyllabus(item),
                        },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}

        {tab === 'lessons' && (
          <>
            <Card style={{ marginBottom:12 }}>
              <div style={{ fontWeight:900, fontSize:13, color:C.accPale, marginBottom:8 }}>Cipta Pelajaran + Kuiz</div>
              <div style={{ display:'grid', gap:8 }}>
                <Field label="Item Silibus">
                  <select value={lessonForm.syllabusId} onChange={e => setLessonForm(prev => ({ ...prev, syllabusId:e.target.value }))} style={inputBase}>
                    <option value="">Pilih silibus terkini</option>
                    {(syllabusState.data || []).map(item => (
                      <option key={item.id} value={item.id}>{cleanSubjectLabel(item.subject)} T{item.form_level}: {cleanContentTitle(item.topic, 'Topik tanpa tajuk')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tajuk">
                  <input required value={lessonForm.title} onChange={e => setLessonForm(prev => ({ ...prev, title:e.target.value }))} style={inputBase} />
                </Field>
                <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr' : '1fr 1fr', gap:8 }}>
                  <Field label="Tahap">
                    <select value={lessonForm.difficulty} onChange={e => setLessonForm(prev => ({ ...prev, difficulty:e.target.value }))} style={inputBase}>
                      <option value="easy">Mudah</option>
                      <option value="medium">Sederhana</option>
                      <option value="hard">Sukar</option>
                    </select>
                  </Field>
                  <Field label="Minit">
                    <input type="number" value={lessonForm.estimatedMinutes} onChange={e => setLessonForm(prev => ({ ...prev, estimatedMinutes:e.target.value }))} style={inputBase} />
                  </Field>
                </div>
                <Field label="Ringkasan Kandungan">
                  <textarea required value={lessonForm.summary} onChange={e => setLessonForm(prev => ({ ...prev, summary:e.target.value }))} rows={3} style={{ ...inputBase, resize:'vertical' }} />
                </Field>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:'grid', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ fontWeight:900, fontSize:12, color:C.text }}>Pembina Kuiz</div>
                    <Badge>{quizQuestions.length + (quizDraft.questionText.trim() ? 1 : 0)} soalan</Badge>
                  </div>
                  {quizQuestions.length > 0 && (
                    <div style={{ display:'grid', gap:6 }}>
                      {quizQuestions.map((question, index) => (
                        <div key={question.id} style={{
                          display:'flex', alignItems:'center', gap:8,
                          border:`1px solid ${C.border}`, borderRadius:9,
                          padding:'7px 8px', background:C.surface,
                        }}>
                          <Badge>{index + 1}</Badge>
                          <div style={{ flex:1, minWidth:0, fontSize:11, color:C.textMuted, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {question.type === 'multiple_choice' ? 'MCQ' : 'Benar/Salah'} - {cleanDisplayText(question.questionText, 78, 'Soalan')}
                          </div>
                          <AdminActionMenu
                            label="Aksi"
                            ariaLabel={`Tindakan soalan kuiz ${index + 1}`}
                            items={[
                              {
                                label:'Buang soalan draf',
                                tone:'danger',
                                description:'Keluarkan daripada draf pelajaran.',
                                onClick:() => removeQuizQuestion(question.id),
                              },
                            ]}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr' : 'minmax(0, 1fr) 118px', gap:8 }}>
                    <Field label="Jenis">
                      <select value={quizDraft.type} onChange={e => setQuizDraft(prev => ({ ...prev, type:e.target.value }))} style={inputBase}>
                        <option value="multiple_choice">MCQ</option>
                        <option value="true_false">Benar/Salah</option>
                      </select>
                    </Field>
                    <Field label="Markah (tetap)">
                      <input value="1 mata / soalan" readOnly disabled style={{ ...inputBase, opacity:.55 }} title="Setiap soalan bernilai 1 mata. Tidak boleh diubah." />
                    </Field>
                  </div>
                  <Field label="Soalan">
                    <input required value={quizDraft.questionText} onChange={e => setQuizDraft(prev => ({ ...prev, questionText:e.target.value }))} placeholder="Tulis soalan kuiz" style={inputBase} />
                  </Field>
                  {quizDraft.type === 'multiple_choice' ? (
                    <fieldset style={{ border:'none', padding:0, margin:0, display:'grid', gap:6 }}>
                      <legend style={{ fontSize:10, color:C.textMuted, fontWeight:900, textTransform:'uppercase', letterSpacing:.5, padding:0, marginBottom:2 }}>
                        Jawapan betul
                      </legend>
                      {quizDraft.options.map((option, index) => (
                        <label key={index} style={{ display:'grid', gridTemplateColumns:'52px minmax(0, 1fr)', gap:8, alignItems:'center', minWidth:0, minHeight:52, cursor:'pointer' }}>
                          <span style={{
                            minHeight:52, minWidth:52,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            border:`1.5px solid ${quizDraft.correctOption === String(index) ? C.borderB : C.border}`,
                            borderRadius:12,
                            background:quizDraft.correctOption === String(index) ? C.accDim : C.surface,
                          }}>
                            <input
                              type="radio"
                              name="adminQuizCorrect"
                              aria-label={`Tandakan pilihan ${index + 1} sebagai jawapan betul`}
                              checked={quizDraft.correctOption === String(index)}
                              onChange={() => setQuizDraft(prev => ({ ...prev, correctOption:String(index) }))}
                              style={{ accentColor:C.acc, width:24, height:24, cursor:'pointer' }}
                            />
                          </span>
                          <input
                            required={index < 2}
                            aria-label={`Pilihan jawapan ${index + 1}`}
                            value={option}
                            onChange={e => updateQuizOption(index, e.target.value)}
                            placeholder={`Pilihan ${index + 1}`}
                            style={inputBase}
                          />
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <Field label="Jawapan">
                      <select value={quizDraft.trueFalseAnswer} onChange={e => setQuizDraft(prev => ({ ...prev, trueFalseAnswer:e.target.value }))} style={inputBase}>
                        <option value="true">Benar</option>
                        <option value="false">Salah</option>
                      </select>
                    </Field>
                  )}
                  <Field label="Penjelasan">
                    <input value={quizDraft.explanation} onChange={e => setQuizDraft(prev => ({ ...prev, explanation:e.target.value }))} style={inputBase} />
                  </Field>
                  <SmallButton onClick={addQuizQuestion} style={{ justifySelf:'start' }}>Tambah Soalan</SmallButton>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <ContentStatusBadge status="draft" />
                  <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, textAlign:'right' }}>Pratonton semakan menunjukkan tajuk, status, dan jumlah soalan.</div>
                </div>
                <GlowButton onClick={requestPublishLesson} disabled={busy === 'lesson'} style={{ padding:'10px 12px', fontSize:13 }}>
                  {busy === 'lesson' ? 'Menerbitkan...' : 'Semak & Terbitkan Pelajaran'}
                </GlowButton>
              </div>
            </Card>

            <SectionLabel>Pelajaran Diterbitkan</SectionLabel>
            {lessonsState.loading ? [0,1,2].map(i => (
              <Card key={i} style={{ marginBottom:8 }}>
                <Skeleton width="72%" height={13} radius={7} style={{ marginBottom:8 }} />
                <Skeleton width="56%" height={10} radius={5} />
              </Card>
            )) : lessonsState.error ? (
              <ErrorRetry message="Pelajaran tidak dapat dimuat." onRetry={lessonsState.refresh} />
            ) : (lessonsState.data || []).length === 0 ? (
              <div style={{ textAlign:'center', padding:'26px 0', color:C.textFaint, fontSize:12, fontWeight:800 }}>Tiada pelajaran diterbitkan.</div>
            ) : (lessonsState.data || []).map(lesson => (
              <Card key={lesson.id} style={{ marginBottom:8, padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div title={cleanContentTitle(lesson.title, 'Pelajaran tanpa tajuk')} style={{ fontSize:13, color:C.text, fontWeight:900, lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cleanContentTitle(lesson.title, 'Pelajaran tanpa tajuk')}</div>
                    <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:2, overflowWrap:'anywhere' }}>
                      {cleanSubjectLabel(lesson.subject)} - T{lesson.form_level || '-'} - {cleanDisplayText(lesson.difficulty, 18, 'Tahap')}
                    </div>
                    <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                      <ContentStatusBadge status={(lesson.is_active ?? lesson.isActive) === false ? 'archive' : 'published'} />
                      <Badge>{metricNumber(lesson.question_count)} soalan</Badge>
                      <Badge>{metricNumber(lesson.assigned_classrooms)} kelas</Badge>
                      {shortId(lesson.id) && <Badge tone="neutral">Ref {shortId(lesson.id)}</Badge>}
                    </div>
                  </div>
                  <div style={{ display:'grid', gap:5, justifyItems:'end', flexShrink:0 }}>
                    <AdminActionMenu
                      label="Aksi"
                      ariaLabel={`Tindakan pelajaran ${cleanContentTitle(lesson.title, 'tanpa tajuk')}`}
                      disabled={busy === lesson.id}
                      items={[
                        { label:'Pratonton terbitan', onClick:() => setPreviewLesson(lesson) },
                        { label:'Tugaskan ke kelas', tone:'success', onClick:() => setAssignAdminLesson(lesson) },
                        {
                          label:'Arkibkan pelajaran',
                          tone:'danger',
                          description:'Sembunyikan daripada katalog aktif.',
                          onClick:() => requestDeleteLesson(lesson),
                        },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
      {confirmPublish && (
        <ConfirmModal
          title={confirmPublish.type === 'lesson' ? 'Terbitkan pelajaran?' : 'Terbitkan item silibus?'}
          confirmLabel={confirmPublish.issues?.length ? 'Tutup' : (confirmPublish.type === 'lesson' ? 'Terbitkan Pelajaran' : 'Terbitkan Silibus')}
          busy={busy === confirmPublish.type}
          maxWidth={560}
          onCancel={() => setConfirmPublish(null)}
          onConfirm={confirmPublish.issues?.length ? () => setConfirmPublish(null) : (confirmPublish.type === 'lesson' ? createLesson : createSyllabus)}
        >
          {confirmPublish.issues?.length ? (
            <div>
              <div style={{ color:C.red, fontWeight:900, marginBottom:6 }}>Lengkapkan perkara berikut sebelum terbit:</div>
              {confirmPublish.issues.map((issue, i) => (
                <div key={i} style={{ marginBottom:4 }}>- {issue}</div>
              ))}
            </div>
          ) : (
            <ContentPublishPreview
              type={confirmPublish.type}
              syllabusForm={syllabusForm}
              lessonForm={lessonForm}
              syllabusItems={syllabusState.data || []}
              quizQuestions={quizQuestions}
              quizDraft={quizDraft}
            />
          )}
        </ConfirmModal>
      )}
      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.type === 'lesson' ? 'Arkibkan pelajaran?' : 'Arkibkan item silibus?'}
          confirmLabel={confirmDelete.type === 'lesson' ? 'Arkibkan Pelajaran' : 'Arkibkan Silibus'}
          danger
          busy={busy === confirmDelete.item?.id}
          expectedText={confirmDelete.type === 'lesson' ? cleanContentTitle(confirmDelete.item?.title, '') : undefined}
          expectedLabel="Taip tajuk pelajaran untuk sahkan"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmContentDelete}
        >
          {confirmDelete.type === 'lesson'
            ? 'Pelajaran ini akan dipindahkan ke keadaan arkib dan disembunyikan daripada katalog aktif. Tugasan serta rekod sedia ada tidak dipadam.'
            : 'Item silibus ini akan dipindahkan ke keadaan arkib. Semak pelajaran berkaitan sebelum meneruskan.'}
        </ConfirmModal>
      )}
      {previewLesson && <LessonPreviewModal lesson={previewLesson} onClose={() => setPreviewLesson(null)} />}
      {assignAdminLesson && <AdminAssignLessonModal lesson={assignAdminLesson} onClose={() => setAssignAdminLesson(null)} />}
    </div>
  );
};

const AdminSystem = () => {
  const systemState = useAdminSystem();
  const healthState = useAdminHealth();
  const [busy, setBusy] = React.useState('');
  const [notice, setNotice] = React.useState(null);
  const [showConfig, setShowConfig] = React.useState(false);
  const [confirmConfigReveal, setConfirmConfigReveal] = React.useState(false);
  const [confirmCache, setConfirmCache] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(null);
  const narrowSystem = useNarrow(720);
  const system = systemState.data || {};
  const config = system.config || {};
  const sync = system.sync || {};
  const backup = system.backup || {};

  const refreshSystem = () => {
    systemState.refresh();
    healthState.refresh();
    setLastRefresh(new Date());
  };

  React.useEffect(() => {
    if (!systemState.loading && !healthState.loading) setLastRefresh(new Date());
  }, [systemState.loading, healthState.loading]);

  const requestConfigReveal = () => {
    if (showConfig) {
      setShowConfig(false);
      return;
    }
    if (window.tusyenUser?.role !== 'admin') {
      setNotice({ message:'Hanya admin boleh melihat konfigurasi sensitif.', error:true });
      return;
    }
    setConfirmConfigReveal(true);
  };

  const clearCache = async (confirmed = false) => {
    if (confirmed !== true) {
      setConfirmCache(true);
      return;
    }
    setBusy('cache');
    setNotice({ message:'Membersihkan cache Redis...', error:false });
    try {
      await window.tusyenApi.clearAdminCache();
      setNotice({ message:'Cache Redis dibersihkan.', error:false });
      refreshSystem();
    } catch (err) {
      setNotice({ message:err.message || 'Tidak dapat membersihkan cache.', error:true });
    } finally {
      setBusy('');
    }
  };

  const testNotification = async () => {
    setBusy('notification');
    setNotice({ message:'Menghantar notifikasi ujian...', error:false });
    try {
      const data = await window.tusyenApi.testAdminNotification({
        title:'Tusyen Admin',
        message:'Semakan notifikasi daripada panel admin.',
      });
      if (data.success === false) throw new Error(data.result?.error || 'Provider notifikasi menolak ujian notifikasi.');
      setNotice({ message:data.subscribeUrl ? `Notifikasi ujian dihantar. Topik: ${data.subscribeUrl}` : 'Notifikasi ujian dihantar.', error:false });
      refreshSystem();
    } catch (err) {
      setNotice({ message:err.message || 'Tidak dapat menghantar notifikasi ujian.', error:true });
    } finally {
      setBusy('');
    }
  };

  const configRows = [
    ['Environment', config.nodeEnv || '-'],
    ['Port API', config.port || '-'],
    ['Keycloak Realm', config.keycloakRealm || '-'],
    ['Keycloak Client', config.keycloakClientId || '-'],
    ['NTFY', config.ntfyEnabled ? 'enabled' : 'disabled'],
    ['Sync Batch', config.syncBatchSize || '-'],
    ['Sync History', `${config.maxSyncHistoryDays || '-'} hari`],
    ['Log masuk contoh admin', config.demoAdminLoginEnabled ? 'Aktif' : 'Tidak aktif'],
    ['Public Admin Register', config.publicAdminRegistrationEnabled ? 'enabled' : 'disabled'],
  ];

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>Sistem</div>
          <div style={{ fontSize:20, color:C.text, fontWeight:900 }}>Operasi Platform</div>
          <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, marginTop:2 }}>
            {lastRefresh ? `Kemas kini terakhir: ${formatDateTime(lastRefresh.toISOString())}` : 'Belum dikemas kini'}
          </div>
        </div>
        <SmallButton onClick={refreshSystem}>Segar</SmallButton>
      </div>

      <InlineNotice message={notice?.message} error={notice?.error} />

      {systemState.error && (
        <div style={{ marginBottom:10 }}>
          <ErrorRetry message="Ringkasan sistem tidak dapat dimuat." onRetry={systemState.refresh} />
        </div>
      )}

      <ThemeSettingsCard />

      <SectionLabel>Status Perkhidmatan</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:narrowSystem ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap:8, marginBottom:14 }}>
        {healthState.loading ? [0,1,2].map(i => (
          <Card key={i} style={{ padding:12, minHeight:112 }}>
            <Skeleton width="66%" height={13} radius={7} style={{ marginBottom:8 }} />
            <Skeleton width="82%" height={10} radius={5} style={{ marginBottom:12 }} />
            <Skeleton width={72} height={18} radius={999} />
          </Card>
        )) : (healthState.data || []).map((m, i) => (
          <HealthStatusCard key={m.label || i} metric={m} />
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:9 }}>
        <div style={{
          fontWeight:800,
          fontSize:11,
          color:C.textMuted,
          textTransform:'uppercase',
          letterSpacing:.8,
        }}>Konfigurasi Pelayan</div>
        <SmallButton onClick={requestConfigReveal}>
          {showConfig ? 'Sembunyi' : 'Tunjuk'}
        </SmallButton>
      </div>
      <Card style={{ marginBottom:14, padding:'10px 14px' }}>
        {systemState.loading ? [0,1,2,3,4].map(i => (
          <Skeleton key={i} width="100%" height={18} radius={8} style={{ marginBottom:i < 4 ? 8 : 0 }} />
        )) : (
          <>
            {!showConfig && (
              <div style={{
                fontSize:10,
                color:C.textFaint,
                fontWeight:800,
                lineHeight:1.35,
                paddingBottom:8,
                borderBottom:`1px solid ${C.border}`,
                marginBottom:2,
              }}>
                Butiran konfigurasi disembunyikan secara lalai. Gunakan Tunjuk hanya bila perlu.
              </div>
            )}
            {configRows.map((row, i) => (
              <div key={row[0]} style={{
                display:'flex', justifyContent:'space-between', gap:10,
                padding:'7px 0',
                borderBottom:i < configRows.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>{row[0]}</div>
                <div style={{
                  fontSize:11,
                  color:showConfig ? C.text : C.textFaint,
                  fontWeight:800,
                  textAlign:'right',
                  overflowWrap:'anywhere',
                  userSelect:showConfig ? 'text' : 'none',
                }}>{showConfig ? String(row[1]) : maskConfigValue(row[1])}</div>
              </div>
            ))}
          </>
        )}
      </Card>

      <SectionLabel>Sinkronisasi</SectionLabel>
      <Card style={{ marginBottom:14, padding:'12px 14px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <div style={{ fontSize:22, color:C.blue, fontWeight:900 }}>{fmt(sync.registeredDevices || 0)}</div>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>Peranti berdaftar</div>
          </div>
          <div>
            <div style={{ fontSize:22, color:C.gold, fontWeight:900 }}>{fmt(sync.pendingQueues || 0)}</div>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>Giliran tertunggak</div>
          </div>
        </div>
        <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:8 }}>
          Sync terakhir: {sync.latestSyncAt ? window.timeAgo(sync.latestSyncAt) : 'Belum ada data'}
        </div>
      </Card>

      <SectionLabel>Penyelenggaraan</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'grid', gap:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:C.text, fontWeight:900 }}>Cache Redis</div>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>Kosongkan cache laporan dan leaderboard.</div>
            </div>
            <SmallButton danger disabled={busy === 'cache'} onClick={clearCache}>
              {busy === 'cache' ? 'Proses' : 'Bersih'}
            </SmallButton>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, color:C.text, fontWeight:900 }}>Notifikasi</div>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>Hantar ujian notifikasi ke ntfy.</div>
            </div>
            <SmallButton success disabled={busy === 'notification'} onClick={testNotification}>
              {busy === 'notification' ? 'Proses' : 'Uji'}
            </SmallButton>
          </div>
        </div>
      </Card>

      <SectionLabel>Sandaran</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:C.text, fontWeight:900 }}>Postgres backup</div>
            <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, lineHeight:1.35 }}>
              {backup.note || 'Sandaran dijalankan di luar proses aplikasi.'}
            </div>
          </div>
          <div style={{ display:'grid', justifyItems:'end', gap:5 }}>
            <Badge tone="warn">{backup.mode || 'external'}</Badge>
            <div style={{ fontSize:9, color:C.textFaint, fontWeight:600, textAlign:'right', lineHeight:1.25 }}>
              Jalankan pg_dump atau snapshot volume di server.
            </div>
          </div>
        </div>
      </Card>

      <AccountActionsCard />
      {confirmCache && (
        <ConfirmModal
          title="Bersihkan cache Redis?"
          confirmLabel="Bersih Cache"
          danger
          busy={busy === 'cache'}
          onCancel={() => setConfirmCache(false)}
          onConfirm={async () => { setConfirmCache(false); await clearCache(true); }}
        >
          Cache laporan dan leaderboard akan dijana semula selepas tindakan ini.
        </ConfirmModal>
      )}
      {confirmConfigReveal && (
        <ConfirmModal
          title="Tunjuk konfigurasi sensitif?"
          confirmLabel="Tunjuk Konfigurasi"
          expectedText="TUNJUK"
          expectedLabel="Taip TUNJUK untuk sahkan"
          onCancel={() => setConfirmConfigReveal(false)}
          onConfirm={() => { setShowConfig(true); setConfirmConfigReveal(false); }}
        >
          Nilai konfigurasi pelayan akan dipaparkan dalam skrin admin ini. Elakkan berkongsi skrin atau menyalin nilai jika tidak diperlukan.
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Admin Classrooms ──────────────────────────────────────────────────────

const useAdminClassroomsList = ({ search, teacherId, activeFilter, formLevel }) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return [];
    const data = await window.tusyenApi.adminClassrooms({
      search: search || undefined,
      teacherId: teacherId || undefined,
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
    });
    const rows = data.classrooms || [];
    return formLevel === 'all' ? rows : rows.filter(cls => String(cls.form_level || '') === String(formLevel));
  }, [search, teacherId, activeFilter, formLevel], []);
};

const useAdminUsersList = (role, search = '', limit = 200) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return [];
    const data = await window.tusyenApi.adminUsers({ role, search: search.trim() || undefined, limit }).catch(() => ({ users:[] }));
    return (data.users || []).map(u => ({
      id:u.id,
      name:cleanUserName(u),
      email:u.email || '',
      displayEmail:cleanEmailDisplay(u.email, 42, '', u.role),
      role:u.role,
      shortId:shortId(u.id),
    }));
  }, [role, search, limit], []);
};

const SearchableUserSelect = ({ role, value, onChange, selectedLabel, placeholder = 'Cari pengguna...', emptyLabel = 'Pilih pengguna' }) => {
  const [query, setQuery] = React.useState('');
  const usersState = useAdminUsersList(role, query, 30);
  const options = usersState.data || [];
  const comboOptions = options.map(userOption);
  const selectedOption = value && selectedLabel && !comboOptions.some(option => option.value === value)
    ? [{ value, label:selectedLabel, description:'' }]
    : [];
  const hasSelectedOption = value && options.some(option => option.id === value);
  return (
    <div style={{ display:'grid', gap:6 }}>
      <AdminCombobox
        options={[...selectedOption, ...comboOptions]}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        loading={usersState.loading}
        query={query}
        onQueryChange={setQuery}
      />
      <select value={value || ''} onChange={e => onChange(e.target.value)} aria-hidden="true" tabIndex="-1" style={{ ...inputBase, display:'none' }}>
        <option value="">— {emptyLabel} —</option>
        {value && selectedLabel && !hasSelectedOption && <option value={value}>{selectedLabel}</option>}
        {options.map(option => (
          <option key={option.id} value={option.id}>{option.name}{option.displayEmail ? ` - ${option.displayEmail}` : ''}</option>
        ))}
      </select>
      <div style={{ fontSize:10, color:C.textFaint, fontWeight:800, lineHeight:1.3 }}>
        {usersState.loading ? 'Mencari...' : `${fmt(options.length)} hasil teratas. Taip nama atau e-mel untuk menapis.`}
      </div>
    </div>
  );
};

const AdminClassroomsPage = () => {
  const [search, setSearch] = React.useState('');
  const [searchQ, setSearchQ] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [formFilter, setFormFilter] = React.useState('all');
  const [teacherFilter, setTeacherFilter] = React.useState('');
  const classroomsState = useAdminClassroomsList({ search: searchQ, teacherId:teacherFilter, activeFilter, formLevel:formFilter });
  const studentsState = useAdminUsersList('student');
  const [expanded, setExpanded] = React.useState(null);
  const [classStudents, setClassStudents] = React.useState({});
  const [rosterState, setRosterState] = React.useState({});
  const [addStudentId, setAddStudentId] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [editingClassroom, setEditingClassroom] = React.useState(null);
  const [newCls, setNewCls] = React.useState({ name:'', subject:'Matematik', formLevel:'4', teacherId:'' });
  const [busy, setBusy] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [msgErr, setMsgErr] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(null);
  const [confirmClassStatus, setConfirmClassStatus] = React.useState(null);
  const narrow = useNarrow(820);

  const setOk = (m) => { setMsg(m); setMsgErr(false); };
  const setErr = (m) => { setMsg(m); setMsgErr(true); };

  const applyClassSearch = () => setSearchQ(search.trim());
  const clearClassSearch = () => {
    setSearch('');
    setSearchQ('');
  };

  const loadStudents = async (classroomId, force = false) => {
    if (!force && (rosterState[classroomId]?.loading || rosterState[classroomId]?.loaded)) return;
    setRosterState(prev => ({ ...prev, [classroomId]:{ loading:true, error:'', loaded:false } }));
    try {
      const data = await window.tusyenApi.adminClassroomStudents(classroomId);
      setClassStudents(prev => ({ ...prev, [classroomId]: data.students || [] }));
      setRosterState(prev => ({ ...prev, [classroomId]:{ loading:false, error:'', loaded:true } }));
    } catch (e) {
      setClassStudents(prev => ({ ...prev, [classroomId]: [] }));
      setRosterState(prev => ({
        ...prev,
        [classroomId]:{
          loading:false,
          error:e.message || 'Roster kelas tidak dapat dimuat.',
          loaded:true,
        },
      }));
    }
  };

  const toggleExpand = (id) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) loadStudents(next);
  };

  const toggleActive = async (cls) => {
    setBusy(cls.id); setMsg('');
    try {
      await window.tusyenApi.toggleAdminClassroom(cls.id, !cls.is_active);
      setOk(cls.is_active ? 'Kelas dinyahaktifkan.' : 'Kelas diaktifkan.');
      setConfirmClassStatus(null);
      classroomsState.refresh();
    } catch (e) { setErr(e.message || 'Tidak dapat menukar status.'); }
    finally { setBusy(''); }
  };

  const requestClassStatus = (cls) => {
    setConfirmClassStatus({ cls, isActive:cls.is_active === false });
  };

  const createClassroom = async () => {
    if (!newCls.name.trim()) { setErr('Nama kelas diperlukan.'); return; }
    if (!newCls.teacherId) { setErr('Pilih guru untuk kelas.'); return; }
    setBusy('create'); setMsg('');
    try {
      await window.tusyenApi.createAdminClassroom({
        name: newCls.name.trim(),
        subject: newCls.subject,
        formLevel: Number(newCls.formLevel),
        teacherId: newCls.teacherId || undefined,
      });
      setOk('Kelas dicipta.');
      setCreating(false);
      setNewCls({ name:'', subject:'Matematik', formLevel:'4', teacherId:'' });
      classroomsState.refresh();
    } catch (e) { setErr(e.message || 'Tidak dapat mencipta kelas.'); }
    finally { setBusy(''); }
  };

  const startEditClassroom = (cls) => {
    setEditingClassroom({
      id:cls.id,
      name:cls.name || '',
      subject:cls.subject || 'Matematik',
      formLevel:String(cls.form_level || '4'),
      teacherId:cls.teacher_id || '',
      teacherName:cleanTeacherDisplayName(cls.teacher_name, '', 'Guru dipilih'),
    });
    setCreating(false);
    setMsg('');
  };

  const saveClassroom = async () => {
    if (!editingClassroom?.id) return;
    if (!editingClassroom.name.trim()) { setErr('Nama kelas diperlukan.'); return; }
    if (!editingClassroom.teacherId) { setErr('Pilih guru untuk kelas.'); return; }
    setBusy('editclass'); setMsg('');
    try {
      await window.tusyenApi.updateAdminClassroom(editingClassroom.id, {
        name: editingClassroom.name.trim(),
        subject: editingClassroom.subject,
        formLevel: Number(editingClassroom.formLevel),
        teacherId: editingClassroom.teacherId,
      });
      setOk('Kelas dikemas kini.');
      setEditingClassroom(null);
      classroomsState.refresh();
    } catch (e) { setErr(e.message || 'Tidak dapat mengemas kini kelas.'); }
    finally { setBusy(''); }
  };

  const addStudent = async (classroomId) => {
    const sid = addStudentId.trim();
    if (!sid) return;
    setBusy('addstud'); setMsg('');
    try {
      await enrollAdminClassroomStudent(classroomId, sid);
      setOk('Pelajar didaftarkan.');
      setAddStudentId('');
      const data = await window.tusyenApi.adminClassroomStudents(classroomId);
      setClassStudents(prev => ({ ...prev, [classroomId]: data.students || [] }));
      setRosterState(prev => ({ ...prev, [classroomId]:{ loading:false, error:'', loaded:true } }));
      classroomsState.refresh();
    } catch (e) { setErr(e.message || 'Tidak dapat mendaftarkan pelajar.'); }
    finally { setBusy(''); }
  };

  const removeStudent = async (classroomId, studentId) => {
    setBusy(studentId); setMsg('');
    try {
      await window.tusyenApi.removeStudentFromAdminClassroom(classroomId, studentId);
      setOk('Pelajar dikeluarkan.');
      setConfirmRemove(null);
      setClassStudents(prev => ({ ...prev, [classroomId]: (prev[classroomId] || []).filter(s => s.id !== studentId) }));
      setRosterState(prev => ({ ...prev, [classroomId]:{ loading:false, error:'', loaded:true } }));
      classroomsState.refresh();
    } catch (e) { setErr(e.message || 'Tidak dapat mengeluarkan pelajar.'); }
    finally { setBusy(''); }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px 0', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:narrow ? 'wrap' : 'nowrap' }}>
          <div style={{ flex:'1 1 220px', minWidth:0, minHeight:44, display:'flex', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'8px 10px' }}>
            <span style={{ color:C.textFaint }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyClassSearch(); }}
              placeholder="Cari kelas..."
              aria-label="Cari kelas"
              style={{ flex:1, minWidth:0, minHeight:44, background:'none', border:'none', outline:'none', fontFamily:'Nunito', fontSize:13, fontWeight:700, color:C.text }}
            />
            {(search || searchQ) && (
              <button
                type="button"
                onClick={clearClassSearch}
                aria-label="Kosongkan carian kelas"
                style={{ background:'none', border:'none', color:C.textFaint, cursor:'pointer', minWidth:44, minHeight:44, fontFamily:'Nunito', fontWeight:900 }}
              >x</button>
            )}
          </div>
          <SmallButton onClick={applyClassSearch} disabled={classroomsState.loading && search.trim() === searchQ} style={{ flex:narrow ? '1 1 108px' : '0 0 auto' }}>Cari</SmallButton>
          <SmallButton onClick={() => { setCreating(v => !v); setEditingClassroom(null); setMsg(''); }} style={{ flex:narrow ? '1 1 108px' : '0 0 auto' }}>+ Cipta</SmallButton>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:narrow ? '1fr 1fr' : '120px 120px minmax(220px, 1fr)', gap:8, marginBottom:8 }}>
          <Field label="Status">
            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} style={inputBase}>
              <option value="all">Semua</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </select>
          </Field>
          <Field label="Tingkatan">
            <select value={formFilter} onChange={e => setFormFilter(e.target.value)} style={inputBase}>
              <option value="all">Semua</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </Field>
          <Field label="Guru" style={narrow ? { gridColumn:'1 / -1' } : undefined}>
            <SearchableUserSelect
              role="teacher"
              value={teacherFilter}
              onChange={setTeacherFilter}
              placeholder="Tapis mengikut guru..."
              emptyLabel="Semua guru"
            />
          </Field>
        </div>
        {msg && <div style={{ fontSize:11, fontWeight:800, color:msgErr ? C.red : C.green, marginBottom:8 }}>{msg}</div>}
        {creating && (
          <Card style={{ marginBottom:10 }}>
            <div style={{ fontWeight:900, fontSize:13, color:C.accPale, marginBottom:8 }}>Kelas Baharu</div>
            <div style={{ display:'grid', gap:8 }}>
              <Field label="Nama"><input value={newCls.name} onChange={e => setNewCls(p => ({ ...p, name:e.target.value }))} style={inputBase} /></Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label="Subjek">
                  <select value={newCls.subject} onChange={e => setNewCls(p => ({ ...p, subject:e.target.value }))} style={inputBase}>
                    {['Matematik','Sains','Fizik','Kimia','Biologi','English','Sejarah'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Tingkatan">
                  <select value={newCls.formLevel} onChange={e => setNewCls(p => ({ ...p, formLevel:e.target.value }))} style={inputBase}>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </Field>
              </div>
              <Field label="Guru">
                <SearchableUserSelect
                  role="teacher"
                  value={newCls.teacherId}
                  onChange={teacherId => setNewCls(p => ({ ...p, teacherId }))}
                  placeholder="Cari guru untuk kelas..."
                  emptyLabel="Pilih guru"
                />
              </Field>
              <div style={{ display:'flex', gap:8 }}>
                <GlowButton onClick={createClassroom} disabled={busy === 'create'} style={{ flex:1, padding:'9px 12px', fontSize:13 }}>{busy === 'create' ? 'Mencipta...' : 'Cipta Kelas'}</GlowButton>
                <SmallButton onClick={() => setCreating(false)}>Batal</SmallButton>
              </div>
            </div>
          </Card>
        )}
        {editingClassroom && (
          <Card style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ fontWeight:900, fontSize:13, color:C.accPale }}>Edit Kelas</div>
              <Badge>{editingClassroom.teacherName || 'Guru dipilih'}</Badge>
            </div>
            <div style={{ display:'grid', gap:8 }}>
              <Field label="Nama">
                <input value={editingClassroom.name} onChange={e => setEditingClassroom(p => ({ ...p, name:e.target.value }))} style={inputBase} />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <Field label="Subjek">
                  <select value={editingClassroom.subject} onChange={e => setEditingClassroom(p => ({ ...p, subject:e.target.value }))} style={inputBase}>
                    {['Matematik','Sains','Fizik','Kimia','Biologi','English','Sejarah'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Tingkatan">
                  <select value={editingClassroom.formLevel} onChange={e => setEditingClassroom(p => ({ ...p, formLevel:e.target.value }))} style={inputBase}>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </Field>
              </div>
              <Field label="Guru">
                <SearchableUserSelect
                  role="teacher"
                  value={editingClassroom.teacherId}
                  selectedLabel={editingClassroom.teacherName}
                  onChange={teacherId => setEditingClassroom(p => ({ ...p, teacherId }))}
                  placeholder="Cari guru untuk kelas..."
                  emptyLabel="Pilih guru"
                />
              </Field>
              <div style={{ display:'flex', gap:8 }}>
                <GlowButton onClick={saveClassroom} disabled={busy === 'editclass'} style={{ flex:1, padding:'9px 12px', fontSize:13 }}>
                  {busy === 'editclass' ? 'Menyimpan...' : 'Simpan Kelas'}
                </GlowButton>
                <SmallButton onClick={() => setEditingClassroom(null)}>Batal</SmallButton>
              </div>
            </div>
          </Card>
        )}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 10px' }}>
        {classroomsState.loading ? [0,1,2,3].map(i => (
          <Card key={i} style={{ marginBottom:8 }}>
            <Skeleton width="60%" height={13} radius={7} style={{ marginBottom:8 }} />
            <Skeleton width="40%" height={10} radius={5} />
          </Card>
        )) : classroomsState.error ? (
          <ErrorRetry message="Tidak dapat memuat kelas." onRetry={classroomsState.refresh} />
        ) : (classroomsState.data || []).length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:C.textFaint, fontSize:13, fontWeight:700, lineHeight:1.45 }}>
            {searchQ || teacherFilter || activeFilter !== 'all' || formFilter !== 'all'
              ? 'Tiada kelas sepadan dengan carian atau penapis semasa.'
              : 'Belum ada kelas dicipta.'}
          </div>
        ) : (classroomsState.data || []).map(cls => {
          const isOpen = expanded === cls.id;
          const roster = classStudents[cls.id] || [];
          const rosterStatus = rosterState[cls.id] || {};
          const teacherLabel = cls.teacher_name ? cleanTeacherDisplayName(cls.teacher_name, '', 'Guru') : '';
          return (
            <Card key={cls.id} style={{ marginBottom:8, padding:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:narrow ? 'wrap' : 'nowrap' }}>
                <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => toggleExpand(cls.id)}>
                  <div title={cleanClassName(cls.name)} style={{ fontWeight:900, fontSize:13, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cleanClassName(cls.name)}</div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5 }}>
                    <Badge tone="neutral">{cleanSubjectLabel(cls.subject)}</Badge>
                    <Badge tone="neutral">T{cls.form_level || '-'}</Badge>
                  </div>
                  <div title={teacherLabel} style={{ fontSize:10, color:C.textFaint, fontWeight:700, marginTop:5, overflowWrap:'anywhere' }}>
                    {cleanSubjectLabel(cls.subject)} - T{cls.form_level || '-'}
                    {teacherLabel ? ` - ${teacherLabel}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => toggleExpand(cls.id)}
                  aria-label={`${cls.student_count ?? 0} pelajar dalam ${cleanClassName(cls.name)}`}
                  style={{
                    minWidth:58,
                    minHeight:44,
                    background:'rgba(56,189,248,.10)',
                    border:'1px solid rgba(56,189,248,.28)',
                    borderRadius:10,
                    padding:'5px 8px',
                    color:C.blue,
                    fontFamily:'Nunito',
                    cursor:'pointer',
                  }}
                >
                  <div style={{ fontSize:18, fontWeight:900, lineHeight:1 }}>{fmt(cls.student_count ?? 0)}</div>
                  <div style={{ fontSize:9, fontWeight:900, textTransform:'uppercase', lineHeight:1.1 }}>Pelajar</div>
                </button>
                <div style={{ display:'flex', gap:5, flexShrink:0, alignItems:'flex-start', flexWrap:'wrap', justifyContent:'flex-end' }}>
                  <Badge tone={cls.is_active !== false ? 'good' : 'warn'}>{cls.is_active !== false ? 'Aktif' : 'Tidak aktif'}</Badge>
                  <AdminActionMenu
                    label="Aksi"
                    ariaLabel={`Tindakan kelas ${cleanClassName(cls.name)}`}
                    items={[
                      { label:isOpen ? 'Tutup butiran' : 'Buka butiran', onClick:() => toggleExpand(cls.id) },
                      { label:'Edit kelas', onClick:() => startEditClassroom(cls) },
                      {
                        label:cls.is_active !== false ? 'Nyahaktifkan kelas' : 'Aktifkan kelas',
                        tone:cls.is_active !== false ? 'danger' : 'success',
                        disabled:busy === cls.id,
                        description:cls.is_active !== false ? 'Pelajar tidak akan nampak kelas aktif.' : 'Kelas kembali tersedia.',
                        onClick:() => requestClassStatus(cls),
                      },
                    ]}
                  />
                </div>
              </div>
              {isOpen && (
                <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                  <div style={{ fontWeight:800, fontSize:11, color:C.textMuted, textTransform:'uppercase', marginBottom:8 }}>Pelajar Dalam Kelas</div>
                  {rosterStatus.loading ? (
                    <div style={{ display:'grid', gap:6, marginBottom:8 }}>
                      {[0,1,2].map(i => <Skeleton key={i} width="100%" height={30} radius={8} />)}
                    </div>
                  ) : rosterStatus.error ? (
                    <div style={{ marginBottom:8 }}>
                      <ErrorRetry message="Roster pelajar kelas ini tidak dapat dimuat." onRetry={() => loadStudents(cls.id, true)} />
                    </div>
                  ) : roster.length === 0 ? (
                    <div style={{
                      border:`1px dashed ${C.border}`,
                      borderRadius:10,
                      padding:'10px 12px',
                      color:C.textFaint,
                      fontSize:11,
                      fontWeight:800,
                      lineHeight:1.45,
                      marginBottom:8,
                    }}>
                      Belum ada pelajar dalam kelas ini. Cari pelajar di bawah untuk menambah enrolmen.
                    </div>
                  ) : roster.map((s, i) => (
                    <div key={s.id || i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < roster.length - 1 ? `1px solid ${C.border}` : 'none', minWidth:0 }}>
                      <Avatar name={cleanUserName(s)} size={26} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cleanUserName(s)}</div>
                        <div title={cleanEmailDisplay(s.email, 42, '', 'student')} style={{ fontSize:10, color:C.textFaint, fontWeight:600, overflowWrap:'anywhere' }}>{cleanEmailDisplay(s.email, 42, '', 'student')}</div>
                      </div>
                      <AdminActionMenu
                        label="Aksi"
                        ariaLabel={`Tindakan pelajar ${cleanUserName(s)}`}
                        items={[
                          {
                            label:'Keluarkan pelajar',
                            tone:'danger',
                            disabled:busy === s.id,
                            description:'Nyahaktifkan enrolmen kelas.',
                            onClick:() => setConfirmRemove({ classroomId:cls.id, student:s, classroom:cls }),
                          },
                        ]}
                      />
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:narrow ? 'wrap' : 'nowrap' }}>
                    <div style={{ flex:'1 1 220px', minWidth:0 }}>
                      <Field label="Enroll Student">
                        <input
                          value={addStudentId}
                          onChange={e => setAddStudentId(e.target.value)}
                          placeholder="Student UUID atau e-mel"
                          style={inputBase}
                        />
                      </Field>
                    </div>
                    <div style={{ flex:'1 1 220px', minWidth:0 }}>
                      <SearchableUserSelect
                        role="student"
                        value={addStudentId}
                        onChange={setAddStudentId}
                        placeholder="Atau cari pelajar sedia ada..."
                        emptyLabel="Pilih pelajar"
                      />
                    </div>
                    <select value={addStudentId} onChange={e => setAddStudentId(e.target.value)} aria-hidden="true" tabIndex="-1" style={{ display:'none' }}>
                      <option value="">— Pilih pelajar —</option>
                      {(studentsState.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <SmallButton disabled={busy === 'addstud' || !addStudentId.trim()} onClick={() => addStudent(cls.id)} style={{ flex:narrow ? '1 1 108px' : '0 0 auto' }}>
                      {busy === 'addstud' ? 'Mendaftar...' : 'Daftar'}
                    </SmallButton>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {confirmClassStatus && (
        <ConfirmModal
          title={confirmClassStatus.isActive ? 'Aktifkan kelas?' : 'Nyahaktifkan kelas?'}
          confirmLabel={confirmClassStatus.isActive ? 'Aktifkan' : 'Nyahaktifkan'}
          danger={!confirmClassStatus.isActive}
          busy={busy === confirmClassStatus.cls?.id}
          onCancel={() => setConfirmClassStatus(null)}
          onConfirm={() => toggleActive(confirmClassStatus.cls)}
        >
          {confirmClassStatus.isActive
            ? `${cleanClassName(confirmClassStatus.cls?.name)} akan tersedia semula untuk guru dan pelajar.`
            : `${cleanClassName(confirmClassStatus.cls?.name)} akan disembunyikan daripada senarai aktif tanpa memadam rekod.`}
        </ConfirmModal>
      )}
      {confirmRemove && (
        <ConfirmModal
          title="Keluarkan pelajar daripada kelas?"
          confirmLabel="Keluarkan"
          danger
          busy={busy === confirmRemove.student?.id}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => removeStudent(confirmRemove.classroomId, confirmRemove.student?.id)}
        >
          {cleanUserName(confirmRemove.student || {})} akan dikeluarkan daripada {cleanClassName(confirmRemove.classroom?.name, 'kelas ini')}.
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Admin Parent Links ─────────────────────────────────────────────────────

const AdminParentLinksSection = () => {
  const [links, setLinks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const parentsState = useAdminUsersList('parent');
  const studentsState = useAdminUsersList('student');
  const [selectedParent, setSelectedParent] = React.useState('');
  const [selectedStudent, setSelectedStudent] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [msgErr, setMsgErr] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(null);

  const setOk = (m) => { setMsg(m); setMsgErr(false); };
  const setErr = (m) => { setMsg(m); setMsgErr(true); };

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await window.tusyenApi.adminParentLinks();
      setLinks(data.links || data.parentLinks || []);
    } catch { setLinks([]); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { loadLinks(); }, []);

  const linksByFamily = React.useMemo(() => {
    const groups = new Map();
    links.forEach((link) => {
      const parentId = link.parent_id || link.parentId || link.parent_email || link.parentEmail || 'parent';
      if (!groups.has(parentId)) {
        groups.set(parentId, {
          id:parentId,
          parentName:cleanPersonName(link.parent_name || link.parentName, link.parent_email || link.parentEmail, 'parent', 'Ibu Bapa'),
          parentEmail:cleanEmailDisplay(link.parent_email || link.parentEmail, 42, '', 'parent'),
          parentRawEmail:link.parent_email || link.parentEmail || '',
          links:[],
        });
      }
      groups.get(parentId).links.push(link);
    });
    return Array.from(groups.values());
  }, [links]);

  const addLink = async () => {
    if (!selectedParent || !selectedStudent) { setErr('Pilih ibu bapa dan pelajar.'); return; }
    setBusy('add'); setMsg('');
    try {
      await window.tusyenApi.createAdminParentLink(selectedParent, selectedStudent);
      setOk('Pautan ditambah.');
      setSelectedParent(''); setSelectedStudent('');
      loadLinks();
    } catch (e) { setErr(e.message || 'Tidak dapat menambah pautan.'); }
    finally { setBusy(''); }
  };

  const removeLink = async (id) => {
    setBusy(id); setMsg('');
    try {
      await deactivateAdminParentLink(id);
      setOk('Pautan dinyahaktifkan.');
      setConfirmRemove(null);
      loadLinks();
    } catch (e) { setErr(e.message || 'Tidak dapat menyahaktifkan pautan.'); }
    finally { setBusy(''); }
  };

  return (
    <div>
      <SectionLabel>🔗 Pautan Ibu Bapa–Pelajar</SectionLabel>
      {msg && <div style={{ fontSize:11, fontWeight:800, color:msgErr ? C.red : C.green, marginBottom:8 }}>{msg}</div>}
      <Card style={{ marginBottom:10 }}>
        <div style={{ fontWeight:900, fontSize:12, color:C.accPale, marginBottom:8 }}>Tambah Pautan Baharu</div>
        <div style={{ display:'grid', gap:8 }}>
          <Field label="Ibu Bapa">
            <SearchableUserSelect
              role="parent"
              value={selectedParent}
              onChange={setSelectedParent}
              placeholder="Cari ibu bapa..."
              emptyLabel="Tiada ibu bapa ditemui"
            />
            <select value={selectedParent} onChange={e => setSelectedParent(e.target.value)} aria-hidden="true" tabIndex="-1" style={{ ...inputBase, display:'none' }}>
              <option value="">— Pilih ibu bapa —</option>
              {(parentsState.data || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Pelajar">
            <SearchableUserSelect
              role="student"
              value={selectedStudent}
              onChange={setSelectedStudent}
              placeholder="Cari pelajar..."
              emptyLabel="Tiada pelajar ditemui"
            />
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} aria-hidden="true" tabIndex="-1" style={{ ...inputBase, display:'none' }}>
              <option value="">— Pilih pelajar —</option>
              {(studentsState.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <SmallButton disabled={busy === 'add' || !selectedParent || !selectedStudent} onClick={addLink} style={{ justifySelf:'start' }}>Tambah Pautan</SmallButton>
        </div>
      </Card>
      <Card style={{ marginBottom:14, padding:'10px 14px' }}>
        {loading ? [0,1,2].map(i => <Skeleton key={i} width="100%" height={28} radius={8} style={{ marginBottom:6 }} />) :
        links.length === 0 ? (
          <div style={{ display:'grid', gap:6, fontSize:12, color:C.textFaint, fontWeight:700 }}>
            <Badge tone="warn" style={{ justifySelf:'start' }}>Belum dipautkan</Badge>
            <div>Tiada pautan ibu bapa-pelajar.</div>
          </div>
        ) : linksByFamily.map((family, familyIndex) => (
          <div key={family.id} style={{
            padding:'9px 0',
            borderBottom:familyIndex < linksByFamily.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:7, flexWrap:'wrap' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, color:C.text, fontWeight:900, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{family.parentName}</div>
                <div title={family.parentEmail || 'Tiada e-mel ibu bapa'} style={{ fontSize:10, color:C.textFaint, fontWeight:700, overflowWrap:'anywhere' }}>{family.parentEmail || 'Tiada e-mel ibu bapa'}</div>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'flex-end' }}>
                <Badge tone="good">Dipautkan</Badge>
                <Badge>{family.links.length} pelajar</Badge>
              </div>
            </div>
            <div style={{ display:'grid', gap:6 }}>
              {family.links.map((link, i) => (
                (() => {
                  const linkActive = (link.is_active ?? link.isActive) !== false;
                  return (
                <div key={link.id || i} style={{
                  display:'grid',
                  gridTemplateColumns:'minmax(0, 1fr) auto',
                  gap:8,
                  alignItems:'center',
                  border:`1px solid ${C.border}`,
                  borderRadius:10,
                  padding:'8px 9px',
                  background:C.surface,
                }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:900, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {cleanPersonName(link.student_name || link.studentName, link.student_email || link.studentEmail, 'student', 'Pelajar')}
                    </div>
                    <div title={cleanEmailDisplay(link.student_email || link.studentEmail, 42, 'Tiada e-mel pelajar', 'student')} style={{ fontSize:10, color:C.textFaint, fontWeight:700, overflowWrap:'anywhere' }}>
                      {cleanEmailDisplay(link.student_email || link.studentEmail, 42, 'Tiada e-mel pelajar', 'student')}
                    </div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5 }}>
                      <Badge tone={(link.is_active ?? link.isActive) === false ? 'warn' : 'good'}>
                        {(link.is_active ?? link.isActive) === false ? 'Tidak aktif' : 'Aktif'}
                      </Badge>
                      <Badge>{formatDateTime(link.created_at || link.createdAt)}</Badge>
                      {(link.created_by || link.createdBy) && <Badge title={cleanPersonLogLabel(link.created_by || link.createdBy, 'admin', 'Admin')}>Dicipta oleh {cleanPersonLogLabel(link.created_by || link.createdBy, 'admin', 'Admin')}</Badge>}
                    </div>
                  </div>
                  <AdminActionMenu
                    label="Aksi"
                    ariaLabel={`Tindakan pautan ${family.parentName}`}
                    items={[
                      {
                        label:'Nyahaktifkan pautan',
                        tone:'danger',
                        description:'Nyahaktifkan pautan keluarga ini.',
                        disabled:busy === link.id || !linkActive,
                        onClick:() => setConfirmRemove(link),
                      },
                    ]}
                  />
                </div>
                  );
                })()
              ))}
            </div>
          </div>
        ))}
      </Card>
      <Card style={{ display:'none', marginBottom:14, padding:'10px 14px' }}>
        {loading ? [0,1,2].map(i => <Skeleton key={i} width="100%" height={28} radius={8} style={{ marginBottom:6 }} />) :
        links.length === 0 ? (
          <div style={{ fontSize:12, color:C.textFaint, fontWeight:600 }}>Tiada pautan ibu bapa–pelajar.</div>
        ) : links.map((link, i) => (
          <div key={link.id || i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom: i < links.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:800, color:C.text }}>
                {cleanPersonName(link.parent_name || link.parentName, link.parent_email || link.parentEmail, 'parent', 'Ibu Bapa')} -> {cleanPersonName(link.student_name || link.studentName, link.student_email || link.studentEmail, 'student', 'Pelajar')}
              </div>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>
                {cleanEmailDisplay(link.parent_email || link.parentEmail, 42, '', 'parent')} - {cleanEmailDisplay(link.student_email || link.studentEmail, 42, '', 'student')}
              </div>
            </div>
            <AdminActionMenu
              label="Aksi"
              ariaLabel={`Tindakan pautan ${cleanPersonName(link.parent_name || link.parentName, link.parent_email || link.parentEmail, 'parent', 'ibu bapa')}`}
              disabled={busy === link.id}
              items={[
                {
                  label:'Nyahaktifkan pautan',
                  tone:'danger',
                  disabled:(link.is_active ?? link.isActive) === false,
                  description:'Nyahaktifkan pautan keluarga ini.',
                  onClick:() => setConfirmRemove(link),
                },
              ]}
            />
          </div>
        ))}
      </Card>
      {confirmRemove && (
        <ConfirmModal
          title="Nyahaktifkan pautan keluarga?"
          confirmLabel="Nyahaktifkan Pautan"
          danger
          busy={busy === confirmRemove.id}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => removeLink(confirmRemove.id)}
        >
          Pautan antara {cleanPersonName(confirmRemove.parent_name || confirmRemove.parentName, confirmRemove.parent_email || confirmRemove.parentEmail, 'parent', 'ibu bapa')} dan {cleanPersonName(confirmRemove.student_name || confirmRemove.studentName, confirmRemove.student_email || confirmRemove.studentEmail, 'student', 'pelajar')} akan dinyahaktifkan.
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Admin App ─────────────────────────────────────────────────────────────

const AdminSidebar = ({ navItems, active, onNav, user, onSignOut, extraTop }) => {
  const { language } = useLanguage();
  const displayName = cleanPersonName(user?.fullName || user?.full_name, user?.email, 'admin', user?.email || 'Admin');
  return (
    <aside className="sidebar-wrap" aria-label="Navigasi admin">
      <div style={{ padding:'22px 20px 18px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:38,
            height:38,
            borderRadius:12,
            flexShrink:0,
            background:'linear-gradient(135deg, var(--acc-lo), var(--acc))',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            fontSize:20,
            boxShadow:`0 4px 16px ${C.accGlow}`,
          }} aria-hidden="true">T</div>
          <div className="sidebar-logo-text" style={{ fontWeight:800, fontSize:22, lineHeight:1 }}>
            <span style={{ color:C.accPale }}>Tu</span><span style={{ color:C.text }}>syen</span>
          </div>
        </div>
      </div>

      {extraTop}

      <div className="sidebar-user" style={{ padding:'16px 16px 14px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <Avatar name={displayName} size={42} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>Admin</div>
          </div>
        </div>
        <Badge tone="good">Panel Admin</Badge>
      </div>

      <nav className="sidebar-nav" aria-label="Navigasi utama admin" style={{ flex:1, padding:'12px 10px' }}>
        {navItems.map(item => {
          const on = active === item.id;
          const visibleLabel = languageText(item.label, item.en, language);
          const label = `${item.label}${item.en ? ` / ${item.en}` : ''}`;
          return (
            <button
              key={item.id}
              className="sidebar-nav-button"
              onClick={() => onNav(item.id)}
              aria-label={label}
              aria-current={on ? 'page' : undefined}
              title={label}
              style={{
                display:'flex',
                alignItems:'center',
                gap:12,
                width:'100%',
                padding:'11px 12px',
                marginBottom:3,
                background:on ? C.accDim : 'transparent',
                border:`1px solid ${on ? C.borderB : 'transparent'}`,
                borderRadius:12,
                cursor:'pointer',
                color:on ? C.accHi : C.textMuted,
                fontFamily:'Nunito',
                fontWeight:on ? 700 : 600,
                fontSize:14,
                textAlign:'left',
                transition:'all .15s',
              }}
            >
              <NavIcon item={item} />
              <div className="sidebar-label" style={{ flex:1 }}>
                <div lang={language} style={{ lineHeight:1.2, color:on ? C.accHi : C.text }}>{visibleLabel}</div>
                {item.en && language === 'ms' && <div lang="en" style={{ fontSize:10, fontWeight:600, color:on ? C.accPale : C.textFaint, lineHeight:1 }}>{item.en}</div>}
              </div>
              {on && <div aria-hidden="true" style={{ width:7, height:7, borderRadius:'50%', background:C.acc, boxShadow:`0 0 8px ${C.accGlow}`, flexShrink:0 }} />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom" style={{ padding:'14px 14px 18px', borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
        <div className="sidebar-label" style={{ display:'grid', gap:6, marginBottom:10 }}>
          <Badge tone="neutral" style={{ justifyContent:'center' }}>Operasi</Badge>
          <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.35, textAlign:'center' }}>
            Urus pengguna, kelas, kandungan, dan sistem.
          </div>
        </div>
        <ThemeToggle />
        <div style={{ marginTop:8 }}>
          <LanguageToggle compact />
        </div>
        <button className="topbar-signout" onClick={onSignOut} aria-label="Log keluar" style={{
          width:'100%',
          marginTop:8,
          background:'rgba(239,68,68,.10)',
          border:'1px solid rgba(239,68,68,.30)',
          color:C.red,
          borderRadius:10,
          padding:'8px 10px',
          minHeight:44,
          fontFamily:'Nunito',
          fontWeight:700,
          fontSize:12,
          cursor:'pointer',
        }}><span aria-hidden="true">🚪</span> <span className="sidebar-label">Log Keluar</span></button>
      </div>
    </aside>
  );
};

const AdminApp = ({ sidebarExtraTop } = {}) => {
  const [screen, setScreen] = React.useState('home');
  const nav = [
    { id:'home',       icon:'📊', label:'Papan Pemuka', en:'Dashboard'    },
    { id:'users',      icon:'👥', label:'Pengguna',     en:'Users'        },
    { id:'links',      icon:'🔗', label:'Ibu Bapa',     en:'Parent Links' },
    { id:'classrooms', icon:'🏫', label:'Kelas',        en:'Classrooms'   },
    { id:'content',    icon:'📚', label:'Kandungan',    en:'Content'      },
    { id:'settings',   icon:'⚙️', label:'Sistem',       en:'System'       },
  ];

  const screenMeta = {
    home:       { title:'Tusyen Admin',  en:'Dashboard'    },
    users:      { title:'Pengguna',      en:'User Mgmt'    },
    links:      { title:'Ibu Bapa',      en:'Parent Links' },
    classrooms: { title:'Kelas',         en:'Classrooms'   },
    content:    { title:'Kandungan',     en:'Content'      },
    settings:   { title:'Sistem',        en:'Operations'   },
  };
  const meta = screenMeta[screen] || screenMeta.home;
  useScreenFocus(screen);

  return (
    <div className="app-shell admin-shell mobile-bottom-nav">
      <AdminSidebar
        navItems={nav}
        active={screen}
        onNav={setScreen}
        user={window.tusyenUser}
        onSignOut={() => window.tusyenSignOut?.()}
        extraTop={sidebarExtraTop}
      />
      <main id="main-content" className="main-area" tabIndex="-1" aria-label={`${meta.title}${meta.en ? ` / ${meta.en}` : ''}`}>
        <TopBarMobile
          title={meta.title}
          subtitle={meta.en}
          right={<Avatar name={window.tusyenUser?.fullName || 'A'} size={32} />}
        />
        <DataModeBanner role="admin" />
        <div className="main-content" key={screen}>
          <h1 className="sr-only">{meta.title}{meta.en ? ` / ${meta.en}` : ''}</h1>
          {screen === 'home'       && <AdminDash go={setScreen} />}
          {screen === 'users'      && <AdminUsers />}
          {screen === 'links'      && <div style={{ padding:'14px 16px 10px' }}><AdminParentLinksSection /></div>}
          {screen === 'classrooms' && <AdminClassroomsPage />}
          {screen === 'content'    && <AdminContent />}
          {screen === 'settings'   && <AdminSystem />}
        </div>
        <BottomNavMobile items={nav} active={screen} onNav={setScreen} label="Navigasi admin" />
      </main>
    </div>
  );
};

window.AdminApp = AdminApp;
