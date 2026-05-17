// Tusyen — Student Role UI v2
// Ported from the Claude Design handoff. Uses real logged-in user's name where available.

const SUBJECTS = [
  { id:'math',    name:'Matematik', icon:'📐', color:'#8B5CF6', progress:65, query:'Mathematics', aliases:['math','mathematics','matematik'] },
  { id:'bio',     name:'Biologi',   icon:'🌿', color:'#22C55E', progress:42, query:'Biology', aliases:['bio','biology','biologi','science','sains'] },
  { id:'physics', name:'Fizik',     icon:'⚡', color:'#38BDF8', progress:30, query:'Physics', aliases:['physics','fizik','phys'] },
  { id:'chem',    name:'Kimia',     icon:'🧪', color:'#F59E0B', progress:18, query:'Chemistry', aliases:['chem','chemistry','kimia'] },
  { id:'hist',    name:'Sejarah',   icon:'📜', color:'#EF4444', progress:55, query:'Sejarah', aliases:['history','hist','sejarah'] },
  { id:'geo',     name:'Geografi',  icon:'🌏', color:'#10B981', progress:22, query:'Geography', aliases:['geo','geography','geografi'] },
];

const SKILL_NODES = [
  { id:1, label:'Nombor',       sub:'Numbers',      done:true,  locked:false, cur:false },
  { id:2, label:'Algebra',      sub:'Algebra',      done:true,  locked:false, cur:false },
  { id:3, label:'Geometri',     sub:'Geometry',     done:false, locked:false, cur:true  },
  { id:4, label:'Trigonometri', sub:'Trigonometry', done:false, locked:true,  cur:false },
  { id:5, label:'Statistik',    sub:'Statistics',   done:false, locked:true,  cur:false },
];

const SUBJECT_SKILL_FALLBACKS = {
  math: SKILL_NODES,
  bio: [
    { id:'bio-1', label:'Sel', sub:'Struktur dan fungsi', done:false, locked:false, cur:true },
    { id:'bio-2', label:'Pembahagian Sel', sub:'Mitosis dan meiosis', done:false, locked:true, cur:false },
    { id:'bio-3', label:'Genetik', sub:'Pewarisan sifat', done:false, locked:true, cur:false },
    { id:'bio-4', label:'Ekosistem', sub:'Interaksi organisma', done:false, locked:true, cur:false },
    { id:'bio-5', label:'Homeostasis', sub:'Kawalan dalaman', done:false, locked:true, cur:false },
  ],
  physics: [
    { id:'phy-1', label:'Daya dan Gerakan', sub:'Halaju, pecutan, graf', done:false, locked:false, cur:true },
    { id:'phy-2', label:'Tenaga', sub:'Kerja, kuasa, kecekapan', done:false, locked:true, cur:false },
    { id:'phy-3', label:'Haba', sub:'Suhu dan pemindahan haba', done:false, locked:true, cur:false },
    { id:'phy-4', label:'Gelombang', sub:'Bunyi dan cahaya', done:false, locked:true, cur:false },
    { id:'phy-5', label:'Elektrik', sub:'Arus, voltan, rintangan', done:false, locked:true, cur:false },
  ],
  chem: [
    { id:'chem-1', label:'Jirim', sub:'Atom dan molekul', done:false, locked:false, cur:true },
    { id:'chem-2', label:'Jadual Berkala', sub:'Kumpulan dan kala', done:false, locked:true, cur:false },
    { id:'chem-3', label:'Ikatan Kimia', sub:'Ion dan kovalen', done:false, locked:true, cur:false },
    { id:'chem-4', label:'Asid dan Bes', sub:'pH dan peneutralan', done:false, locked:true, cur:false },
    { id:'chem-5', label:'Kadar Tindak Balas', sub:'Faktor dan graf', done:false, locked:true, cur:false },
  ],
  hist: [
    { id:'hist-1', label:'Warisan Negara', sub:'Identiti dan budaya', done:false, locked:false, cur:true },
    { id:'hist-2', label:'Nasionalisme', sub:'Tokoh dan gerakan', done:false, locked:true, cur:false },
    { id:'hist-3', label:'Pembentukan Negara', sub:'Perlembagaan dan sistem', done:false, locked:true, cur:false },
    { id:'hist-4', label:'Kemerdekaan', sub:'Peristiwa utama', done:false, locked:true, cur:false },
    { id:'hist-5', label:'Malaysia Moden', sub:'Pembangunan negara', done:false, locked:true, cur:false },
  ],
  geo: [
    { id:'geo-1', label:'Kemahiran Peta', sub:'Skala dan arah', done:false, locked:false, cur:true },
    { id:'geo-2', label:'Bentuk Muka Bumi', sub:'Tanah tinggi dan saliran', done:false, locked:true, cur:false },
    { id:'geo-3', label:'Cuaca dan Iklim', sub:'Hujan, suhu, angin', done:false, locked:true, cur:false },
    { id:'geo-4', label:'Penduduk', sub:'Taburan dan migrasi', done:false, locked:true, cur:false },
    { id:'geo-5', label:'Sumber', sub:'Pengurusan alam sekitar', done:false, locked:true, cur:false },
  ],
};

const LEADERBOARD_BASE = [
  { rank:1, name:'Siti Nora',   xp:3120, medal:'🥇' },
  { rank:2, name:'Haziq Razif', xp:2980, medal:'🥈' },
  { rank:3, name:'Nurul Ain',   xp:2760, medal:'🥉' },
  { rank:4, name:'Kamu',        xp:2450, me:true     },
  { rank:5, name:'Aina Sofia',  xp:2200              },
];

const QUESTIONS = [
  { q:'KSSM Matematik Tingkatan 4: Selesaikan persamaan linear 2x + 4 = 12. Apakah nilai x?',
    sub:'Topik: Persamaan linear satu pemboleh ubah',
    opts:['x = 3','x = 4','x = 8','x = 6'], ans:1,
    explanation:'Tolak 4 pada kedua-dua belah, kemudian bahagi dengan 2.' },
  { q:'Sebuah ruang aktiviti kelas berbentuk segi empat sama mempunyai sisi 5 m. Berapakah luas ruang itu?',
    sub:'KSSM Matematik: Luas bentuk geometri',
    opts:['20 m²','25 m²','10 m²','30 m²'], ans:1,
    explanation:'Luas segi empat sama ialah sisi darab sisi, iaitu 5 m × 5 m.' },
  { q:'Dalam topik ungkapan algebra KSSM, permudahkan: 3x + 2x − x',
    sub:'Gabungkan sebutan sejenis',
    opts:['4x','5x','6x','3x'], ans:0,
    explanation:'Gabungkan pekali sejenis: 3 + 2 - 1 = 4.' },
];

const BADGES = [
  { icon:'🔥', name:'Streak 7 Hari',    desc:'Belajar 7 hari berturut', earned:true  },
  { icon:'⚡', name:'Pelajar Pantas',   desc:'10 pelajaran sehari',      earned:true  },
  { icon:'🎯', name:'Markah Sempurna',  desc:'Skor 100% dalam ujian',   earned:true  },
  { icon:'🏆', name:'Top 3 Kelas',      desc:'3 teratas dalam kelas',   earned:false },
  { icon:'💎', name:'Pelajar Elit',     desc:'Capai 5,000 XP',          earned:false },
  { icon:'🌟', name:'Penguasa Algebra', desc:'Selesai semua Algebra',   earned:false },
];

const ACHIEVEMENT_TYPE_META = {
  streak:{ icon:'7', name:'Rentetan Hari' },
  streak_7:{ icon:'7', name:'Streak 7 Hari' },
  daily_streak:{ icon:'7', name:'Rentetan Harian' },
  fast_learner:{ icon:'XP', name:'Pelajar Pantas' },
  speed_learner:{ icon:'XP', name:'Pelajar Pantas' },
  perfect_score:{ icon:'100', name:'Markah Sempurna' },
  top_3_class:{ icon:'TOP', name:'Top 3 Kelas' },
  top3_class:{ icon:'TOP', name:'Top 3 Kelas' },
  elite_student:{ icon:'XP', name:'Pelajar Elit' },
  subject_mastery:{ icon:'OK', name:'Penguasaan Subjek' },
  topic_mastery:{ icon:'OK', name:'Penguasaan Topik' },
  lesson_completion:{ icon:'OK', name:'Selesai Pelajaran' },
  quiz_mastery:{ icon:'100', name:'Penguasaan Kuiz' },
};
const achievementTypeKey = (value='') => `${value || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const achievementTypeName = (value='') => {
  const key = achievementTypeKey(value);
  if (!key) return 'Lencana';
  return key.split('_').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').filter(Boolean).join(' ');
};
const achievementMetaForType = (type='') => ACHIEVEMENT_TYPE_META[achievementTypeKey(type)] || {
  icon:'OK',
  name:achievementTypeName(type),
};

const studentLanguageCode = () => `${window.tusyenLanguage || window.tusyenLang || window.tusyenLocale || localStorage.getItem('tusyen_language') || localStorage.getItem('tusyen_lang') || localStorage.getItem('language') || document.documentElement?.lang || 'ms'}`.toLowerCase();
const tStudent = (malay, english) => studentLanguageCode().startsWith('en') ? english : malay;
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return tStudent('Selamat Pagi', 'Good Morning');
  if (h < 17) return tStudent('Selamat Petang', 'Good Afternoon');
  return tStudent('Selamat Malam', 'Good Evening');
};

const firstName = (full) => (full || '').split(' ')[0] || 'Pelajar';
const studentText = (value, fallback = 'Item', max = 80) =>
  window.cleanUiText ? window.cleanUiText(value, { fallback, max }) : `${value || fallback}`;
const studentName = (value, fallback = 'Pengguna') =>
  window.cleanUiName ? window.cleanUiName(value, fallback) : studentText(value, fallback, 42);
const studentTitle = (value, fallback = 'Tanpa tajuk') =>
  window.cleanUiTitle ? window.cleanUiTitle(value, fallback) : studentText(value, fallback, 68);
const studentBodyText = (value, fallback = '', max = 140) =>
  window.cleanUiText ? window.cleanUiText(value, { fallback, max, preserveCase:true }) : `${value || fallback}`;

const medalForRank = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
const studentLevelFromXp = (xp=0) => {
  const totalXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = Math.floor(totalXp / 250) + 1;
  const tier =
    level >= 20 ? 'Pelajar Elit' :
    level >= 12 ? 'Pelajar Maju' :
    level >= 6  ? 'Pelajar Tekun' :
                  'Pelajar Baru';
  return { level, tier };
};

const cleanSubjectKey = (value='') => `${value}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeFormLevel = (value) => {
  const match = `${value ?? ''}`.match(/\d+/);
  return match ? Number(match[0]) : null;
};
const subjectValues = (subject) => [subject?.id, subject?.name, subject?.query, ...(subject?.aliases || [])]
  .map(cleanSubjectKey)
  .filter(Boolean);
