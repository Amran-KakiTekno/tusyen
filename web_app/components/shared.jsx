// Tusyen — Shared Design Tokens & Base Components v2
// Ported from the Claude Design handoff (Tusyen v2.html).

const C = {
  bg:'var(--c-bg)', surface:'var(--c-surface)', card:'var(--c-card)', cardB:'var(--c-card-b)',
  text:'var(--c-text)', textMuted:'var(--c-text2)', textFaint:'var(--c-text3)',
  border:'var(--c-bdr)', borderB:'var(--c-bdr-b)',
  acc:'var(--c-acc)', accHi:'var(--c-acc-hi)', accLo:'var(--c-acc-lo)',
  accPale:'var(--c-acc-pale)', accDim:'var(--c-acc-dim)', accGlow:'var(--c-acc-glow)',
  gold:'#F5A623', orange:'#FF9600', red:'#EF4444', green:'#22C55E', blue:'#38BDF8',
};

const UI_TEXT = {
  actions:'Tindakan',
  cancel:'Batal',
  close:'Tutup',
  confirm:'Sahkan',
  delete:'Padam',
  loading:'Memproses...',
};
const LANGUAGE_KEY = 'tusyen_language';
const LANGUAGE_EVENT = 'tusyen-language-change';
const LANGUAGE_OPTIONS = [
  { id:'ms', label:'BM', name:'Bahasa Melayu' },
  { id:'en', label:'EN', name:'English' },
];
const normalizeLanguage = (value) => value === 'en' ? 'en' : 'ms';
const readLanguage = () => {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return 'ms';
  }
};
const applyLanguage = (language, { persist = true } = {}) => {
  const next = normalizeLanguage(language);
  document.documentElement.lang = next;
  document.documentElement.dataset.language = next;
  try {
    if (persist) localStorage.setItem(LANGUAGE_KEY, next);
  } catch {}
  return next;
};
applyLanguage(readLanguage(), { persist:false });
const languageText = (ms, en, language = readLanguage()) =>
  normalizeLanguage(language) === 'en' && en ? en : ms;
const makeBilingualLabel = (label, en) => languageText(label || '', en);
const useLanguage = () => {
  const [language, setLanguageState] = React.useState(readLanguage);
  React.useEffect(() => {
    applyLanguage(readLanguage(), { persist: false });
    const sync = () => setLanguageState(readLanguage());
    scheduleStaticTranslation(readLanguage());
    window.addEventListener(LANGUAGE_EVENT, sync);
    const onStorage = (event) => {
      if (event.key === LANGUAGE_KEY) {
        const next = normalizeLanguage(event.newValue);
        applyLanguage(next, { persist: false });
        setLanguageState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const setLanguage = React.useCallback((next) => {
    const applied = applyLanguage(next);
    setLanguageState(applied);
    scheduleStaticTranslation(applied);
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail:{ language:applied } }));
  }, []);
  const t = React.useCallback((ms, en) => languageText(ms, en, language), [language]);
  return { language, setLanguage, t };
};

const STATIC_TRANSLATIONS = new Map([
  ['Akaun', 'Account'],
  ['Aktif', 'Active'],
  ['Amaran', 'Alerts'],
  ['Anak', 'Children'],
  ['Bahasa', 'Language'],
  ['Batal', 'Cancel'],
  ['Belajar', 'Learn'],
  ['Belum ada kelas', 'No classes yet'],
  ['Belum ada markah direkodkan.', 'No scores recorded yet.'],
  ['Belum ada pelajaran', 'No lessons yet'],
  ['Belum ada soalan', 'No questions yet'],
  ['Buat kelas dahulu untuk boleh mulakan sesi kuiz langsung.', 'Create a class first before starting a live quiz session.'],
  ['Belum mula', 'Not started'],
  ['Benar / palsu', 'True / false'],
  ['Buang soalan', 'Remove question'],
  ['Buang soalan?', 'Remove question?'],
  ['Cipta Akaun', 'Create Account'],
  ['Cipta kelas pertama anda', 'Create your first class'],
  ['Cuba lagi', 'Retry'],
  ['Cerah', 'Light'],
  ['Dapatkan PIN daripada guru untuk masuk ke sesi langsung.', 'Get the PIN from your teacher to join the live session.'],
  ['Dek baharu', 'New deck'],
  ['Dek kuiz', 'Quiz deck'],
  ['Dek Kuiz', 'Quiz Decks'],
  ['DEK KUIZ', 'QUIZ DECKS'],
  ['Detail Kelas', 'Class Detail'],
  ['Dijeda', 'Paused'],
  ['Gelap', 'Dark'],
  ['Guru', 'Teacher'],
  ['Hari Streak', 'Day Streak'],
  ['Ibu Bapa', 'Parent'],
  ['Jawapan tidak dapat dihantar.', 'Answer could not be submitted.'],
  ['Jeda', 'Pause'],
  ['Jumlah Soalan', 'Total Questions'],
  ['JUMLAH SOALAN', 'TOTAL QUESTIONS'],
  ['KELAS', 'CLASSES'],
  ['Kandungan', 'Content'],
  ['Kata Laluan', 'Password'],
  ['Kembali ke dek', 'Back to decks'],
  ['Kelas', 'Classes'],
  ['Kelas Saya', 'My Classes'],
  ['Kemajuan', 'Progress'],
  ['Keputusan', 'Results'],
  ['Keputusan Kuiz', 'Quiz Results'],
  ['Ketepatan', 'Accuracy'],
  ['Ketepatan Setiap Soalan', 'Accuracy By Question'],
  ['Kimia', 'Chemistry'],
  ['Komponen kuiz tidak dapat dimuatkan.', 'Quiz component could not be loaded.'],
  ['Kuiz ini telah tamat. Minta PIN sesi baharu daripada guru.', 'This quiz has ended. Ask your teacher for a new session PIN.'],
  ['Kuiz', 'Quiz'],
  ['Kuiz baharu', 'New Quiz'],
  ['Kuiz langsung', 'Live quiz'],
  ['Lobi', 'Lobby'],
  ['Log Keluar', 'Sign Out'],
  ['Log Masuk', 'Sign In'],
  ['Langkau ke kandungan utama', 'Skip to main content'],
  ['Matematik', 'Mathematics'],
  ['Masukkan PIN 6 digit daripada guru', 'Enter the 6-digit PIN from your teacher'],
  ['Memadam...', 'Deleting...'],
  ['Memeriksa sesi kuiz aktif...', 'Checking active quiz session...'],
  ['Memproses...', 'Processing...'],
  ['Memulakan...', 'Starting...'],
  ['Menunggu guru memulakan...', 'Waiting for the teacher to start...'],
  ['Menyambung ke sesi langsung...', 'Connecting to the live session...'],
  ['Menyertai...', 'Joining...'],
  ['Menyimpan...', 'Saving...'],
  ['Mulakan', 'Start'],
  ['Mulakan Kuiz', 'Start Quiz'],
  ['Nama Penuh', 'Full Name'],
  ['Nama panggilan', 'Nickname'],
  ['Nama panggilan diperlukan.', 'Nickname is required.'],
  ['Navigasi admin', 'Admin navigation'],
  ['Navigasi bawah', 'Bottom navigation'],
  ['Papan Putih', 'Whiteboard'],
  ['Papan Skor Langsung', 'Live Scoreboard'],
  ['Padam dek', 'Delete deck'],
  ['Padam dek kuiz?', 'Delete quiz deck?'],
  ['Paparan PIN', 'PIN Display'],
  ['PELAJAR', 'STUDENTS'],
  ['Pelajar', 'Student'],
  ['Pelajaran', 'Lessons'],
  ['Pemantauan', 'Monitoring'],
  ['Pengguna', 'Users'],
  ['Peranan', 'Role'],
  ['Peserta', 'Participants'],
  ['Peserta Teratas', 'Top Participants'],
  ['PIN mesti 6 digit.', 'PIN must be 6 digits.'],
  ['PIN tidak sah. Semak 6 digit daripada guru dan cuba lagi.', 'Invalid PIN. Check the 6 digits from your teacher and try again.'],
  ['Pilih bahasa', 'Choose language'],
  ['Pilih Kelas', 'Select Class'],
  ['Pilih kelas dahulu.', 'Select a class first.'],
  ['Pilih tema warna', 'Choose color theme'],
  ['Pilihan jawapan', 'Multiple choice'],
  ['Pos', 'Posts'],
  ['Pos Kelas', 'Class Posts'],
  ['Profil', 'Profile'],
  ['Profil Guru', 'Teacher Profile'],
  ['Ringkasan Kuiz Saya', 'My Quiz Summary'],
  ['Sains', 'Science'],
  ['Salin', 'Copy'],
  ['Salin dek', 'Copy deck'],
  ['Sambung', 'Resume'],
  ['Sedang berjalan', 'In progress'],
  ['Sejarah', 'History'],
  ['Selesai', 'Done'],
  ['Sertai Kuiz', 'Join Quiz'],
  ['Sertai Kuiz dengan PIN', 'Join Quiz With PIN'],
  ['Sertai Sekarang', 'Join Now'],
  ['Sesi Terkini', 'Recent Sessions'],
  ['Sila tunggu...', 'Please wait...'],
  ['Simpan', 'Save'],
  ['Simpan dek', 'Save deck'],
  ['Sistem', 'System'],
  ['Soalan', 'Questions'],
  ['Soalan Seterusnya', 'Next Question'],
  ['Subjek', 'Subject'],
  ['SUBJEK', 'SUBJECTS'],
  ['Sunting', 'Edit'],
  ['Sunting dek', 'Edit deck'],
  ['Tajuk dek', 'Deck title'],
  ['Tajuk wajib diisi.', 'Deck title is required.'],
  ['Tambah sekurang-kurangnya satu soalan lengkap.', 'Add at least one complete question.'],
  ['Tandai untuk tindak lanjut', 'Flag for follow-up'],
  ['Tamat', 'Ended'],
  ['Tamatkan', 'End'],
  ['Teks soalan...', 'Question text...'],
  ['Tiada mesej dihantar; tindakan ini hanya menyimpan tanda tindak lanjut.', 'No message is sent; this only saves a follow-up flag.'],
  ['Tema', 'Theme'],
  ['Tetapan', 'Settings'],
  ['Tindakan lanjut', 'More actions'],
  ['Tindakan lanjut soalan', 'More question actions'],
  ['Tidak dapat memulakan kuiz.', 'Could not start the quiz.'],
  ['Tidak dapat menamatkan kuiz.', 'Could not end the quiz.'],
  ['Tidak dapat mengemas kini pemasa.', 'Could not update the timer.'],
  ['Tidak dapat pergi ke soalan seterusnya.', 'Could not move to the next question.'],
  ['Tiada dek lagi. Cipta dek pertama anda.', 'No decks yet. Create your first deck.'],
  ['Tutup', 'Close'],
  ['Utama', 'Home'],
]);

const STATIC_TRANSLATION_PATTERNS = [
  [/^\+ Tambah Soalan$/, '+ Add Question'],
  [/^(\d+) soalan$/, '$1 questions'],
  [/^(\d+) soalan - (.+)$/, '$1 questions - $2'],
  [/^(\d+) peserta dalam lobi$/, '$1 participants in lobby'],
  [/^(\d+) peserta$/, '$1 participants'],
  [/^(\d+) sesi - (.+) XP diperoleh$/, '$1 sessions - $2 XP earned'],
  [/^(\d+)\/(\d+) betul$/, '$1/$2 correct'],
  [/^(.+)\sPelajar$/, '$1 Student'],
  [/^(.+)\sGuru$/, '$1 Teacher'],
  [/^(.+)\sIbu Bapa$/, '$1 Parent'],
  [/^Tindakan lanjut untuk (.+)$/, 'More actions for $1'],
  [/^Form (\d+)$/, 'Form $1'],
  [/^Pilihan ([A-Z])$/, 'Option $1'],
  [/^PIN Kuiz \(6 digit\)$/, 'Quiz PIN (6 digits)'],
  [/^Soalan (\d+)$/, 'Question $1'],
  [/^Tingkatan (\d+)$/, 'Form $1'],
  [/^Dek "(.+)" akan dibuang daripada senarai guru\.$/, 'Deck "$1" will be removed from the teacher list.'],
  [/^Soalan (\d+) akan dikeluarkan daripada draf dek ini\.$/, 'Question $1 will be removed from this deck draft.'],
];

const TRANSLATED_TEXT_NODES = new WeakMap();
const TRANSLATED_ATTRS = new WeakMap();
let staticTranslationObserver = null;
let staticTranslationPending = false;

const translateStaticString = (value, language = readLanguage()) => {
  if (language !== 'en' || typeof value !== 'string' || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  const core = value.trim();
  const exact = STATIC_TRANSLATIONS.get(core);
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, replacement] of STATIC_TRANSLATION_PATTERNS) {
    if (pattern.test(core)) return `${leading}${core.replace(pattern, replacement)}${trailing}`;
  }
  return value;
};