const subjectMatchScore = (subject, value='') => {
  const key = cleanSubjectKey(value);
  if (!subject || !key) return 0;
  const values = subjectValues(subject);
  if (values.includes(key)) return 100;
  const words = new Set(key.split(' ').filter(Boolean));
  if (values.some(alias => words.has(alias))) return 70;
  if (values.some(alias => alias.length >= 3 && key.includes(alias))) return 45;
  if (values.some(alias => key.length >= 3 && alias.includes(key))) return 35;
  return 0;
};
const subjectMatches = (subject, value='') => {
  return subjectMatchScore(subject, value) > 0;
};
const subjectForText = (value='') => {
  const ranked = SUBJECTS
    .map(subject => ({ subject, score:subjectMatchScore(subject, value) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.subject;
};
const progressValue = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const subjectProgressFromStats = (stats, subject) => {
  const row = (stats?.bySubject || []).find(item => subjectMatches(subject, item.subject));
  if (!row) return stats?.fromFallback ? subject.progress : 0;
  return progressValue(row.avg_completion ?? row.completion ?? row.progress);
};
const subjectListFromStats = (stats) => SUBJECTS.map(subject => ({
  ...subject,
  progress: subjectProgressFromStats(stats, subject),
}));
const subjectIdsForClassroomSubject = (value='') => {
  const key = cleanSubjectKey(value);
  if (key === 'science' || key === 'sains') return ['bio', 'physics', 'chem'];
  const matched = subjectForText(value);
  return matched ? [matched.id] : [];
};
const subjectListForStudentContext = (stats, lessons=[], classInfo=null) => {
  const base = subjectListFromStats(stats);
  const classrooms = Array.isArray(classInfo?.classrooms) ? classInfo.classrooms : [];
  const enrolledFormLevels = new Set(
    classrooms
      .map(cls => normalizeFormLevel(cls.form_level ?? cls.formLevel))
      .filter(Boolean)
  );
  const subjectIds = new Set();

  classrooms.forEach(cls => {
    subjectIdsForClassroomSubject(cls.subject || cls.name).forEach(id => subjectIds.add(id));
  });

  (lessons || []).forEach(lesson => {
    const lessonForm = normalizeFormLevel(lesson.formLevel ?? lesson.form_level);
    if (enrolledFormLevels.size && lessonForm && !enrolledFormLevels.has(lessonForm)) return;
    const matched = subjectForText(lesson.subject || lesson.title || lesson.topic);
    if (matched) subjectIds.add(matched.id);
  });

  if (!subjectIds.size) return base;
  return [...base].sort((a, b) => {
    const aRelevant = subjectIds.has(a.id) ? 0 : 1;
    const bRelevant = subjectIds.has(b.id) ? 0 : 1;
    if (aRelevant !== bRelevant) return aRelevant - bRelevant;
    return SUBJECTS.findIndex(subject => subject.id === a.id) - SUBJECTS.findIndex(subject => subject.id === b.id);
  });
};

const subjectIcon = (subject='') => {
  const matched = subjectForText(subject);
  if (matched) return matched.icon;
  return '📐';
};

const studentContentObject = (content) => {
  if (!content) return {};
  if (typeof content === 'object' && !Array.isArray(content)) return content;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : { summary:`${content}` };
  } catch {
    return { summary:`${content}` };
  }
};

const studentArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
};

const studentResourceUrl = (item={}) =>
  `${item.url || item.embedUrl || item.embed_url || item.downloadUrl || item.download_url || item.href || item.src || item.fileUrl || item.file_url || item.imageUrl || item.image_url || ''}`.trim();

const studentNormalizeResource = (item, fallbackType='link') => {
  if (!item) return null;
  if (typeof item !== 'object') {
    const url = `${item}`.trim();
    return url ? { type:fallbackType, title:studentTitle(url, 'Pautan'), url, thumbnailUrl:'' } : null;
  }
  const url = studentResourceUrl(item);
  const type = `${item.type || item.kind || fallbackType || 'file'}`.toLowerCase();
  const thumbnailUrl = `${item.thumbnailUrl || item.thumbnail_url || item.poster || item.previewUrl || item.preview_url || ''}`.trim();
  const rawTitle = item.name || item.title || item.label || item.filename || item.fileName || '';
  if (!url && !thumbnailUrl && !rawTitle) return null;
  const title = studentTitle(rawTitle || url, 'Bahan sokongan');
  return {
    ...item,
    type,
    title,
    url,
    thumbnailUrl,
    mimeType:item.mimeType || item.mime_type || '',
  };
};

const studentAttachmentTypeLabel = (attachment={}) => {
  const type = `${attachment.type || ''}`.toLowerCase();
  const mime = `${attachment.mimeType || ''}`.toLowerCase();
  if (type.includes('embed')) return attachment.providerName || attachment.provider || 'Video';
  if (type.includes('image') || type.includes('gif') || mime.startsWith('image/')) return 'Imej';
  if (type.includes('video') || mime.startsWith('video/')) return 'Video';
  if (type.includes('link')) return 'Pautan';
  return 'Lampiran';
};

const studentAttachmentIcon = (attachment={}) => {
  const label = studentAttachmentTypeLabel(attachment).toLowerCase();
  if (label.includes('imej')) return 'IMG';
  if (label.includes('video') || label.includes('youtube') || label.includes('vimeo') || label.includes('loom')) return 'VID';
  if (label.includes('pautan')) return 'URL';
  return 'FILE';
};

const studentLessonContentData = (lesson={}) => {
  const content = studentContentObject(lesson.content);
  const rawBlocks = studentArray(content.blocks);
  const blocks = rawBlocks
    .map((block, index) => {
      if (typeof block !== 'object') {
        return { id:index, type:'text', title:'', body:studentBodyText(block, '', 500), raw:block };
      }
      return {
        ...block,
        id:block.id || index,
        type:`${block.type || 'text'}`.toLowerCase(),
        title:studentTitle(block.title || block.name, '', 80),
        body:studentBodyText(block.body || block.text || block.description || block.caption, '', 700),
      };
    })
    .filter(block => block.title || block.body || studentResourceUrl(block) || block.thumbnailUrl || block.thumbnail_url);

  const examples = [
    ...studentArray(content.examples || content.example || content.sampleQuestions || content.samples),
    ...blocks.flatMap(block => studentArray(block.examples || block.example)),
  ].map((example, index) => {
    if (typeof example === 'object') {
      return {
        id:example.id || index,
        title:studentTitle(example.title || example.name, `Contoh ${index + 1}`, 70),
        body:studentBodyText(example.body || example.text || example.description || example.content || '', '', 420),
      };
    }
    return { id:index, title:`Contoh ${index + 1}`, body:studentBodyText(example, '', 420) };
  }).filter(example => example.title || example.body);

  const blockResources = blocks
    .filter(block => ['image', 'video', 'gif', 'embed', 'link', 'file'].includes(block.type) || studentResourceUrl(block) || block.thumbnailUrl || block.thumbnail_url)
    .map(block => studentNormalizeResource(block, block.type || 'link'));
  const resources = [
    ...studentArray(content.resources || content.resource || content.links || content.link || content.media || content.attachments),
    ...studentArray(lesson.attachments || lesson.resources || lesson.media),
    ...blockResources,
  ].map(item => studentNormalizeResource(item)).filter(Boolean);
  const seen = new Set();
  const uniqueResources = resources.filter(item => {
    const key = `${item.url || ''}|${item.title || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    summary:studentBodyText(content.summary || content.description || lesson.summary || lesson.description, '', 700),
    blocks,
    examples,
    resources:uniqueResources,
    blockCount:Number(lesson.content_block_count ?? lesson.contentBlockCount ?? blocks.length) || blocks.length,
  };
};

const normalizeLessonCard = (lesson={}) => ({
  id: lesson.id,
  classroomId: lesson.classroom_id || lesson.classroomId,
  title: studentTitle(lesson.title || lesson.name, 'Pelajaran'),
  topic: studentText(lesson.topic || lesson.subtopic || lesson.subject, 'Topik pembelajaran', 64),
  subject: studentText(lesson.subject || '', '', 36),
  formLevel: lesson.form_level || lesson.formLevel || null,
  dueDate: lesson.due_date || lesson.dueDate || null,
  progress: progressValue(lesson.completion_percentage ?? lesson.progress ?? 0),
  icon: subjectIcon(lesson.subject || lesson.title || ''),
  content: lesson.content || null,
  contentBlockCount: Number(lesson.content_block_count ?? lesson.contentBlockCount) || 0,
  estimatedMinutes: Number(lesson.estimated_minutes ?? lesson.estimatedMinutes) || null,
  difficulty: lesson.difficulty || '',
  classroomName: lesson.classroom_name || lesson.classroomName || '',
  attachments: lesson.attachments || lesson.resources || lesson.media || [],
  isFree: Boolean(lesson.is_free || lesson.isFree),
});

const normalizeCatalogLessonCard = (lesson={}) => ({
  ...normalizeLessonCard(lesson),
  classroomId:null,
  classroomName:'',
  isFree:true,
});

const CONTINUE_EMPTY = {
  id:null,
  empty:true,
  title:'Tiada pelajaran aktif',
  topic:'Pilih subjek untuk mula belajar',
  subject:'',
  progress:0,
  icon:'🧭',
};

const StudentAttachmentPreview = ({ attachments=[], compact=false }) => {
  const items = (attachments || []).map(item => studentNormalizeResource(item)).filter(Boolean);
  if (!items.length) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, margin:compact ? '8px 0' : '10px 0 0' }}>
      {items.map((attachment, index) => {
        const label = studentTitle(attachment.title || attachment.name, 'Bahan sokongan', 80);
        const typeLabel = studentAttachmentTypeLabel(attachment);
        const imageUrl = attachment.thumbnailUrl ||
          (typeLabel === 'Imej' ? attachment.url : '');
        const href = attachment.url || attachment.embedUrl || attachment.downloadUrl || '';
        return (
          <a
            key={`${href || label}-${index}`}
            href={href || '#'}
            target={href ? '_blank' : undefined}
            rel={href ? 'noreferrer' : undefined}
            aria-label={`${typeLabel}: ${label}`}
            onClick={(event) => { if (!href) event.preventDefault(); }}
            style={{
              display:'grid',
              gridTemplateColumns:compact ? '44px minmax(0, 1fr) auto' : '56px minmax(0, 1fr) auto',
              gap:10, alignItems:'center',
              background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
              padding:compact ? 8 : 10, color:C.text, textDecoration:'none',
              minWidth:0,
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                loading="lazy"
                style={{
                  width:compact ? 44 : 56, height:compact ? 44 : 56,
                  borderRadius:10, objectFit:'cover',
                  background:C.card, border:`1px solid ${C.border}`,
                }}
              />
            ) : (
              <span style={{
                width:compact ? 44 : 56, height:compact ? 44 : 56,
                borderRadius:10, background:C.accDim, border:`1px solid ${C.borderB}`,
                color:C.accPale, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:compact ? 10 : 11, fontWeight:900,
              }}>
                {studentAttachmentIcon(attachment)}
              </span>
            )}
            <span style={{ minWidth:0 }}>
              <span className="student-clamp-2" style={{ display:'block', fontSize:12, fontWeight:900, color:C.text, lineHeight:1.25 }}>
                {label}
              </span>
              <span style={{ display:'block', fontSize:10, fontWeight:800, color:C.textFaint, marginTop:2 }}>
                {typeLabel}
              </span>
            </span>
            <span style={{
              color:href ? C.accPale : C.textFaint,
              fontSize:11, fontWeight:900, whiteSpace:'nowrap',
            }}>
              {href ? 'Buka' : 'Pratonton'}
            </span>
          </a>
        );
      })}
    </div>
  );
};

const normalizeOption = (option) => {
  if (option && typeof option === 'object') {
    return option.text ?? option.label ?? option.value ?? option.answer ?? JSON.stringify(option);
  }
  return `${option ?? ''}`;
};

const optionIndexFromAnswer = (question, options) => {
  if (Number.isInteger(question.ans)) return question.ans;
  const raw = question.correct_answer ?? question.correctAnswer;
  if (raw === undefined || raw === null) return null;
  if (Number.isInteger(raw)) return raw;
  if (raw && typeof raw === 'object' && Number.isInteger(raw.optionIndex ?? raw.option_index)) {
    return Number(raw.optionIndex ?? raw.option_index);
  }
  const text = normalizeOption(raw).trim().toLowerCase();
  const index = options.findIndex(opt => opt.trim().toLowerCase() === text);
  return index >= 0 ? index : null;
};

const normalizeLessonQuestion = (question, index) => {
  const options = Array.isArray(question.options)
    ? question.options.map(normalizeOption).filter(Boolean)
    : [];
  const fallbackOptions = options.length ? options : (question.question_type === 'true_false' ? ['Benar', 'Palsu'] : options);
  const finalOptions = fallbackOptions.length ? fallbackOptions : ['A', 'B', 'C', 'D'];
  return {
    id: question.id || `mock-${index}`,
    q: question.question_text || question.q || `Soalan ${index + 1}`,
    sub: question.sub || '',
    opts: finalOptions,
    ans: optionIndexFromAnswer(question, finalOptions),
    explanation: question.explanation || question.hint || '',
    timeLimitSeconds: Number(question.timeLimitSeconds ?? question.time_limit_seconds) || 45,
  };
};

const MOCK_QUESTIONS = QUESTIONS.map(normalizeLessonQuestion);
const normalizeStudentHearts = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const source = value?.hearts && typeof value.hearts === 'object' ? value.hearts : value || {};
  const current = Number(source.current ?? source.current_hearts ?? source.remaining ?? source.remaining_hearts ?? source.hearts_remaining ?? source.value ?? source.hearts);
  const max = Number(source.max ?? source.max_hearts ?? source.total ?? source.total_hearts ?? source.capacity ?? source.limit);
  if (!Number.isFinite(current) && !Number.isFinite(max)) return null;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 5;
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.min(safeMax, current)) : safeMax;
  return `${safeCurrent}/${safeMax}`;
};
const DEMO_STUDENT_STATS = {
  streak:7,
  xp:2450,
  hearts:null,
  lessons:138,
  lessonsAttempted:138,
  daysActive:47,
  today:{ lessonsAttempted:7, lessonsCompleted:7, target:10 },
  bySubject: SUBJECTS.map(s => ({ subject:s.name, avg_completion:s.progress })),
  fromFallback:true,
};
const EMPTY_STUDENT_STATS = {
  streak:0,
  xp:0,
  hearts:null,
  lessons:0,
  lessonsAttempted:0,
  daysActive:0,
  today:{ lessonsAttempted:0, lessonsCompleted:0, target:1 },
  bySubject:[],
  fromFallback:false,
};

let studentStreakCheckUserId = null;
let studentStreakCheckPromise = null;
const ensureStudentStreakChecked = (userId) => {
  if (!userId || !window.tusyenApi?.checkStreak) return null;
  if (studentStreakCheckUserId !== userId) {
    studentStreakCheckUserId = userId;
    studentStreakCheckPromise = window.tusyenApi.checkStreak().catch(() => null);
  }
  return studentStreakCheckPromise;
};

const useStudentStreakOnMount = () => {
  React.useEffect(() => {
    const u = window.tusyenUser;
    if (u?.role === 'student' && u?.id) ensureStudentStreakChecked(u.id);
  }, []);
};

const useStudentStats = () => {
  const initial = window.tusyenUser?.role === 'student' ? EMPTY_STUDENT_STATS : DEMO_STUDENT_STATS;
  return useAsync(async () => {
    const u = window.tusyenUser;
    if (u?.role !== 'student' || !u?.id) return DEMO_STUDENT_STATS;
    ensureStudentStreakChecked(u.id);
    const [data, heartsData] = await Promise.all([
      window.tusyenApi.studentStats(u.id),
      window.tusyenApi.studentHearts ? window.tusyenApi.studentHearts(u.id).catch(() => null) : Promise.resolve(null),
    ]);
    const hearts = normalizeStudentHearts(heartsData || data?.hearts || data?.heart_status || data?.heartStatus);
    if (!data) return { ...EMPTY_STUDENT_STATS, hearts };
    const overall = data.overall || {};
    const today = data.today || {};
    const streakValue = typeof data.streak === 'object' ? data.streak?.current : data.streak;
    const lessons = Number(overall.lessons_completed) || 0;
    const lessonsAttempted = Number(overall.total_lessons_attempted) || lessons;
    const todayCompleted = Number(today.lessons_completed) || 0;
    const todayAttempted = Number(today.lessons_attempted) || todayCompleted;
    return {
      streak:  Number(streakValue)               || 0,
      xp:      Number(data.quiz?.quizXpTotal)    || 0,
      hearts,
      lessons,
      lessonsAttempted,
      daysActive: Number(overall.days_active) || 0,
      today:{ lessonsAttempted:todayAttempted, lessonsCompleted:todayCompleted, target:10 },
      bySubject: Array.isArray(data.bySubject) ? data.bySubject : [],
      fromFallback:false,
    };
  }, [], initial);
};

const useAssignedLessons = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return [];
    const { lessons } = await window.tusyenApi.assignedLessons();
    return (lessons || []).map(normalizeLessonCard);
  }, [], []);
};

const useCatalogLessons = (subject, formLevel) => {
  const normalizedSubject = `${subject || ''}`.trim();
  const normalizedFormLevel = normalizeFormLevel(formLevel);
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return [];
    if (!window.tusyenApi?.catalogLessons) return [];
    const params = {};
    if (normalizedSubject) params.subject = normalizedSubject;
    if (normalizedFormLevel) params.formLevel = normalizedFormLevel;
    const { lessons } = await window.tusyenApi.catalogLessons(params);
    return (lessons || []).map(normalizeCatalogLessonCard);
  }, [normalizedSubject, normalizedFormLevel], []);
};

const pickContinueLesson = (assignedLessons=[], catalogLessons=[]) => {
  const assigned = assignedLessons || [];
  const catalog = catalogLessons || [];
  return assigned.find(lesson => lesson.progress > 0 && lesson.progress < 100) ||
    catalog.find(lesson => lesson.progress > 0 && lesson.progress < 100) ||
    assigned.find(lesson => Number(lesson.progress || 0) === 0) ||
    catalog.find(lesson => Number(lesson.progress || 0) === 0) ||
    assigned.find(lesson => lesson.progress < 100) ||
    catalog.find(lesson => lesson.progress < 100) ||
    assigned[0] ||
    catalog[0] ||
    null;
};

const useContinueLesson = () => {
  const assignedLessons = useAssignedLessons();
  const catalogLessons = useCatalogLessons();
  const nextLesson = pickContinueLesson(assignedLessons.data || [], catalogLessons.data || []);
  return {
    ...assignedLessons,
    loading: assignedLessons.loading || catalogLessons.loading,
    error: assignedLessons.error || catalogLessons.error,
    refresh: () => {
      assignedLessons.refresh?.();
      catalogLessons.refresh?.();
    },
    data: nextLesson || CONTINUE_EMPTY,
  };
};

const useStudentClassInfo = () => {
  const demo = { label:'Tingkatan 4', detail:'Belum disambung ke kelas', formLevel:4, classrooms:[] };
  const empty = { label:'Belum sertai kelas', detail:'Minta kod kelas daripada guru', formLevel:null, classrooms:[] };
  const initial = window.tusyenUser?.role === 'student' ? empty : demo;
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return demo;
    const { classrooms } = await window.tusyenApi.classrooms();
    const list = classrooms || [];
    const first = list[0];
    if (!first) return empty;
    const form = first.form_level || first.formLevel;
    return {
      label: `${form ? `Tingkatan ${form}` : 'Tingkatan'} • ${studentText(first.name, 'Kelas', 54)}`,
      detail: first.subject ? `${studentText(first.subject, 'Subjek', 36)} • ${studentName(first.teacher_name, 'Guru')}` : studentName(first.teacher_name, ''),
      formLevel: form ? Number(form) : null,
      classrooms:list,
    };
  }, [], initial);
};

const useClassroomLeaderboard = (displayName, hasClassrooms=true) => {
  const initial = window.tusyenUser?.role === 'student' ? [] : LEADERBOARD_BASE;
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return LEADERBOARD_BASE;
    if (!hasClassrooms) return [];
    const { classrooms } = await window.tusyenApi.classrooms();
    const first = (classrooms || [])[0];
    if (!first?.id) return [];
    const { leaderboard } = await window.tusyenApi.classroomLeaderboard(first.id);
    const mapped = (leaderboard || []).map((row, i) => {
      const rank = Number(row.rank || i + 1);
      const currentUser = window.tusyenUser || {};
      const userId = currentUser.id;
      const rowUserId = row.user_id || row.userId || row.student_id || row.studentId;
      const userName = (currentUser.fullName || currentUser.full_name || '').trim().toLowerCase();
      const rowName = (row.full_name || row.name || '').trim().toLowerCase();
      const isMe = (userId && rowUserId && `${rowUserId}` === `${userId}`) || (!!(userName && rowName) && userName === rowName);return {
        rank,
        name: studentName(row.full_name || row.name, 'Pelajar'),
        xp: Number(row.total_xp ?? row.xp) || 0,
        medal: medalForRank(rank),
        me: isMe,
      };
    });
    return mapped;
  }, [displayName, hasClassrooms], initial);
};

const useAchievements = () => {
  const initial = window.tusyenUser?.role === 'student' ? [] : BADGES;
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return BADGES;
    const { achievements } = await window.tusyenApi.myAchievements();
    const mapped = (achievements || []).map(a => {
      const type = a.type || a.badge_type || a.badgeType || a.key || a.slug || '';
      const meta = achievementMetaForType(type);
      return {
        icon: a.icon || a.icon_url || meta.icon,
        name: studentTitle(a.name || a.title || meta.name, meta.name, 64),
        desc: a.description || a.desc || '',
        earned: Boolean(a.is_earned || a.earned || a.earned_at),
        type,
      };
    }).filter(a => a.name);return mapped;
  }, [], initial);
};

const compactNotifText = (value='', fallback='Aktiviti kelas baharu') => {
  const text = `${value || fallback}`.replace(/\s+/g, ' ').trim();
  return text.length > 86 ? `${text.slice(0, 83)}...` : text;
};

const postNotificationIcon = (postType='') => {
  const type = `${postType}`.toLowerCase();
  if (type.includes('assignment')) return '📋';
  if (type.includes('announcement')) return '📣';
  return '💬';
};

const studentNotificationTs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const mergeStudentNotifications = (...groups) => {
  const seen = new Set();
  return groups
    .flat()
    .filter(Boolean)
    .filter(item => item.id && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 12);
};

const studentNotificationClassroomIds = (classInfo=null) => {
  const seen = new Set();
  return (classInfo?.classrooms || [])
    .map(cls => cls?.id || cls?.classroom_id || cls?.classroomId)
    .filter(id => id && !seen.has(id) && seen.add(id));
};

const buildStudentPostNotification = (post={}) => {
  const postId = post.id || post.post_id || post.postId;
  if (!postId) return null;
  const createdAt = post.created_at || post.createdAt || post.updated_at || post.updatedAt;
  const title = studentTitle(post.title || post.content, 'Pengumuman kelas');
  return {
    id:`post:${postId}`,
    icon:postNotificationIcon(post.post_type || post.postType),
    msg:compactNotifText(`${studentName(post.author_name || post.authorName, 'Guru')}: ${title}`),
    time:timeAgo(createdAt),
    ts:studentNotificationTs(createdAt),
  };
};

const buildStudentLessonNotification = (lesson={}, options={}) => {
  const data = normalizeLessonCard(lesson);
  const lessonId = data.id || lesson.lesson_id || lesson.lessonId;
  if (!lessonId) return null;
  const classroomId = options.classroomId || data.classroomId || lesson.classroom_id || lesson.classroomId || 'class';
  const dueDate = data.dueDate || lesson.due_date || lesson.dueDate || null;
  return {
    id:`lesson:${classroomId}:${lessonId}`,
    icon:'📚',
    msg:compactNotifText(`${data.title} tersedia untuk disambung`),
    time:dueDate ? `Tarikh akhir ${new Date(dueDate).toLocaleDateString('ms-MY', { day:'numeric', month:'short' })}` : (options.time || 'Pelajaran aktif'),
    ts:options.ts || studentNotificationTs(dueDate) || studentNotificationTs(lesson.assigned_at || lesson.assignedAt || lesson.created_at || lesson.createdAt),
  };
};

const fetchStudentNotificationItems = async ({ classroomId } = {}) => {
  const items = [];
  const feedParams = classroomId ? { classroomId, limit:8 } : { limit:8 };
  const lessonParams = classroomId ? { classroomId } : {};
  const [feedResult, lessonResult] = await Promise.allSettled([
    window.tusyenApi.feedPosts(feedParams),
    window.tusyenApi.assignedLessons(lessonParams),
  ]);

  const posts = feedResult.status === 'fulfilled' ? (feedResult.value.posts || []) : [];
  posts.forEach(post => {
    const item = buildStudentPostNotification(post);
    if (item) items.push(item);
  });

  const lessons = lessonResult.status === 'fulfilled'
    ? (lessonResult.value.lessons || []).map(normalizeLessonCard)
    : [];
  lessons
    .filter(lesson => lesson.id && lesson.progress < 100)
    .slice(0, 4)
    .forEach(lesson => {
      const item = buildStudentLessonNotification(lesson, { classroomId });
      if (item) items.push(item);
    });

  return mergeStudentNotifications(items);
};

const buildStudentRealtimeNotification = (message={}, classroomId='') => {
  const type = `${message.type || ''}`;
  const now = Date.now();
  if (type === 'LESSON_ASSIGNED' || type === 'CLASSROOM_LESSON_ASSIGNED') {
    return buildStudentLessonNotification(message.lesson || {
      id:message.lessonId || message.lesson_id,
      title:message.lessonTitle || message.title,
      dueDate:message.dueDate || message.due_date,
      classroomId:message.classroomId || classroomId,
    }, {
      classroomId:message.classroomId || classroomId,
      time:'Baru sahaja',
      ts:now,
    });
  }
  if (type === 'QUIZ_LOBBY_CREATED' || type === 'QUIZ_SESSION_STARTED' || type === 'QUIZ_QUESTION_STARTED') {
    const title = studentTitle(message.deckTitle || message.quizTitle || message.title, 'Kuiz langsung');
    const status = type === 'QUIZ_LOBBY_CREATED' ? 'dibuka' : 'telah bermula';
    return {
      id:`quiz:${message.sessionId || message.quizSessionId || message.pin || classroomId}:${type}`,
      icon:'🎮',
      msg:compactNotifText(`${title} ${status}. Sertai sekarang.`),
      time:'Baru sahaja',
      ts:now,
    };
  }
  if (type === 'WHITEBOARD_STARTED') {
    const title = studentTitle(message.title, 'Papan putih langsung');
    return {
      id:`whiteboard:${message.sessionId || classroomId}`,
      icon:'🖊️',
      msg:compactNotifText(`${title} telah bermula.`),
      time:'Baru sahaja',
      ts:now,
    };
  }
  if (type === 'CHAT_MESSAGE' && message.message) {
    return {
      id:`chat:${message.messageId || message.timestamp || now}`,
      icon:'💬',
      msg:compactNotifText(message.message, 'Mesej kelas baharu'),
      time:'Baru sahaja',
      ts:studentNotificationTs(message.timestamp) || now,
    };
  }
  return null;
};

const useStudentNotifications = (classInfo=null) => {
  const classroomIds = React.useMemo(() => studentNotificationClassroomIds(classInfo), [classInfo]);
  const classroomKey = classroomIds.join('|');
  const baseState = useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return [];
    const items = [];
    const initialItems = await fetchStudentNotificationItems();
    items.push(...initialItems);
    return mergeStudentNotifications(items);
  }, [classroomKey], []);
  const [liveItems, setLiveItems] = React.useState([]);
  const [removedItemIds, setRemovedItemIds] = React.useState(() => new Set());

  React.useEffect(() => {
    setLiveItems([]);
    setRemovedItemIds(new Set());
  }, [classroomKey]);

  React.useEffect(() => {
    if (window.tusyenUser?.role !== 'student') return undefined;
    if (!classroomIds.length || typeof WebSocket === 'undefined' || !window.tusyenApi?.buildClassroomWsUrl) return undefined;

    let closed = false;
    const sockets = [];
    const addNotifications = (items=[]) => {
      const cleanItems = items.filter(Boolean);
      if (!cleanItems.length || closed) return;
      setLiveItems(prev => mergeStudentNotifications(cleanItems, prev));
      setRemovedItemIds(prev => {
        let changed = false;
        const next = new Set(prev);
        cleanItems.forEach(item => {
          if (next.delete(item.id)) changed = true;
        });
        return changed ? next : prev;
      });
    };
    const refreshClassroomNotifications = async (classroomId) => {
      try {
        const items = await fetchStudentNotificationItems({ classroomId });
        addNotifications(items);
      } catch {}
    };
    const removeNotification = (id) => {
      if (!id) return;
      setLiveItems(prev => prev.filter(item => item.id !== id));
      setRemovedItemIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    };

    classroomIds.forEach(classroomId => {
      try {
        const ws = new WebSocket(window.tusyenApi.buildClassroomWsUrl(classroomId));
        sockets.push(ws);
        ws.onopen = () => {
          const token = localStorage.getItem('tusyen_token') || '';
          ws.send(JSON.stringify({ type:'AUTH', token }));
        };
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const type = `${message.type || ''}`;
            const eventClassroomId = message.classroomId || classroomId;
            if (type === 'NEW_POST' || type === 'POST_UPDATED' || type === 'NEW_POST_COMMENT' || type === 'POST_COMMENT_UPDATED') {
              refreshClassroomNotifications(eventClassroomId);
              return;
            }
            if (type === 'POST_DELETED') {
              removeNotification(`post:${message.postId || message.id}`);
              return;
            }
            if (type === 'LESSON_ASSIGNED' || type === 'CLASSROOM_LESSON_ASSIGNED') {
              addNotifications([buildStudentRealtimeNotification(message, eventClassroomId)]);
              refreshClassroomNotifications(eventClassroomId);
              return;
            }
            addNotifications([buildStudentRealtimeNotification(message, eventClassroomId)]);
          } catch {}
        };
      } catch {}
    });

    return () => {
      closed = true;
      sockets.forEach(ws => {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
        } catch {}
      });
    };
  }, [classroomKey]);

  return {
    ...baseState,
    data:mergeStudentNotifications(liveItems, baseState.data || [])
      .filter(item => !removedItemIds.has(item.id)),
  };
};

const StudentScopedStyles = () => (
  <style>{`
    .student-shell .main-area,
    .student-shell .main-content,
    .student-shell .main-content > * {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .student-shell .student-wrap-text {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .student-shell .student-clamp-2,
    .student-shell .student-clamp-3 {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .student-shell .student-clamp-2 { -webkit-line-clamp: 2; }
    .student-shell .student-clamp-3 { -webkit-line-clamp: 3; }
    .student-shell .student-scroll-affordance {
      scrollbar-width: thin;
      scrollbar-color: var(--c-acc-hi) transparent;
      overscroll-behavior-x: contain;
    }
    .student-shell .student-scroll-affordance::-webkit-scrollbar { height: 6px; }
    .student-shell .student-scroll-affordance::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--c-acc-hi) 72%, transparent);
      border-radius: 999px;
    }
    .student-shell .student-scroll-fade {
      position: relative;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .student-shell .student-scroll-fade::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      width: 26px;
      z-index: 2;
      pointer-events: none;
    }
    .student-shell .student-scroll-fade::after {
      right: 0;
      background: linear-gradient(270deg, var(--c-bg), transparent);
    }
    .student-shell .student-native-select {
      width: 100%;
      min-height: 46px;
      box-sizing: border-box;
      border-radius: 14px;
      padding: 0 12px;
      font-family: Nunito, sans-serif;
      font-size: 13px;
      font-weight: 900;
    }
    .student-shell .main-content {
      padding: 18px 18px 32px;
    }
    .student-shell.student-mobile-nav .student-focus-title { min-width: 0; }
    @media (max-width: 600px) {
      .student-shell.student-mobile-nav .sidebar-wrap { display: none !important; }
      .student-shell.student-mobile-nav .top-bar-mobile {
        display: flex !important;
        height: 52px;
        padding: 0 12px;
      }
      .student-shell.student-mobile-nav .bottom-nav-wrap {
        display: block !important;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 180;
      }
      .student-shell.student-mobile-nav .main-content {
        padding: 16px 16px 96px !important;
      }
      .student-shell.student-mobile-nav .bottom-nav-wrap button {
        min-width: 44px;
        min-height: 44px;
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
    }
    .student-shell.student-focus-mode .sidebar-wrap,
    .student-shell.student-focus-mode .top-bar-mobile,
    .student-shell.student-focus-mode .bottom-nav-wrap,
    .student-shell.student-focus-mode .student-data-banner {
      display: none !important;
    }
    .student-shell.student-focus-mode .main-content {
      padding: 16px !important;
    }
  `}</style>
);

const StudentConfirmModal = ({
  open,
  title,
  message,
  confirmLabel='Teruskan',
  cancelLabel='Batal',
  danger=false,
  busy=false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position:'fixed', inset:0, zIndex:650,
        background:'rgba(2,6,23,.62)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-confirm-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:380,
          background:C.bg, border:`1px solid ${C.border}`,
          borderRadius:18, padding:16,
          boxShadow:'0 24px 80px rgba(0,0,0,.42)',
        }}
      >
        <div id="student-confirm-title" style={{ fontWeight:900, fontSize:17, color:C.text, marginBottom:6 }}>
          {title}
        </div>
        <div style={{ fontSize:13, color:C.textMuted, fontWeight:700, lineHeight:1.5, marginBottom:14 }}>
          {message}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              minHeight:44, borderRadius:12,
              border:`1px solid ${C.border}`,
              background:C.surface, color:C.textMuted,
              fontFamily:'Nunito', fontWeight:900, cursor:busy ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              minHeight:44, borderRadius:12,
              border:`1px solid ${danger ? 'rgba(239,68,68,.35)' : C.borderB}`,
              background:danger ? 'rgba(239,68,68,.14)' : C.accDim,
              color:danger ? C.red : C.accPale,
              fontFamily:'Nunito', fontWeight:900, cursor:busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const cleanStudentKuizPin = (value='') => `${value}`.replace(/\D/g, '').slice(0, 6);
const cleanStudentJoinCode = (value='') => `${value}`.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
const studentJoinCodeValidation = (value='') => {
  const code = cleanStudentJoinCode(value);
  if (!code) return 'Masukkan kod kelas daripada guru.';
  if (code.replace(/-/g, '').length < 4) return 'Kod kelas terlalu pendek. Semak kod penuh daripada guru.';
  return '';
};
const studentJoinCodeErrorMessage = (message='') => {
  const text = `${message}`.toLowerCase();
  if (text.includes('already') || text.includes('sudah') || text.includes('enrolled')) {
    return 'Kamu sudah berada dalam kelas ini.';
  }
  if (text.includes('code') || text.includes('kod') || text.includes('invalid') || text.includes('not found')) {
    return 'Kod kelas tidak sah. Semak huruf, nombor, atau tanda sempang daripada guru.';
  }
  return message || 'Kod kelas tidak dapat digunakan.';
};
const studentKuizJoinErrorMessage = (message='') => {
  const text = `${message}`.toLowerCase();
  if (text.includes('ended') || text.includes('cancelled') || text.includes('tamat')) {
    return 'Kuiz ini telah tamat. Minta PIN sesi baharu daripada guru.';
  }
  if (text.includes('pin') || text.includes('not found')) {
    return 'PIN tidak sah. Semak 6 digit daripada guru dan cuba lagi.';
  }
  if (text.includes('not enrolled')) {
    return 'Akaun ini belum didaftarkan dalam kelas kuiz tersebut.';
  }
  return message || 'Tidak dapat menyertai kuiz.';
};

const STUDENT_WHITEBOARD_WIDTH = 1280;
const STUDENT_WHITEBOARD_HEIGHT = 720;
const STUDENT_WHITEBOARD_BG = '#0f0f1a';

const studentWhiteboardClassroomId = (classroom={}) => `${classroom.id || classroom.classroom_id || classroom.classroomId || ''}`;
const studentWhiteboardSessionId = (session={}) => `${session?.id || session?.sessionId || session?.session_id || ''}`;
const studentWhiteboardClassroomName = (classroom={}) => studentTitle(classroom.name || classroom.title, 'Kelas', 54);
const studentWhiteboardSessionTitle = (session={}) => studentTitle(session?.title || session?.name, 'Papan putih langsung', 70);
const studentWhiteboardSessionClassroomId = (session={}, fallback='') => `${session?.classroom_id || session?.classroomId || fallback || ''}`;
const studentWhiteboardJoinErrorMessage = (message='') => {
  const text = `${message}`.toLowerCase();
  if (text.includes('inactive') || text.includes('ended') || text.includes('tamat')) {
    return 'Sesi papan putih ini telah tamat. Minta guru mulakan sesi baharu.';
  }
  if (text.includes('access') || text.includes('denied') || text.includes('not enrolled')) {
    return 'Akaun ini belum didaftarkan dalam kelas papan putih tersebut.';
  }
  return message || 'Tidak dapat menyertai papan putih.';
};
const studentWhiteboardEventPayload = (event={}) => {
  let payload = event.payload || event.data || event.event_data || event.eventData || event.detail || event;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); }
    catch { payload = {}; }
  }
  return payload || {};
};
const studentWhiteboardEventType = (event={}) => {
  const raw = `${event.type || event.event_type || event.eventType || event.kind || ''}`.toUpperCase();
  const payloadType = `${studentWhiteboardEventPayload(event).type || ''}`.toUpperCase();
  const type = raw || payloadType;
  if (type.includes('CLEAR')) return 'WHITEBOARD_CLEAR';
  if (type.includes('DRAW')) return 'WHITEBOARD_DRAW';
  return type;
};
const studentWhiteboardEvents = (data={}) => {
  const list = Array.isArray(data?.events) ? data.events
    : Array.isArray(data?.items) ? data.items
      : Array.isArray(data) ? data
        : [];
  return [...list].sort((a, b) => (Number(a.sequence ?? a.seq ?? 0) || 0) - (Number(b.sequence ?? b.seq ?? 0) || 0));
};
const studentWhiteboardPoint = (point) => {
  const x = Array.isArray(point) ? point[0] : point?.x;
  const y = Array.isArray(point) ? point[1] : point?.y;
  const px = Number(x);
  const py = Number(y);
  return Number.isFinite(px) && Number.isFinite(py) ? { x:px, y:py } : null;
};
const studentWhiteboardResetCanvas = (ctx) => {
  if (!ctx?.canvas) return;
  ctx.fillStyle = STUDENT_WHITEBOARD_BG;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};
const studentWhiteboardDrawLine = (ctx, from, to, color, width, tool) => {
  if (!ctx || !from || !to) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, Number(width) || 4);
  ctx.strokeStyle = tool === 'eraser' ? STUDENT_WHITEBOARD_BG : (color || '#38BDF8');
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
};
const studentWhiteboardDrawStroke = (ctx, stroke={}) => {
  const points = (stroke.points || stroke.path || []).map(studentWhiteboardPoint).filter(Boolean);
  if (!points.length) return;
  const color = stroke.color || '#38BDF8';
  const width = stroke.width || stroke.lineWidth || 4;
  const tool = stroke.tool || 'pen';
  if (points.length === 1) {
    const p = points[0];
    studentWhiteboardDrawLine(ctx, p, { x:p.x + 0.1, y:p.y + 0.1 }, color, width, tool);
    return;
  }
  for (let i = 1; i < points.length; i += 1) {
    studentWhiteboardDrawLine(ctx, points[i - 1], points[i], color, width, tool);
  }
};
const studentWhiteboardMessageSessionId = (message={}) => `${message.sessionId || message.session_id || ''}`;
const studentWhiteboardShouldApply = (message={}, sessionId='') => {
  const msgSessionId = studentWhiteboardMessageSessionId(message);
  return !msgSessionId || !sessionId || msgSessionId === `${sessionId}`;
};
const studentWhiteboardApplyEvent = (ctx, event={}, sessionId='') => {
  const payload = studentWhiteboardEventPayload(event);
  const type = studentWhiteboardEventType(event);
  if (!studentWhiteboardShouldApply({ ...event, ...payload }, sessionId)) return;
  if (type === 'WHITEBOARD_CLEAR') {
    studentWhiteboardResetCanvas(ctx);
    return;
  }
  if (type === 'WHITEBOARD_DRAW') {
    const strokes = payload.strokes || event.strokes || [];
    strokes.forEach(stroke => studentWhiteboardDrawStroke(ctx, stroke));
  }
};

const useStudentWhiteboardSessions = (classInfo=null) => {
  const classroomKey = (classInfo?.classrooms || []).map(studentWhiteboardClassroomId).filter(Boolean).join('|');
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return { rows:[], activeCount:0 };
    const classrooms = classInfo?.classrooms || [];
    if (!classrooms.length || !window.tusyenApi?.whiteboardActiveSession) return { rows:[], activeCount:0 };
    const rows = await Promise.all(classrooms.map(async (classroom) => {
      const classroomId = studentWhiteboardClassroomId(classroom);
      if (!classroomId) return null;
      try {
        const data = await window.tusyenApi.whiteboardActiveSession(classroomId);
        const session = data?.session || data?.activeSession || (data?.active && studentWhiteboardSessionId(data) ? data : null);
        return {
          classroom,
          classroomId,
          session,
          active:Boolean(session && studentWhiteboardSessionId(session)),
          onlineCount:data?.onlineCount ?? data?.online_count ?? null,
        };
      } catch (err) {
        return {
          classroom,
          classroomId,
          session:null,
          active:false,
          error:err.message || 'Tidak dapat menyemak papan putih.',
        };
      }
    }));
    const cleanRows = rows.filter(Boolean);
    return { rows:cleanRows, activeCount:cleanRows.filter(row => row.active).length };
  }, [classroomKey], { rows:[], activeCount:0 });
};

const SWhiteboardCanvas = ({ session, classroom, onLeave, onSessionEnded }) => {
  const sessionId = studentWhiteboardSessionId(session);
  const classroomId = studentWhiteboardSessionClassroomId(session, studentWhiteboardClassroomId(classroom));
  const canvasRef = React.useRef(null);
  const wsRef = React.useRef(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef(null);
  const loadedRef = React.useRef(false);
  const queuedMessagesRef = React.useRef([]);
  const [color, setColor] = React.useState('#38BDF8');
  const [lineWidth, setLineWidth] = React.useState(5);
  const [tool, setTool] = React.useState('pen');
  const [connected, setConnected] = React.useState(false);
  const [status, setStatus] = React.useState('Memuatkan papan putih...');
  const colors = ['#38BDF8', '#22C55E', '#F59E0B', '#EF4444', '#A78BFA', '#FFFFFF'];

  const applyIncoming = React.useCallback((message) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx || !studentWhiteboardShouldApply(message, sessionId)) return;
    if (!loadedRef.current) {
      queuedMessagesRef.current.push(message);
      return;
    }
    studentWhiteboardApplyEvent(ctx, message, sessionId);
  }, [sessionId]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx || !sessionId) return undefined;
    let cancelled = false;
    loadedRef.current = false;
    queuedMessagesRef.current = [];
    studentWhiteboardResetCanvas(ctx);
    setStatus('Memuatkan lakaran papan putih...');
    (async () => {
      try {
        const data = await window.tusyenApi.whiteboardSessionEvents(sessionId);
        if (cancelled) return;
        studentWhiteboardResetCanvas(ctx);
        studentWhiteboardEvents(data).forEach(event => studentWhiteboardApplyEvent(ctx, event, sessionId));
        loadedRef.current = true;
        queuedMessagesRef.current.splice(0).forEach(message => studentWhiteboardApplyEvent(ctx, message, sessionId));
        setStatus('Papan putih sedia.');
      } catch (err) {
        if (cancelled) return;
        loadedRef.current = true;
        queuedMessagesRef.current.splice(0).forEach(message => studentWhiteboardApplyEvent(ctx, message, sessionId));
        setStatus('Papan putih sedia, tetapi sejarah lakaran tidak dapat dimuatkan.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  React.useEffect(() => {
    if (!classroomId || typeof WebSocket === 'undefined' || !window.tusyenApi?.buildWhiteboardWsUrl) {
      setConnected(false);
      setStatus('Sambungan langsung tidak tersedia pada pelayar ini.');
      return undefined;
    }
    let closed = false;
    try {
      const ws = new WebSocket(window.tusyenApi.buildWhiteboardWsUrl(classroomId));
      wsRef.current = ws;
      ws.onopen = () => {
        const token = localStorage.getItem('tusyen_token') || '';
        ws.send(JSON.stringify({ type:'AUTH', token }));
        setStatus('Menyambung ke papan putih langsung...');
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'AUTH_SUCCESS') {
            setConnected(true);
            setStatus('Papan putih langsung disambung.');
            return;
          }
          if (message.type === 'WHITEBOARD_DRAW' || message.type === 'WHITEBOARD_CLEAR') {
            applyIncoming(message);
            return;
          }
          if (message.type === 'WHITEBOARD_ENDED' && studentWhiteboardShouldApply(message, sessionId)) {
            setStatus('Sesi papan putih telah tamat.');
            onSessionEnded?.();
            return;
          }
          if (message.type === 'ERROR') {
            const errorText = `${message.message || ''}`;
            setStatus(errorText.includes('Only teachers')
              ? 'Backend belum membenarkan pelajar melukis pada papan putih.'
              : errorText || 'Ralat sambungan papan putih.');
          }
        } catch {}
      };
      ws.onerror = () => setStatus('Sambungan papan putih bermasalah.');
      ws.onclose = () => {
        if (!closed) {
          setConnected(false);
          setStatus('Sambungan papan putih terputus.');
        }
      };
    } catch (err) {
      setConnected(false);
      setStatus('Tidak dapat membuka sambungan papan putih.');
    }
    return () => {
      closed = true;
      setConnected(false);
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) wsRef.current.close();
      } catch {}
      wsRef.current = null;
    };
  }, [classroomId, sessionId, applyIncoming, onSessionEnded]);

  const pointerPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect?.();
    if (!canvas || !rect?.width || !rect?.height) return null;
    return {
      x:(event.clientX - rect.left) * (canvas.width / rect.width),
      y:(event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const sendStroke = (stroke) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type:'WHITEBOARD_DRAW', sessionId, strokes:[stroke] }));
    } else {
      setStatus('Sambungan belum bersedia. Lakaran dipaparkan pada skrin kamu sahaja.');
    }
  };
  const drawLocalStroke = (from, to) => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx || !from || !to) return;
    const stroke = { color, width:lineWidth, tool, points:[[from.x, from.y], [to.x, to.y]] };
    studentWhiteboardDrawStroke(ctx, stroke);
    sendStroke(stroke);
  };
  const startDrawing = (event) => {
    event.preventDefault();
    const point = pointerPoint(event);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
    drawLocalStroke(point, { x:point.x + 0.1, y:point.y + 0.1 });
  };
  const moveDrawing = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = pointerPoint(event);
    const lastPoint = lastPointRef.current;
    if (!point || !lastPoint) return;
    drawLocalStroke(lastPoint, point);
    lastPointRef.current = point;
  };
  const stopDrawing = (event) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch {}
  };

  return (
    <div style={{ maxWidth:980, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:16, padding:10,
      }}>
        <button
          onClick={onLeave}
          style={{
            minWidth:44, minHeight:44, borderRadius:12,
            background:C.card, border:`1px solid ${C.border}`,
            color:C.textMuted, fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
          }}
        >
          Keluar
        </button>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:12, color:C.textFaint, fontWeight:900 }}>
            {connected ? 'Papan putih aktif' : 'Menyambung papan'}
          </div>
          <div style={{ fontSize:15, color:C.text, fontWeight:900, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {studentWhiteboardSessionTitle(session)} - {studentWhiteboardClassroomName(classroom)}
          </div>
        </div>
        <div style={{
          minHeight:32, display:'flex', alignItems:'center',
          borderRadius:99, padding:'0 10px',
          background:connected ? 'rgba(34,197,94,.12)' : C.accDim,
          border:`1px solid ${connected ? 'rgba(34,197,94,.28)' : C.border}`,
          color:connected ? C.green : C.accPale,
          fontSize:11, fontWeight:900,
        }}>
          {connected ? 'Langsung' : 'Offline'}
        </div>
      </div>

      <Card style={{ padding:12 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <button
              type="button"
              onClick={() => setTool('pen')}
              style={{
                minHeight:44, padding:'0 14px', borderRadius:12,
                border:`2px solid ${tool === 'pen' ? C.acc : C.border}`,
                background:tool === 'pen' ? C.accDim : C.card,
                color:tool === 'pen' ? C.accPale : C.textMuted,
                fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
              }}
            >
              Pen
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              style={{
                minHeight:44, padding:'0 14px', borderRadius:12,
                border:`2px solid ${tool === 'eraser' ? C.acc : C.border}`,
                background:tool === 'eraser' ? C.accDim : C.card,
                color:tool === 'eraser' ? C.accPale : C.textMuted,
                fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
              }}
            >
              Pemadam
            </button>
            {colors.map(item => (
              <button
                key={item}
                type="button"
                aria-label={`Warna ${item}`}
                onClick={() => { setColor(item); setTool('pen'); }}
                style={{
                  width:44, height:44, borderRadius:12, cursor:'pointer',
                  border:`3px solid ${color === item && tool === 'pen' ? C.acc : C.border}`,
                  background:item,
                  boxShadow:item === '#FFFFFF' ? 'inset 0 0 0 1px rgba(15,23,42,.25)' : 'none',
                }}
              />
            ))}
          </div>
          <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, color:C.textMuted, fontWeight:900 }}>
            Saiz
            <input
              type="range"
              min="2"
              max="18"
              value={lineWidth}
              onChange={e => setLineWidth(Number(e.target.value) || 5)}
              style={{ width:120 }}
            />
            <span style={{ color:C.text }}>{lineWidth}</span>
          </label>
        </div>
        <canvas
          ref={canvasRef}
          width={STUDENT_WHITEBOARD_WIDTH}
          height={STUDENT_WHITEBOARD_HEIGHT}
          aria-label="Kanvas papan putih"
          onPointerDown={startDrawing}
          onPointerMove={moveDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{
            display:'block', width:'100%', aspectRatio:'16 / 9',
            borderRadius:18, border:`1px solid ${C.border}`,
            background:STUDENT_WHITEBOARD_BG,
            cursor:tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction:'none',
            boxShadow:'inset 0 0 0 1px rgba(255,255,255,.03)',
          }}
        />
        <div role="status" aria-live="polite" style={{
          marginTop:10, fontSize:12, color:status.includes('belum membenarkan') || status.includes('bermasalah') || status.includes('terputus') ? C.red : C.textMuted,
          fontWeight:800, lineHeight:1.4,
        }}>
          {status}
        </div>
      </Card>
    </div>
  );
};

const SWhiteboardJoin = ({ classInfo, onActiveChange }) => {
  const sessState = useStudentWhiteboardSessions(classInfo);
  const rows = sessState.data?.rows || [];
  const activeRows = rows.filter(row => row.active);
  const [joined, setJoined] = React.useState(null);
  const [joiningId, setJoiningId] = React.useState('');
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    onActiveChange?.(Boolean(joined));
    return () => onActiveChange?.(false);
  }, [joined, onActiveChange]);

  const joinSession = async (row) => {
    const sessionId = studentWhiteboardSessionId(row.session);
    if (!sessionId) {
      setMsg('Tiada sesi papan putih aktif untuk kelas ini.');
      return;
    }
    setJoiningId(sessionId);
    setMsg('Menyertai papan putih...');
    try {
      const joinData = window.tusyenApi?.joinWhiteboardSession
        ? await window.tusyenApi.joinWhiteboardSession(sessionId)
        : null;
      setJoined({
        session:{ ...row.session, classroomId:row.classroomId, joinData },
        classroom:row.classroom,
      });
      setMsg('');
    } catch (err) {
      setMsg(studentWhiteboardJoinErrorMessage(err.message));
    } finally {
      setJoiningId('');
    }
  };

  if (joined) {
    return (
      <SWhiteboardCanvas
        session={joined.session}
        classroom={joined.classroom}
        onLeave={() => { setJoined(null); sessState.refresh?.(); }}
        onSessionEnded={() => { setJoined(null); sessState.refresh?.(); }}
      />
    );
  }

  return (
    <div style={{ maxWidth:760, margin:'0 auto', display:'flex', flexDirection:'column', gap:14 }}>
      <Card style={{
        display:'flex', gap:14, alignItems:'center',
        background:`linear-gradient(135deg, ${C.accDim}, rgba(56,189,248,.08))`,
      }}>
        <div style={{ fontSize:30 }} aria-hidden="true">🖌️</div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontWeight:900, fontSize:17, color:C.text }}>Papan putih langsung</div>
          <div style={{ color:C.textMuted, fontSize:13, fontWeight:700, lineHeight:1.4 }}>
            Sertai sesi guru, lihat lakaran semasa, dan lukis jawapan terus pada papan.
          </div>
        </div>
        <button
          type="button"
          onClick={() => sessState.refresh?.()}
          style={{
            minHeight:44, minWidth:44, borderRadius:12,
            border:`1px solid ${C.border}`, background:C.card,
            color:C.textMuted, fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
          }}
        >
          Semak
        </button>
      </Card>

      {sessState.loading && <Skeleton lines={3} />}
      {msg && (
        <div role="alert" style={{
          color:msg.includes('Menyertai') ? C.accPale : C.red,
          fontSize:13, fontWeight:800, lineHeight:1.4,
          background:msg.includes('Menyertai') ? C.accDim : 'rgba(239,68,68,.08)',
          border:`1px solid ${msg.includes('Menyertai') ? C.border : 'rgba(239,68,68,.24)'}`,
          borderRadius:12, padding:10,
        }}>
          {msg}
        </div>
      )}

      {!sessState.loading && !(classInfo?.classrooms || []).length && (
        <Card>
          <div style={{ fontWeight:900, fontSize:16, color:C.text, marginBottom:4 }}>Belum sertai kelas</div>
          <div style={{ fontSize:13, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
            Minta kod kelas daripada guru sebelum menyertai papan putih langsung.
          </div>
        </Card>
      )}

      {!sessState.loading && activeRows.length === 0 && (classInfo?.classrooms || []).length > 0 && (
        <Card>
          <div style={{ fontWeight:900, fontSize:16, color:C.text, marginBottom:4 }}>Tiada papan putih aktif</div>
          <div style={{ fontSize:13, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
            Sesi akan muncul di sini selepas guru memulakan papan putih untuk kelas kamu.
          </div>
        </Card>
      )}

      {activeRows.map(row => {
        const sessionId = studentWhiteboardSessionId(row.session);
        const startedAt = row.session?.started_at || row.session?.startedAt || row.session?.created_at || row.session?.createdAt;
        return (
          <Card key={sessionId || row.classroomId} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:900, fontSize:16, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {studentWhiteboardSessionTitle(row.session)}
                </div>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:800, marginTop:3 }}>
                  {studentWhiteboardClassroomName(row.classroom)}
                  {startedAt ? ` - Bermula ${window.timeAgo(startedAt)}` : ''}
                </div>
              </div>
              <div style={{
                flexShrink:0, borderRadius:99, padding:'6px 10px',
                background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.28)',
                color:C.green, fontSize:11, fontWeight:900,
              }}>
                Aktif
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ fontSize:12, color:C.textFaint, fontWeight:800 }}>
                {row.onlineCount !== null ? `${row.onlineCount} peserta dalam kelas` : 'Sambungan langsung tersedia'}
              </div>
              <GlowButton onClick={() => joinSession(row)} disabled={joiningId === sessionId}>
                {joiningId === sessionId ? 'Menyertai...' : 'Sertai papan'}
              </GlowButton>
            </div>
          </Card>
        );
      })}

      {rows.some(row => row.error) && (
        <div style={{ fontSize:12, color:C.textFaint, fontWeight:800, lineHeight:1.45 }}>
          Sesetengah kelas tidak dapat disemak sekarang. Tekan Semak untuk cuba lagi.
        </div>
      )}
    </div>
  );
};

const SKuizJoin = ({ user, onActiveChange }) => {
  const [joinedSession, setJoinedSession] = React.useState(null);
  const [pinInput, setPinInput] = React.useState('');
  const pinInputRef = React.useRef(null);
  const [pinTouched, setPinTouched] = React.useState(false);
  const [pinAttempted, setPinAttempted] = React.useState(false);
  const [nickname, setNickname] = React.useState(`${user?.fullName || user?.full_name || ''}`.slice(0, 24));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [quizStatus, setQuizStatus] = React.useState('');
  const [leaveKuizOpen, setLeaveKuizOpen] = React.useState(false);
  const summaryState = useAsync(async () => {
    const summaryFn = window.tusyenApi?.[['my','Qui','zSummary'].join('')];
    if (!summaryFn) return {};
    return summaryFn.call(window.tusyenApi);
  }, [], {});
  const summary = summaryState.data?.summary || summaryState.data || {};
  React.useEffect(() => {
    onActiveChange?.(Boolean(joinedSession));
    return () => onActiveChange?.(false);
  }, [joinedSession, onActiveChange]);

  const pinValidation = pinInput.length === 0
    ? 'Masukkan PIN 6 digit.'
    : pinInput.length < 6
      ? 'PIN mesti 6 digit.'
      : '';
  const showPinValidation = Boolean((pinTouched || pinAttempted) && pinValidation);
  const pinErrorActive = showPinValidation || error.toLowerCase().includes('pin');
  const focusPinInput = () => window.setTimeout(() => {
    pinInputRef.current?.focus?.();
    pinInputRef.current?.select?.();
  }, 0);
  const resetPinForRetry = () => {
    setPinInput('');
    setPinTouched(false);
    setPinAttempted(false);
    setError('');
    focusPinInput();
  };

  const submitJoin = async (e) => {
    e.preventDefault();
    const cleanPin = cleanStudentKuizPin(pinInput);
    const cleanNickname = `${nickname}`.trim().slice(0, 24);
    if (cleanPin.length !== 6) {
      setPinAttempted(true);
      setError('');
      setQuizStatus('');
      focusPinInput();
      return;
    }
    if (!cleanNickname) { setError('Nama panggilan diperlukan.'); return; }
    setBusy(true);
    setError('');
    setQuizStatus('Menyertai kuiz...');
    try {
      const joinFn = window.tusyenApi[['join','Qui','zByPin'].join('')];
      const data = await joinFn.call(window.tusyenApi, { pin:cleanPin, nickname:cleanNickname });
      setJoinedSession(data);
      setQuizStatus('Kuiz disertai. Tunggu arahan guru.');
    } catch (err) {
      const message = studentKuizJoinErrorMessage(err.message);
      setError(message);
      setQuizStatus('');
      if (message.toLowerCase().includes('pin')) {
        setPinAttempted(true);
        focusPinInput();
      }
    } finally {
      setBusy(false);
    }
  };

  const LiveSession = window[['Qui','zLiveSession'].join('')];
  if (joinedSession && LiveSession) {
    const participantToken =
      joinedSession.participantToken ||
      joinedSession.participant?.joinToken ||
      joinedSession.participant?.join_token;
    const sessionTitle = joinedSession.deck?.title || joinedSession.session?.deckTitle || 'Kuiz langsung';
    return (
      <div style={{ maxWidth:760, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:16, padding:10,
        }}>
          <button
            onClick={() => setLeaveKuizOpen(true)}
            style={{
              minWidth:44, minHeight:44, borderRadius:12,
              background:C.card, border:`1px solid ${C.border}`,
              color:C.textMuted, fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
            }}
          >
            Keluar
          </button>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, color:C.textFaint, fontWeight:900 }}>Kuiz aktif</div>
            <div style={{ fontSize:15, color:C.text, fontWeight:900, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {sessionTitle}
            </div>
          </div>
        </div>
        <LiveSession
          session={joinedSession.session || joinedSession}
          initialSnapshot={joinedSession.snapshot}
          participantToken={participantToken}
          isTeacher={false}
          onEnd={() => { setJoinedSession(null); summaryState.refresh?.(); }}
        />
        <StudentConfirmModal
          open={leaveKuizOpen}
          danger
          title="Tinggalkan kuiz?"
          message="Jawapan yang belum dihantar mungkin hilang jika kamu keluar sekarang."
          confirmLabel="Tinggalkan"
          cancelLabel="Kekal"
          onConfirm={() => { setLeaveKuizOpen(false); setJoinedSession(null); summaryState.refresh?.(); }}
          onCancel={() => setLeaveKuizOpen(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth:680, margin:'0 auto', display:'flex', flexDirection:'column', gap:14 }}>
      {summaryState.loading && <Skeleton lines={2} />}
      {summaryState.data && (
        <Card style={{ display:'flex', gap:14, alignItems:'center' }}>
          <div style={{ fontSize:30 }} aria-hidden="true">🎮</div>
          <div>
            <div style={{ fontWeight:900, fontSize:16, color:C.text }}>Ringkasan kuiz saya</div>
            <div style={{ color:C.textMuted, fontSize:13, fontWeight:700 }}>
              {summary.recentSessions?.length ?? 0} sesi · {summary.quizXpTotal ?? 0} XP diperoleh
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontWeight:900, fontSize:16, color:C.text, marginBottom:4 }}>Sertai kuiz dengan PIN</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:800, marginBottom:12 }}>
          Dapatkan PIN daripada guru, kemudian tekan Sertai kuiz.
        </div>
        <form onSubmit={submitJoin} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <label style={{ fontSize:12, color:C.textMuted, fontWeight:900 }}>PIN kuiz 6 digit</label>
          <input
            ref={pinInputRef}
            placeholder="000000"
            value={pinInput}
            maxLength={6}
            inputMode="numeric"
                        pattern="[0-9]*"aria-label="PIN kuiz 6 digit"
            aria-invalid={pinErrorActive ? 'true' : 'false'}
            aria-describedby="student-kuiz-pin-help student-kuiz-pin-error"
            onBlur={() => setPinTouched(true)}
                        onKeyPress={e => { if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }}onChange={e => {
              setPinInput(cleanStudentKuizPin(e.target.value));
              setError('');
              setPinAttempted(false);
              setQuizStatus('');
            }}
            style={{
              minHeight:52, fontSize:22, textAlign:'center', letterSpacing:6,
              padding:'10px 0', borderRadius:12, border:`2px solid ${pinErrorActive ? C.red : C.border}`,
              background:C.card, color:C.text, fontFamily:'Nunito', fontWeight:900,
              boxShadow:pinErrorActive ? '0 0 0 3px rgba(239,68,68,.10)' : 'none',
            }}
            required
          />
          <div id="student-kuiz-pin-help" style={{
            fontSize:11, color:showPinValidation ? C.red : C.textFaint,
            fontWeight:800, marginTop:-6, lineHeight:1.35,
          }}>
            {showPinValidation ? `${pinValidation} ` : ''}Minta PIN daripada guru. {pinInput.length}/6 digit
          </div>
          <label style={{ fontSize:12, color:C.textMuted, fontWeight:900 }}>Nama panggilan</label>
          <input
            placeholder="Nama panggilan"
            value={nickname}
            maxLength={24}
            onChange={e => { setNickname(e.target.value.slice(0, 24)); setError(''); setQuizStatus(''); }}
            style={{
              minHeight:44, padding:'8px 12px', borderRadius:12, border:`2px solid ${C.border}`,
              background:C.card, color:C.text, fontFamily:'Nunito', fontWeight:800, fontSize:14,
            }}
            required
          />
          <div style={{ fontSize:11, color:C.textFaint, fontWeight:800, textAlign:'right', marginTop:-6 }}>
            {nickname.length}/24
          </div>
          {error && (
            <div id="student-kuiz-pin-error" role="alert" style={{
              color:C.red, fontSize:13, fontWeight:800, lineHeight:1.4,
              background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.24)',
              borderRadius:12, padding:10,
            }}>
              <div>{error}</div>
              {error.toLowerCase().includes('pin') && (
                <button
                  type="button"
                  onClick={resetPinForRetry}
                  style={{
                    marginTop:8, minHeight:44, minWidth:44,
                    borderRadius:10, padding:'0 12px',
                    background:C.card, border:'1px solid rgba(239,68,68,.30)',
                    color:C.red, fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
                  }}
                >
                  Cuba PIN lain
                </button>
              )}
            </div>
          )}
          {quizStatus && (
            <div role="status" aria-live="polite" style={{
              color:C.accPale, fontSize:12, fontWeight:900, lineHeight:1.35,
              background:C.accDim, border:`1px solid ${C.border}`,
              borderRadius:12, padding:10,
            }}>
              {quizStatus}
            </div>
          )}
          <GlowButton type="submit" disabled={busy}>{busy ? 'Menyertai...' : 'Sertai kuiz'}</GlowButton>
        </form>
      </Card>

      {summary.recentSessions?.length > 0 && (
        <Card>
          <div style={{ fontWeight:900, color:C.text, marginBottom:8 }}>Sesi terkini</div>
          {summary.recentSessions.map((s, i) => (
            <div key={s.sessionId || s.id || i} style={{
              display:'flex', justifyContent:'space-between', gap:12,
              padding:'9px 0', borderBottom:i < summary.recentSessions.length - 1 ? `1px solid ${C.border}` : 'none',
              fontSize:13, fontWeight:800,
            }}>
              <span style={{ color:C.text, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {s.deckTitle || 'Kuiz'}
              </span>
              <span style={{ color:C.accPale, flexShrink:0 }}>+{s.xpAwarded ?? s.xpEarned ?? 0} XP</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const SLessonResult = ({ correct, total, hearts, go, result, lesson, questions=[], answers={}, onRetry }) => {
  const correctCount = Number(result?.correctAnswers ?? result?.correctCount ?? correct) || 0;
  const totalQuestions = Number(result?.totalQuestions ?? result?.total ?? total) || 1;
  correct = correctCount;
  total = totalQuestions;
  const accuracy = Math.round(Number(result?.score ?? ((correctCount / totalQuestions) * 100)) || 0);
  const bonus    = accuracy === 100 ? 50 : accuracy >= 80 ? 25 : 0;
  const xpEarned = Number(result?.xpEarned ?? result?.xp_earned) || (correctCount * 10 + bonus);
  const stars    = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
  const xpDisplay = useCountUp(xpEarned, 1000);
  const [shared, setShared] = React.useState(false);
  const lessonTitle = studentTitle(lesson?.title || [lesson?.subject, lesson?.topic].filter(Boolean).join(' • '), 'Pelajaran');
  const lessonTopic = studentText(lesson?.topic || lesson?.subject, 'Topik pembelajaran', 64);
  const shareText = `Saya selesai ${lessonTitle} dengan ketepatan ${accuracy}% dan +${xpEarned} XP di Tusyen.`;
  const reviewItems = questions.slice(0, 4).map((item, index) => {
    const correctText = item.ans !== null && item.ans !== undefined ? item.opts[item.ans] : '';
    const answerText = answers[item.id] ?? '';
    const isCorrect = !correctText || answerText === correctText;
    return {
      id:item.id || index,
      label:item.q || `Soalan ${index + 1}`,
      answer:answerText || 'Tidak dijawab',
      correct:correctText,
      isCorrect,
      explanation:item.explanation,
    };
  });

  const headline = accuracy === 100 ? 'Sempurna! 🌟' : accuracy >= 80 ? 'Bagus! 🎉' : 'Tamat!';
  const shareAchievement = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
      setShared(true);
    } catch (err) {
      setShared(false);
    }
  };

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      alignItems:'center', gap:24,
      padding:'40px 20px',
      maxWidth:500, margin:'0 auto',
      background:`radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--acc) 16%, transparent) 0%, transparent 65%)`,
    }}>
      <div style={{
        fontSize:76, lineHeight:1,
        animation:'tv2-trophy .55s cubic-bezier(.34,1.56,.64,1) forwards',
        filter:`drop-shadow(0 0 32px ${C.accGlow})`,
      }}>🏆</div>

      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:900, fontSize:26, color:C.text, letterSpacing:-0.5 }}>{headline}</div>
        <div style={{ fontSize:13, color:C.textMuted, marginTop:3, fontWeight:600 }}>
          {lessonTitle} — {lessonTopic}
        </div>
      </div>

      <div style={{ display:'flex', gap:10 }}>
        {[1,2,3].map(s => (
          <span key={s} style={{
            fontSize:34,
            opacity: s <= stars ? 1 : 0.18,
            filter: s <= stars
              ? 'drop-shadow(0 0 10px #F5A623)' : 'grayscale(1)',
            animation: s <= stars
              ? `tv2-starfade .3s cubic-bezier(.34,1.56,.64,1) ${s * 0.14}s both`
              : 'none',
          }}>⭐</span>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, width:'100%' }}>
        {[
          { label:'Betul',      value:`${correct}/${total}`, color:C.green,    icon:'✓'  },
          { label:'XP',         value:`+${xpDisplay}`,       color:C.gold,     icon:'⚡' },
          { label:'Ketepatan',  value:`${accuracy}%`,        color:C.acc,      icon:'🎯' },
        ].map((st, i) => (
          <Card key={i} style={{ padding:12, textAlign:'center' }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{st.icon}</div>
            <div style={{ fontWeight:800, fontSize:18, color:st.color, lineHeight:1 }}>{st.value}</div>
            <div style={{
              fontSize:10, color:C.textMuted, fontWeight:600,
              textTransform:'uppercase', letterSpacing:0.5, marginTop:3,
            }}>{st.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', justifyContent:'center' }}>
        <span style={{ fontSize:11, color:C.textMuted, fontWeight:800 }}>Nyawa latihan:</span>
        {[...Array(5)].map((_,i) => (
          <span key={i} style={{ fontSize:14, opacity: i < hearts ? 1 : 0.15 }}>❤️</span>
        ))}
        <span style={{ flexBasis:'100%', textAlign:'center', fontSize:10, color:C.textFaint, fontWeight:700 }}>
          Nyawa membantu fokus semasa latihan, bukan markah akademik.
        </span>
      </div>

      {(result?.syncPending || result?.syncError) && (
        <div role="status" aria-live="polite" style={{
          width:'100%', padding:'9px 12px', borderRadius:12,
          background: result.syncError ? 'rgba(239,68,68,.10)' : C.accDim,
          border:`1px solid ${result.syncError ? 'rgba(239,68,68,.30)' : C.border}`,
          color: result.syncError ? C.red : C.textMuted,
          fontSize:12, fontWeight:700, textAlign:'center',
        }}>
          {result.syncError || 'Keputusan tempatan dipaparkan sementara disegerakkan.'}
        </div>
      )}

      {reviewItems.length > 0 && (
        <Card style={{ width:'100%', padding:12 }}>
          <div style={{ fontWeight:900, color:C.text, fontSize:14, marginBottom:8 }}>Semakan ringkas</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {reviewItems.map((item, index) => (
              <div key={item.id} style={{
                padding:'9px 10px', borderRadius:12,
                background:item.isCorrect ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.10)',
                border:`1px solid ${item.isCorrect ? 'rgba(34,197,94,.22)' : 'rgba(245,158,11,.25)'}`,
              }}>
                <div style={{ fontSize:11, color:item.isCorrect ? C.green : C.gold, fontWeight:900, marginBottom:3 }}>
                  Soalan {index + 1} · {item.isCorrect ? 'Kukuh' : 'Perlu ulang kaji'}
                </div>
                <div style={{ fontSize:12, color:C.text, fontWeight:800, lineHeight:1.35 }}>
                  {item.label}
                </div>
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, marginTop:4 }}>
                  Jawapan anda: {item.answer}
                </div>
                {!item.isCorrect && item.correct && (
                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, marginTop:4 }}>
                    Jawapan tepat: {item.correct}
                  </div>
                )}
                {!item.isCorrect && item.explanation && (
                  <div style={{ fontSize:11, color:C.textFaint, fontWeight:700, marginTop:3, lineHeight:1.35 }}>
                    Cadangan: {item.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
        <GlowButton onClick={() => go('home')}>🏠 Kembali ke Utama</GlowButton>
        <GlowButton outlined onClick={onRetry}>Cuba Semula dari Awal</GlowButton>
        <GlowButton outlined onClick={shareAchievement}>
          {shared ? 'Ringkasan disalin' : 'Kongsi pencapaian'}
        </GlowButton>
      </div>
    </div>
  );
};

const SLessonOverview = ({ lesson, contentData, questionCount, returnScreen, go, onStart, onRetry }) => {
  const hasContent = Boolean(
    contentData.summary ||
    contentData.blocks.length ||
    contentData.examples.length ||
    contentData.resources.length
  );
  const lessonTitle = studentTitle(lesson?.title, 'Pelajaran');
  const lessonTopic = studentText(lesson?.topic || lesson?.subject, 'Topik pembelajaran', 80);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:760, margin:'0 auto' }}>
      <Card glow style={{ padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
          <div style={{ minWidth:0, flex:'1 1 260px' }}>
            <div style={{ fontSize:12, color:C.accPale, fontWeight:900, marginBottom:4 }}>
              Baca dahulu
            </div>
            <div className="student-wrap-text" style={{ fontSize:22, color:C.text, fontWeight:900, lineHeight:1.15 }}>
              {lessonTitle}
            </div>
            <div className="student-wrap-text" style={{ fontSize:13, color:C.textMuted, fontWeight:800, marginTop:5, lineHeight:1.35 }}>
              {lessonTopic}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
            {lesson?.estimatedMinutes && (
              <span style={{ fontSize:11, color:C.textMuted, fontWeight:900, background:C.surface, border:`1px solid ${C.border}`, borderRadius:999, padding:'5px 9px' }}>
                {lesson.estimatedMinutes} min
              </span>
            )}
            <span style={{ fontSize:11, color:C.textMuted, fontWeight:900, background:C.surface, border:`1px solid ${C.border}`, borderRadius:999, padding:'5px 9px' }}>
              {questionCount} soalan
            </span>
            {contentData.blockCount > 0 && (
              <span style={{ fontSize:11, color:C.textMuted, fontWeight:900, background:C.surface, border:`1px solid ${C.border}`, borderRadius:999, padding:'5px 9px' }}>
                {contentData.blockCount} bahagian
              </span>
            )}
          </div>
        </div>
      </Card>

      {(contentData.summary || !hasContent) && (
        <Card style={{ padding:14 }}>
          <div style={{ fontSize:12, color:C.accPale, fontWeight:900, marginBottom:6 }}>Ringkasan</div>
          <div style={{ fontSize:13, color:C.text, fontWeight:700, lineHeight:1.55, whiteSpace:'pre-line' }}>
            {contentData.summary || 'Semak tajuk dan topik pelajaran ini sebelum mula menjawab latihan.'}
          </div>
        </Card>
      )}

      {contentData.blocks.map((block, index) => (
        <Card key={block.id ?? index} style={{ padding:14 }}>
          <div style={{ fontSize:11, color:C.textFaint, fontWeight:900, marginBottom:5 }}>
            Bahagian {index + 1}
          </div>
          {block.title && (
            <div className="student-wrap-text" style={{ fontSize:15, color:C.text, fontWeight:900, lineHeight:1.25, marginBottom:block.body ? 6 : 0 }}>
              {block.title}
            </div>
          )}
          {block.body && (
            <div style={{ fontSize:13, color:C.textMuted, fontWeight:700, lineHeight:1.55, whiteSpace:'pre-line' }}>
              {block.body}
            </div>
          )}
        </Card>
      ))}

      {contentData.examples.length > 0 && (
        <Card style={{ padding:14 }}>
          <div style={{ fontSize:12, color:C.accPale, fontWeight:900, marginBottom:8 }}>Contoh</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {contentData.examples.map((example, index) => (
              <div key={example.id ?? index} style={{
                padding:'10px 11px', borderRadius:12,
                background:C.surface, border:`1px solid ${C.border}`,
              }}>
                <div className="student-wrap-text" style={{ fontSize:12, color:C.text, fontWeight:900, marginBottom:example.body ? 3 : 0 }}>
                  {example.title}
                </div>
                {example.body && (
                  <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45, whiteSpace:'pre-line' }}>
                    {example.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {contentData.resources.length > 0 && (
        <Card style={{ padding:14 }}>
          <div style={{ fontSize:12, color:C.accPale, fontWeight:900, marginBottom:2 }}>Media dan pautan</div>
          <StudentAttachmentPreview attachments={contentData.resources} />
        </Card>
      )}

      {questionCount > 0 ? (
        <GlowButton onClick={onStart}>Saya sudah baca, mula latihan</GlowButton>
      ) : (
        <Card style={{ padding:14, border:'1px solid rgba(245,158,11,.30)', background:'rgba(245,158,11,.08)' }}>
          <div style={{ fontSize:13, color:C.gold, fontWeight:900, marginBottom:4 }}>Latihan belum tersedia</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:10 }}>
            Kandungan pelajaran boleh dibaca, tetapi soalan belum diterbitkan oleh guru.
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <GlowButton onClick={onRetry}>Cuba Lagi</GlowButton>
            <GlowButton outlined onClick={() => go(returnScreen || 'learn')}>Kembali</GlowButton>
          </div>
        </Card>
      )}
    </div>
  );
};

const SLessonLive = ({ go, selectedLesson, returnScreen='home', onActiveChange }) => {
  const [qi, setQi] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const [hearts, setHearts] = React.useState(5);
  const [correct, setCorrect] = React.useState(0);
  const [phase, setPhase] = React.useState('content');
  const [lessonMeta, setLessonMeta] = React.useState(selectedLesson || CONTINUE_EMPTY);
  const [questions, setQuestions] = React.useState(() => (window.tusyenUser?.role === 'student' ? [] : MOCK_QUESTIONS));
  const [answers, setAnswers] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [startedAt, setStartedAt] = React.useState(Date.now());
  const [contentReviewed, setContentReviewed] = React.useState(false);
  const [contentStartedAt, setContentStartedAt] = React.useState(Date.now());
  const [contentReviewSeconds, setContentReviewSeconds] = React.useState(0);
  const [receipt, setReceipt] = React.useState('');
  const [attemptKey, setAttemptKey] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(45);
  const [timerPaused, setTimerPaused] = React.useState(true);
  const lessonTimerStarted = React.useRef(false);
  const narrowOptions = useNarrow(560);
  const isRealStudent = window.tusyenUser?.role === 'student';

  React.useEffect(() => {
    let cancelled = false;
    const resetLessonAttempt = () => {
      setQi(0);
      setSel(null);
      setDone(false);
      setHearts(5);
      setCorrect(0);
      setPhase('content');
      setLessonMeta(selectedLesson || CONTINUE_EMPTY);
      setQuestions(isRealStudent ? [] : MOCK_QUESTIONS);
      setAnswers({});
      setResult(null);
      setSubmitError('');
      setStartedAt(Date.now());
      setContentReviewed(false);
      setContentStartedAt(Date.now());
      setContentReviewSeconds(0);
      setReceipt('');
      setTimerPaused(true);
      lessonTimerStarted.current = false;
    };

    resetLessonAttempt();
    if (!isRealStudent) return;

    const loadLesson = async () => {
      setLoading(true);
      try {
        let target = selectedLesson ? normalizeLessonCard(selectedLesson) : null;
        if (selectedLesson && !target?.id) {
          if (!cancelled) {
            setLessonMeta(target);
            setQuestions([]);
          }
          return;
        }
        if (!target?.id) {
          const [assigned, catalog] = await Promise.all([
            window.tusyenApi.assignedLessons().catch(() => ({ lessons:[] })),
            window.tusyenApi?.catalogLessons
              ? window.tusyenApi.catalogLessons({ limit:1 }).catch(() => ({ lessons:[] }))
              : Promise.resolve({ lessons:[] }),
          ]);
          const assignedLessons = (assigned.lessons || []).map(normalizeLessonCard);
          const catalogLessons = (catalog.lessons || []).map(normalizeCatalogLessonCard);
          target = pickContinueLesson(assignedLessons, catalogLessons);
        }
        if (!target?.id) {
          if (!cancelled) {
            setLessonMeta(CONTINUE_EMPTY);
            setQuestions([]);
          }
          return;
        }

        const detail = await window.tusyenApi.lessonDetail(target.id, { classroomId: target.classroomId });
        if (cancelled) return;
        const liveLesson = normalizeLessonCard({ ...target, ...(detail.lesson || {}) });
        const liveQuestions = (detail.questions || [])
          .map(normalizeLessonQuestion)
          .filter(q => q.opts.length > 0);
        setLessonMeta(liveLesson);
        setQuestions(liveQuestions.length ? liveQuestions : []);
        setContentStartedAt(Date.now());
      } catch (err) {
        if (!cancelled) {
          setLessonMeta(selectedLesson || CONTINUE_EMPTY);
          setQuestions([]);
          setContentStartedAt(Date.now());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLesson();
    return () => { cancelled = true; };
  }, [selectedLesson?.id, selectedLesson?.classroomId, attemptKey, isRealStudent]);

  const hasLessonQuestions = questions.length > 0;
  const total = hasLessonQuestions ? questions.length : (isRealStudent ? 0 : MOCK_QUESTIONS.length);
  const q = hasLessonQuestions ? questions[qi] : (isRealStudent ? null : MOCK_QUESTIONS[0]);
  const questionId = q?.id;
  const hasAnswerKey = q ? q.ans !== null && q.ans !== undefined : false;
  const timerMax = Number(q?.timeLimitSeconds) || 45;
  const lessonContentData = studentLessonContentData(lessonMeta);

  React.useEffect(() => {
    onActiveChange?.(phase === 'quiz' && !loading && questions.length > 0);
    return () => onActiveChange?.(false);
  }, [phase, loading, questions.length, onActiveChange]);

  React.useEffect(() => {
    if (loading || phase !== 'quiz' || questions.length === 0 || !questionId) return undefined;
    setTimeLeft(timerMax);
    setTimerPaused(true);
    const delay = lessonTimerStarted.current ? 700 : 1400;
    const id = setTimeout(() => {
      if (!lessonTimerStarted.current) {
        lessonTimerStarted.current = true;
        setStartedAt(Date.now());
      }
      setTimerPaused(false);
    }, delay);
    return () => clearTimeout(id);
  }, [loading, phase, questions.length, qi, questionId, timerMax]);

  React.useEffect(() => {
    if (loading || phase !== 'quiz' || done || timerPaused || !questionId) return undefined;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setSel(null);
          setDone(true);
          setAnswers(current => ({ ...current, [questionId]: '' }));
          setHearts(h => Math.max(0, h - 1));
          setReceipt('Masa tamat. Jawapan kosong direkodkan.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loading, phase, done, timerPaused, qi, questionId]);

  const startQuestions = () => {
    const seconds = Math.max(1, Math.round((Date.now() - contentStartedAt) / 1000));
    setContentReviewSeconds(seconds);
    setContentReviewed(true);
    setReceipt('Kandungan selesai dibaca. Latihan dimulakan.');
    setPhase('quiz');
    setStartedAt(Date.now());
    setTimerPaused(true);
  };

  const pick = (i) => {
    if (!q || done || timerPaused) return;
    setSel(i);
    setDone(true);
    setAnswers(prev => ({ ...prev, [q.id]: q.opts[i] }));
    setReceipt(`Jawapan ${['A','B','C','D'][i] || i + 1} direkodkan.`);
    if (!hasAnswerKey) return;
    if (i === q.ans) setCorrect(c => c + 1);
    else setHearts(h => Math.max(0, h - 1));
  };

  const localResult = () => ({
    score: total ? Math.round((correct / total) * 100) : 0,
    correctAnswers: correct,
    totalQuestions: total,
    syncPending: Boolean(lessonMeta?.id),
  });

  const submit = async () => {
    const optimistic = localResult();
    setResult(optimistic);
    setPhase('result');
    setReceipt('Jawapan latihan dihantar. Menyediakan keputusan.');

    if (!lessonMeta?.id) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const reviewSeconds = contentReviewed
      ? Math.max(1, contentReviewSeconds || Math.round((Date.now() - contentStartedAt) / 1000))
      : 0;
    try {
      const data = await window.tusyenApi.submitLesson(lessonMeta.id, {
        classroomId: lessonMeta.classroomId,
        answers: questions.map(item => ({
          questionId: item.id,
          answer: answers[item.id] ?? '',
        })),
        timeSpentSeconds: seconds,
        contentReviewed,
        contentReviewSeconds: reviewSeconds,
        contentBlockCount: lessonContentData.blockCount,
      });
      const serverResult = data.result || {};
      setResult({
        score: Number(serverResult.score) || 0,
        correctAnswers: Number(serverResult.correctAnswers ?? serverResult.correctCount) || 0,
        totalQuestions: Number(serverResult.totalQuestions ?? serverResult.total) || total,
        xpEarned: serverResult.xpEarned ?? serverResult.xp_earned,
        syncPending:false,
      });
      setReceipt('Keputusan latihan disimpan.');
    } catch (err) {
      const message = err.message || 'Tidak dapat menghantar jawapan. Cuba lagi.';
      setSubmitError(message);
      setResult(prev => ({ ...(prev || optimistic), syncPending:false, syncError:message }));
      setReceipt('Keputusan dipaparkan, tetapi penyegerakan gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (qi >= total - 1) { submit(); return; }
    setQi(n => n + 1);
    setSel(null);
    setDone(false);
    setReceipt('');
  };

  if (loading) {
    return <EmptyState icon="📐" title="Memuat pelajaran" subtitle="Kandungan dan latihan sedang dimuat." />;
  }

  if (isRealStudent && !lessonMeta?.id) {
    return (
      <div style={{ maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
        <EmptyState icon="📝" title="Belum ada pelajaran tersedia" subtitle="Pilih pelajaran bebas di tab Belajar atau sertai kelas untuk tugasan guru." />
        <GlowButton onClick={() => go(returnScreen || 'learn')}>Cari Pelajaran</GlowButton>
      </div>
    );
  }

  if (phase === 'content') {
    return (
      <SLessonOverview
        lesson={lessonMeta}
        contentData={lessonContentData}
        questionCount={questions.length}
        returnScreen={returnScreen}
        go={go}
        onStart={startQuestions}
        onRetry={() => setAttemptKey(k => k + 1)}
      />
    );
  }

  if (isRealStudent && questions.length === 0) {
    return (
      <div style={{ maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
        <EmptyState icon="📚" title="Latihan belum tersedia" subtitle="Pelajaran ini belum mempunyai soalan. Cuba pelajaran bebas lain atau semak semula kemudian." />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <GlowButton onClick={() => setAttemptKey(k => k + 1)}>Cuba Lagi</GlowButton>
          <GlowButton outlined onClick={() => go(returnScreen || 'learn')}>Kembali</GlowButton>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <SLessonResult
        correct={correct}
        total={total}
        hearts={hearts}
        go={go}
        result={result}
        lesson={lessonMeta}
        questions={questions}
        answers={answers}
        onRetry={() => setAttemptKey(k => k + 1)}
      />
    );
  }

  const optStyle = (i) => {
    if (!done) return { bg:C.card, bd:C.border, col:C.text };
    if (hasAnswerKey && i === q.ans) return { bg:'rgba(34,197,94,0.15)', bd:'rgba(34,197,94,.6)', col:C.green };
    if (i === sel && (!hasAnswerKey || i !== q.ans)) return {
      bg: hasAnswerKey ? 'rgba(239,68,68,0.15)' : C.accDim,
      bd: hasAnswerKey ? 'rgba(239,68,68,.6)' : C.borderB,
      col: hasAnswerKey ? C.red : C.accPale,
    };
    return { bg:C.card, bd:C.border, col:C.textFaint };
  };
  const timedOut = done && sel === null;
  const answeredCorrect = !hasAnswerKey || sel === q.ans;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:720, margin:'0 auto' }}>
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:16, padding:10,
      }}>
        <button
          onClick={() => go(returnScreen || 'home')}
          aria-label="Tinggalkan pelajaran"
          style={{
            width:44, height:44, borderRadius:12,
            background:C.card, border:`1px solid ${C.border}`,
            cursor:'pointer', fontSize:20, color:C.textMuted,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >×</button>
        <div className="student-focus-title" style={{ flex:1 }}>
          <div style={{ fontSize:12, color:C.textFaint, fontWeight:900, marginBottom:2 }}>
            Soalan {qi + 1} / {total}
          </div>
          <div style={{
            fontSize:15, color:C.text, fontWeight:900,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            {lessonMeta.title || 'Pelajaran'}
          </div>
          <div style={{
            fontSize:11, color:C.textMuted, fontWeight:700,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            {lessonMeta.topic || lessonMeta.subject || 'Topik pembelajaran'}
          </div>
          <ProgressBar value={((qi + 1) / total) * 100} height={6} style={{ marginTop:7 }} />
        </div>
        <div style={{
          minWidth:54, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center',
          textAlign:'center', padding:'4px 8px', borderRadius:12,
          background: timerPaused ? 'rgba(245,158,11,.12)' : timeLeft <= 10 ? 'rgba(239,68,68,.12)' : C.accDim,
          border:`1px solid ${timerPaused ? 'rgba(245,158,11,.35)' : timeLeft <= 10 ? 'rgba(239,68,68,.35)' : C.border}`,
          color: timerPaused ? C.gold : timeLeft <= 10 ? C.red : C.accPale,
          fontSize:12, fontWeight:900,
        }}>{timerPaused ? 'Sedia' : `${timeLeft}s`}</div>
      </div>

      {receipt && (
        <div role="status" aria-live="polite" style={{
          padding:'8px 12px', borderRadius:12,
          background:C.surface, border:`1px solid ${C.border}`,
          color:C.textMuted, fontSize:12, fontWeight:800, lineHeight:1.35,
        }}>
          {receipt}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ fontSize:11, color:C.textMuted, fontWeight:800 }}>
          Pilih satu jawapan
        </div>
        <div aria-label={`Nyawa latihan ${hearts} daripada 5`} style={{ display:'flex', gap:2 }}>
          {[...Array(5)].map((_,i) => (
            <span key={i} style={{ fontSize:15, opacity: i < hearts ? 1 : 0.15 }}>❤️</span>
          ))}
        </div>
      </div>

      <div style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:16, padding:16, flexShrink:0 }}>
        <div style={{ fontWeight:800, fontSize:16, color:C.text, lineHeight:1.4, marginBottom:4 }}>{q.q}</div>
        <div style={{ fontSize:11, color:C.textMuted, fontStyle:'italic' }}>{q.sub || lessonMeta.topic}</div>
      </div>

      {timerPaused && (
        <div role="status" style={{
          padding:'8px 12px', borderRadius:12,
          background:'rgba(245,158,11,.10)', border:'1px solid rgba(245,158,11,.28)',
          color:C.gold, fontSize:12, fontWeight:900, textAlign:'center',
        }}>
          Bersedia... timer bermula sebentar lagi.
        </div>
      )}

      <div style={{
        display:'grid',
        gridTemplateColumns:narrowOptions ? '1fr' : 'repeat(2, minmax(0, 1fr))',
        gap:10,
        alignItems:'stretch',
      }}>
        {q.opts.map((opt, i) => {
          const s = optStyle(i);
          return (
            <button key={i} onClick={() => pick(i)} style={{
              background:s.bg, border:`1.5px solid ${s.bd}`, color:s.col,
              borderRadius:14, padding:'13px 14px',
              fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:15,
              lineHeight:1.35, minHeight:72, height:'100%',
              cursor: done || timerPaused ? 'default' : 'pointer', textAlign:'left',
              display:'flex', alignItems:'flex-start', gap:10, transition:'all .2s',
            }}>
              <span style={{
                width:27, height:27, borderRadius:'50%',
                background:`color-mix(in srgb,${s.col} 15%,transparent)`,
                border:`1.5px solid color-mix(in srgb,${s.col} 40%,transparent)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:800, flexShrink:0, color:s.col,
              }}>{['A','B','C','D'][i] || String(i + 1)}</span>
              <span style={{ flex:1, minWidth:0, overflowWrap:'anywhere' }}>{opt}</span>
              {done && hasAnswerKey && i === q.ans && (
                <span aria-hidden="true" style={{
                  width:24, height:24, borderRadius:'50%', flexShrink:0,
                  background:'rgba(34,197,94,.16)', color:C.green,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:900,
                }}>✓</span>
              )}
              {done && hasAnswerKey && i === sel && i !== q.ans && (
                <span aria-hidden="true" style={{
                  width:24, height:24, borderRadius:'50%', flexShrink:0,
                  background:'rgba(239,68,68,.16)', color:C.red,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:900,
                }}>✕</span>
              )}
            </button>
          );
        })}
      </div>

      {done && (
        <div>
          <div style={{
            padding:'10px 14px', borderRadius:12, marginBottom:10,
            background: answeredCorrect && !timedOut ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
            border:`1px solid ${answeredCorrect && !timedOut ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'}`,
          }}>
            <div style={{ fontWeight:800, fontSize:14, color: answeredCorrect && !timedOut ? C.green : C.red }}>
              {timedOut ? 'Masa tamat. Jawapan kosong direkodkan.' : !hasAnswerKey ? 'Jawapan direkodkan' : sel === q.ans ? '🎉 Betul! +10 XP' : 'Salah. Semak hint ringkas ini.'}
            </div>
            {hasAnswerKey && sel !== q.ans && (
              <div style={{ fontSize:12, color:C.textMuted, marginTop:2, fontWeight:600 }}>
                Jawapan: {q.opts[q.ans]}
              </div>
            )}
            {!answeredCorrect && q.explanation && (
              <div style={{ fontSize:12, color:C.textMuted, marginTop:4, fontWeight:600, lineHeight:1.35 }}>
                Petunjuk: {q.explanation}
              </div>
            )}
            {submitError && (
              <div style={{ fontSize:12, color:C.red, marginTop:6, fontWeight:700 }}>{submitError}</div>
            )}
          </div>
          <GlowButton onClick={next}>
            {qi >= total - 1 ? (submitting ? 'Menyegerakkan keputusan...' : 'Lihat Keputusan 🏆') : 'Seterusnya →'}
          </GlowButton>
        </div>
      )}
    </div>
  );
};