const shouldSkipStaticTextNode = (node) => {
  const parent = node?.parentElement;
  if (!parent) return true;
  return ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)
    || parent.closest?.('[data-no-static-translate="true"]');
};

const translateTextNode = (node, language) => {
  if (shouldSkipStaticTextNode(node)) return;
  let original = TRANSLATED_TEXT_NODES.get(node);
  const current = node.nodeValue || '';
  if (!original || (current !== original && current !== translateStaticString(original, 'en'))) {
    original = current;
    TRANSLATED_TEXT_NODES.set(node, original);
  }
  const next = language === 'en' ? translateStaticString(original, language) : original;
  if (current !== next) node.nodeValue = next;
};

const translateElementAttrs = (element, language) => {
  if (!element?.getAttribute || element.closest?.('[data-no-static-translate="true"]')) return;
  const attrs = ['aria-label', 'placeholder', 'title'];
  let originals = TRANSLATED_ATTRS.get(element);
  if (!originals) {
    originals = {};
    TRANSLATED_ATTRS.set(element, originals);
  }
  attrs.forEach((attr) => {
    if (!element.hasAttribute(attr)) return;
    const current = element.getAttribute(attr) || '';
    const original = originals[attr] || current;
    if (!originals[attr] || (current !== original && current !== translateStaticString(original, 'en'))) {
      originals[attr] = current;
    }
    const nextOriginal = originals[attr] || current;
    const next = language === 'en' ? translateStaticString(nextOriginal, language) : nextOriginal;
    if (current !== next) element.setAttribute(attr, next);
  });
};

const walkStaticTranslation = (root, language) => {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttrs(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
    else if (node.nodeType === Node.ELEMENT_NODE) translateElementAttrs(node, language);
    node = walker.nextNode();
  }
};

const scheduleStaticTranslation = (language = readLanguage()) => {
  if (staticTranslationPending) return;
  staticTranslationPending = true;
  const run = () => {
    staticTranslationPending = false;
    if (document.body) walkStaticTranslation(document.body, normalizeLanguage(language));
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else window.setTimeout(run, 0);
};

const startStaticTranslationObserver = () => {
  if (staticTranslationObserver || !document.body || typeof MutationObserver === 'undefined') return;
  staticTranslationObserver = new MutationObserver((mutations) => {
    const language = readLanguage();
    if (language !== 'en') return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target, language);
      } else if (mutation.type === 'attributes') {
        translateElementAttrs(mutation.target, language);
      } else {
        mutation.addedNodes.forEach((node) => walkStaticTranslation(node, language));
      }
    }
  });
  staticTranslationObserver.observe(document.body, {
    childList:true,
    subtree:true,
    characterData:true,
    attributes:true,
    attributeFilter:['aria-label', 'placeholder', 'title'],
  });
  scheduleStaticTranslation(readLanguage());
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startStaticTranslationObserver, { once:true });
} else {
  window.setTimeout(startStaticTranslationObserver, 0);
}

const THEME_KEY = 'tusyen_theme';
const THEME_SOURCE_KEY = 'tusyen_theme_source';
const THEME_EVENT = 'tusyen-theme-change';
const getSystemTheme = () => {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};
const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    const source = localStorage.getItem(THEME_SOURCE_KEY);
    if (stored === 'light') return stored;
    if (stored === 'dark' && source === 'manual') return stored;
    return null;
  } catch {
    return null;
  }
};
const readTheme = () => {
  return readStoredTheme() || getSystemTheme();
};
const applyTheme = (theme, { persist = true } = {}) => {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  try {
    if (persist) {
      localStorage.setItem(THEME_KEY, next);
      localStorage.setItem(THEME_SOURCE_KEY, 'manual');
    }
  } catch {}
  return next;
};
applyTheme(readTheme(), { persist:false });

try {
  const systemThemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  systemThemeQuery?.addEventListener?.('change', () => {
    if (readStoredTheme()) return;
    const next = applyTheme(getSystemTheme(), { persist:false });
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail:{ theme:next } }));
  });
} catch {}

const useTheme = () => {
  const [theme, setThemeState] = React.useState(readTheme);
  React.useEffect(() => {
    const sync = () => setThemeState(readTheme());
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const setTheme = React.useCallback((next) => {
    const applied = applyTheme(next);
    setThemeState(applied);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail:{ theme:applied } }));
  }, []);
  return { theme, setTheme };
};

(function () {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes tv2-pulse {
      0%,100%{ box-shadow:0 0 16px var(--c-acc-glow); }
      50%    { box-shadow:0 0 36px var(--c-acc-glow),
                          0 0 64px color-mix(in srgb,var(--c-acc) 18%,transparent); }
    }
    @keyframes tv2-pop {
      from { opacity:0; transform:scale(.86) translateY(-6px); }
      to   { opacity:1; transform:scale(1)   translateY(0);    }
    }
    @keyframes tv2-slidedown {
      from { opacity:0; transform:translateY(-12px); }
      to   { opacity:1; transform:translateY(0);     }
    }
    @keyframes tv2-sheetup {
      from { opacity:0; transform:translateY(18px); }
      to   { opacity:1; transform:translateY(0);    }
    }
    @keyframes tv2-trophy {
      0%   { opacity:0; transform:scale(.5) rotate(-12deg); }
      65%  {            transform:scale(1.12) rotate(4deg); }
      100% { opacity:1; transform:scale(1) rotate(0deg);    }
    }
    @keyframes tv2-starfade {
      from { opacity:0; transform:scale(0) rotate(-20deg); }
      to   { opacity:1; transform:scale(1) rotate(0deg);   }
    }
    @keyframes tv2-skeleton {
      from { background-position: 140% 0; }
      to   { background-position: -140% 0; }
    }
    .tv2-pulse     { animation: tv2-pulse 2.2s ease-in-out infinite !important; }
    .tv2-pop       { animation: tv2-pop .28s cubic-bezier(.34,1.56,.64,1) both; }
    .tv2-slidedown { animation: tv2-slidedown .2s ease forwards; }
    .tv2-sheetup   { animation: tv2-sheetup .22s ease forwards; }
    .tv2-skeleton  {
      background:linear-gradient(90deg,
        color-mix(in srgb,var(--c-card) 78%,var(--c-acc-dim)),
        color-mix(in srgb,var(--c-acc) 18%,var(--c-card)),
        color-mix(in srgb,var(--c-card) 78%,var(--c-acc-dim)));
      background-size:280% 100%;
      animation:tv2-skeleton 1.35s ease-in-out infinite;
    }
  `;
  document.head.appendChild(s);
}());

const useAsync = (fn, deps = [], initial = null) => {
  const [state, setState] = React.useState({ data:initial, loading:true, error:null });
  const [refreshKey, setRefreshKey] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshKey(k => k + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading:true, error:null }));
    Promise.resolve()
      .then(fn)
      .then(data => {
        if (!cancelled) setState({ data: data ?? initial, loading:false, error:null });
      })
      .catch(error => {
        if (!cancelled) {
          setState(prev => ({ data: prev.data ?? initial, loading:false, error }));
        }
      });
    return () => { cancelled = true; };
  }, [...deps, refreshKey]);

  return { ...state, refresh };
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const then = new Date(ts).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'Baru sahaja';
  if (min < 60) return `${min}m lepas`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}j lepas`;
  const d = Math.floor(hr / 24);
  return d === 1 ? 'Semalam' : `${d} hari lepas`;
};

const videoEmbedInfoFromUrl = (value) => {
  const raw = `${value || ''}`.trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  const safeTitle = 'Video';

  if (host === 'youtu.be') {
    const id = parts[0];
    if (id) return { src:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, title:safeTitle };
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const watchId = url.searchParams.get('v');
    const embedId = ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '';
    const id = watchId || embedId;
    if (id) return { src:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`, title:safeTitle };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parts[0] === 'video' ? parts[1] : parts.find(part => /^\d+$/.test(part));
    if (id) return { src:`https://player.vimeo.com/video/${encodeURIComponent(id)}`, title:safeTitle };
  }

  if (host === 'loom.com' || host.endsWith('.loom.com')) {
    const id = parts[0] === 'embed' || parts[0] === 'share' ? parts[1] : '';
    if (id) return { src:`https://www.loom.com/embed/${encodeURIComponent(id)}`, title:safeTitle };
  }

  return null;
};

const isVideoEmbedUrl = (value) => !!videoEmbedInfoFromUrl(value);

const VideoEmbed = ({ url, title, style:sx={} }) => {
  const info = videoEmbedInfoFromUrl(url);
  if (!info) return null;
  return (
    <div style={{
      position:'relative',
      width:'100%',
      aspectRatio:'16 / 9',
      overflow:'hidden',
      borderRadius:16,
      border:`1px solid ${C.border}`,
      background:C.bg,
      ...sx,
    }}>
      <iframe
        title={title || info.title}
        src={info.src}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          position:'absolute',
          inset:0,
          width:'100%',
          height:'100%',
          border:0,
        }}
      />
    </div>
  );
};

const titleCaseDisplayWords = (value) => `${value || ''}`
  .toLowerCase()
  .replace(/\b(kssm|spm|pt3|mcq|kbat|pin)\b/g, word => word.toUpperCase())
  .replace(/\b\w/g, letter => letter.toUpperCase());