const SHome = ({ goLearn, openLesson, goClassrooms, displayName, avatarUrl, classInfo }) => {
  useStudentStreakOnMount();
  const statsState = useStudentStats();
  const continueState = useContinueLesson();
  const lessonsState = useAssignedLessons();
  const hasClassrooms = (classInfo?.classrooms || []).length > 0;
  const leaderboardState = useClassroomLeaderboard(displayName, hasClassrooms);
  const stats = statsState.data;
  const continueLesson = continueState.data;
  const leaderboard = leaderboardState.data || [];
  const subjects = subjectListForStudentContext(stats, lessonsState.data || [], classInfo);
  const homeSubjects = [...subjects].sort((a, b) => {
    const aDone = Number(a.progress) >= 100;
    const bDone = Number(b.progress) >= 100;
    if (aDone !== bDone) return aDone ? 1 : -1;
    return Number(b.progress || 0) - Number(a.progress || 0);
  });
  const defaultSubjectId = homeSubjects[0]?.id || subjects[0]?.id || 'math';
  const mission = stats?.today || { lessonsCompleted:0, lessonsAttempted:0, target:10 };
  const missionDone = Math.min(Number(mission.lessonsCompleted ?? mission.lessonsAttempted) || 0, mission.target || 10);
  const missionTarget = Number(mission.target) || 10;
  const missionRemaining = Math.max(0, missionTarget - missionDone);
  const firstTime = !statsState.loading && !continueState.loading &&
    Number(stats?.lessonsAttempted || 0) === 0 &&
    Number(stats?.lessons || 0) === 0;
  const narrow = useNarrow(1100);
  const phone = useNarrow(620);
  return (
  <div style={{ display:'flex', flexDirection:'column', gap:22, minWidth:0, width:'100%', maxWidth:'100%' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:13, color:C.textMuted, fontWeight:600, marginBottom:3 }}>{getGreeting()}</div>
        <div className="student-wrap-text" style={{ fontSize:30, fontWeight:900, color:C.text, letterSpacing:-.7, lineHeight:1.1 }}>
          {firstName(displayName)} 👋
        </div>
      </div>
      <div className="show-mobile">
        <Avatar name={displayName} size={52} src={avatarUrl} />
      </div>
    </div>

    {/* Stat pills */}
    <div style={{ display:'flex', gap:10, flexWrap:'wrap', order:phone ? 4 : 0 }}>
      {statsState.loading ? (
        [86, 78, 92, 70].map((w, i) => <Skeleton key={i} width={w} height={42} radius={99} />)
      ) : (
        <>
          <StatPill icon="🔥" value={String(stats.streak)} label="Rentetan hari" color={C.orange} />
          <StatPill icon="⚡" value={stats.xp.toLocaleString()} label="XP" color={C.gold} />
          <StatPill icon="HP" value={String(stats.hearts || '...')} label="Nyawa" color={C.red} />
          <StatPill icon="📚" value={String(stats.lessons ?? 0)} label="Pelajaran" color={C.blue} />
        </>
      )}
    </div>
    {!statsState.loading && (
      <div style={{ order:phone ? 5 : 0, fontSize:11, color:C.textFaint, fontWeight:700, lineHeight:1.4 }}>
        Nyawa digunakan sebagai penanda fokus latihan, bukan ukuran pencapaian akademik.
      </div>
    )}

    {(statsState.error || continueState.error || lessonsState.error || (hasClassrooms && leaderboardState.error)) && (
      <ErrorRetry
        message="Sebahagian data tidak dapat dimuat. Semak sambungan API sebelum menganggap ini rekod sebenar."
        onRetry={() => { statsState.refresh(); continueState.refresh(); lessonsState.refresh(); leaderboardState.refresh(); }}
      />
    )}

    {firstTime && (
      <Card glow>
        <div style={{ fontWeight:900, fontSize:14, color:C.text, marginBottom:5 }}>
          Mulakan pembelajaran pertama
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5, marginBottom:10 }}>
          Mulakan dengan memilih subjek di bawah. Kamu boleh sertai kelas guru untuk tugasan berstruktur.
        </div>
        <GlowButton onClick={() => goLearn(defaultSubjectId)} style={{ padding:'10px 12px', fontSize:13 }}>
          Pilih subjek
        </GlowButton>
      </Card>
    )}

    {/* Daily mission */}
    <Card glow style={{ order:phone ? 2 : 0, padding:phone ? 12 : 14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🎯</span>
          <div>
            <div style={{ fontWeight:900, fontSize:phone ? 13 : 14, color:C.accPale }}>Misi hari ini</div>
            <div style={{ fontSize:11, color:C.textFaint, fontWeight:600 }}>Sasaran {missionTarget} pelajaran</div>
          </div>
        </div>
        <div style={{ fontWeight:900, fontSize:16, color:C.accHi, flexShrink:0 }}>{missionDone}/{missionTarget}</div>
      </div>
      <ProgressBar value={missionDone} max={missionTarget} height={10} />
      <div style={{ fontSize:12, color:C.textMuted, marginTop:7, fontWeight:700 }}>
        {missionRemaining === 0 ? 'Bonus XP hari ini sudah terbuka.' : `${missionRemaining} pelajaran lagi untuk Bonus XP.`}
      </div>
    </Card>

    {/* Continue lesson */}
    {continueState.loading ? (
      <Card style={{ order:phone ? 1 : 0 }}>
        <Skeleton width={118} height={10} radius={5} style={{ marginBottom:12 }} />
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Skeleton width={60} height={60} radius={18} />
          <div style={{ flex:1 }}>
            <Skeleton width="78%" height={14} radius={7} style={{ marginBottom:8 }} />
            <Skeleton width="54%" height={12} radius={6} style={{ marginBottom:10 }} />
            <Skeleton width="100%" height={7} radius={999} />
          </div>
          <Skeleton width={40} height={40} radius={12} />
        </div>
      </Card>
    ) : (
      <div onClick={() => continueLesson.empty ? goLearn(defaultSubjectId) : openLesson(continueLesson, 'home')} style={{
        background:'linear-gradient(135deg, color-mix(in srgb, var(--acc-lo) 25%, var(--card)), var(--card))',
        border:'1px solid var(--border-b)', borderRadius:16, padding:18, cursor:'pointer',
        boxShadow:`0 4px 28px var(--acc-glow)`, transition:'transform .15s, box-shadow .15s',
        order:phone ? 1 : 0, minHeight:44, minWidth:0, maxWidth:'100%', overflow:'hidden',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 36px var(--acc-glow)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 28px var(--acc-glow)'; }}
      >
        <div style={{ fontSize:11, color:C.accPale, fontWeight:900, textTransform:'uppercase', letterSpacing:.7, marginBottom:12 }}>
          <span aria-hidden="true">▶</span> Sambung seterusnya
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{
            width:60, height:60, borderRadius:18, flexShrink:0,
            background:'linear-gradient(135deg, var(--acc-lo), var(--acc))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, boxShadow:`0 4px 20px var(--acc-glow)`,
          }}>{continueLesson.icon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="student-clamp-2" style={{ fontWeight:900, fontSize:18, color:C.text, marginBottom:3, letterSpacing:-.3, lineHeight:1.2 }}>{continueLesson.title}</div>
            <div className="student-clamp-2" style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginBottom:10, lineHeight:1.35 }}>{continueLesson.topic}</div>
            <ProgressBar value={continueLesson.progress} height={7} />
            <div style={{ fontSize:11, color:C.textFaint, marginTop:4, fontWeight:600 }}>{continueLesson.progress}% siap</div>
          </div>
          <div style={{
            width:40, height:40, borderRadius:12, background:C.accDim, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:C.accHi, fontSize:22, fontWeight:900,
          }}>›</div>
        </div>
      </div>
    )}

    {/* Two-col: subjects + leaderboard */}
    <div style={{ display:'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', gap:22, alignItems:'start', order:phone ? 3 : 0, minWidth:0 }}>
      {/* Subjects */}
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:800, fontSize:12, color:C.textMuted, textTransform:'uppercase', letterSpacing:.8, marginBottom:12 }}>
          Subjek
        </div>
        <div style={{ display:'grid', gridTemplateColumns:phone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap:10, minWidth:0 }}>
          {homeSubjects.map(s => {
            const hasProgress = Number(s.progress) > 0;
            const isComplete = Number(s.progress) >= 100;
            return (
            <Card key={s.id} onClick={() => goLearn(s.id)} style={{ padding:14, opacity:firstTime && !hasProgress ? .86 : isComplete ? .78 : 1, minWidth:0, maxWidth:'100%', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{
                  width:38, height:38, borderRadius:11, flexShrink:0,
                  background:`color-mix(in srgb, ${s.color} 18%, transparent)`,
                  border:`1.5px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                }}>{s.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div className="student-clamp-2" style={{ fontWeight:800, fontSize:13, color:C.text, lineHeight:1.2 }}>{s.name}</div>
                  <div className="student-clamp-2" style={{ fontSize:10, color:C.textFaint, fontWeight:600, lineHeight:1.2 }}>{s.query}</div>
                </div>
              </div>
              <ProgressBar value={s.progress} color={hasProgress ? s.color : C.textFaint} height={5} />
              <div style={{ fontSize:11, color:C.textFaint, marginTop:4, fontWeight:700 }}>
                {isComplete ? 'Selesai' : hasProgress ? `${s.progress}%` : 'Belum mula'}
              </div>
            </Card>
          );})}
        </div>
      </div>

      {/* Leaderboard / class CTA */}
      <div style={{ minWidth:0 }}>
        {hasClassrooms ? (
          <>
            <div style={{ fontWeight:800, fontSize:12, color:C.textMuted, textTransform:'uppercase', letterSpacing:.8, marginBottom:12 }}>
              🏆 Ranking kelas
            </div>
            <Card style={{ padding:'4px 0', minWidth:0, overflow:'hidden' }}>
              {leaderboardState.loading ? [0,1,2].map(i => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 8px', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <Skeleton width={18} height={16} radius={6} />
                  <Skeleton width={28} height={28} radius={14} />
                  <Skeleton width="60%" height={13} radius={7} style={{ flex:1 }} />
                  <Skeleton width={62} height={12} radius={6} />
                </div>
              )) : leaderboard.length ? leaderboard.map((item, i) => {
                const label = item.me ? 'Kamu' : item.name;
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding: item.me ? '10px 14px' : '10px 8px',
                    borderBottom: i < leaderboard.length - 1 ? `1px solid ${C.border}` : 'none',
                    borderLeft: item.me ? `3px solid ${C.accHi}` : '3px solid transparent',
                    background: item.me ? C.accDim : 'transparent',
                    borderRadius: item.me ? 10 : 0,
                    margin: item.me ? '4px 8px' : '0',
                  }}>
                    <span style={{ width:24, fontWeight:900, fontSize:15, textAlign:'center', flexShrink:0 }}>
                      {item.medal || <span style={{ color:C.textFaint, fontSize:12 }}>#{item.rank}</span>}
                    </span>
                    <Avatar name={item.me ? displayName : item.name} size={30} />
                    <div style={{ flex:1, minWidth:0, fontWeight: item.me ? 800 : 700, fontSize:13, color: item.me ? C.accPale : C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {label}
                    </div>
                    <div style={{ fontWeight:900, fontSize:12, color:C.gold, flexShrink:0 }}>
                      {item.xp.toLocaleString()} XP
                    </div>
                  </div>
                );
              }) : (
                <div style={{ padding:'12px 14px', fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5 }}>
                  Belum ada ranking kelas. Lengkapkan tugasan pertama untuk muncul di sini.
                </div>
              )}
            </Card>
          </>
        ) : (
          <>
            <div style={{ fontWeight:800, fontSize:12, color:C.textMuted, textTransform:'uppercase', letterSpacing:.8, marginBottom:12 }}>
              Kelas
            </div>
            <Card style={{ padding:14, minWidth:0 }}>
              <div style={{ fontWeight:900, fontSize:13, color:C.text, marginBottom:5 }}>
                Belajar bebas tersedia
              </div>
              <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:10 }}>
                Sertai kelas guru untuk tugasan, ranking dan penilaian
              </div>
              <GlowButton outlined onClick={() => goClassrooms?.()} style={{ padding:'9px 12px', fontSize:12 }}>
                Sertai kelas
              </GlowButton>
            </Card>
          </>
        )}
      </div>
    </div>
    <div style={{ height:8 }} />
  </div>
);
};

const syllabusItemId = (item={}) => `${item.id || item.topic_id || item.topicId || item.syllabus_id || item.syllabusId || item.syllabusTopicId || ''}`.trim();
const progressRowSyllabusIds = (row={}) => [
  row.syllabus_id,
  row.syllabusId,
  row.syllabus_topic_id,
  row.syllabusTopicId,
  row.topic_id,
  row.topicId,
].map(value => `${value || ''}`.trim()).filter(Boolean);
const progressCompletionValue = (row={}) => progressValue(row.completion_percentage ?? row.completionPercentage ?? row.completion ?? row.progress ?? row.percentage);
const progressRowMatchesSyllabusItem = (row={}, item={}) => {
  const itemId = syllabusItemId(item);
  if (itemId && progressRowSyllabusIds(row).includes(itemId)) return true;
  const itemTitleKey = cleanSubjectKey(item.topic || item.label || item.title || '');
  const itemKey = cleanSubjectKey(`${item.topic || item.label || item.title || ''} ${item.subtopic || item.sub || ''}`);
  const rowKey = cleanSubjectKey(`${row.lesson_title || row.lessonTitle || row.title || ''} ${row.topic || ''} ${row.subtopic || row.sub_topic || ''}`);
  if (!rowKey || !itemTitleKey) return false;
  return rowKey.includes(itemTitleKey) || itemTitleKey.includes(rowKey) || (!!itemKey && itemKey.length >= 4 && rowKey.includes(itemKey));
};

const buildSkillNodes = (items, subjectId, progress, progressRows=[]) => {
  const source = (items && items.length ? items : SUBJECT_SKILL_FALLBACKS[subjectId] || SKILL_NODES);
  const total = source.length || 1;
  const rowMatches = source.map(item => (progressRows || []).find(row => progressRowMatchesSyllabusItem(row, item)));
  const topicDoneFlags = rowMatches.map(row => Boolean(row?.is_completed || row?.isCompleted) || progressCompletionValue(row) >= 100);
  const hasTopicProgress = rowMatches.some(Boolean);
  const completed = progress >= 100 ? total : Math.floor((progressValue(progress) / 100) * total);
  const fallbackCurrentIndex = progress >= 100 ? -1 : Math.min(completed, total - 1);
  const inProgressIndex = rowMatches.findIndex((row, i) => row && !topicDoneFlags[i] && progressCompletionValue(row) > 0);
  const firstOpenIndex = topicDoneFlags.findIndex(done => !done);
  const currentIndex = hasTopicProgress
    ? (inProgressIndex >= 0 ? inProgressIndex : firstOpenIndex)
    : fallbackCurrentIndex;

  return source.map((it, i) => {
    const label = studentTitle(it.topic || it.label, `Topik ${i + 1}`);
    const done = hasTopicProgress ? topicDoneFlags[i] : i < completed;
    const cur = !done && i === currentIndex;
    const locked = hasTopicProgress ? (!done && currentIndex >= 0 && i > currentIndex) : (progress < 100 && i > currentIndex);
    return {
      id: it.id || `${subjectId}-${i}`,
      label,
      sub: studentText(it.subtopic || it.sub || it.topic, '', 64),
      done,
      cur,
      locked,
      lockReason: locked ? `Selesaikan ${studentTitle(source[i - 1]?.topic || source[i - 1]?.label, 'topik sebelumnya')} dahulu` : '',
    };
  });
};

const syllabusQueryCandidates = (subject) => {
  const preferred = [subject?.query, subject?.name, ...(subject?.aliases || [])];
  return [...new Set(preferred.map(value => `${value || ''}`.trim()).filter(Boolean))];
};
const loadPreferredSyllabus = async (subject, formLevel) => {
  const exactForm = normalizeFormLevel(formLevel);
  const candidates = syllabusQueryCandidates(subject);
  for (const query of candidates) {
    if (exactForm) {
      const exact = await window.tusyenApi.syllabus(query, exactForm);
      if ((exact.syllabus || []).length) return exact.syllabus;
    }
    const subjectOnly = await window.tusyenApi.syllabus(query);
    const rows = subjectOnly.syllabus || [];
    if (rows.length) {
      const exactRows = exactForm
        ? rows.filter(row => normalizeFormLevel(row.form_level ?? row.formLevel) === exactForm)
        : rows;
      return exactRows.length ? exactRows : rows;
    }
  }
  return [];
};

const useSyllabusNodes = (subjectId, progress, formLevel) => {
  const userId = window.tusyenUser?.id;
  return useAsync(async () => {
    const subject = SUBJECTS.find(s => s.id === subjectId);
    if (!subject) return buildSkillNodes([], subjectId, progress);
    const [items, progressData] = await Promise.all([
      loadPreferredSyllabus(subject, formLevel),
      userId && window.tusyenApi?.studentProgress
        ? window.tusyenApi.studentProgress(userId).catch(() => ({ progress:[] }))
        : Promise.resolve({ progress:[] }),
    ]);
    return buildSkillNodes(items, subjectId, progress, progressData?.progress || []);
  }, [subjectId, progress, formLevel, userId], buildSkillNodes([], subjectId, progress));
};

const lessonMatchesSubjectForm = (lesson, subject, formLevel=null) => {
  const lessonForm = normalizeFormLevel(lesson.formLevel ?? lesson.form_level);
  if (formLevel && lessonForm && lessonForm !== formLevel) return false;
  return subjectMatches(subject, lesson.subject || lesson.title || lesson.topic);
};

const lessonMergeKey = (lesson={}) => lesson.id || cleanSubjectKey(`${lesson.title || ''} ${lesson.topic || ''} ${lesson.subject || ''}`);

const mergeLessonPools = (...groups) => {
  const seen = new Set();
  return groups
    .flat()
    .filter(Boolean)
    .filter(lesson => {
      const key = lessonMergeKey(lesson);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const studentDueLabel = (dueDate) => {
  if (!dueDate) return '';
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return '';
  return `Tarikh akhir ${date.toLocaleDateString('ms-MY', { day:'numeric', month:'short' })}`;
};

const SLearn = ({ activeSubject='math', setActiveSubject, openLesson, classInfo, goProgress }) => {
  const statsState = useStudentStats();
  const lessonState = useAssignedLessons();
  const lessons = lessonState.data || [];
  const isRealStudent = window.tusyenUser?.role === 'student';
  const enrolledClassrooms = classInfo?.classrooms || [];
  const hasClassroom = enrolledClassrooms.length > 0;
  const subjects = subjectListForStudentContext(statsState.data, lessons, classInfo);
  const [active, setActive] = React.useState(activeSubject || 'math');
  const [lockedNotice, setLockedNotice] = React.useState('');
  const subjectIdsKey = subjects.map(s => s.id).join('|');
  React.useEffect(() => {
    if (activeSubject && activeSubject !== active) setActive(activeSubject);
  }, [activeSubject]);
  React.useEffect(() => {
    if (subjects.length && !subjects.some(s => s.id === active)) {
      setActive(subjects[0].id);
      setActiveSubject?.(subjects[0].id);
    }
  }, [subjectIdsKey, active, setActiveSubject]);
  React.useEffect(() => {
    if (!lockedNotice) return undefined;
    const id = setTimeout(() => setLockedNotice(''), 3600);
    return () => clearTimeout(id);
  }, [lockedNotice]);
  const subj = subjects.find(s => s.id === active) || subjects[0] || SUBJECTS[0];
  const enrolledFormLevel = normalizeFormLevel(classInfo?.formLevel);
  const assignedLessonsForSubject = lessons.filter(lesson => lessonMatchesSubjectForm(lesson, subj, enrolledFormLevel));
  const formLevel = enrolledFormLevel || assignedLessonsForSubject.find(lesson => lesson.formLevel)?.formLevel || null;
  const catalogState = useCatalogLessons(subj.query || subj.name, formLevel);
  const catalogLessons = catalogState.data || [];
  const catalogLessonsForSubject = catalogLessons.filter(lesson => lessonMatchesSubjectForm(lesson, subj, formLevel));
  const allLessonsForSubject = mergeLessonPools(assignedLessonsForSubject, catalogLessonsForSubject);
  const formLabel = formLevel ? `Tingkatan ${formLevel}` : 'Tingkatan belum ditetapkan';
  const nodesState = useSyllabusNodes(active, subj.progress, formLevel);
  const nodes = nodesState.data || buildSkillNodes([], active, subj.progress);
  const phone = useNarrow(620);
  const completedNodes = nodes.filter(node => node.done);
  const currentNode = nodes.find(node => node.cur) || nodes.find(node => !node.done && !node.locked) || null;
  const nextLesson = allLessonsForSubject.find(lesson => lesson.progress > 0 && lesson.progress < 100) ||
    allLessonsForSubject.find(lesson => lesson.progress < 100) ||
    null;
  const weakNode = nodes.find(node => !node.done && !node.locked && !node.cur) || currentNode || completedNodes[completedNodes.length - 1] || null;
  const softNote = !isRealStudent ? '' :
    catalogState.loading ? 'Memuat pelajaran bebas untuk subjek ini.' :
    !hasClassroom ? 'Guru belum menetapkan pelajaran. Kamu boleh belajar secara bebas dari katalog.' :
    assignedLessonsForSubject.length ? 'Tugasan kelas diutamakan. Pelajaran bebas masih tersedia untuk latihan tambahan.' :
    'Guru belum menetapkan pelajaran. Kamu boleh belajar secara bebas dari katalog.';
  const runTopicAction = (type) => {
    if (type === 'next') {
      if (nextLesson) {
        openLesson(nextLesson, 'learn');
        return;
      }
      if (currentNode) {
        openNodeLesson(currentNode);
        return;
      }
      setLockedNotice('Semua topik sudah selesai. Ulang kaji topik yang pernah dibuat untuk kekalkan penguasaan.');
      return;
    }
    if (type === 'revise') {
      const target = completedNodes[completedNodes.length - 1];
      if (target) openNodeLesson(target);
      else setLockedNotice('Belum ada topik selesai untuk diulang kaji.');
      return;
    }
    if (type === 'weak') {
      if (weakNode) openNodeLesson(weakNode);
      else setLockedNotice('Tiada topik lemah dikesan setakat ini.');
      return;
    }
    goProgress?.();
  };
  const openNodeLesson = (node) => {
    if (node.locked) {
      setLockedNotice(node.lockReason || 'Topik ini masih terkunci.');
      return;
    }
    setLockedNotice('');
    const label = cleanSubjectKey(`${node.label} ${node.sub}`);
    const matchedLesson = allLessonsForSubject.find(lesson => {
      const lessonText = cleanSubjectKey(`${lesson.title} ${lesson.topic}`);
      return lessonText.includes(cleanSubjectKey(node.label)) || label.includes(cleanSubjectKey(lesson.topic));
    }) || allLessonsForSubject.find(lesson => lesson.progress < 100) || allLessonsForSubject[0] || null;
    openLesson(matchedLesson || {
      title:`${subj.name} • ${node.label}`,
      topic:node.sub || node.label,
      subject:subj.name,
      progress:subj.progress,
      icon:subj.icon,
    }, 'learn');
  };
  const selectSubject = (id) => {
    setActive(id);
    setActiveSubject?.(id);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0, minHeight:'100%' }}>
      {/* Subject tabs */}
      {phone ? (
        <div style={{ marginBottom:16, minWidth:0, maxWidth:'100%' }}>
          <select
            className="student-native-select"
            aria-label="Pilih subjek"
            value={active}
            onChange={(e) => selectSubject(e.target.value)}
            style={{ background:C.surface, border:`1px solid ${C.borderB}`, color:C.text }}
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} - {s.progress}% siap</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="student-scroll-fade" style={{ marginBottom:20 }}>
          <div className="student-scroll-affordance" style={{
            display:'flex',
            gap:8,
            flexWrap:'wrap',
            padding:'2px 4px 10px 4px',
            minWidth:0,
            maxWidth:'100%',
            boxSizing:'border-box',
          }}>
            {subjects.map(s => {
              const isActive = active === s.id;
              return (
              <button key={s.id} onClick={() => selectSubject(s.id)} aria-pressed={isActive} style={{
                display:'flex', alignItems:'center', justifyContent:'flex-start',
                gap:7, flex:'0 0 auto',
                minWidth:110,
                background: isActive ? `color-mix(in srgb, ${s.color} 16%, var(--c-card))` : 'transparent',
                border:`${isActive ? 2 : 1.5}px solid ${isActive ? s.color : C.border}`,
                borderRadius:20, padding:'7px 13px', minHeight:44,
                fontSize:13, fontWeight:800, cursor:'pointer',
                color: isActive ? C.text : C.textMuted,
                fontFamily:'Nunito', transition:'all .15s',
                boxShadow: isActive ? `inset 0 -3px 0 ${s.color}, 0 2px 12px color-mix(in srgb, ${s.color} 20%, transparent)` : 'none',
                scrollSnapAlign:'start',
                overflowWrap:'anywhere',
              }}>
                <span aria-hidden="true" style={{ flexShrink:0 }}>{s.icon}</span>
                <span className="student-wrap-text" style={{ minWidth:0, lineHeight:1.15 }}>{s.name}</span>
                {isActive && <span aria-hidden="true" style={{ fontSize:11, fontWeight:900, color:s.color }}>Aktif</span>}
              </button>
            );})}
          </div>
        </div>
      )}

      {/* Subject header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:36, flexWrap:'wrap', gap:12 }}>
        <div style={{ flex:'1 1 220px', minWidth:0 }}>
          <div className="student-wrap-text" style={{ fontSize:28, fontWeight:900, color:C.text, letterSpacing:-.5, lineHeight:1.1 }}>
            {subj.icon} {subj.name}
          </div>
          <div className="student-wrap-text" style={{ fontSize:14, color:C.textMuted, fontWeight:600, marginTop:4 }}>
            {formLabel} · {subj.progress}% siap
          </div>
        </div>
        <div style={{ minWidth:phone ? 0 : 160, width:phone ? '100%' : undefined, flex:'0 1 220px', maxWidth:'100%' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:11, color:C.textFaint, fontWeight:600 }}>{nodes.filter(n => n.done).length}/{nodes.length} topik</span>
            <span style={{ fontSize:11, color:subj.color, fontWeight:900 }}>{subj.progress}%</span>
          </div>
          <ProgressBar value={subj.progress} color={subj.color} height={8} />
        </div>
      </div>

      {lockedNotice && (
        <div role="status" style={{
          marginBottom:18, padding:'10px 12px', borderRadius:12,
          background:C.accDim, border:`1px solid ${C.border}`,
          color:C.textMuted, fontSize:12, fontWeight:800, lineHeight:1.45,
        }}>
          {lockedNotice}
        </div>
      )}

      {(lessonState.error || catalogState.error) && (
        <ErrorRetry
          message="Sebahagian pelajaran tidak dapat dimuat. Cuba semula atau teruskan topik yang sudah tersedia."
          onRetry={() => { lessonState.refresh?.(); catalogState.refresh?.(); }}
        />
      )}

      {softNote && (
        <Card style={{ marginBottom:18, padding:14, border:'1px solid rgba(59,130,246,.24)', background:'rgba(59,130,246,.08)' }}>
          <div style={{ fontSize:13, color:C.gold, fontWeight:900, marginBottom:4 }}>
            Belajar fleksibel
          </div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
            {softNote}
          </div>
        </Card>
      )}

      <div style={{
        display:'grid',
        gridTemplateColumns:phone ? '1fr' : 'repeat(4, minmax(0, 1fr))',
        gap:10,
        marginBottom:18,
      }}>
        {[
          { key:'next', label:'Pelajaran dicadang', sub:nextLesson?.title || currentNode?.label || 'Pilih topik semasa' },
          { key:'revise', label:'Ulang kaji selesai', sub:completedNodes.length ? `${completedNodes.length} topik tersedia` : 'Belum ada topik selesai' },
          { key:'weak', label:'Latih topik lemah', sub:weakNode?.label || 'Ikut rekod semasa' },
          { key:'mastery', label:'Lihat penguasaan', sub:`${subj.progress}% siap` },
        ].map(action => {
          return (
          <button
            key={action.key}
            onClick={() => runTopicAction(action.key)}
            style={{
              minHeight:62, textAlign:'left',
              background:C.card, border:`1px solid ${C.border}`,
              borderRadius:14, padding:'10px 12px',
              color:C.text, fontFamily:'Nunito', cursor:'pointer',
              display:'flex', flexDirection:'column', justifyContent:'center',
              minWidth:0,
            }}
          >
            <span className="student-wrap-text" style={{ fontSize:12, fontWeight:900, color:C.accPale }}>{action.label}</span>
            <span className="student-clamp-2" style={{ fontSize:11, fontWeight:700, color:C.textFaint, marginTop:2, lineHeight:1.25 }}>{action.sub}</span>
          </button>
        );})}
      </div>

      {hasClassroom && assignedLessonsForSubject.length > 0 && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontWeight:800, fontSize:12, color:C.textMuted, textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>
            Tugasan Kelas
          </div>
          {lessonState.loading ? (
            <div style={{ display:'grid', gridTemplateColumns:phone ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap:10 }}>
              {[0,1].map(i => (
                <Card key={i} style={{ padding:12 }}>
                  <Skeleton width="66%" height={13} radius={7} style={{ marginBottom:8 }} />
                  <Skeleton width="44%" height={11} radius={6} style={{ marginBottom:10 }} />
                  <Skeleton width="100%" height={7} radius={999} />
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:phone ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap:10 }}>
              {assignedLessonsForSubject.slice(0, 4).map((lesson, index) => {
                const dueLabel = studentDueLabel(lesson.dueDate);
                return (
                  <Card key={lesson.id || `${lesson.title}-${index}`} onClick={() => openLesson(lesson, 'learn')} style={{ padding:12, minWidth:0 }}>
                    <div className="student-clamp-2" style={{ fontSize:13, color:C.text, fontWeight:900, lineHeight:1.25, marginBottom:4 }}>
                      {lesson.title}
                    </div>
                    <div className="student-clamp-2" style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.25, marginBottom:8 }}>
                      {dueLabel || lesson.topic || 'Tugasan guru'}
                    </div>
                    <ProgressBar value={lesson.progress} height={6} />
                    <div style={{ fontSize:10, color:C.textFaint, fontWeight:800, marginTop:5 }}>
                      {lesson.progress}% siap
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Topic timeline */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, paddingBottom:48 }}>
        {nodes.map((node, i) => {
          const statusLabel = node.done ? 'Selesai' : node.cur ? 'Semasa' : node.locked ? 'Terkunci' : 'Sedia';
          const statusColor = node.done ? C.green : node.cur ? subj.color : node.locked ? C.textFaint : C.accPale;
          const nodeHint = node.sub || (node.locked ? node.lockReason : 'Topik pembelajaran');
          return (
            <button
              key={node.id}
              onClick={() => openNodeLesson(node)}
              aria-label={node.locked ? `${node.label}. ${node.lockReason}` : `${node.label}. ${statusLabel}`}
              style={{
                minHeight:72, width:'100%', textAlign:'left',
                display:'grid', gridTemplateColumns:'44px 1fr auto', gap:12, alignItems:'center',
                background:node.cur ? `color-mix(in srgb, ${subj.color} 10%, var(--card))` : C.card,
                border:`1.5px solid ${node.cur ? `color-mix(in srgb, ${subj.color} 42%, transparent)` : C.border}`,
                borderRadius:14, padding:'12px 14px',
                color:C.text, fontFamily:'Nunito',
                cursor:node.locked ? 'not-allowed' : 'pointer',
                opacity:node.locked ? .72 : 1,
              }}
            >
              <span style={{
                width:44, height:44, borderRadius:14,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:node.done ? 'rgba(34,197,94,.14)' : node.cur ? `color-mix(in srgb, ${subj.color} 18%, transparent)` : C.surface,
                border:`1px solid ${node.done ? 'rgba(34,197,94,.28)' : node.cur ? `color-mix(in srgb, ${subj.color} 36%, transparent)` : C.border}`,
                color:statusColor, fontWeight:900, fontSize:18,
              }}>
                {node.done ? '✓' : node.locked ? '🔒' : node.cur ? '▶' : i + 1}
              </span>
              <span style={{ minWidth:0 }}>
                <span className="student-wrap-text" style={{ display:'block', fontWeight:900, fontSize:15, color:node.locked ? C.textFaint : C.text, lineHeight:1.2 }}>
                  {node.label}
                </span>
                <span className="student-wrap-text" style={{ display:'block', fontSize:12, color:C.textMuted, fontWeight:700, marginTop:3, lineHeight:1.35 }}>
                  {nodeHint}
                </span>
              </span>
              <span style={{
                justifySelf:'end',
                fontSize:11, fontWeight:900, color:statusColor,
                background:node.done ? 'rgba(34,197,94,.10)' : node.cur ? `color-mix(in srgb, ${subj.color} 12%, transparent)` : C.surface,
                border:`1px solid ${node.done ? 'rgba(34,197,94,.25)' : node.cur ? `color-mix(in srgb, ${subj.color} 30%, transparent)` : C.border}`,
                borderRadius:999, padding:'5px 9px',
                whiteSpace:'nowrap',
              }}>
                {statusLabel}
              </span>
            </button>
          );
        })}
        {currentNode && (
          <div style={{ marginTop:6 }}>
            <GlowButton onClick={() => openNodeLesson(currentNode)}
              style={{ background:`linear-gradient(135deg, ${subj.color}CC, ${subj.color})` }}>
              Mula topik semasa
            </GlowButton>
          </div>
        )}
      </div>
    </div>
  );
};

const StudentChangePasswordCard = () => {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const inputStyle = {
    width:'100%', boxSizing:'border-box', minHeight:44,
    background:C.card, border:`1px solid ${C.border}`, color:C.text,
    borderRadius:10, padding:'10px 12px',
    fontFamily:'Nunito', fontWeight:800,
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (newPassword.length < 8) {
      setError('Kata laluan baharu mesti sekurang-kurangnya 8 aksara.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Pengesahan kata laluan tidak sepadan.');
      return;
    }
    setBusy(true);
    try {
      await window.tusyenApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Kata laluan berjaya dikemas kini.');
    } catch (err) {
      setError(err.message || 'Kata laluan tidak dapat dikemas kini.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionLabel>Keselamatan</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <input type="password" placeholder="Kata laluan semasa" value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} required />
          <input type="password" placeholder="Kata laluan baharu" value={newPassword}
            onChange={e => setNewPassword(e.target.value)} style={inputStyle} minLength={8} required />
          <input type="password" placeholder="Sahkan kata laluan baharu" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} minLength={8} required />
          {error && <div style={{ color:C.red, fontSize:12, fontWeight:800 }}>{error}</div>}
          {message && <div style={{ color:C.green, fontSize:12, fontWeight:800 }}>{message}</div>}
          <GlowButton type="submit" disabled={busy}>{busy ? 'Mengemas kini...' : 'Tukar Kata Laluan'}</GlowButton>
        </form>
      </Card>
    </>
  );
};

const StudentAccountSafetyCard = () => (
  <>
    <SectionLabel>Akaun</SectionLabel>
    <Card style={{ marginBottom:14 }}>
      <div style={{ fontWeight:900, fontSize:14, color:C.text, marginBottom:4 }}>
        Keselamatan akaun
      </div>
      <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:12 }}>
        Semak kata laluan, tema paparan, dan sesi akaun kamu di sini.
      </div>
      <div style={{ marginBottom:12 }}>
        <ThemeToggle />
      </div>
      <div style={{ marginBottom:12 }}>
        <LanguageToggle />
      </div>
      <button
        type="button"
        onClick={() => window.tusyenSignOut?.()}
        style={{
          width:'100%', minHeight:44,
          background:'rgba(239,68,68,.10)',
          border:'1px solid rgba(239,68,68,.32)',
          color:C.red,
          borderRadius:12,
          padding:'10px 12px',
          fontFamily:'Nunito',
          fontWeight:900,
          fontSize:13,
          cursor:'pointer',
        }}
      >
        Log Keluar
      </button>
    </Card>
  </>
);

const JoinClassroomCard = ({ classInfo, onJoined }) => {
  const [joinCode, setJoinCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [joinTouched, setJoinTouched] = React.useState(false);
  const [joinAttempted, setJoinAttempted] = React.useState(false);
  const hasClassroom = (classInfo?.classrooms || []).length > 0;
  const cleanedJoinCode = cleanStudentJoinCode(joinCode);
  const joinValidation = studentJoinCodeValidation(cleanedJoinCode);
  const showJoinValidation = Boolean((joinTouched || joinAttempted) && joinValidation);
  const joinInvalid = Boolean(showJoinValidation || error);

  const submit = async (e) => {
    e.preventDefault();
    const code = cleanedJoinCode;
    setMessage('');
    setError('');
    if (joinValidation) {
      setJoinAttempted(true);
      return;
    }
    setBusy(true);
    try {
      const data = await window.tusyenApi.joinClassroomByCode(code);
      setJoinCode('');
      setJoinTouched(false);
      setJoinAttempted(false);
      setMessage(data.classroom?.name ? `Berjaya sertai ${data.classroom.name}.` : 'Berjaya sertai kelas.');
      onJoined?.();
    } catch (err) {
      setError(studentJoinCodeErrorMessage(err.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionLabel>Kelas</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, color:C.text, fontWeight:900, marginBottom:4 }}>
          {hasClassroom ? 'Sertai kelas lain' : 'Sertai kelas pertama'}
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:10 }}>
          Masukkan kod kelas yang diberikan oleh guru.
        </div>
        <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
          <input
            id="student-profile-join-code"
            value={joinCode}
            onBlur={() => setJoinTouched(true)}
            onChange={e => {
              setJoinCode(cleanStudentJoinCode(e.target.value));
              setError('');
              setMessage('');
              setJoinAttempted(false);
            }}
            aria-invalid={joinInvalid ? 'true' : 'false'}
            aria-describedby="student-profile-join-help student-profile-join-error"
            placeholder="Kod kelas"
            style={{
              minWidth:0, border:`1.5px solid ${joinInvalid ? C.red : C.border}`,
              borderRadius:10, padding:'0 10px', minHeight:44,
              background:C.card, color:C.text, fontFamily:'Nunito', fontWeight:800,
            }}
          />
          <button disabled={busy} type="submit" style={{
            background:C.accDim, border:`1px solid ${C.borderB}`, color:C.accPale,
            borderRadius:10, padding:'0 14px', minHeight:44, fontWeight:900, cursor:busy ? 'not-allowed' : 'pointer',
          }}>{busy ? '...' : 'Sertai'}</button>
        </form>
        <div id="student-profile-join-help" style={{
          color:showJoinValidation ? C.red : C.textFaint,
          fontSize:11, fontWeight:800, marginTop:7, lineHeight:1.35,
        }}>
          {showJoinValidation ? `${joinValidation} ` : ''}Kod kelas 4-12 aksara; huruf, nombor, atau tanda sempang.
        </div>
        {error && <div id="student-profile-join-error" role="alert" style={{ color:C.red, fontSize:12, fontWeight:800, marginTop:8 }}>{error}</div>}
        {message && <div role="status" style={{ color:C.green, fontSize:12, fontWeight:800, marginTop:8 }}>{message}</div>}
      </Card>
    </>
  );
};

// ─── SClassrooms ─────────────────────────────────────────────────────────────
const SClassrooms = ({ classInfo, onClassJoined, onViewPosts }) => {
  const [joinCode, setJoinCode] = React.useState('');
  const [joining, setJoining] = React.useState(false);
  const [joinMsg, setJoinMsg] = React.useState('');
  const [joinErr, setJoinErr] = React.useState('');
  const [joinTouched, setJoinTouched] = React.useState(false);
  const [joinAttempted, setJoinAttempted] = React.useState(false);
  const [leaveTarget, setLeaveTarget] = React.useState(null);
  const [openMenuId, setOpenMenuId] = React.useState(null);
  const [leavingId, setLeavingId] = React.useState(null);
  const [leaveErr, setLeaveErr] = React.useState('');
  const cleanedJoinCode = cleanStudentJoinCode(joinCode);
  const joinValidation = studentJoinCodeValidation(cleanedJoinCode);
  const showJoinValidation = Boolean((joinTouched || joinAttempted) && joinValidation);
  const joinInvalid = Boolean(showJoinValidation || joinErr);

  const classroomsState = useAsync(async () => {
    const { classrooms } = await window.tusyenApi.classrooms();
    return classrooms || [];
  }, [], []);

  const classPostsState = useAsync(async () => {
    const list = classroomsState.data || [];
    if (!list.length) return {};
    const results = await Promise.allSettled(
      list.map(cls => window.tusyenApi.feedPosts({ classroomId: cls.id, limit: 2 }))
    );
    const map = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') map[list[i].id] = r.value.posts || [];
    });
    return map;
  }, [JSON.stringify((classroomsState.data || []).map(c => c.id))], {});

  const postTypeIcon = (type='') => {
    const t = `${type}`.toLowerCase();
    if (t.includes('announcement')) return '📢';
    if (t.includes('assignment')) return '📋';
    return '💬';
  };

  const submitJoin = async (e) => {
    e.preventDefault();
    const code = cleanedJoinCode;
    setJoinMsg(''); setJoinErr('');
    if (joinValidation) { setJoinAttempted(true); return; }
    setJoining(true);
    try {
      const data = await window.tusyenApi.joinClassroomByCode(code);
      setJoinCode('');
      setJoinTouched(false);
      setJoinAttempted(false);
      setJoinMsg(data.classroom?.name ? `Berjaya sertai ${studentText(data.classroom.name, 'kelas', 54)}.` : 'Berjaya sertai kelas.');
            await Promise.resolve(classroomsState.refresh?.());
      await Promise.resolve(onClassJoined?.());} catch (err) {
      setJoinErr(studentJoinCodeErrorMessage(err.message));
    } finally {
      setJoining(false);
    }
  };

  const requestLeave = (cls) => {
    setOpenMenuId(null);
    setLeaveErr('');
    setLeaveTarget(cls);
  };

  const confirmLeaveClass = async () => {
    if (!leaveTarget?.id) return;
    setLeavingId(leaveTarget.id);
    setLeaveErr('');
    try {
      await window.tusyenApi.leaveClassroom(leaveTarget.id);
      classroomsState.refresh?.();
      onClassJoined?.();
      setLeaveTarget(null);
    } catch (err) {
      setLeaveErr(err.message || 'Kelas tidak dapat ditinggalkan.');
    } finally {
      setLeavingId(null);
    }
  };

  const ghBtn = {
    background: C.accDim, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '6px 10px', minHeight:44, color: C.accPale, fontFamily: 'Nunito', fontWeight: 800,
    fontSize: 12, cursor: 'pointer',
  };
  const redBtn = {
    background: 'rgba(239,68,68,.12)', border: `1px solid rgba(239,68,68,.30)`, borderRadius: 10,
    padding: '6px 10px', minHeight:44, color: C.red, fontFamily: 'Nunito', fontWeight: 800,
    fontSize: 12, cursor: 'pointer',
  };
  const inputStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '8px 10px', minHeight:44, color: C.text, fontFamily: 'Nunito', fontWeight: 700,
    fontSize: 12, width: '100%', boxSizing: 'border-box',
  };
  const phone = useNarrow(620);

  return (
    <div style={{ maxWidth: 640, width:'100%', minWidth:0, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Join form */}
      <SectionLabel>Sertai Kelas</SectionLabel>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 900, marginBottom: 4 }}>
          Sertai kelas dengan kod
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, lineHeight: 1.45, marginBottom: 10 }}>
          Masukkan kod kelas yang diberikan oleh guru kamu.
        </div>
        <form onSubmit={submitJoin} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, minWidth:0 }}>
          <input
            id="student-classrooms-join-code"
            value={joinCode}
            onBlur={() => setJoinTouched(true)}
            onChange={e => {
              setJoinCode(cleanStudentJoinCode(e.target.value));
              setJoinErr('');
              setJoinMsg('');
              setJoinAttempted(false);
            }}
            aria-invalid={joinInvalid ? 'true' : 'false'}
            aria-describedby="student-classrooms-join-help student-classrooms-join-error"
            placeholder="Contoh: ABC-123"
            style={{ ...inputStyle, minWidth: 0, border:`1.5px solid ${joinInvalid ? C.red : C.border}` }}
          />
          <button disabled={joining} type="submit" style={{
            background: C.accDim, border: `1px solid ${C.borderB}`, color: C.accPale,
            borderRadius: 10, padding: '0 14px', minHeight:44, fontWeight: 900, cursor: joining ? 'not-allowed' : 'pointer',
            fontFamily: 'Nunito', fontSize: 13,
          }}>{joining ? '...' : 'Sertai'}</button>
        </form>
        <div id="student-classrooms-join-help" style={{
          color:showJoinValidation ? C.red : C.textFaint,
          fontSize:11, fontWeight:800, marginTop:7, lineHeight:1.35,
        }}>
          {showJoinValidation ? `${joinValidation} ` : ''}Kod kelas 4-12 aksara; huruf, nombor, atau tanda sempang.
        </div>
        {joinErr && <div id="student-classrooms-join-error" role="alert" style={{ color: C.red, fontSize: 12, fontWeight: 800, marginTop: 8 }}>{joinErr}</div>}
        {joinMsg && <div role="status" style={{ color: C.green, fontSize: 12, fontWeight: 800, marginTop: 8 }}>{joinMsg}</div>}
      </Card>

      {/* Classroom list */}
      <SectionLabel>Kelas Saya</SectionLabel>

      {classroomsState.loading && (
        <>{[0, 1].map(i => <Card key={i} style={{ marginBottom: 14 }}><Skeleton lines={3} /></Card>)}</>
      )}

      {!classroomsState.loading && classroomsState.error && (
        <ErrorRetry onRetry={classroomsState.refresh} />
      )}

      {!classroomsState.loading && !classroomsState.error && (classroomsState.data || []).length === 0 && (
        <EmptyState icon="🏫" title="Belum sertai kelas" subtitle="Masukkan kod kelas daripada guru untuk mula belajar." />
      )}

      {!classroomsState.loading && (classroomsState.data || []).map(cls => {
        const posts = (classPostsState.data || {})[cls.id] || [];
        const isLeaving = leavingId === cls.id;
        const menuOpen = openMenuId === cls.id;
        return (
          <Card key={cls.id} style={{ marginBottom: 14, position:'relative', minWidth:0, maxWidth:'100%', overflow:'hidden' }}>
            {/* Classroom header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap:10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="student-wrap-text" style={{ fontWeight: 900, fontSize: 14, color: C.text, lineHeight: 1.2 }}>
                  {studentText(cls.name, 'Kelas', 54)}
                </div>
                {cls.subject && (
                  <div className="student-wrap-text" style={{ fontSize: 12, color: C.accPale, fontWeight: 800, marginTop: 2, lineHeight:1.25 }}>{studentText(cls.subject, 'Subjek', 36)}</div>
                )}
              </div>
              <button
                onClick={() => setOpenMenuId(menuOpen ? null : cls.id)}
                disabled={isLeaving}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Tindakan untuk ${studentText(cls.name, 'kelas', 54)}`}
                style={{ ...ghBtn, minWidth:44, minHeight:44, padding:'0 12px' }}
              >
                {isLeaving ? '...' : 'Lagi'}
              </button>
              {menuOpen && (
                <div role="menu" style={{
                  position:'absolute', top:58, right:14, zIndex:20,
                  minWidth:180, background:C.bg, border:`1px solid ${C.border}`,
                  borderRadius:12, padding:6, boxShadow:'0 14px 36px rgba(0,0,0,.28)',
                }}>
                  <button
                    role="menuitem"
                    onClick={() => requestLeave(cls)}
                    style={{
                      width:'100%', minHeight:44, textAlign:'left',
                      background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.24)',
                      borderRadius:10, color:C.red, fontFamily:'Nunito',
                      fontWeight:900, cursor:'pointer', padding:'0 12px',
                    }}
                  >
                    Tinggalkan kelas
                  </button>
                </div>
              )}
            </div>

            {/* Details row */}
            <div style={{
              display: 'flex', flexDirection:phone ? 'column' : 'row',
              flexWrap: phone ? 'nowrap' : 'wrap', gap: phone ? 6 : '4px 12px', marginBottom: 10,
              minWidth:0,
            }}>
              {cls.form_level != null && (
                <span className="student-wrap-text" style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, minWidth:0 }}>
                  📚 Tingkatan {cls.form_level}
                </span>
              )}
              {cls.teacher_name && (
                <span className="student-wrap-text" style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, minWidth:0 }}>
                  👩‍🏫 {studentName(cls.teacher_name, 'Guru')}
                </span>
              )}
              {cls.student_count != null && (
                <span className="student-wrap-text" style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, minWidth:0 }}>
                  👥 {cls.student_count} pelajar
                </span>
              )}
            </div>

            {/* Latest posts */}
            {posts.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Pos Terkini
                </div>
                {posts.map(post => (
                  <div key={post.id} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '8px 0', borderBottom: `1px solid ${C.border}`,
                    minWidth:0,
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{postTypeIcon(post.post_type || post.postType)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="student-clamp-2" style={{ fontSize: 12, fontWeight: 800, color: C.text, lineHeight: 1.25 }}>
                        {studentTitle(post.title || post.content?.slice(0, 60), 'Pos')}
                      </div>
                      {post.content && post.title && (
                        <div className="student-clamp-2" style={{
                          fontSize: 11, color: C.textMuted, fontWeight: 600, lineHeight: 1.3,
                        }}>
                          {studentBodyText(post.content.slice(0, 80), 'Butiran pos', 80)}
                        </div>
                      )}
                      <div style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        gap:8, marginTop:6, flexWrap:'wrap', minWidth:0,
                      }}>
                        <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 700 }}>
                          {timeAgo(post.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onViewPosts?.(cls.id)}
                          style={{
                            minHeight:44, minWidth:44, borderRadius:10,
                            padding:'0 12px', background:C.accDim,
                            border:`1px solid ${C.borderB}`, color:C.accPale,
                            fontFamily:'Nunito', fontSize:12, fontWeight:900,
                            cursor:'pointer', flexShrink:0,
                          }}
                        >
                          Lihat pos
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {leaveErr && (
        <div style={{ color:C.red, fontSize:12, fontWeight:800, margin:'0 0 10px' }}>{leaveErr}</div>
      )}
      <StudentConfirmModal
        open={Boolean(leaveTarget)}
        danger
        busy={Boolean(leavingId)}
        title="Tinggalkan kelas?"
        message={leaveErr || `Kamu akan keluar daripada ${studentText(leaveTarget?.name, 'kelas ini', 54)}. Pelajaran dan pos kelas tidak lagi muncul selepas tindakan ini.`}
        confirmLabel="Tinggalkan"
        cancelLabel="Kekal"
        onConfirm={confirmLeaveClass}
        onCancel={() => { if (!leavingId) setLeaveTarget(null); }}
      />
      <div style={{ height: 8 }} />
    </div>
  );
};