const cleanUiText = (value, { fallback = 'Item', max = 80, preserveCase = false } = {}) => {
  const raw = `${value ?? ''}`.replace(/\s+/g, ' ').trim();
  if (!raw) return fallback;
  const hasInternalNoise =
    /\b(?:qa|qaqc|test|demo|seed|smoke|fixture|internal|autogen|generated|tmp|e2e|spec|playwright|automation|uuid|token|run)\b/i.test(raw)
    || /\babcdef[a-z0-9]*\b/i.test(raw)
    || /\b(?:qa|test|demo)[-_.\s]?(?:subject|subjek|lesson|pelajaran|teacher|guru|student|pelajar|parent|ibu|admin|classroom|class|kelas|syllabus|silibus|content|kandungan|topic|topik|subtopic|post|pos|quiz|kuiz|deck|event|log|alert|amaran|achievement|headline|specialty|credential|bio)\b/i.test(raw)
    || /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(raw)
    || /\b[0-9a-f]{12,}\b/i.test(raw)
    || /\b[A-Z0-9]{14,}\b/.test(raw)
    || /\b20\d{6,}\b/.test(raw)
    || /\b\d{9,}\b/.test(raw)
    || /[_/|]|[a-z0-9]-[a-z0-9]/i.test(raw);

  let cleaned = raw
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ' ')
    .replace(/\b[0-9a-f]{12,}\b/gi, ' ')
    .replace(/\b[A-Z0-9]{14,}\b/g, ' ')
    .replace(/\b(?:full|btn|seed|record|item|row|tmp|temp)[-_.]+[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]+--[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]{2,}\d{3,}\b/gi, ' ')
    .replace(/\babcdef[a-z0-9]*\b/gi, ' ')
    .replace(/\b(?:qa|test|demo)[-_.\s]?(?:subject|subjek|lesson|pelajaran|teacher|guru|student|pelajar|parent|ibu|admin|classroom|class|kelas|syllabus|silibus|content|kandungan|topic|topik|subtopic|post|pos|quiz|kuiz|deck|event|log|alert|amaran|achievement|headline|specialty|credential|bio)(?:[-_.\s]?\d{4,}|[-_.][a-z0-9]{3,})*\b/gi, ' ')
    .replace(/\b20\d{6,}(?:[-_.][a-z0-9]{3,})*\b/g, ' ')
    .replace(/\b\d{9,}\b/g, ' ')
    .replace(/\.[a-z0-9]{2,5}$/i, ' ')
    .replace(/[-_/|]+/g, ' ')
    .replace(/\b(?:qa|qaqc|test|demo|seed|smoke|fixture|internal|autogen|generated|tmp|e2e|spec|playwright|automation|uuid|token|run)\b/gi, ' ');

  if (hasInternalNoise) {
    cleaned = cleaned.replace(/\b(?:student|teacher|parent|admin|user|classroom|class|lesson|content|post|comment|deck|log|event|data|record|title|name|email|syllabus|silibus|topic|topik|subtopic|subject|subjek|alert|amaran|whiteboard|papan|session|sesi|bio|credential|credentials|headline|specialty|specialties|achievement)\b/gi, ' ');
  }

  cleaned = cleaned
    .replace(/\s+\([A-Z0-9]{5,12}\)$/g, match => /[0-9]/.test(match) ? '' : match)
    .replace(/\s+[A-Z0-9]{5,10}$/g, match => /[0-9]/.test(match) ? '' : match)
    .replace(/[._-]{2,}/g, ' ')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3 || /^(?:abcdef|qa|qaqc|test|demo|internal)$/i.test(cleaned)) return fallback;
  if (!preserveCase && (hasInternalNoise || cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase())) {
    cleaned = titleCaseDisplayWords(cleaned);
  }
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(1, max - 3)).trim()}...`;
};

const cleanUiName = (value, fallback = 'Pengguna') => cleanUiText(value, { fallback, max:42 });
const cleanUiTitle = (value, fallback = 'Tanpa tajuk') => cleanUiText(value, { fallback, max:68 });

const useCountUp = (target, duration = 1100) => {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let cur = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(Math.round(cur));
      if (cur >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
};

const TopBar = ({ title, subtitle, left, right }) => (
  <header style={{
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'10px 18px', minHeight:52, flexShrink:0,
    background:C.surface, borderBottom:`1px solid ${C.border}`,
  }}>
    <div style={{ minWidth:44, display:'flex', alignItems:'center' }}>{left}</div>
    <div style={{ textAlign:'center', flex:1, minWidth:0, padding:'0 8px' }}>
      <div style={{ fontWeight:700, fontSize:16, color:C.text, lineHeight:1.2 }}>{title}</div>
      {subtitle && <div lang="en" style={{ fontSize:11, color:C.textMuted, fontWeight:500, marginTop:1 }}>{subtitle}</div>}
    </div>
    <div style={{ minWidth:44, display:'flex', justifyContent:'flex-end', alignItems:'center' }}>{right}</div>
  </header>
);

const BottomNav = ({ items, active, onSelect }) => (
  <div style={{
    flexShrink:0, background:C.surface, borderTop:`1px solid ${C.border}`,
    display:'flex', alignItems:'flex-end', justifyContent:'space-around',
    paddingTop:10, paddingBottom:22,
  }}>
    {items.map(item => {
      const on = active === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          aria-label={`${item.label}${item.en ? ` / ${item.en}` : ''}`}
          aria-current={on ? 'page' : undefined}
          style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          gap:3, background:'none', border:'none', cursor:'pointer',
          color: on ? C.accHi : C.textFaint,
          padding:'4px 14px', position:'relative', transition:'color 0.2s',
        }}>
          {on && <div style={{
            position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)',
            width:36, height:3,
            background:'linear-gradient(90deg, var(--c-acc-lo), var(--c-acc-hi))',
            borderRadius:'0 0 4px 4px',
          }} />}
          <NavIcon item={item} size={22} />
          <span style={{ fontSize:12, fontWeight:600, letterSpacing:0.2 }}>{item.label}</span>
        </button>
      );
    })}
  </div>
);

const StatPill = ({ icon, value, color, label }) => (
  <div style={{
    display:'inline-flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
    background:`color-mix(in srgb, ${color} 12%, transparent)`,
    border:`1.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
    borderRadius:99, padding:'6px 12px', minHeight:44, minWidth:74,
    whiteSpace:'nowrap', textAlign:'center',
  }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, minWidth:0 }}>
      <span style={{ fontSize:15, lineHeight:1, flexShrink:0 }}>{icon}</span>
      <span style={{ fontWeight:900, fontSize:14, color, lineHeight:1 }}>{value}</span>
    </div>
    {label && <div style={{ fontSize:10, color:C.textMuted, fontWeight:800, lineHeight:1.05 }}>{label}</div>}
  </div>
);