// ─── SFeed ────────────────────────────────────────────────────────────────────
const SFeed = ({ classInfo, initialClassId = null }) => {
  const [activeClassId, setActiveClassId] = React.useState(initialClassId);
  const [expandedPosts, setExpandedPosts] = React.useState({});
  const [comments, setComments] = React.useState({});
  const [commentsLoading, setCommentsLoading] = React.useState({});
  const [commentDraft, setCommentDraft] = React.useState({});
  const [commentSubmitting, setCommentSubmitting] = React.useState({});
  const [posts, setPosts] = React.useState([]);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [postsError, setPostsError] = React.useState(null);
  const [postActionErrors, setPostActionErrors] = React.useState({});

  const classroomsState = useAsync(async () => {
    const { classrooms } = await window.tusyenApi.classrooms();
    return classrooms || [];
  }, [], []);

  const loadPosts = React.useCallback(async (classroomId) => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const params = { limit: 30 };
      if (classroomId) params.classroomId = classroomId;
      const data = await window.tusyenApi.feedPosts(params);
      setPosts(data.posts || []);
      setPostActionErrors({});
    } catch (err) {
      setPostsError(err.message || 'Pos tidak dapat dimuatkan.');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  React.useEffect(() => { loadPosts(activeClassId); }, [activeClassId]);
  React.useEffect(() => {
    setActiveClassId(initialClassId || null);
  }, [initialClassId]);

  const postTypeInfo = (type='') => {
    const t = `${type}`.toLowerCase();
    if (t.includes('announcement')) return { icon: '📢', label: 'Pengumuman', bg: 'rgba(251,191,36,.15)', color: '#F59E0B' };
    if (t.includes('assignment'))   return { icon: '📋', label: 'Tugasan',    bg: 'rgba(99,102,241,.15)', color: '#818CF8' };
    return                                 { icon: '💬', label: 'Umum',       bg: 'rgba(16,185,129,.15)', color: '#34D399' };
  };

  const setPostError = (postId, key, message='') => {
    setPostActionErrors(prev => ({
      ...prev,
      [postId]: {
        ...(prev[postId] || {}),
        [key]:message,
      },
    }));
  };

  const toggleLike = async (postId) => {
    const idx = posts.findIndex(p => p.id === postId);
    if (idx < 0) return;
    const post = posts[idx];
    const wasLiked = Boolean(post.user_has_reacted);
    const newCount = (Number(post.reaction_count || post.reactions_count || 0)) + (wasLiked ? -1 : 1);
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, user_has_reacted: !wasLiked, reaction_count: newCount, reactions_count: newCount }
      : p
    ));
    setPostError(postId, 'like', '');
    try {
      await window.tusyenApi.toggleReaction(postId);
    } catch (err) {
      // Revert
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, user_has_reacted: wasLiked, reaction_count: post.reaction_count, reactions_count: post.reactions_count }
        : p
      ));
      setPostError(postId, 'like', err.message || 'Reaksi tidak dapat disimpan. Cuba lagi.');
    }
  };

  const toggleExpand = async (postId) => {
    const next = !expandedPosts[postId];
    setExpandedPosts(prev => ({ ...prev, [postId]: next }));
    if (next && !comments[postId] && !commentsLoading[postId]) {
      setCommentsLoading(prev => ({ ...prev, [postId]: true }));
      setPostError(postId, 'comments', '');
      try {
        const data = await window.tusyenApi.postComments(postId);
        setComments(prev => ({ ...prev, [postId]: data.comments || [] }));
      } catch (err) {
        setComments(prev => ({ ...prev, [postId]: [] }));
        setPostError(postId, 'comments', err.message || 'Komen tidak dapat dimuatkan.');
      } finally {
        setCommentsLoading(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  const submitComment = async (postId) => {
    const content = (commentDraft[postId] || '').trim();
    if (!content) return;
    setCommentSubmitting(prev => ({ ...prev, [postId]: true }));
    setPostError(postId, 'comment', '');
    try {
      const data = await window.tusyenApi.addComment(postId, content);
      const newComment = data.comment || { id: Date.now(), content, author_name: window.tusyenUser?.fullName || 'Kamu', created_at: new Date().toISOString() };
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
      setCommentDraft(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(post => post.id === postId
        ? {
          ...post,
          comment_count:Number(post.comment_count || post.comments_count || 0) + 1,
          comments_count:Number(post.comment_count || post.comments_count || 0) + 1,
        }
        : post
      ));
    } catch (err) {
      setPostError(postId, 'comment', err.message || 'Komen tidak dapat dihantar. Cuba lagi.');
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const deleteComment = async (postId, commentId) => {
    setPostError(postId, 'comment', '');
    try {
      await window.tusyenApi.deleteComment(postId, commentId);
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(post => post.id === postId
        ? {
          ...post,
          comment_count:Math.max(0, Number(post.comment_count || post.comments_count || 0) - 1),
          comments_count:Math.max(0, Number(post.comment_count || post.comments_count || 0) - 1),
        }
        : post
      ));
    } catch (err) {
      setPostError(postId, 'comment', err.message || 'Komen tidak dapat dipadam.');
    }
  };

  const ghBtn = {
    background: C.accDim, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '6px 10px', color: C.accPale, fontFamily: 'Nunito', fontWeight: 800,
    fontSize: 12, cursor: 'pointer',
  };
  const inputStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '8px 10px', color: C.text, fontFamily: 'Nunito', fontWeight: 700,
    fontSize: 12, width: '100%', boxSizing: 'border-box',
  };

  const classrooms = classroomsState.data || [];
  const feedNarrow = useNarrow(900);
  const feedPhone = useNarrow(620);
  const filterOptions = [{ id: null, name: 'Semua kelas' }, ...classrooms];
  const selectClassFilter = (value) => {
    const picked = filterOptions.find(cls => `${cls.id ?? ''}` === value);
    setActiveClassId(picked?.id ?? null);
  };
  const postCtaLabel = (typeInfo, isExpanded) => {
    if (isExpanded) return 'Tutup butiran';
    if (typeInfo.label === 'Tugasan') return 'Buka tugasan';
    if (typeInfo.label === 'Pengumuman') return 'Lihat pengumuman';
    return 'Lihat perbincangan';
  };

  return (
    <div style={{
      maxWidth: 1040, width:'100%', minWidth:0, margin: '0 auto',
      display: 'grid', gridTemplateColumns: feedNarrow ? '1fr' : '220px minmax(0, 760px)',
      gap: feedNarrow ? 0 : 18, alignItems:'start',
    }}>
      {/* Classroom filter chips */}
      {feedPhone ? (
        <div style={{ marginBottom:12, minWidth:0, maxWidth:'100%' }}>
          <select
            className="student-native-select"
            aria-label="Tapis pos mengikut kelas"
            value={`${activeClassId ?? ''}`}
            onChange={(e) => selectClassFilter(e.target.value)}
            style={{ background:C.surface, border:`1px solid ${C.borderB}`, color:C.text }}
          >
            {filterOptions.map(cls => (
              <option key={cls.id ?? 'all'} value={`${cls.id ?? ''}`}>{studentText(cls.name, 'Kelas', 54)}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className={feedNarrow ? 'student-scroll-fade' : ''} style={{
          marginBottom: feedNarrow ? 10 : 0,
          position: feedNarrow ? 'relative' : 'sticky',
          top: feedNarrow ? undefined : 12,
          maxWidth:'100%',
          minWidth:0,
        }}>
          <div className={feedNarrow ? 'student-scroll-affordance' : ''} style={{
            display: 'flex', flexDirection: feedNarrow ? 'row' : 'column',
            gap: 6, overflowX: feedNarrow ? 'auto' : 'visible',
            WebkitOverflowScrolling:'touch',
            scrollSnapType: feedNarrow ? 'x proximity' : undefined,
            padding: feedNarrow ? '2px 28px 8px 4px' : '0 0 4px',
            maxWidth:'100%', minWidth:0,
            boxSizing:'border-box',
          }}>
            {!feedNarrow && (
              <div style={{ fontSize:12, color:C.textMuted, fontWeight:900, marginBottom:4 }}>Tapis pos</div>
            )}
            {filterOptions.map(cls => {
              const active = activeClassId === cls.id;
              return (
                <button
                  key={cls.id ?? 'all'}
                  onClick={() => setActiveClassId(cls.id)}
                  style={{
                    flexShrink: 0, minHeight:44,
                    background: active ? C.accDim : C.surface,
                    border: `1px solid ${active ? C.borderB : C.border}`,
                    borderRadius: 14, padding: '5px 14px',
                    color: active ? C.accPale : C.textMuted,
                    fontFamily: 'Nunito', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    whiteSpace: 'nowrap', textAlign: feedNarrow ? 'center' : 'left',
                    scrollSnapAlign: feedNarrow ? 'start' : undefined,
                  }}
                >{studentText(cls.name, 'Kelas', 54)}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ minWidth:0, maxWidth:'100%' }}>

      {/* Loading skeletons */}
      {postsLoading && (
        <>{[0, 1, 2].map(i => (
          <Card key={i} style={{ marginBottom: 14, minHeight: 100 }}>
            <Skeleton lines={3} />
          </Card>
        ))}</>
      )}

      {/* Error */}
      {!postsLoading && postsError && (
        <ErrorRetry onRetry={() => loadPosts(activeClassId)} />
      )}

      {/* Empty */}
      {!postsLoading && !postsError && posts.length === 0 && (
        <EmptyState icon="📢" title="Tiada pos lagi" subtitle="Pos daripada kelas akan muncul di sini." />
      )}

      {/* Post cards */}
      {!postsLoading && posts.map(post => {
        const typeInfo = postTypeInfo(post.post_type || post.postType);
        const likeCount = Number(post.reaction_count || post.reactions_count || 0);
        const commentCount = Number(post.comment_count || post.comments_count || 0);
        const liked = Boolean(post.user_has_reacted);
        const isExpanded = Boolean(expandedPosts[post.id]);
        const cleanContent = studentBodyText(post.content, '', 220);
        const snippet = cleanContent
          ? (cleanContent.length > 120 ? cleanContent.slice(0, 120) + '…' : cleanContent)
          : '';
        const postTitle = studentTitle(post.title, '');
        const postMeta = [
          studentText(post.classroom_name, '', 54),
          studentName(post.author_name, ''),
        ].filter(Boolean).join(' · ');
        const attachments = studentArray(post.attachments || post.resources || post.media);
        const cardErrors = postActionErrors[post.id] || {};

        return (
          <Card key={post.id} style={{ marginBottom: 14, minWidth:0, maxWidth:'100%', overflow:'hidden' }}>
            {/* Type pill + pin + meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap', minWidth:0 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: typeInfo.bg, color: typeInfo.color,
                borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 800,
              }}>{typeInfo.icon} {typeInfo.label}</span>
              {post.is_pinned && <span style={{ fontSize: 12 }}>📌</span>}
              <span className="student-wrap-text" style={{
                fontSize: 11, color: C.textMuted, fontWeight: 700,
                marginLeft: feedPhone ? 0 : 'auto',
                flex:'1 1 160px', minWidth:0,
                textAlign: feedPhone ? 'left' : 'right',
              }}>
                {postMeta}
              </span>
            </div>

            {/* Title + snippet */}
            {postTitle && (
              <div className="student-clamp-3" style={{ fontWeight: 900, fontSize: 14, color: C.text, lineHeight: 1.25, marginBottom: 4 }}>
                {postTitle}
              </div>
            )}
            {snippet && (
              <div className="student-clamp-3" style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, lineHeight: 1.5, marginBottom: 8 }}>
                {snippet}
              </div>
            )}
            <StudentAttachmentPreview attachments={attachments} compact />

            {/* Timestamp */}
            <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, marginBottom: 10 }}>
              {timeAgo(post.created_at)}
            </div>

            {/* Actions row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth:0 }}>
              {/* Butang reaksi */}
              <button
                onClick={() => toggleLike(post.id)}
                style={{
                  background: liked ? 'rgba(239,68,68,.12)' : C.surface,
                  border: `1px solid ${liked ? 'rgba(239,68,68,.35)' : C.border}`,
                  borderRadius: 10, padding: '5px 10px',
                  color: liked ? C.red : C.textMuted,
                  fontFamily: 'Nunito', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent:'center', gap: 4,
                  minHeight:44, minWidth:44,
                }}
              >
                {liked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : ''}
              </button>

              {/* Comment count */}
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, minHeight:44 }}>
                💬 {commentCount}
              </span>

              {/* Expand button */}
              <button
                onClick={() => toggleExpand(post.id)}
                style={{
                  ...ghBtn,
                  marginLeft: feedPhone ? 0 : 'auto',
                  minHeight:44, minWidth:44,
                  flex:feedPhone ? '1 1 100%' : '0 1 auto',
                  textAlign:'center',
                }}
              >
                {postCtaLabel(typeInfo, isExpanded)}
              </button>
            </div>
            {(cardErrors.like || cardErrors.comments) && (
              <div role="alert" style={{
                marginTop:8, padding:'8px 10px', borderRadius:10,
                background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.24)',
                color:C.red, fontSize:12, fontWeight:800, lineHeight:1.35,
              }}>
                {cardErrors.like || cardErrors.comments}
              </div>
            )}
            <div style={{ fontSize:11, color:C.textFaint, fontWeight:700, lineHeight:1.35, marginTop:8 }}>
              Reaksi dan komen boleh dilihat oleh ahli kelas. Komen hanya untuk perbincangan pembelajaran.
            </div>

            {/* Expanded comments */}
            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                {commentsLoading[post.id] && <Skeleton lines={2} />}
                {!commentsLoading[post.id] && (comments[post.id] || []).map(cm => {
                  const isOwn = cm.author_id === window.tusyenUser?.id;
                  return (
                    <div key={cm.id} style={{
                      display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start',
                    }}>
                      <Avatar name={studentName(cm.author_name, 'Pengguna')} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="student-wrap-text" style={{ fontSize: 11, fontWeight: 800, color: C.accPale, marginBottom: 2, lineHeight:1.3 }}>
                          {studentName(cm.author_name, 'Pengguna')}
                          <span style={{ color: C.textFaint, fontWeight: 600, marginLeft: 6 }}>{timeAgo(cm.created_at)}</span>
                        </div>
                        <div className="student-wrap-text" style={{ fontSize: 12, color: C.text, fontWeight: 600, lineHeight: 1.45 }}>{studentBodyText(cm.content, '', 180)}</div>
                      </div>
                      {isOwn && (
                        <button
                          onClick={() => deleteComment(post.id, cm.id)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: C.textFaint, fontFamily: 'Nunito', fontWeight: 800,
                            fontSize: 11, padding: '2px 8px', minHeight:44, minWidth:44, flexShrink: 0,
                          }}
                        >Padam</button>
                      )}
                    </div>
                  );
                })}
                {!commentsLoading[post.id] && !(comments[post.id] || []).length && (
                  <div style={{ fontSize: 12, color: C.textFaint, fontWeight: 600, marginBottom: 10 }}>
                    Belum ada komen. Jadilah yang pertama!
                  </div>
                )}
                {cardErrors.comment && (
                  <div role="alert" style={{
                    marginBottom:8, padding:'8px 10px', borderRadius:10,
                    background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.24)',
                    color:C.red, fontSize:12, fontWeight:800, lineHeight:1.35,
                  }}>
                    {cardErrors.comment}
                  </div>
                )}
                {/* Add comment */}
                <div style={{ display: 'flex', flexDirection:feedPhone ? 'column' : 'row', gap: 8, marginTop: 6, alignItems: feedPhone ? 'stretch' : 'flex-end', minWidth:0 }}>
                  <textarea
                    rows={3}
                    maxLength={500}
                    placeholder="Tambah komen..."
                    value={commentDraft[post.id] || ''}
                    onChange={e => {
                      setCommentDraft(prev => ({ ...prev, [post.id]: e.target.value }));
                      setPostError(post.id, 'comment', '');
                    }}
                    style={{
                      ...inputStyle, resize: 'vertical', minHeight: 56, flex: 1, minWidth:0,
                    }}
                  />
                  <button
                    onClick={() => submitComment(post.id)}
                    disabled={commentSubmitting[post.id] || !(commentDraft[post.id] || '').trim()}
                    style={{ ...ghBtn, alignSelf: feedPhone ? 'stretch' : 'flex-end', flexShrink: 0, padding: '8px 12px', minHeight:44, minWidth:44 }}
                  >
                    {commentSubmitting[post.id] ? '...' : 'Hantar'}
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      <div style={{ height: 8 }} />
      </div>
    </div>
  );
};

const SProfile = ({ displayName, avatarUrl, classInfo, onProfileSave, onClassJoined }) => {
  const badgesState = useAchievements();
  const statsState = useStudentStats();
  const badges = badgesState.data || BADGES;
  const stats = statsState.data || {};
  const levelInfo = studentLevelFromXp(stats.xp);
  const teacherId = classInfo?.classrooms?.[0]?.teacher_id || classInfo?.classrooms?.[0]?.teacherId || '';
  const teacherProfileState = useAsync(async () => {
    if (!teacherId) return null;
    const { profile } = await window.tusyenApi.teacherProfile(teacherId);
    return profile || null;
  }, [teacherId], null);
  const teacherProfile = teacherProfileState.data;
  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(displayName);
  const [draftAvatar, setDraftAvatar] = React.useState(avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileError, setProfileError] = React.useState('');
  const [profileTab, setProfileTab] = React.useState('profile');
  const phone = useNarrow(620);
  const earnedBadgeCount = badges.filter(b => b.earned).length;
  React.useEffect(() => {
    setDraftName(displayName);
    setDraftAvatar(avatarUrl || '');
  }, [displayName, avatarUrl]);
  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError('');
    if (!file.type.startsWith('image/')) {
      setProfileError('Pilih fail imej untuk avatar.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const data = await window.tusyenApi.uploadMedia(file);
      setDraftAvatar(data.url || data.canonicalUrl || '');
    } catch (err) {
      setProfileError(err.message || 'Gambar tidak dapat dimuat naik.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };
  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError('');
    try {
      await onProfileSave?.({ fullName:draftName.trim() || displayName, avatarUrl:draftAvatar.trim() });
      setEditing(false);
    } catch (err) {
      setProfileError(err.message || 'Profil tidak dapat disimpan.');
    } finally {
      setSavingProfile(false);
    }
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:640, width:'100%', minWidth:0, margin:'0 auto' }}>
      {/* Hero card */}
      <Card style={{ padding:'28px 20px 22px', textAlign:'center', minWidth:0, overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
          <Avatar name={displayName} size={82} src={avatarUrl} />
        </div>
        <div className="student-wrap-text" style={{ fontWeight:900, fontSize:24, color:C.text, letterSpacing:-.4 }}>{displayName}</div>
        <div className="student-wrap-text" style={{ fontSize:13, color:C.textMuted, fontWeight:600, marginTop:3 }}>{classInfo?.label || 'Belum sertai kelas'}</div>
        {classInfo?.detail && (
          <div className="student-wrap-text" style={{ fontSize:11, color:C.textFaint, fontWeight:600, marginTop:2 }}>{classInfo.detail}</div>
        )}
        <div style={{
          marginTop:8, display:'inline-flex', alignItems:'center', gap:5,
          background:'linear-gradient(135deg,var(--acc-lo),var(--acc))',
          borderRadius:20, padding:'4px 16px', fontSize:12, fontWeight:900, color:'#fff',
          boxShadow:`0 2px 12px var(--acc-glow)`,
        }}>⚡ Tahap {levelInfo.level} · {levelInfo.tier}</div>
        <div style={{ marginTop:12 }}>
          <button onClick={() => setEditing(true)} style={{
            background:C.accDim, border:`1px solid ${C.border}`,
            color:C.accPale, borderRadius:10, padding:'8px 18px', minHeight:44,
            fontFamily:'Nunito', fontSize:13, fontWeight:800, cursor:'pointer',
          }}><span aria-hidden="true">✏️</span> Edit profil</button>
        </div>
      </Card>

      <div role="tablist" aria-label="Bahagian profil" style={{
        display:'grid',
        gridTemplateColumns:phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        gap:8,
        minWidth:0,
      }}>
        {[
          { id:'profile', label:'Profil' },
          { id:'achievements', label:`Pencapaian${earnedBadgeCount ? ` ${earnedBadgeCount}` : ''}` },
          { id:'class', label:'Kelas' },
          { id:'security', label:'Keselamatan' },
        ].map(tab => {
          const active = profileTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setProfileTab(tab.id)}
              style={{
                minHeight:44, borderRadius:12,
                border:`1.5px solid ${active ? C.borderB : C.border}`,
                background:active ? C.accDim : C.surface,
                color:active ? C.accPale : C.textMuted,
                fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
                padding:'0 8px',
                overflowWrap:'anywhere',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {profileTab === 'class' && (teacherProfileState.loading || teacherProfile) && (
        <Card style={{ padding:'16px 14px' }}>
          <div style={{ fontWeight:900, fontSize:14, color:C.text, marginBottom:6 }}>Tentang Cikgu</div>
          {teacherProfileState.loading ? (
            <Skeleton lines={2} />
          ) : (
            <>
              <div style={{ fontSize:13, fontWeight:800, color:C.accPale }}>
                Cikgu {studentName(teacherProfile?.full_name || classInfo?.classrooms?.[0]?.teacher_name, 'Guru')}
              </div>
              {teacherProfile.headline && (
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, marginTop:2 }}>{teacherProfile.headline}</div>
              )}
              <div style={{ fontSize:12, color:C.text, fontWeight:700, lineHeight:1.5, marginTop:8, whiteSpace:'pre-line' }}>
                {teacherProfile.bio || 'Cikgu belum menambah pengenalan ringkas.'}
              </div>
              {teacherProfile.credentials && (
                <div style={{ marginTop:8, fontSize:11, color:C.textMuted, fontWeight:800 }}>
                  Kelayakan: {teacherProfile.credentials}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {profileTab === 'profile' && (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12, minWidth:0 }}>
        {[
          {v:String(stats.daysActive ?? 0), l:'Hari aktif', i:'📅', color:C.accHi},
          {v:String(stats.lessons ?? 0),    l:'Pelajaran',  i:'📚', color:C.blue},
          {v:Number(stats.xp || 0).toLocaleString(), l:'Jumlah XP', i:'⚡', color:C.gold},
        ].map((s,i) => (
          <Card key={i} style={{ padding:'16px 12px', textAlign:'center' }}>
            <div style={{ fontSize:26, marginBottom:6 }}>{s.i}</div>
            <div style={{ fontWeight:900, fontSize:22, color:s.color, lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:12, color:C.text, fontWeight:800, marginTop:5 }}>{s.l}</div>
          </Card>
        ))}
      </div>
      )}

      {profileTab === 'class' && <JoinClassroomCard classInfo={classInfo} onJoined={onClassJoined} />}
      {profileTab === 'security' && (
        <>
          <StudentChangePasswordCard />
          <StudentAccountSafetyCard />
        </>
      )}

      {profileTab === 'achievements' && (
      <>
      <SectionLabel>🏅 Pencapaian</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8, minWidth:0 }}>
        {badgesState.loading ? [0,1,2,3].map(i => (
          <Card key={i} style={{ padding:12 }}>
            <Skeleton width={30} height={30} radius={10} style={{ marginBottom:8 }} />
            <Skeleton width="72%" height={12} radius={6} style={{ marginBottom:6 }} />
            <Skeleton width="100%" height={9} radius={5} />
          </Card>
        )) : badges.length ? badges.map((b, i) => (
          <Card key={i} style={{
            padding:12, opacity: b.earned ? 1 : 0.4,
            border: b.earned
              ? `1px solid color-mix(in srgb,var(--c-acc) 35%,transparent)`
              : `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:24, marginBottom:4 }}>{b.icon}</div>
            <div style={{ fontWeight:800, fontSize:12, color:C.text, lineHeight:1.2 }}>{b.name}</div>
            <div title={b.desc} style={{
              fontSize:10, color:C.textMuted, fontWeight:600, lineHeight:1.3, marginTop:2,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>{b.desc}</div>
          </Card>
        )) : (
          <Card style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5 }}>
              Belum ada pencapaian. Lengkapkan pelajaran pertama untuk membuka badge.
            </div>
          </Card>
        )}
      </div>
      </>
      )}
      {editing && (
        <div onClick={() => setEditing(false)} style={{
          position:'fixed', inset:0, zIndex:400, background:'rgba(2,6,23,.60)',
          display:'flex', alignItems:'flex-end',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="tv2-sheetup" style={{
            width:'100%', background:C.bg, borderRadius:'22px 22px 0 0',
            border:`1px solid ${C.border}`, padding:'16px', boxShadow:'0 -18px 44px rgba(0,0,0,.28)',
          }}>
            <div style={{ fontWeight:900, color:C.text, fontSize:16, marginBottom:12 }}>Edit Profil</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
              <Avatar name={draftName || displayName} size={72} src={draftAvatar} />
            </div>
            <label style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:5 }}>Nama paparan</label>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} style={{
              width:'100%', boxSizing:'border-box', marginBottom:10,
              background:C.card, border:`1px solid ${C.border}`, color:C.text,
              borderRadius:10, padding:'10px 12px', fontFamily:'Nunito', fontWeight:700,
            }} />
            <label style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:5 }}>Gambar profil</label>
            <div style={{ fontSize:11, color:C.textFaint, fontWeight:700, lineHeight:1.35, marginBottom:6 }}>
              Gunakan imej jelas berbentuk segi empat; sistem akan memotongnya sebagai avatar bulat.
            </div>
            <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploadingAvatar} style={{
              width:'100%', boxSizing:'border-box', marginBottom:14,
              background:C.card, border:`1px solid ${C.border}`, color:C.text,
              borderRadius:10, padding:'10px 12px', fontFamily:'Nunito', fontWeight:700,
            }} />
            {uploadingAvatar && <div style={{ fontSize:11, color:C.accPale, fontWeight:800, marginTop:-8, marginBottom:10 }}>Memuat naik gambar...</div>}
            <label style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:5 }}>Pautan gambar sandaran</label>
            <input value={draftAvatar} onChange={(e) => setDraftAvatar(e.target.value)} placeholder="https://..." style={{
              width:'100%', boxSizing:'border-box', marginBottom:10,
              background:C.card, border:`1px solid ${C.border}`, color:C.text,
              borderRadius:10, padding:'10px 12px', fontFamily:'Nunito', fontWeight:700,
            }} />
            {profileError && <div style={{ fontSize:12, color:C.red, fontWeight:800, lineHeight:1.35, marginBottom:10 }}>{profileError}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <GlowButton outlined onClick={() => setEditing(false)} disabled={savingProfile || uploadingAvatar}>Batal</GlowButton>
              <GlowButton onClick={saveProfile} disabled={savingProfile || uploadingAvatar}>{savingProfile ? 'Menyimpan...' : 'Simpan'}</GlowButton>
            </div>
          </div>
        </div>
      )}
      <div style={{ height:8 }} />
    </div>
  );
};

// ─── SProgress ───────────────────────────────────────────────────────────────
const formatStudyTime = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
};

const subjectIconForProgress = (subject='') => {
  const key = (subject || '').toLowerCase().replace(/[^a-z]/g, '');
  const map = [
    ['math',      '📐'], ['matematik',  '📐'], ['mathematics','📐'],
    ['bio',       '🌿'], ['biology',    '🌿'], ['biologi',    '🌿'],
    ['physics',   '⚡'], ['fizik',      '⚡'],
    ['chem',      '🧪'], ['chemistry',  '🧪'], ['kimia',      '🧪'],
    ['history',   '📜'], ['sejarah',    '📜'], ['hist',       '📜'],
  ];
  for (const [alias, icon] of map) {
    if (key === alias || key.startsWith(alias) || alias.startsWith(key)) return icon;
  }
  return '📚';
};

const MASTERY_BANDS = [
  {
    min:0,
    max:49,
    label:'Perlu latihan',
    color:C.red,
    bg:'rgba(239,68,68,.10)',
    border:'rgba(239,68,68,.28)',
    meaning:'Asas topik belum stabil; ulang contoh dan latihan berpandu.',
  },
  {
    min:50,
    max:74,
    label:'Di landasan',
    color:C.gold,
    bg:'rgba(245,158,11,.10)',
    border:'rgba(245,158,11,.28)',
    meaning:'Faham kebanyakan idea utama; teruskan latihan untuk kurangkan silap.',
  },
  {
    min:75,
    max:100,
    label:'Kuat',
    color:C.green,
    bg:'rgba(34,197,94,.10)',
    border:'rgba(34,197,94,.28)',
    meaning:'Penguasaan kukuh; sesuai untuk cabaran atau topik seterusnya.',
  },
];

const masteryBandForScore = (score) => {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return MASTERY_BANDS.find(band => value >= band.min && value <= band.max) || MASTERY_BANDS[0];
};

const SProgress = () => {
  const isStudent = window.tusyenUser?.role === 'student';
  const phone = useNarrow(620);

  const dataState = useAsync(async () => {
    const uid = window.tusyenUser?.id;
    if (!uid || !isStudent) return { stats: null, progress: [] };
    const [statsData, progressData] = await Promise.all([
      window.tusyenApi.studentStats(uid),
      window.tusyenApi.studentProgress(uid),
    ]);
    return {
      stats: statsData || null,
      progress: (progressData?.progress || []),
    };
  }, [], { stats: null, progress: [] });

  if (!isStudent) {
    return <EmptyState icon="📊" title="Hanya untuk pelajar." />;
  }

  if (dataState.loading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16, width:'100%', minWidth:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} height={88} radius={14} />)}
        </div>
        <Skeleton height={18} radius={8} style={{ marginTop:8 }} />
        {[0,1,2].map(i => <Skeleton key={i} height={56} radius={12} />)}
        <Skeleton height={18} radius={8} style={{ marginTop:8 }} />
        {[0,1,2,3].map(i => <Skeleton key={i} height={72} radius={12} />)}
      </div>
    );
  }

  if (dataState.error) {
    return <ErrorRetry message="Data kemajuan tidak dapat dimuat." onRetry={dataState.refresh} />;
  }

  const { stats, progress } = dataState.data;
  const overall = stats?.overall || {};
  const streak = stats?.streak;
  const bySubject = Array.isArray(stats?.bySubject) ? stats.bySubject : [];

  const lessonsCompleted  = overall.lessons_completed ?? 0;
  const avgScore          = overall.average_score != null ? Math.round(overall.average_score) : null;
  const totalTime         = overall.total_time_seconds ?? 0;
  const streakCurrent     = (typeof streak === 'object' ? streak?.current : streak) ?? 0;

  const statCells = [
    { icon:'✅', value:String(lessonsCompleted),                          label:'Pelajaran Selesai' },
    { icon:'📊', value:avgScore != null ? `${avgScore}%` : '—',          label:'Purata skor'       },
    { icon:'⏱️', value:formatStudyTime(totalTime),                         label:'Masa Belajar'      },
    { icon:'🔥', value:`${streakCurrent}`,                                 label:'Streak (hari)'     },
  ];

  const sortedProgress = [...progress].sort(
    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  );
  const subjectRowsByScore = [...bySubject].sort((a, b) => (Number(a.avg_score) || 0) - (Number(b.avg_score) || 0));
  const focusSubject = subjectRowsByScore[0];
  const latestIncomplete = sortedProgress.find(row => !(Boolean(row.is_completed) || Number(row.completion_percentage) >= 100));
  const recommendation = focusSubject
    ? `Latih semula ${studentText(focusSubject.subject, 'subjek paling rendah', 36)} sebelum cuba tugasan baharu.`
    : latestIncomplete
      ? `Sambung ${studentTitle(latestIncomplete.lesson_title, 'pelajaran terakhir')} untuk lengkapkan rekod.`
      : 'Lengkapkan satu pelajaran untuk membina cadangan kemajuan.';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:640, width:'100%', minWidth:0, margin:'0 auto' }}>

      {/* Summary grid 2×2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {statCells.map((cell, i) => (
          <Card key={i} style={{ padding:12, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{cell.icon}</div>
            <div style={{ fontSize:20, fontWeight:900, color:C.accPale, lineHeight:1 }}>{cell.value}</div>
            <div style={{
              fontSize:10, color:C.textMuted, fontWeight:700,
              textTransform:'uppercase', letterSpacing:.5, marginTop:5,
            }}>{cell.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding:'12px 14px' }}>
        <div style={{ fontWeight:900, fontSize:13, color:C.text, marginBottom:4 }}>Bacaan kemajuan</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
          Bar subjek menunjukkan peratus topik yang siap. Purata skor datang daripada latihan yang sudah dihantar.
        </div>
        <div style={{
          display:'grid',
          gridTemplateColumns:phone ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
          gap:8,
          marginTop:10,
          minWidth:0,
        }}>
          {MASTERY_BANDS.map(band => (
            <div key={band.label} style={{
              minWidth:0, border:`1px solid ${band.border}`, background:band.bg,
              borderRadius:12, padding:10,
            }}>
              <div className="student-wrap-text" style={{ color:band.color, fontSize:12, fontWeight:900, lineHeight:1.2 }}>
                {band.label}
              </div>
              <div style={{ color:C.textFaint, fontSize:10, fontWeight:800, marginTop:2 }}>
                {band.min}-{band.max}%
              </div>
              <div className="student-wrap-text" style={{ color:C.textMuted, fontSize:11, fontWeight:700, lineHeight:1.35, marginTop:5 }}>
                {band.meaning}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:8, fontSize:12, color:C.accPale, fontWeight:900, lineHeight:1.4 }}>
          Cadangan: {recommendation}
        </div>
      </Card>

      {/* By subject */}
      <SectionLabel>Prestasi Subjek</SectionLabel>
      {bySubject.length ? bySubject.map((row, i) => {
        const avg  = Math.round(Number(row.avg_score) || 0);
        const comp = Math.max(0, Math.min(100, Math.round(Number(row.avg_completion) || 0)));
        const band = masteryBandForScore(avg);
        return (
          <Card key={i} style={{ padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:8, flexWrap:'wrap' }}>
              <div className="student-wrap-text" style={{ fontWeight:800, fontSize:13, color:C.text, minWidth:0, flex:'1 1 140px' }}>{studentText(row.subject, 'Subjek', 36)}</div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end', minWidth:0 }}>
                <span style={{
                  fontSize:11, fontWeight:900, color:band.color,
                  background: band.bg,
                  border:`1px solid ${band.border}`,
                  borderRadius:999, padding:'2px 9px',
                }}>{avg}%</span>
                <span className="student-wrap-text" style={{
                  fontSize:11, fontWeight:900, color:band.color,
                  background:band.bg, border:`1px solid ${band.border}`,
                  borderRadius:999, padding:'2px 9px',
                }}>{band.label}</span>
                <span style={{
                  fontSize:10, fontWeight:700, color:C.textFaint,
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:999, padding:'2px 8px',
                }}>{row.lessons_count ?? 0} pelajaran</span>
              </div>
            </div>
            <ProgressBar value={comp} height={6} />
            <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, marginTop:4 }}>
              Penguasaan {comp}% · Purata skor {avg}%
            </div>
            <div className="student-wrap-text" style={{ fontSize:11, color:C.textMuted, fontWeight:700, marginTop:5, lineHeight:1.35 }}>
              Maksud akademik: {band.meaning}
            </div>
          </Card>
        );
      }) : (
        <div style={{ fontSize:13, color:C.textMuted, fontWeight:700, padding:'10px 0' }}>
          Belum ada data subjek.
        </div>
      )}

      {/* Lesson record */}
      <SectionLabel>Rekod Pelajaran</SectionLabel>
      {sortedProgress.length ? sortedProgress.map((row) => {
        const score      = row.score != null ? Math.round(Number(row.score)) : null;
        const comp       = Math.max(0, Math.min(100, Math.round(Number(row.completion_percentage) || 0)));
        const isDone     = Boolean(row.is_completed) || comp >= 100;
        const scoreColor = score == null ? C.textFaint : score >= 60 ? C.green : C.red;
        const scoreBg    = score == null ? C.surface   : score >= 60 ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)';
        const scoreBd    = score == null ? C.border    : score >= 60 ? 'rgba(34,197,94,.28)' : 'rgba(239,68,68,.28)';
        return (
          <Card key={row.id} style={{ padding:'12px 14px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{
                width:40, height:40, borderRadius:12, flexShrink:0,
                background:C.surface, border:`1px solid ${C.border}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
              }}>{subjectIconForProgress(row.subject || row.topic || row.lesson_title)}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontWeight:800, fontSize:13, color:C.text,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>{studentTitle(row.lesson_title, 'Pelajaran')}</div>
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:6 }}>
                  {studentText(row.subject || row.topic, '', 48)}
                </div>
                <ProgressBar value={comp} height={5} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                {score != null && (
                  <span style={{
                    fontSize:11, fontWeight:900, color:scoreColor,
                    background:scoreBg, border:`1px solid ${scoreBd}`,
                    borderRadius:999, padding:'2px 9px',
                  }}>{score}%</span>
                )}
                <span style={{
                  fontSize:10, fontWeight:800,
                  color: isDone ? C.green : C.gold,
                  background: isDone ? 'rgba(34,197,94,.10)' : 'rgba(245,158,11,.10)',
                  border:`1px solid ${isDone ? 'rgba(34,197,94,.28)' : 'rgba(245,158,11,.28)'}`,
                  borderRadius:999, padding:'2px 8px',
                }}>{isDone ? 'Selesai' : 'Dalam Proses'}</span>
                {row.updated_at && (
                  <span style={{ fontSize:9, color:C.textFaint, fontWeight:600 }}>{timeAgo(row.updated_at)}</span>
                )}
              </div>
            </div>
          </Card>
        );
      }) : (
        <EmptyState icon="📝" title="Belum ada rekod pelajaran." />
      )}

      <div style={{ height:12 }} />
    </div>
  );
};

// ─── TeacherProfileModal ──────────────────────────────────────────────────────
const TeacherProfileModal = ({ teacherId, onClose }) => {
  const profileState = useAsync(async () => {
    if (!teacherId) return null;
    const { profile } = await window.tusyenApi.teacherProfile(teacherId);
    return profile || null;
  }, [teacherId], null);

  const p = profileState.data;

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, overflowY:'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth:520, margin:'40px auto 80px', background:C.bg,
          border:`1px solid ${C.border}`, borderRadius:20,
          padding:'24px 20px', position:'relative',
          boxShadow:'0 24px 80px rgba(0,0,0,.45)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position:'absolute', top:14, right:14,
            background:C.surface, border:`1px solid ${C.border}`,
            color:C.textMuted, borderRadius:10,
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:16, cursor:'pointer', fontWeight:900, fontFamily:'Nunito',
          }}
        >✕</button>

        {profileState.loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:8 }}>
              <Skeleton width={64} height={64} radius={32} />
              <div style={{ flex:1 }}>
                <Skeleton width="65%" height={18} radius={8} style={{ marginBottom:8 }} />
                <Skeleton width="45%" height={12} radius={6} />
              </div>
            </div>
            <Skeleton height={12} radius={6} />
            <Skeleton height={12} radius={6} />
            <Skeleton width="80%" height={12} radius={6} />
          </div>
        ) : !p ? (
          <EmptyState icon="👤" title="Profil guru tidak tersedia." />
        ) : (
          <>
            {/* Avatar + name */}
            <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:18 }}>
              <Avatar name={p.full_name} size={64} />
              <div>
                <div style={{ fontSize:20, fontWeight:900, color:C.text, letterSpacing:-.3 }}>{p.full_name}</div>
                {p.headline && (
                  <div style={{ fontSize:13, color:C.textMuted, fontWeight:600, marginTop:3 }}>{p.headline}</div>
                )}
                {p.location && (
                  <div style={{ fontSize:11, color:C.textFaint, fontWeight:600, marginTop:2 }}>📍 {p.location}</div>
                )}
              </div>
            </div>

            {/* Bio */}
            {p.bio && (
              <>
                <SectionLabel>Tentang</SectionLabel>
                <p style={{ fontSize:13, color:C.text, fontWeight:600, lineHeight:1.6, margin:'0 0 16px', whiteSpace:'pre-line' }}>
                  {p.bio}
                </p>
              </>
            )}

            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:18 }}>
              {[
                { v: p.classroom_count != null ? `${p.classroom_count}` : '—', l:'Kelas' },
                { v: p.student_count   != null ? `${p.student_count}`   : '—', l:'Pelajar' },
                { v: p.years_experience != null ? `${p.years_experience}` : '—', l:'Tahun Pengalaman' },
              ].map((s, i) => (
                <div key={i} style={{
                  background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:12, padding:'10px 8px', textAlign:'center',
                }}>
                  <div style={{ fontWeight:900, fontSize:18, color:C.accPale, lineHeight:1 }}>{s.v}</div>
                  <div style={{
                    fontSize:10, color:C.textMuted, fontWeight:700,
                    marginTop:4, textTransform:'uppercase', letterSpacing:.4,
                  }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Specialties */}
            {Array.isArray(p.specialties) && p.specialties.length > 0 && (
              <>
                <SectionLabel>Kepakaran</SectionLabel>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                  {p.specialties.map((sp, i) => (
                    <span key={i} style={{
                      background:C.accDim, border:`1px solid ${C.border}`,
                      color:C.accPale, borderRadius:99, padding:'3px 10px',
                      fontSize:11, fontWeight:700,
                    }}>{sp}</span>
                  ))}
                </div>
              </>
            )}

            {/* Credentials */}
            {p.credentials && (
              <>
                <SectionLabel>Kelayakan</SectionLabel>
                <p style={{
                  fontSize:12, color:C.textMuted, fontStyle:'italic',
                  fontWeight:600, lineHeight:1.55, margin:'0 0 8px',
                }}>
                  {p.credentials}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

window.TeacherProfileModal = TeacherProfileModal;

// ─── StudentApp ───────────────────────────────────────────────────────────────
const StudentApp = ({ sidebarExtraTop, sidebarExtraBottom }) => {
  const [screen,    setScreen]    = React.useState('home');
  const [showNotif, setShowNotif] = React.useState(false);
  const [selectedLesson, setSelectedLesson] = React.useState(null);
  const [activeSubject, setActiveSubject] = React.useState('math');
  const [postsClassId, setPostsClassId] = React.useState(null);
  const [returnScreen, setReturnScreen] = React.useState('home');
  const [lessonActive, setLessonActive] = React.useState(false);
  const [kuizActive, setKuizActive] = React.useState(false);
  const [whiteboardActive, setWhiteboardActive] = React.useState(false);
  const [pendingNav, setPendingNav] = React.useState(null);
  const profileKey = `tusyen_student_profile:${window.tusyenUser?.id || 'preview'}`;
  const [profileOverrides, setProfileOverrides] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(profileKey) || '{}') || {}; }
    catch { return {}; }
  });
  const notifSeenKey = `tusyen_student_notifs_seen:${window.tusyenUser?.id || 'preview'}`;
  const [seenNotifIds, setSeenNotifIds] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(notifSeenKey) || '[]')); }
    catch { return new Set(); }
  });
  const classState = useStudentClassInfo();
  const classInfo = classState.data;
  const statsState = useStudentStats();
  const notifState = useStudentNotifications(classInfo);
  const notifications = (notifState.data || []).map(item => ({
    ...item,
    unread: item.unread ?? !seenNotifIds.has(item.id),
  }));
  const unread = notifications.filter(n => n.unread).length;
  const baseDisplayName = studentName(window.tusyenUser?.fullName || window.tusyenUser?.full_name || window.tusyenUser?.email, 'Ahmad Hafiz');
  const displayName = studentName(profileOverrides.fullName || baseDisplayName, baseDisplayName);
  const avatarUrl = profileOverrides.avatarUrl || window.tusyenUser?.avatarUrl || '';

  const openLesson = (lesson, from='home') => {
    setSelectedLesson(lesson || null);
    setReturnScreen(from);
    setScreen('lesson');
  };
  const goLearn = (subjectId='math') => {
    setActiveSubject(subjectId);
    selectNav('learn');
  };
  const performNav = (id) => {
    if (screen === 'lesson' && id === 'lesson') return;
    if (id === 'lesson') {
      setReturnScreen(screen === 'lesson' ? returnScreen : screen);
      setSelectedLesson(null);
    }
    setScreen(id);
  };
  const goClassPosts = (classroomId) => {
    setPostsClassId(classroomId || null);
    performNav('posts');
  };
  const selectNav = (id) => {
    if (id === 'posts') setPostsClassId(null);
    const hasActiveSession = (screen === 'lesson' && lessonActive) || (screen === 'quiz' && kuizActive) || (screen === 'whiteboard' && whiteboardActive);
    if (hasActiveSession && id !== screen) {
      setPendingNav(id);
      return;
    }
    performNav(id);
  };
  const goScreen = React.useCallback((id) => {
    selectNav(id);
  }, [screen, lessonActive, kuizActive, returnScreen]);
  const confirmPendingNav = () => {
    const target = pendingNav || returnScreen || 'home';
    setPendingNav(null);
    setLessonActive(false);
    setKuizActive(false);
    setWhiteboardActive(false);
    performNav(target);
  };
  const saveProfile = async (patch) => {
    const next = { ...profileOverrides, ...patch };
    setProfileOverrides(next);
    localStorage.setItem(profileKey, JSON.stringify(next));
    if (window.tusyenUser) {
      window.tusyenUser = { ...window.tusyenUser, fullName:next.fullName || baseDisplayName, avatarUrl:next.avatarUrl || '' };
      try {
        const stored = JSON.parse(localStorage.getItem('tusyen_user') || '{}');
        localStorage.setItem('tusyen_user', JSON.stringify({ ...stored, fullName:window.tusyenUser.fullName, avatarUrl:window.tusyenUser.avatarUrl }));
      } catch {}
    }
    if (window.tusyenUser?.id && window.tusyenApi.updateCurrentUserProfile) {
      await window.tusyenApi.updateCurrentUserProfile({
        fullName:next.fullName || baseDisplayName,
        avatarUrl:next.avatarUrl || '',
      }).catch(() => undefined);
    }
  };
  const closeNotifications = () => {
    const next = new Set(seenNotifIds);
    notifications.forEach(item => item.id && next.add(item.id));
    setSeenNotifIds(next);
    localStorage.setItem(notifSeenKey, JSON.stringify([...next]));
    setShowNotif(false);
  };

  const nav = [
    { id:'home',       icon:'🏠', label:'Utama'      },
    { id:'learn',      icon:'🗺️', label:'Belajar'    },
    { id:'classrooms', icon:'🏫', label:'Kelas'      },
    { id:'posts',      icon:'📢', label:'Pos'        },
    { id:'progress',   icon:'📊', label:'Kemajuan'   },
    { id:'lesson',     icon:'📝', label:'Pelajaran'  },
    { id:'quiz',       icon:'🎮', label:'Kuiz'       },
    { id:'whiteboard', icon:'🖌️', label:'Papan Putih' },
    { id:'profile',    icon:'👤', label:'Profil'     },
  ];
  const navEnglish = {
    home:'Home',
    learn:'Learning',
    classrooms:'Classrooms',
    posts:'Posts',
    progress:'Progress',
    lesson:'Lesson',
    quiz:'Quiz',
    whiteboard:'Whiteboard',
    profile:'Profile',
  };
  const localizedNav = nav.map(item => ({ ...item, en: navEnglish[item.id] || item.en }));
  const mobileNav = localizedNav.filter(item => item.id !== 'lesson' && item.id !== 'profile');

  const activeSubjectName = SUBJECTS.find(s => s.id === activeSubject)?.name || 'Belajar';
  const screenMeta = {
    home:       { title:'Utama' },
    learn:      { title:activeSubjectName },
    classrooms: { title:'Kelas' },
    posts:      { title:'Pos' },
    progress:   { title:'Kemajuan' },
    lesson:     { title:selectedLesson?.title || 'Pelajaran' },
    quiz:       { title:'Kuiz' },
    whiteboard: { title:'Papan Putih' },
    profile:    { title:'Profil' },
  };
  const meta = screenMeta[screen] || screenMeta.home;
  useScreenFocus(screen);

  const focusMode = (screen === 'lesson' && lessonActive) || (screen === 'quiz' && kuizActive) || (screen === 'whiteboard' && whiteboardActive);

  return (
    <div className={`app-shell student-shell student-mobile-nav${focusMode ? ' student-focus-mode' : ''}`}>
      <StudentScopedStyles />
      {/* Desktop sidebar */}
      <AppSidebar
        navItems={localizedNav}
        active={screen}
        onNav={selectNav}
        user={window.tusyenUser}
        stats={statsState.data}
        onSignOut={() => window.tusyenSignOut?.()}
        extraTop={sidebarExtraTop}
        extraBottom={sidebarExtraBottom}
      />

      {/* Kawasan utama */}
      <main id="main-content" className="main-area" tabIndex="-1" aria-label={meta.title}>
        {/* Mobile top bar */}
        <TopBarMobile
          title={meta.title}
          subtitle={meta.subtitle}
          right={
            <>
              {screen === 'home' && <NotifBell count={unread} onClick={() => setShowNotif(true)} />}
              <button
                onClick={() => selectNav('profile')}
                aria-label="Buka profil"
                style={{
                  minWidth:44, minHeight:44, border:'none', background:'transparent',
                  padding:0, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer',
                }}
              >
                <Avatar name={displayName} size={32} />
              </button>
            </>
          }
        />

        {/* API / data mode banner */}
        <div className="student-data-banner">
          <DataModeBanner role="student" />
        </div>

        {/* Scrollable content */}
        <div className="main-content" key={screen} style={{ animation:'slideIn .2s ease' }}>
          <h1 className="sr-only">{meta.title}</h1>
          {screen === 'home'       && <SHome goLearn={goLearn} openLesson={openLesson} goClassrooms={() => selectNav('classrooms')} displayName={displayName} avatarUrl={avatarUrl} classInfo={classInfo} />}
          {screen === 'learn'      && <SLearn activeSubject={activeSubject} setActiveSubject={setActiveSubject} openLesson={openLesson} classInfo={classInfo} goProgress={() => selectNav('progress')} />}
          {screen === 'classrooms' && <SClassrooms classInfo={classInfo} onClassJoined={classState.refresh} onViewPosts={goClassPosts} />}
          {screen === 'posts'      && <SFeed classInfo={classInfo} initialClassId={postsClassId} />}
          {screen === 'progress'   && <SProgress />}
          {screen === 'lesson'     && <SLessonLive go={goScreen} selectedLesson={selectedLesson} returnScreen={returnScreen} onActiveChange={setLessonActive} />}
          {screen === 'quiz'       && <SKuizJoin user={window.tusyenUser} onActiveChange={setKuizActive} />}
          {screen === 'whiteboard' && <SWhiteboardJoin classInfo={classInfo} onActiveChange={setWhiteboardActive} />}
          {screen === 'profile'    && <SProfile displayName={displayName} avatarUrl={avatarUrl} classInfo={classInfo} onProfileSave={saveProfile} onClassJoined={classState.refresh} />}
        </div>

        {/* Mobile bottom nav */}
        <BottomNavMobile items={mobileNav} active={screen} onNav={selectNav} />
      </main>

      {showNotif && (
        <NotifPanel notifs={notifications} onClose={closeNotifications} />
      )}
      <StudentConfirmModal
        open={Boolean(pendingNav)}
        danger
        title={screen === 'quiz' ? 'Tinggalkan kuiz?' : screen === 'whiteboard' ? 'Tinggalkan papan putih?' : 'Tinggalkan pelajaran?'}
        message={screen === 'quiz'
          ? 'Jawapan kuiz yang belum dihantar mungkin hilang jika kamu keluar sekarang.'
          : screen === 'whiteboard'
            ? 'Lakaran yang belum dihantar mungkin hilang jika kamu keluar sekarang.'
          : 'Jawapan pelajaran yang belum dihantar mungkin hilang jika kamu keluar sekarang.'}
        confirmLabel="Tinggalkan"
        cancelLabel="Kekal"
        onConfirm={confirmPendingNav}
        onCancel={() => setPendingNav(null)}
      />
    </div>
  );
};

window.StudentApp = StudentApp;