const ProgressBar = ({
  value,
  max=100,
  color,
  height=8,
  style:sx={},
  label,
  valueText,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}) => {
  const maxValue = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100;
  const rawValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const currentValue = Math.min(Math.max(rawValue, 0), maxValue);
  const pct = (currentValue / maxValue) * 100;
  const fill = color
    ? `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 68%, white))`
    : 'linear-gradient(90deg, var(--c-acc-lo), var(--c-acc))';
  const glow = color
    ? `0 0 10px color-mix(in srgb, ${color} 34%, transparent)`
    : `0 0 10px ${C.accGlow}`;
  return (
    <div
      {...props}
      role="progressbar"
      aria-label={ariaLabel || label}
      aria-labelledby={ariaLabelledBy}
      aria-valuemin={0}
      aria-valuemax={maxValue}
      aria-valuenow={currentValue}
      aria-valuetext={valueText}
      style={{ height, borderRadius:999, background:C.accDim, overflow:'hidden', ...sx }}
    >
      <div style={{
        height:'100%', width:`${pct}%`, borderRadius:999,
        background:fill,
        boxShadow:glow,
        transition:'width 0.6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  );
};

const Card = ({ children, style:sx={}, onClick, warn, success, glow, flat }) => {
  const [hov, setHov] = React.useState(false);
  const isClick = !!onClick;
  const handleKeyDown = React.useCallback((event) => {
    if (!isClick || event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick?.(event);
  }, [isClick, onClick]);
  return (
    <div
      onClick={onClick}
      onKeyDown={isClick ? handleKeyDown : undefined}
      onMouseEnter={() => isClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      role={isClick ? 'button' : undefined}
      tabIndex={isClick ? 0 : undefined}
      style={{
        background: warn ? 'rgba(239,68,68,0.07)' : success ? 'rgba(34,197,94,0.07)' : flat ? 'transparent' : C.card,
        border:`1px solid ${
          warn    ? 'rgba(239,68,68,0.28)'  :
          success ? 'rgba(34,197,94,0.28)'  :
          glow    ? C.borderB               :
          hov     ? C.borderB               : C.border
        }`,
        borderRadius:16, padding:14,
        minWidth:0, maxWidth:'100%', overflowWrap:'anywhere',
        cursor: isClick ? 'pointer' : 'default',
        transform: hov && isClick ? 'translateY(-2px)' : 'none',
        boxShadow: glow ? `0 0 28px ${C.accGlow}` : hov && isClick ? '0 6px 28px rgba(90,20,180,.1)' : 'none',
        transition:'border-color .15s, transform .15s, box-shadow .15s',
        ...sx,
      }}
    >{children}</div>
  );
};

const GlowButton = ({ children, onClick, outlined, disabled, style:sx={}, color }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: outlined ? 'transparent'
      : (color || 'linear-gradient(135deg, var(--c-acc-lo), var(--c-acc))'),
    border: outlined ? `2px solid ${C.acc}` : 'none',
    color: outlined ? C.acc : '#fff',
    borderRadius:14, padding:'13px 20px',
    fontFamily:'Nunito, sans-serif', fontWeight:800, fontSize:15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width:'100%', minHeight:44, opacity: disabled ? 0.5 : 1,
    boxShadow: outlined ? 'none' : '0 4px 24px var(--c-acc-glow)',
    transition:'opacity .2s, transform .1s', letterSpacing:0.3, ...sx,
  }}>{children}</button>
);

const Avatar = ({ name='?', size=40, src }) => (
  <div style={{
    width:size, height:size, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg, var(--c-acc-lo), var(--c-acc-hi))',
    display:'flex', alignItems:'center', justifyContent:'center',
    overflow:'hidden',
    fontWeight:800, fontSize:size * 0.36, color:'#fff',
    border:`2px solid color-mix(in srgb, var(--c-acc) 30%, transparent)`,
  }}>
    {src ? (
      <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
    ) : (
      name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    )}
  </div>
);

const BackBtn = ({ onClick }) => (
  <button onClick={onClick} aria-label="Kembali" style={{
    background:C.accDim, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'5px 11px',
    minWidth:44, minHeight:44,
    color:C.accPale, cursor:'pointer', fontSize:18,
    fontFamily:'Nunito, sans-serif', lineHeight:1,
  }}><span aria-hidden="true">‹</span></button>
);

const SectionLabel = ({ children }) => (
  <div style={{
    fontWeight:700, fontSize:12, color:C.textMuted,
    textTransform:'uppercase', letterSpacing:0.8, marginBottom:9,
  }}>{children}</div>
);

const NotifBell = ({ count=0, onClick }) => (
  <button onClick={onClick} aria-label={count > 0 ? `Buka notifikasi, ${count} belum dibaca` : 'Buka notifikasi'} style={{
    background:'none', border:'none', cursor:'pointer',
    position:'relative', padding:2, lineHeight:1, fontSize:20,
    width:44, height:44, borderRadius:12,
  }}>
    <span aria-hidden="true">🔔</span>
    {count > 0 && (
      <span aria-hidden="true" style={{
        position:'absolute', top:-1, right:-1,
        minWidth:18, height:18, borderRadius:99,
        background:C.red, border:`1.5px solid ${C.surface}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:12, fontWeight:800, color:'#fff', padding:'0 3px',
      }}>{count > 9 ? '9+' : count}</span>
    )}
  </button>
);

const NotifPanel = ({ notifs, onClose }) => (
  <div onClick={onClose} style={{
    position:'fixed', inset:0, zIndex:400,
    background:'rgba(2,6,23,.55)', display:'flex', alignItems:'flex-end',
  }}>
    <div className="tv2-sheetup" onClick={(e) => e.stopPropagation()} style={{
      width:'100%', maxHeight:'82%', minHeight:'42%',
      background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden',
      borderRadius:'22px 22px 0 0', border:`1px solid ${C.border}`,
      boxShadow:'0 -18px 44px rgba(0,0,0,.28)',
    }}>
      <div style={{
        width:42, height:4, borderRadius:999, background:C.borderB,
        margin:'10px auto 0', flexShrink:0,
      }} />
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 18px 14px', borderBottom:`1px solid ${C.border}`,
        background:C.surface, flexShrink:0,
      }}>
        <div style={{ fontWeight:700, fontSize:16, color:C.text }}>Notifikasi</div>
        <button onClick={onClose} style={{
          background:C.accDim, border:`1px solid ${C.border}`, borderRadius:8,
          padding:'5px 14px', color:C.textMuted, cursor:'pointer',
          fontSize:12, fontWeight:700, fontFamily:'Nunito',
        }}>Tutup</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 18px', display:'flex', flexDirection:'column', gap:8 }}>
        {notifs.length === 0 ? (
          <div style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:14, padding:'18px 14px', textAlign:'center',
            color:C.textMuted, fontSize:12, fontWeight:600, lineHeight:1.45,
          }}>
            Tiada notifikasi baharu buat masa ini.
          </div>
        ) : notifs.map((n, i) => (
          <div key={i} className="tv2-pop" style={{
            background: n.unread ? C.accDim : C.card,
            border:`1px solid ${n.unread ? C.borderB : C.border}`,
            borderRadius:14, padding:'11px 12px',
            display:'flex', gap:10, alignItems:'flex-start',
            animationDelay:`${i * 0.05}s`,
          }}>
            <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{n.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:C.text, lineHeight:1.35 }}>{n.msg}</div>
              <div style={{ fontSize:10, color:C.textFaint, marginTop:3 }}>{n.time}</div>
            </div>
            {n.unread && (
              <div style={{ width:7, height:7, borderRadius:'50%', background:C.acc, flexShrink:0, marginTop:5 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon, title, subtitle }) => (
  <div style={{
    flex:1, display:'flex', flexDirection:'column', alignItems:'center',
    justifyContent:'center', gap:10, padding:32, textAlign:'center',
  }}>
    <div style={{ fontSize:48 }}>{icon}</div>
    <div style={{ fontWeight:700, fontSize:17, color:C.text }}>{title}</div>
    {subtitle && (
      <div style={{
        fontSize:13, color:C.textMuted, fontWeight:600,
        lineHeight:1.5, maxWidth:240,
      }}>{subtitle}</div>
    )}
  </div>
);

const Skeleton = ({ width='100%', height=16, radius=8, style:sx={} }) => (
  <div
    aria-hidden="true"
    className="tv2-skeleton"
    style={{ width, height, borderRadius:radius, flexShrink:0, ...sx }}
  />
);

const ErrorRetry = ({ message='Tidak dapat memuat data.', onRetry }) => (
  <Card warn style={{ padding:10 }}>
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{
        width:28, height:28, borderRadius:8, flexShrink:0,
        background:'rgba(239,68,68,.12)', color:C.red,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontWeight:900, fontSize:15,
      }}>!</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, color:C.red, fontWeight:800, lineHeight:1.35 }}>{message}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          background:'rgba(239,68,68,.10)',
          border:'1px solid rgba(239,68,68,.30)',
          borderRadius:9, padding:'6px 10px',
          minHeight:44,
          color:C.red, fontFamily:'Nunito', fontWeight:800,
          fontSize:12, cursor:'pointer', flexShrink:0,
        }}>Cuba lagi</button>
      )}
    </div>
  </Card>
);

const ThemeToggle = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  return (
    <div className="theme-toggle" role="group" aria-label="Pilih tema warna" style={{
      display:'grid', gridTemplateColumns:'1fr 1fr', gap:6,
      width:compact ? 148 : '100%',
    }}>
      {[
        { id:'dark', label:t('Gelap', 'Dark') },
        { id:'light', label:t('Cerah', 'Light') },
      ].map(option => {
        const on = theme === option.id;
        return (
          <button key={option.id} onClick={() => setTheme(option.id)} aria-pressed={on} style={{
            background:on ? C.accDim : 'transparent',
            border:`1.5px solid ${on ? C.borderB : C.border}`,
            color:on ? C.accPale : C.textMuted,
            borderRadius:10, padding:compact ? '8px 8px' : '9px 10px',
            fontFamily:'Nunito', fontWeight:on ? 700 : 600, fontSize:12,
            cursor:'pointer', minHeight:44,
          }}>{option.label}</button>
        );
      })}
    </div>
  );
};

const LanguageToggle = ({ compact = false, iconOnly = false }) => {
  const { language, setLanguage, t } = useLanguage();
  const narrow = useNarrow(620);
  if (iconOnly || (compact && narrow)) {
    const next = language === 'ms' ? 'en' : 'ms';
    return (
      <button
        type="button"
        className="language-toggle language-toggle-icon"
        onClick={() => setLanguage(next)}
        title={t('Tukar bahasa', 'Switch language')}
        aria-label={t('Tukar bahasa kepada English', 'Switch language to Bahasa Melayu')}
        style={{
          width:44, height:44, minWidth:44, minHeight:44,
          borderRadius:12,
          background:C.accDim,
          border:`1px solid ${C.border}`,
          color:C.accPale,
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          fontFamily:'Nunito',
          fontSize:12,
          fontWeight:900,
          cursor:'pointer',
        }}
      >
        <span aria-hidden="true">{language === 'ms' ? 'BM' : 'EN'}</span>
      </button>
    );
  }
  return (
    <div
      className={`language-toggle${compact ? ' compact' : ''}`}
      role="group"
      aria-label={t('Pilih bahasa', 'Choose language')}
      style={{
        display:'grid',
        gridTemplateColumns:'1fr 1fr',
        gap:6,
        width:'100%',
      }}
    >
      {LANGUAGE_OPTIONS.map(option => {
        const on = language === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLanguage(option.id)}
            aria-pressed={on}
            title={option.name}
            style={{
              background:on ? C.accDim : 'transparent',
              border:`1.5px solid ${on ? C.borderB : C.border}`,
              color:on ? C.accPale : C.textMuted,
              borderRadius:10,
              padding:compact ? '8px 8px' : '9px 10px',
              fontFamily:'Nunito',
              fontWeight:on ? 800 : 700,
              fontSize:12,
              cursor:'pointer',
              minHeight:44,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

const ThemeSettingsCard = () => (
  <>
    <SectionLabel>Tampilan</SectionLabel>
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>Mod warna</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>
            Tema awal ikut tetapan sistem. Pilih gelap atau cerah untuk simpan pilihan akaun ini.
          </div>
        </div>
        <div style={{ flexShrink:0 }}>
          <ThemeToggle compact />
        </div>
      </div>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
        borderTop:`1px solid ${C.border}`, marginTop:12, paddingTop:12,
      }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>Bahasa</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>
            Pilih Bahasa Melayu atau English untuk label utama aplikasi.
          </div>
        </div>
        <div style={{ width:118, flexShrink:0 }}>
          <LanguageToggle compact />
        </div>
      </div>
    </Card>
  </>
);

const AccountActionsCard = () => (
  <>
    <SectionLabel>Akaun</SectionLabel>
    <Card style={{ marginBottom:14 }}>
      <button onClick={() => window.tusyenSignOut?.()} style={{
        width:'100%',
        background:'rgba(239,68,68,.10)',
        border:'1px solid rgba(239,68,68,.32)',
        color:C.red,
        borderRadius:12,
        padding:'10px 12px',
        minHeight:44,
        fontFamily:'Nunito',
        fontWeight:900,
        fontSize:13,
        cursor:'pointer',
      }}>Log Keluar</button>
    </Card>
  </>
);

const AccountMenu = ({ notification }) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const panelRef = React.useRef(null);
  const menuId = React.useRef(`account-menu-${Math.random().toString(36).slice(2)}`);
  const close = React.useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus?.({ preventScroll:true }), 0);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    document.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector('button:not([disabled])')?.focus?.({ preventScroll:true });
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} style={{ position:'relative', display:'flex', alignItems:'center', gap:5 }}>
      {notification}
      <button ref={triggerRef} onClick={() => setOpen(v => !v)} title="Menu akaun" aria-label="Buka menu akaun" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? menuId.current : undefined} style={{
        width:44, height:44, minWidth:44, minHeight:44, borderRadius:12,
        background:C.accDim,
        border:`1px solid ${C.border}`,
        color:C.accPale,
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', fontFamily:'Nunito', fontWeight:700, fontSize:14,
      }}><span aria-hidden="true">👤</span></button>
      {open && (
        <div ref={panelRef} id={menuId.current} className="tv2-slidedown" role="dialog" aria-label="Menu akaun" style={{
          position:'absolute', top:38, right:0, zIndex:240,
          width:188, padding:10, borderRadius:14,
          background:C.bg, border:`1px solid ${C.borderB}`,
          boxShadow:'0 18px 42px rgba(0,0,0,.34)',
        }}>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>
            Tema
          </div>
          <ThemeToggle />
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, textTransform:'uppercase', margin:'10px 0 8px' }}>
            Bahasa
          </div>
          <LanguageToggle />
          <button onClick={() => { close(); window.tusyenSignOut?.(); }} style={{
            width:'100%', marginTop:10,
            background:'rgba(239,68,68,.10)',
            border:'1px solid rgba(239,68,68,.32)',
            color:C.red,
            borderRadius:10,
            padding:'8px 10px',
            minHeight:44,
            fontFamily:'Nunito',
            fontWeight:900,
            fontSize:12,
            cursor:'pointer',
          }}>Log Keluar</button>
        </div>
      )}
    </div>
  );
};

const ConfirmDialog = ({
  open = true,
  title,
  body,
  children,
  cancelLabel,
  confirmLabel,
  busyLabel,
  destructive = false,
  busy = false,
  confirmDisabled = false,
  initialFocus,
  onCancel,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [localBusy, setLocalBusy] = React.useState(false);
  const dialogRef = React.useRef(null);
  const cancelRef = React.useRef(null);
  const confirmRef = React.useRef(null);
  const restoreFocusRef = React.useRef(null);
  const idRef = React.useRef(`confirm-dialog-${Math.random().toString(36).slice(2)}`);
  const isBusy = busy || localBusy;
  const hasBody = body || children;
  const titleId = `${idRef.current}-title`;
  const bodyId = `${idRef.current}-body`;

  React.useEffect(() => {
    if (!open) setLocalBusy(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    restoreFocusRef.current = active && active !== document.body ? active : null;
    return () => {
      const target = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (target && document.contains(target)) {
        target.focus?.({ preventScroll:true });
      }
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      const target =
        initialFocus === 'confirm' ? confirmRef.current :
        initialFocus === 'dialog'  ? dialogRef.current  :
        cancelRef.current || confirmRef.current || dialogRef.current;
      target?.focus?.({ preventScroll:true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, initialFocus]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isBusy, onCancel]);

  const handleCancel = React.useCallback(() => {
    if (!isBusy) onCancel?.();
  }, [isBusy, onCancel]);

  const handleConfirm = React.useCallback(() => {
    if (isBusy || confirmDisabled) return;
    let result;
    try {
      result = onConfirm?.();
    } catch {
      setLocalBusy(false);
      return;
    }
    if (result && typeof result.then === 'function') {
      setLocalBusy(true);
      Promise.resolve(result).then(
        () => setLocalBusy(false),
        () => setLocalBusy(false)
      );
    }
  }, [confirmDisabled, isBusy, onConfirm]);

  const resolvedTitle = title ?? t('Sahkan tindakan', 'Confirm action');
  const resolvedCancelLabel = cancelLabel ?? t('Batal', 'Cancel');
  const resolvedConfirmLabel = confirmLabel ?? t('Sahkan', 'Confirm');
  const resolvedBusyLabel = busyLabel ?? t('Memproses...', 'Processing...');

  if (!open) return null;

  return (
    <div className="confirm-dialog-overlay" onPointerDown={(e) => {
      if (e.target === e.currentTarget) handleCancel();
    }}>
      <section
        ref={dialogRef}
        className={`confirm-dialog ${destructive ? 'is-destructive' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasBody ? bodyId : undefined}
        tabIndex="-1"
      >
        <div className="confirm-dialog-content">
          <h2 id={titleId} className="confirm-dialog-title">{resolvedTitle}</h2>
          {hasBody && (
            <div id={bodyId} className="confirm-dialog-body">
              {body || children}
            </div>
          )}
        </div>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog-action confirm-dialog-cancel"
            disabled={isBusy}
            onClick={handleCancel}
          >
            {resolvedCancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="confirm-dialog-action confirm-dialog-confirm"
            disabled={isBusy || confirmDisabled}
            data-destructive={destructive ? 'true' : 'false'}
            onClick={handleConfirm}
          >
            {isBusy ? resolvedBusyLabel : resolvedConfirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

const ActionMenu = ({
  items = [],
  label,
  trigger,
  align = 'end',
  className = '',
  onOpenChange,
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const menuId = React.useRef(`action-menu-${Math.random().toString(36).slice(2)}`);
  const visibleItems = items.filter(Boolean);

  const focusTrigger = React.useCallback(() => {
    window.setTimeout(() => triggerRef.current?.focus?.({ preventScroll:true }), 0);
  }, []);

  const focusMenuItem = React.useCallback((index) => {
    const menuItems = Array.from(rootRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);
    if (!menuItems.length) return;
    const nextIndex = ((index % menuItems.length) + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus?.({ preventScroll:true });
  }, []);

  const setMenuOpen = React.useCallback((next, { restoreFocus = false } = {}) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next && restoreFocus) focusTrigger();
  }, [focusTrigger, onOpenChange]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false, { restoreFocus:true });
        return;
      }
      if (!rootRef.current?.contains(document.activeElement)) return;
      const menuItems = Array.from(rootRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);
      const currentIndex = menuItems.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusMenuItem(currentIndex < 0 ? 0 : currentIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusMenuItem(currentIndex < 0 ? menuItems.length - 1 : currentIndex - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusMenuItem(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusMenuItem(menuItems.length - 1);
      }
    };
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    document.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => {
      rootRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus?.({ preventScroll:true });
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [focusMenuItem, open, setMenuOpen]);

  const handleSelect = (item) => {
    if (item.disabled) return;
    item.onSelect?.(item.id, item);
    if (!item.keepOpen) setMenuOpen(false, { restoreFocus:true });
  };
  const resolvedLabel = label ?? t('Tindakan', 'Actions');

  return (
    <div ref={rootRef} className={`action-menu ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="action-menu-trigger"
        aria-label={resolvedLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId.current : undefined}
        onClick={() => setMenuOpen(!open)}
      >
        {trigger || <span aria-hidden="true">...</span>}
      </button>
      {open && (
        <div
          id={menuId.current}
          className={`action-menu-popover align-${align}`}
          role="menu"
          aria-label={resolvedLabel}
        >
          {visibleItems.map((item) => (
            <button
              key={item.id || item.label}
              type="button"
              role="menuitem"
              className={`action-menu-item ${item.destructive ? 'is-destructive' : ''}`}
              disabled={item.disabled}
              onClick={() => handleSelect(item)}
            >
              {item.icon && <span className="action-menu-item-icon" aria-hidden="true">{item.icon}</span>}
              <span className="action-menu-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DataModeBanner = ({ role }) => {
  const status = window.tusyenApiStatus;
  const userRole = window.tusyenUser?.role;
  const rolePreview = role && userRole && userRole !== role;
  const apiDown = status?.checked && !status.ok;
  if (!apiDown && !rolePreview) return null;
  const message = apiDown
    ? 'API tidak dicapai. Data demo atau data tempatan dipaparkan sementara sambungan dipulihkan.'
    : 'Pratonton peranan demo. Sesetengah data ialah contoh dan bukan rekod akaun sebenar.';
  return (
    <div style={{
      flexShrink:0,
      background:apiDown ? 'rgba(245,158,11,.10)' : C.accDim,
      borderBottom:`1px solid ${apiDown ? 'rgba(245,158,11,.28)' : C.border}`,
      color:apiDown ? C.gold : C.accPale,
      padding:'7px 14px',
      fontSize:12,
      fontWeight:800,
      lineHeight:1.35,
      textAlign:'center',
    }}>{message}</div>
  );
};

// ── useNarrow — responsive breakpoint hook ──────────────────
const useNarrow = (bp = 768) => {
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < bp);
  React.useEffect(() => {
    const h = () => setNarrow(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return narrow;
};

// ── Sidebar (desktop) ───────────────────────────────────────
const MAIN_CONTENT_ID = 'main-content';
const useScreenFocus = (screen) => {
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const main = document.getElementById(MAIN_CONTENT_ID);
      if (!main) return;
      main.focus({ preventScroll:true });
      const content = main.querySelector('.main-content');
      if (content) content.scrollTop = 0;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [screen]);
};

const NAV_ICON_PATHS = {
  home:       <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  school:     <><path d="M3 9l9-5 9 5-9 5-9-5Z" /><path d="M7 12v4c2.8 2 7.2 2 10 0v-4" /><path d="M21 9v6" /></>,
  learn:      <><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2" /><path d="M8 7h7" /><path d="M8 11h7" /></>,
  lesson:     <><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M9 12h6" /><path d="M9 16h6" /></>,
  quiz:       <><path d="M7 8h10a5 5 0 0 1 4 8l-1 2a2 2 0 0 1-3 .4L15 16H9l-2 2.4a2 2 0 0 1-3-.4l-1-2a5 5 0 0 1 4-8Z" /><path d="M8 12h4" /><path d="M10 10v4" /><path d="M16 12h.01" /></>,
  profile:    <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></>,
  users:      <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  posts:      <><path d="M3 11h4l9-5v12l-9-5H3z" /><path d="M7 13v5a2 2 0 0 0 2 2h1" /></>,
  lessons:    <><path d="M4 19.5V5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 0-2 2" /><path d="M11 3h7a2 2 0 0 1 2 2v14.5" /></>,
  whiteboard: <><path d="M3 4h18v13H3z" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="M8 12l3-3 2 2 3-3" /></>,
  progress:   <><path d="M3 17l6-6 4 4 7-8" /><path d="M14 7h6v6" /></>,
  alerts:     <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  settings:   <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.9.3l-.6.4-3.6-2.1-.1-.7a1.7 1.7 0 0 0-1.6-1.2h-.2L8 20.1 4.9 18.3l.1-.2a1.7 1.7 0 0 0-.3-1.9l-.4-.6 2.1-3.6.7-.1a1.7 1.7 0 0 0 1.2-1.6v-.2L4.9 8 6.7 4.9l.2.1a1.7 1.7 0 0 0 1.9-.3l.6-.4 3.6 2.1.1.7a1.7 1.7 0 0 0 1.6 1.2h.2L16 4.9l3.1 1.8-.1.2a1.7 1.7 0 0 0 .3 1.9l.4.6-2.1 3.6-.7.1A1.7 1.7 0 0 0 15.7 15v.2Z" /></>,
  dashboard:  <><path d="M4 13h6V4H4z" /><path d="M14 20h6V4h-6z" /><path d="M4 20h6v-3H4z" /></>,
  link:       <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" /></>,
  content:    <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /><path d="M6 4v16" /></>,
};

const navIconName = (item) => {
  if (item.iconName) return item.iconName;
  const label = `${item.label || ''} ${item.en || ''}`.toLowerCase();
  if (item.id === 'home' && (label.includes('kelas') || label.includes('class'))) return 'school';
  if (item.id === 'home' && label.includes('dashboard')) return 'dashboard';
  if (item.id === 'classrooms' || item.id === 'class') return 'school';
  if (item.id === 'links') return 'link';
  return item.id;
};

const NavIcon = ({ item, size = 20 }) => {
  const paths = NAV_ICON_PATHS[navIconName(item)];
  if (!paths) {
    return <span aria-hidden="true" style={{ fontSize:size, width:28, textAlign:'center', lineHeight:1 }}>{item.icon}</span>;
  }
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width:28, flexShrink:0 }}
    >
      {paths}
    </svg>
  );
};

const AppSidebar = ({ navItems, active, onNav, user, stats, onSignOut, extraTop, extraBottom }) => {
  const { language } = useLanguage();
  const displayName = user?.fullName || user?.email || 'Pengguna';
  const level = Math.floor((Number(stats?.xp) || 0) / 250) + 1;
  const streak = Number(stats?.streak) || 0;
  const xp = Number(stats?.xp) || 0;

  return (
    <aside className="sidebar-wrap" aria-label="Bar sisi aplikasi">
      {/* Logo */}
      <div style={{ padding:'22px 20px 18px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:38, height:38, borderRadius:12, flexShrink:0,
            background:'linear-gradient(135deg, var(--acc-lo), var(--acc))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, boxShadow:`0 4px 16px ${C.accGlow}`,
          }} aria-hidden="true">T</div>
          <div className="sidebar-logo-text" style={{ fontWeight:800, fontSize:22, lineHeight:1 }}>
            <span style={{ color:C.accPale }}>Tu</span><span style={{ color:C.text }}>syen</span>
          </div>
        </div>
      </div>

      {/* Role switcher */}
      {extraTop}

      {/* User card */}
      <div className="sidebar-user" style={{ padding:'16px 16px 14px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <Avatar name={displayName} size={42} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>{user?.role || 'Pelajar'}</div>
          </div>
        </div>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:5,
          background:'linear-gradient(135deg, var(--acc-lo), var(--acc))',
          borderRadius:20, padding:'4px 12px',
          fontSize:11, fontWeight:700, color:'#fff',
          boxShadow:`0 2px 10px ${C.accGlow}`,
        }}><span aria-hidden="true">⚡</span> Tahap {level}</div>
      </div>

      {/* Nav items */}
      <nav className="sidebar-nav" aria-label="Navigasi utama" style={{ flex:1, padding:'12px 10px' }}>
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
              display:'flex', alignItems:'center', gap:12, width:'100%',
              padding:'11px 12px', marginBottom:3,
              background: on ? C.accDim : 'transparent',
              border:`1px solid ${on ? C.borderB : 'transparent'}`,
              borderRadius:12, cursor:'pointer',
              color: on ? C.accHi : C.textMuted,
              fontFamily:'Nunito', fontWeight: on ? 700 : 600, fontSize:14,
              textAlign:'left', transition:'all .15s',
            }}>
              <NavIcon item={item} />
              <div className="sidebar-label" style={{ flex:1 }}>
                <div lang={language} style={{ lineHeight:1.2, color: on ? C.accHi : C.text }}>{visibleLabel}</div>
                {item.en && language === 'ms' && <div lang="en" style={{ fontSize:10, fontWeight:600, color: on ? C.accPale : C.textFaint, lineHeight:1 }}>{item.en}</div>}
              </div>
              {on && <div aria-hidden="true" style={{ width:7, height:7, borderRadius:'50%', background:C.acc, boxShadow:`0 0 8px ${C.accGlow}`, flexShrink:0 }} />}
            </button>
          );
        })}
      </nav>

      {/* Bottom: stats + theme + sign out */}
      <div className="sidebar-bottom" style={{ padding:'14px 14px 18px', borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
        <div className="sidebar-stats" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <div style={{ background:'rgba(255,150,0,.10)', border:'1px solid rgba(255,150,0,.22)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontWeight:800, fontSize:17, color:'#FF9600', lineHeight:1 }}><span aria-hidden="true">🔥</span> {streak}</div>
            <div style={{ fontSize:9, color:C.textFaint, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginTop:3 }}>Hari Streak</div>
          </div>
          <div style={{ background:'rgba(245,166,35,.10)', border:'1px solid rgba(245,166,35,.22)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontWeight:800, fontSize:17, color:'#F5A623', lineHeight:1 }}><span aria-hidden="true">⚡</span> {xp >= 1000 ? `${(xp/1000).toFixed(1)}k` : xp}</div>
            <div style={{ fontSize:9, color:C.textFaint, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginTop:3 }}>XP Total</div>
          </div>
        </div>
        <ThemeToggle />
        <div style={{ marginTop:8 }}>
          <LanguageToggle compact />
        </div>
        {extraBottom}
        <button className="topbar-signout" onClick={onSignOut} aria-label="Log keluar" style={{
          width:'100%', marginTop:8,
          background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.30)',
          color:C.red, borderRadius:10, padding:'8px 10px',
          minHeight:44,
          fontFamily:'Nunito', fontWeight:700, fontSize:12, cursor:'pointer',
        }}><span aria-hidden="true">🚪</span> <span className="sidebar-label">Log Keluar</span></button>
      </div>
    </aside>
  );
};

// ── TopBarMobile ─────────────────────────────────────────────
const TopBarMobile = ({ title, subtitle, left, right, brand = true, className = '' }) => (
  <header className={`top-bar-mobile mobile-top-appbar ${className}`.trim()} aria-label="Bar atas">
    <div className="mobile-top-appbar-left">
      {left || (brand ? (
        <>
          <div style={{
            width:30, height:30, borderRadius:9, flexShrink:0,
            background:'linear-gradient(135deg, var(--acc-lo), var(--acc))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:15, boxShadow:`0 2px 8px var(--acc-glow)`,
          }} aria-hidden="true">T</div>
          <div style={{ fontWeight:800, fontSize:17 }}>
            <span style={{ color:C.accPale }}>Tu</span><span style={{ color:C.text }}>syen</span>
          </div>
        </>
      ) : null)}
    </div>
    <div className="mobile-top-appbar-title">
      <div style={{ fontWeight:700, fontSize:15, color:C.text, textAlign:'center' }}>{title}</div>
      {subtitle && <div lang="en" style={{ fontWeight:500, fontSize:10, color:C.textMuted, textAlign:'center', marginTop:1 }}>{subtitle}</div>}
    </div>
    <div className="mobile-top-appbar-right">
      <LanguageToggle iconOnly />
      {right}
    </div>
  </header>
);

// ── BottomNavMobile ───────────────────────────────────────────
const BottomNavMobile = ({ items, active, onNav, className = '', label = 'Navigasi bawah' }) => {
  const { language } = useLanguage();
  return (
    <nav className={`bottom-nav-wrap ${items.length > 5 ? 'is-compact' : ''} ${className}`.trim()} aria-label={label}>
      <div className="bottom-nav-inner" style={{
        display:'flex', alignItems:'flex-end', justifyContent:'space-around',
        paddingTop:8, paddingBottom:20, flexShrink:0,
        background:'var(--surface)', borderTop:'1px solid var(--border)',
      }}>
        {items.map(item => {
          const on = active === item.id;
          const visibleLabel = languageText(item.label, item.en, language);
          const labelText = item.en ? `${item.label} / ${item.en}` : visibleLabel;
          return (
            <button
              key={item.id}
              className="bottom-nav-button"
              onClick={() => onNav(item.id)}
              aria-label={labelText}
              aria-current={on ? 'page' : undefined}
              title={labelText}
              style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              background:'none', border:'none', cursor:'pointer',
              color: on ? C.accHi : C.textFaint,
              padding:'4px 18px', position:'relative',
              fontFamily:'Nunito', transition:'color .2s',
            }}>
              {on && <div style={{
                position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)',
                width:34, height:3, borderRadius:'0 0 4px 4px',
                background:'linear-gradient(90deg, var(--acc-lo), var(--acc-hi))',
              }} />}
              <NavIcon item={item} size={22} />
              <span lang={language} className="bottom-nav-label" style={{ fontSize:10, fontWeight:600, lineHeight:1 }}>{visibleLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

Object.assign(window, {
  C, UI_TEXT, makeBilingualLabel, languageText,
  TopBar, BottomNav, StatPill, ProgressBar,
  Card, GlowButton, Avatar, BackBtn, SectionLabel,
  useCountUp, useAsync, timeAgo, Skeleton, ErrorRetry,
  NotifBell, NotifPanel, EmptyState,
  ThemeToggle, LanguageToggle, ThemeSettingsCard, AccountActionsCard,
  AccountMenu, ConfirmDialog, ActionMenu, DataModeBanner, useTheme,
  useLanguage, useNarrow, useScreenFocus, AppSidebar, TopBarMobile, BottomNavMobile,
  NavIcon, VideoEmbed, isVideoEmbedUrl,
  cleanUiText, cleanUiName, cleanUiTitle,
});
