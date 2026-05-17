// Tusyen — Parent Role UI v2
// Parent dashboard uses linked-child data, progress rows, and local parent preferences.

const SUBJECT_COLORS = {
  matematik:'#8B5CF6',
  mathematics:'#8B5CF6',
  biologi:'#22C55E',
  biology:'#22C55E',
  fizik:'#38BDF8',
  physics:'#38BDF8',
  kimia:'#F59E0B',
  chemistry:'#F59E0B',
  sejarah:'#EF4444',
  science:'#22C55E',
  english:'#38BDF8',
};

const FALLBACK_CHILD = {
  id:'demo-child',
  name:'Ahmad Hafiz',
  form:4,
  cls:'4A',
  streak:7,
  xp:2450,
  weekTimeSeconds:31320,
  rank:4,
  avg:78,
  hasProgressData:true,
  hasWeekData:true,
  totalLessons:14,
  subjects:[
    { name:'Matematik', score:78, hasData:true, color:'#8B5CF6', trend:'↑' },
    { name:'Biologi',   score:65, hasData:true, color:'#22C55E', trend:'↑' },
    { name:'Fizik',     score:42, hasData:true, color:'#38BDF8', trend:'↓' },
    { name:'Kimia',     score:55, hasData:true, color:'#F59E0B', trend:'→' },
    { name:'Sejarah',   score:72, hasData:true, color:'#EF4444', trend:'↑' },
  ],
  progress:[
    { id:'demo-progress-1', lesson_id:'demo-math-1', subject:'Matematik', lesson_title:'Matematik Bab 3', score:72, completion_percentage:100, is_completed:true, time_spent_seconds:2400, updated_at:new Date(Date.now() - 6 * 86400000).toISOString() },
    { id:'demo-progress-2', lesson_id:'demo-bio-1', subject:'Biologi', lesson_title:'Kuiz Biologi', score:90, completion_percentage:100, is_completed:true, time_spent_seconds:1800, updated_at:new Date(Date.now() - 5 * 86400000).toISOString() },
    { id:'demo-progress-3', lesson_id:'demo-physics-1', subject:'Fizik', lesson_title:'Fizik Bab 5', score:42, completion_percentage:60, is_completed:false, time_spent_seconds:2100, updated_at:new Date(Date.now() - 3 * 86400000).toISOString() },
    { id:'demo-progress-4', lesson_id:'demo-chem-1', subject:'Kimia', lesson_title:'Kimia Latihan', score:55, completion_percentage:80, is_completed:false, time_spent_seconds:1500, updated_at:new Date(Date.now() - 2 * 86400000).toISOString() },
    { id:'demo-progress-5', lesson_id:'demo-history-1', subject:'Sejarah', lesson_title:'Sejarah Bab 2', score:72, completion_percentage:100, is_completed:true, time_spent_seconds:1920, updated_at:new Date(Date.now() - 1 * 86400000).toISOString() },
  ],
  classrooms:[],
  activity:[
    { icon:'✅', label:'Selesai pelajaran Matematik Bab 3', time:'2j lepas' },
    { icon:'🎯', label:'Skor 90% dalam kuiz Biologi', time:'5j lepas' },
    { icon:'🔥', label:'Streak 7 hari! Bonus XP diterima', time:'1 hari lepas' },
    { icon:'📝', label:'Mula bab baru: Fizik Bab 5', time:'2 hari lepas' },
  ],
};

const EMPTY_CHILD_FALLBACK = {
  ...FALLBACK_CHILD,
  streak:0,
  xp:0,
  weekTimeSeconds:0,
  totalTimeSeconds:0,
  rank:null,
  avg:0,
  hasProgressData:false,
  hasWeekData:false,
  totalLessons:0,
  subjects:[],
  progress:[],
  classrooms:[],
  activity:[],
};

const DEFAULT_PARENT_PREFS = {
  lowScore:true,
  inactivity:true,
  assignments:true,
  streaks:false,
  notificationFrequency:'daily',
  preferredName:'',
  language:'ms',
};

const DEMO_ALERTS = [
  {
    childId:'demo-child',
    icon:'🔴',
    title:'Prestasi Fizik Merosot',
    desc:'Purata turun dari 58% ke 42% dalam 2 minggu. Disarankan jumpa guru.',
    severity:'high',
    time:'Hari ini',
    action:'Tandai untuk tindak lanjut',
  },
  {
    childId:'demo-child',
    icon:'🟡',
    title:'Kehadiran Log Masuk Rendah',
    desc:'Ahmad hanya log masuk 2 kali minggu lepas. Galakkan belajar harian.',
    severity:'medium',
    time:'3 hari lepas',
    action:'Semak Kemajuan',
  },
  {
    childId:'demo-child',
    icon:'🟢',
    title:'Streak Tujuh Hari!',
    desc:'Ahmad berjaya mengekalkan streak 7 hari berturut-turut. Tahniah!',
    severity:'good',
    time:'Semalam',
    action:null,
  },
];

const currentUser = () => window.tusyenUser || window.tusyenApi.restoreSession()?.user || null;

const readLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage may be unavailable in private contexts; the UI can still work in memory.
  }
};

const readParentPrefs = () => ({ ...DEFAULT_PARENT_PREFS, ...readLocal('tusyen_parent_prefs', {}) });

const subjectColor = (subject) => SUBJECT_COLORS[`${subject || ''}`.toLowerCase()] || C.acc;

const cleanName = (value) => `${value || ''}`.trim();
const parentText = (value, fallback = 'Item', max = 80) =>
  window.cleanUiText ? window.cleanUiText(value, { fallback, max }) : `${value || fallback}`;
const parentName = (value, fallback = 'Pengguna') =>
  window.cleanUiName ? window.cleanUiName(value, fallback) : parentText(value, fallback, 42);
const parentTitle = (value, fallback = 'Tanpa tajuk') =>
  window.cleanUiTitle ? window.cleanUiTitle(value, fallback) : parentText(value, fallback, 68);
const parentBodyText = (value, fallback = '', max = 180) =>
  window.cleanUiText ? window.cleanUiText(value, { fallback, max, preserveCase:true }) : `${value || fallback}`;
const parentEmailText = (value, fallback = 'Akaun ibu bapa') => {
  const text = `${value || ''}`.trim();
  if (!text) return fallback;
  if (/(?:qaqc|qa|test|demo|playwright|automation|abcdef|\d{8,})/i.test(text)) return fallback;
  return text;
};

const TEACHER_QUESTION_LABEL = 'Simpan soalan untuk guru';
const TEACHER_FOLLOWUP_CONFIRMATION = 'Soalan untuk guru disimpan pada peranti ini. Gunakan saluran rasmi kelas atau sekolah untuk menghantar soalan; aplikasi tidak menghantar mesej automatik.';

const parentStatusIsSuccess = (status) =>
  /berjaya|dipaut|dikeluarkan|dikemas kini/i.test(`${status || ''}`);

const parentActionLabel = (label) => {
  const text = `${label || ''}`.trim();
  if (!text) return '';
  if (/hubungi\s+guru|contact\s+teacher/i.test(text)) return TEACHER_QUESTION_LABEL;
  if (/nota\s+hubungi\s+guru/i.test(text)) return TEACHER_QUESTION_LABEL;
  return text;
};

const validateChildIdentifier = (value) => {
  const id = `${value || ''}`.trim();
  if (!id) return 'Masukkan ID Tusyen pelajar atau e-mel akaun pelajar.';
  if (id.length < 4) return 'ID atau e-mel terlalu pendek. Semak semula profil anak.';
  if (id.length > 120) return 'ID atau e-mel terlalu panjang. Semak semula profil anak.';
  if (/\s/.test(id)) return 'ID atau e-mel tidak boleh mengandungi ruang.';
  if (/^(?:kelas|class|kod|code)[-_\s]*/i.test(id) || /^[0-9][A-Za-z]$/i.test(id)) {
    return 'Gunakan ID Tusyen pelajar atau e-mel akaun pelajar, bukan kod kelas guru.';
  }
  if (id.includes('@')) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    if (!emailOk) return 'Format e-mel pelajar tidak sah.';
  } else if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    return 'ID pelajar hanya boleh mengandungi huruf, nombor, titik, sengkang, atau garis bawah.';
  }
  return '';
};

const parentLinkErrorMessage = (err, fallback = 'Tidak dapat memaut anak.') => {
  const raw = `${err?.code || ''} ${err?.message || err?.error || err || ''}`.toLowerCase();
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout')) {
    return 'Sambungan terganggu. Semak internet dan cuba lagi.';
  }
  if (raw.includes('unauthor') || raw.includes('forbidden') || raw.includes('session')) {
    return 'Sesi akaun tamat atau tidak dibenarkan. Log masuk semula dan cuba lagi.';
  }
  if (raw.includes('not found') || raw.includes('404') || raw.includes('tiada') || raw.includes('not exist')) {
    return 'Akaun pelajar tidak ditemui. Semak ID Tusyen atau e-mel daripada profil anak.';
  }
  if (raw.includes('already') || raw.includes('duplicate') || raw.includes('sudah')) {
    return 'Anak ini sudah dipaut pada akaun ibu bapa.';
  }
  if (raw.includes('class') || raw.includes('kelas') || raw.includes('code') || raw.includes('kod')) {
    return 'Kod kelas guru tidak boleh digunakan. Masukkan ID Tusyen pelajar atau e-mel akaun pelajar.';
  }
  const message = parentBodyText(err?.message || err?.error, '', 140);
  return message || fallback;
};

const firstName = (value) => cleanName(value).split(/\s+/).filter(Boolean)[0] || '';

const emailLocalName = (email) => firstName(`${email || ''}`.split('@')[0]?.replace(/[._-]+/g, ' '));

const parentPreferredName = (user = currentUser(), prefs = readParentPrefs()) => {
  return parentName(cleanName(prefs.preferredName), '')
    || parentName(cleanName(user?.preferredName || user?.preferred_name || user?.givenName || user?.given_name), '')
    || parentName(firstName(user?.fullName || user?.full_name), '')
    || emailLocalName(user?.email)
    || 'Ibu Bapa';
};

const parentGreetingName = (user = currentUser(), prefs = readParentPrefs()) => {
  const salutation = cleanName(user?.salutation || user?.title || prefs.salutation);
  const name = parentPreferredName(user, prefs);
  return salutation ? `${salutation} ${name}` : name;
};

const scoreValue = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const average = (values) => {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
};

const formatDateShort = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('ms-MY', { day:'numeric', month:'short' });
};

const currentWeekRangeLabel = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
};

const formatScore = (value, hasData = true) => {
  const score = scoreValue(value);
  return hasData && score !== null ? `${score}%` : '—';
};

const formatStudyTime = (seconds = 0) => {
  const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}j`;
  return `${hours}j ${minutes}m`;
};

const isWithinDays = (dateValue, days) => {
  const time = new Date(dateValue || 0).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
};

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const postIcon = (type) => {
  switch ((type || '').toLowerCase()) {
    case 'assignment':   return '📋';
    case 'announcement': return '📢';
    case 'general':      return '💬';
    default:             return '✅';
  }
};

const subjectTrend = (rows, fallbackScore) => {
  const sorted = [...rows]
    .filter(row => scoreValue(row.score) !== null)
    .sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0));
  if (sorted.length < 2) return scoreValue(fallbackScore) >= 60 ? '→' : '↓';

  const latest = scoreValue(sorted[sorted.length - 1].score) ?? 0;
  const prev = scoreValue(sorted[sorted.length - 2].score) ?? latest;
  if (latest - prev > 1) return '↑';
  if (prev - latest > 1) return '↓';
  return '→';
};

const buildSubjectRows = (stats, progressRows, fallbackSubjects = []) => {
  const bySubject = Array.isArray(stats?.bySubject) ? stats.bySubject : [];
  const names = uniqueBy([
    ...bySubject.map(row => ({ name: row.subject })),
    ...progressRows.map(row => ({ name: row.subject })),
    ...fallbackSubjects.map(row => ({ name: row.name })),
  ].filter(item => item.name), item => `${item.name}`.toLowerCase());

  return names.map(({ name }) => {
    const statsRow = bySubject.find(row => `${row.subject}`.toLowerCase() === `${name}`.toLowerCase());
    const rows = progressRows.filter(row => `${row.subject}`.toLowerCase() === `${name}`.toLowerCase());
    const fallback = fallbackSubjects.find(row => `${row.name}`.toLowerCase() === `${name}`.toLowerCase());
    const score = scoreValue(statsRow?.avg_score) ?? average(rows.map(row => row.score)) ?? scoreValue(fallback?.score);
    const hasData = score !== null;

    return {
      name: parentText(name, 'Subjek', 36),
      score,
      hasData,
      color: fallback?.color || subjectColor(name),
      trend: hasData ? subjectTrend(rows, score) : '→',
      lessons: Number(statsRow?.lessons_count || rows.length || 0),
      completion: scoreValue(statsRow?.avg_completion),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
};

const buildActivity = (progressRows, fallbackActivity = []) => {
  const items = [...progressRows]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 5)
    .map(row => {
      const score = scoreValue(row.score);
      const title = parentTitle(row.lesson_title || row.topic || row.subject, 'Pelajaran');
      const done = row.is_completed || Number(row.completion_percentage || 0) >= 100;
      return {
        icon: done ? '✅' : '📘',
        label: `${done ? 'Selesai' : 'Kemajuan'} ${title}${score !== null ? ` (${score}%)` : ''}`,
        time: window.timeAgo(row.updated_at),
      };
    });

  return items.length ? items : fallbackActivity;
};

const buildChild = ({ student, stats, progressRows, classrooms, rank, fallback }) => {
  const subjects = buildSubjectRows(stats, progressRows, fallback.subjects);
  const overall = stats?.overall || {};
  const overallScore = scoreValue(overall.average_score);
  const subjectAvg = average(subjects.filter(s => s.hasData).map(s => s.score));
  const progressScores = progressRows.map(row => scoreValue(row.score)).filter(value => value !== null);
  const progressTime = Number(overall.total_time_seconds || 0);
  const completedLessons = Number(overall.lessons_completed || overall.total_lessons_attempted || 0);
  const hasProgressData = overallScore !== null
    || subjectAvg !== null
    || progressScores.length > 0
    || completedLessons > 0
    || progressTime > 0;
  const avg = hasProgressData ? (overallScore ?? subjectAvg ?? scoreValue(fallback.avg)) : null;
  const childClasses = classrooms.filter(cls =>
    cls.student_id === student.id ||
    (!cls.student_id && cls.student_name === student.full_name)
  );
  const firstClass = childClasses[0];
  const weekRows = progressRows.filter(row => isWithinDays(row.updated_at, 7));

  return {
    ...fallback,
    id: student.id,
    name: parentName(student.full_name, fallback.name),
    form: Number(firstClass?.form_level || student.form_level || fallback.form || 4),
    cls: childClasses.length > 1 ? `${childClasses.length} kelas` : parentText(firstClass?.name, fallback.cls || 'Belum kelas', 54),
    streak: Number(stats?.streak?.current ?? stats?.streak ?? fallback.streak ?? 0),
    xp: Number(stats?.quiz?.quizXpTotal || fallback.xp || 0),
    avg,
    hasProgressData,
    hasWeekData: weekRows.length > 0,
    totalLessons: Number(completedLessons || subjects.reduce((sum, s) => sum + (s.lessons || 0), 0)),
    totalTimeSeconds: progressTime,
    weekTimeSeconds: weekRows.length ? sumTime(weekRows) : null,
    rank,
    subjects,
    progress: progressRows,
    classrooms: childClasses,
    activity: buildActivity(progressRows, fallback.activity),
  };
};

const sumTime = (rows) => rows.reduce((sum, row) => sum + Number(row.time_spent_seconds || 0), 0);

const periodMetrics = (child, period) => {
  const days = period === 'month' ? 30 : 7;
  const rows = (child?.progress || []).filter(row => isWithinDays(row.updated_at, days));
  const avg = average(rows.map(row => row.score));
  const hasActivity = rows.length > 0;
  return {
    timeSeconds: sumTime(rows),
    lessons: new Set(rows.map(row => row.lesson_id || row.id)).size || 0,
    avg,
    hasActivity,
    hasScore: avg !== null,
    rank: child?.rank ?? null,
  };
};

const buildHistory = (child, subject, period) => {
  const rows = (child?.progress || [])
    .filter(row => `${row.subject}`.toLowerCase() === `${subject.name}`.toLowerCase())
    .filter(row => scoreValue(row.score) !== null);

  if (period === 'month') {
    const labels = ['M1','M2','M3','M4'];
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 27);
    start.setHours(0, 0, 0, 0);

    const buckets = [[], [], [], []];
    rows.forEach(row => {
      const time = new Date(row.updated_at || 0).getTime();
      if (!Number.isFinite(time) || time < start.getTime()) return;
      const days = Math.floor((time - start.getTime()) / (24 * 60 * 60 * 1000));
      const index = Math.min(3, Math.max(0, Math.floor(days / 7)));
      buckets[index].push(scoreValue(row.score));
    });

    return {
      labels,
      scores: buckets.map(bucket => average(bucket)),
      hasData: buckets.some(bucket => bucket.length > 0),
    };
  }

  const dayLabels = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
  const labels = [];
  const buckets = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    day.setHours(0, 0, 0, 0);
    labels.push(dayLabels[day.getDay()]);
    buckets.push({ start: day.getTime(), values: [] });
  }

  rows.forEach(row => {
    const time = new Date(row.updated_at || 0).getTime();
    if (!Number.isFinite(time)) return;
    const bucket = buckets.find(item => time >= item.start && time < item.start + 24 * 60 * 60 * 1000);
    if (bucket) bucket.values.push(scoreValue(row.score));
  });

  return {
    labels,
    scores: buckets.map(bucket => average(bucket.values)),
    hasData: buckets.some(bucket => bucket.values.length > 0),
  };
};

const loadRank = async (childId, classrooms) => {
  for (const classroom of classrooms.slice(0, 3)) {
    try {
      const data = await window.tusyenApi.classroomLeaderboard(classroom.id);
      const match = (data.leaderboard || []).find(row => row.student_id === childId);
      if (match?.rank) return Number(match.rank);
    } catch {
      // Parents may still see progress when a leaderboard endpoint is temporarily unavailable.
    }
  }
  return null;
};

const useParentChildren = () => {
  const initial = currentUser()?.role === 'parent' ? { children:[] } : { children:[FALLBACK_CHILD] };
  return useAsync(async () => {
    const user = currentUser();
    if (user?.role !== 'parent') return { children:[FALLBACK_CHILD] };

    const [{ students }, classroomData] = await Promise.all([
      window.tusyenApi.linkedStudents(),
      window.tusyenApi.classrooms().catch(() => ({ classrooms:[] })),
    ]);
    const linked = students || [];
    const classrooms = classroomData.classrooms || [];

    if (!linked.length) return { children:[] };

    const children = await Promise.all(linked.map(async (student) => {
      const childClassrooms = classrooms.filter(cls =>
        cls.student_id === student.id ||
        (!cls.student_id && cls.student_name === student.full_name)
      );
      const [stats, progressData, rank] = await Promise.all([
        window.tusyenApi.studentStats(student.id).catch(() => null),
        window.tusyenApi.studentProgress(student.id).catch(() => ({ progress:[] })),
        loadRank(student.id, childClassrooms),
      ]);

      return buildChild({
        student,
        stats,
        progressRows: progressData.progress || [],
        classrooms,
        rank,
        fallback: EMPTY_CHILD_FALLBACK,
      });
    }));

    return { children };
  }, [], initial);
};

const useParentAnnouncements = (child) => {
  return useAsync(async () => {
    const user = currentUser();
    if (user?.role !== 'parent') return [];

    const classIds = new Set((child?.classrooms || []).map(cls => cls.id));
    const { posts } = await window.tusyenApi.feedPosts({ limit: 8 });
    return (posts || [])
      .filter(post => classIds.size === 0 || classIds.has(post.classroom_id))
      .slice(0, 5)
      .map(post => ({
        icon: postIcon(post.post_type),
        label: parentTitle(post.title || post.content?.slice(0, 80), 'Pengumuman baharu di kelas'),
        time: window.timeAgo(post.created_at),
        meta: parentText(post.classroom_name || post.post_type, '', 54),
      }));
  }, [child?.id], []);
};

const alertChildId = (alert) => alert?.childId || alert?.child_id || alert?.studentId || alert?.student_id || '';

const useParentAlerts = (childId) => {
  return useAsync(async () => {
    const user = currentUser();
    if (user?.role !== 'parent') return DEMO_ALERTS;
    const { alerts } = await window.tusyenApi.parentAlerts();
    const items = Array.isArray(alerts) ? alerts : [];
    return childId ? items.filter(alert => !alertChildId(alert) || alertChildId(alert) === childId) : items;
  }, [childId], currentUser()?.role === 'parent' ? [] : DEMO_ALERTS);
};

const ChildSwitcher = ({ childOptions, selectedId, onSelect }) => {
  if (!childOptions || childOptions.length <= 1) return null;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', marginBottom:7 }}>
        <div style={{ fontSize:11, color:C.textMuted, fontWeight:900, textTransform:'uppercase', letterSpacing:0.6 }}>Pilih anak</div>
        <div style={{ fontSize:10, color:C.textFaint, fontWeight:700 }}>Geser untuk tukar anak</div>
      </div>
      <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:3, maxWidth:'100%' }}>
        {childOptions.map(child => {
          const on = child.id === selectedId;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onSelect(child.id)}
              aria-pressed={on}
              style={{
                minHeight:52,
                maxWidth:190,
                display:'flex', alignItems:'center', gap:8, flex:'0 0 auto',
                background:on ? C.accDim : C.card,
                border:`1.5px solid ${on ? C.borderB : C.border}`,
                borderRadius:14, padding:'8px 10px',
                color:on ? C.accPale : C.textMuted,
                cursor:'pointer', fontFamily:'Nunito',
                boxShadow:on ? `0 0 12px ${C.accGlow}` : 'none',
              }}
            >
              <Avatar name={child.name} size={28} />
              <div style={{ textAlign:'left', minWidth:0 }}>
                <div style={{ fontWeight:900, fontSize:12, color:on ? C.accPale : C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{child.name}</div>
                <div style={{ fontSize:11, fontWeight:700, color:on ? C.accPale : C.textFaint }}>{on ? 'Sedang dilihat' : `Tingkatan ${child.form}`}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const NoLinkedChild = ({ onOpenSettings, childState, errorMessage = 'Tidak dapat memuat anak terpaut.' }) => (
  <div style={{ padding:'14px 16px 10px' }}>
    {childState?.error && (
      <div style={{ marginBottom:14 }}>
        <ErrorRetry message={childState.error.message || errorMessage} onRetry={childState.refresh} />
      </div>
    )}
    <EmptyState icon="👪" title="Tiada anak dipaut" subtitle="Tambah ID Tusyen pelajar atau e-mel akaun pelajar di Tetapan untuk mula memantau kemajuan." />
    <div style={{ padding:'0 18px 10px', fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45, textAlign:'center' }}>
      Pautan ini hanya memaparkan kelas, pos, amaran, dan kemajuan anak yang dipaut.
    </div>
    <div style={{ padding:'0 18px 18px' }}>
      <GlowButton onClick={onOpenSettings}>Buka Tetapan</GlowButton>
    </div>
  </div>
);

const TimelineList = ({ loading, items, emptyText, style }) => (
  <Card style={{ marginBottom:14, ...style }}>
    {loading ? [0,1,2,3].map(i => (
      <div key={i} style={{
        display:'flex', gap:10, padding:'8px 0',
        borderBottom: i < 3 ? `1px solid ${C.border}` : 'none',
        alignItems:'flex-start',
      }}>
        <Skeleton width={18} height={18} radius={6} />
        <div style={{ flex:1 }}>
          <Skeleton width={i === 1 ? '72%' : '88%'} height={12} radius={6} style={{ marginBottom:6 }} />
          <Skeleton width={54} height={10} radius={5} />
        </div>
      </div>
    )) : items.length ? items.map((a,i) => (
      <div key={`${a.label}-${i}`} style={{
        display:'flex', gap:10, padding:'8px 0',
        borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
        alignItems:'flex-start',
      }}>
        <span style={{ fontSize:17, flexShrink:0, marginTop:1 }}>{a.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:12, color:C.text, lineHeight:1.4 }}>{a.label}</div>
          <div style={{ fontSize:10, color:C.textFaint, marginTop:2 }}>
            {[a.time, a.meta].filter(Boolean).join(' • ')}
          </div>
        </div>
      </div>
    )) : (
      <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5 }}>{emptyText}</div>
    )}
  </Card>
);

const ParentMobileNavStyles = () => (
  <style>{`
    .parent-mobile-nav-shell .sidebar-user > div:nth-child(2),
    .parent-mobile-nav-shell .sidebar-bottom > .sidebar-stats {
      display: none !important;
    }
    @media (max-width: 600px) {
      .parent-mobile-nav-shell .sidebar-wrap {
        display: none !important;
        width: 0 !important;
      }
      .parent-mobile-nav-shell .top-bar-mobile {
        display: flex !important;
      }
      .parent-mobile-nav-shell .bottom-nav-wrap {
        display: block !important;
        flex-shrink: 0;
      }
      .parent-mobile-nav-shell .bottom-nav-wrap > div {
        justify-content: space-between !important;
        padding-left: 2px;
        padding-right: 2px;
      }
      .parent-mobile-nav-shell .bottom-nav-wrap button {
        flex: 1 1 0;
        min-width: 0;
        min-height: 58px;
        padding: 6px 2px 16px !important;
      }
      .parent-mobile-nav-shell .main-content {
        padding-bottom: env(safe-area-inset-bottom);
        overflow-x: hidden;
      }
      .parent-mobile-nav-shell .main-area,
      .parent-mobile-nav-shell .main-content {
        min-width: 0;
        max-width: 100%;
      }
      .parent-mobile-nav-shell button,
      .parent-mobile-nav-shell input,
      .parent-mobile-nav-shell select,
      .parent-mobile-nav-shell textarea {
        min-height: 44px;
      }
      .parent-mobile-nav-shell .action-menu {
        flex: 0 0 auto;
      }
      .parent-mobile-nav-shell .action-menu-trigger {
        min-width: 44px;
        min-height: 44px;
      }
      .parent-mobile-nav-shell .parent-alert-card {
        max-width: 100%;
        overflow: hidden;
      }
      .parent-mobile-dialog button,
      .parent-mobile-dialog input {
        min-height: 44px;
      }
    }
    @media (max-width: 420px) {
      .parent-mobile-nav-shell .parent-alert-card {
        padding: 12px !important;
      }
    }
  `}</style>
);

const ParentConfirmModal = ({
  title,
  children,
  confirmLabel = 'Sahkan',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  danger,
  busy,
}) => {
  const SharedConfirm = window.ConfirmDialog;
  if (SharedConfirm && SharedConfirm !== ParentConfirmModal) {
    return (
      <SharedConfirm
        open
        title={title}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={danger}
        busy={busy}
        onCancel={onCancel}
        onConfirm={onConfirm}
      >
        {children}
      </SharedConfirm>
    );
  }

  return (
    <div
      role="presentation"
      onClick={() => !busy && onCancel?.()}
      className="parent-mobile-dialog"
      style={{
        position:'fixed', inset:0, zIndex:520,
        background:'rgba(2,6,23,.68)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-confirm-title"
        onClick={e => e.stopPropagation()}
        className="tv2-pop"
        style={{
          width:'100%', maxWidth:420,
          background:C.bg,
          border:`1px solid ${danger ? 'rgba(239,68,68,.45)' : C.borderB}`,
          borderRadius:16, padding:16,
          boxShadow:'0 24px 70px rgba(0,0,0,.42)',
        }}
      >
        <div id="parent-confirm-title" style={{ fontSize:16, color:danger ? C.red : C.text, fontWeight:900, marginBottom:8 }}>
          {title}
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:650, lineHeight:1.5, marginBottom:14 }}>
          {children}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, flexWrap:'wrap' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{
            background:'transparent', border:`1px solid ${C.border}`,
            borderRadius:10, padding:'9px 13px',
            color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
            cursor:busy ? 'not-allowed' : 'pointer',
          }}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={busy} style={{
            background:danger ? 'rgba(239,68,68,.14)' : C.accDim,
            border:`1px solid ${danger ? 'rgba(239,68,68,.45)' : C.borderB}`,
            borderRadius:10, padding:'9px 13px',
            color:danger ? C.red : C.accPale,
            fontFamily:'Nunito', fontWeight:900,
            cursor:busy ? 'not-allowed' : 'pointer',
            opacity:busy ? 0.65 : 1,
          }}>{busy ? 'Memproses...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const GuidedAddChildModal = ({ open, busy, status, onSubmit, onClose }) => {
  const [identifier, setIdentifier] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  React.useEffect(() => {
    if (open) {
      setIdentifier('');
      setConsent(false);
      setErrors({});
    }
  }, [open]);
  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const value = identifier.trim();
    const identifierError = validateChildIdentifier(value);
    const consentError = consent ? '' : 'Sahkan persetujuan anak sebelum memaut akaun.';
    const nextErrors = {
      ...(identifierError ? { identifier:identifierError } : {}),
      ...(consentError ? { consent:consentError } : {}),
    };
    setErrors(nextErrors);
    if (!identifierError && !consentError) onSubmit(value);
  };

  const identifierHintId = 'parent-add-child-identifier-hint';
  const identifierErrorId = 'parent-add-child-identifier-error';
  const consentHintId = 'parent-add-child-consent-hint';
  const consentErrorId = 'parent-add-child-consent-error';
  const statusId = 'parent-add-child-status';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-add-child-title"
      onClick={() => !busy && onClose?.()}
      className="parent-mobile-dialog"
      style={{
        position:'fixed', inset:0, zIndex:510,
        background:'rgba(2,6,23,.68)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:18,
      }}
    >
      <form
        aria-labelledby="parent-add-child-title"
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="tv2-pop"
        style={{
          width:'100%', maxWidth:440,
          background:C.bg,
          border:`1px solid ${C.borderB}`,
          borderRadius:16, padding:16,
          boxShadow:'0 24px 70px rgba(0,0,0,.42)',
        }}
      >
        <div id="parent-add-child-title" style={{ fontSize:16, color:C.text, fontWeight:900, marginBottom:6 }}>
          Tambah anak berpandu
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:650, lineHeight:1.5, marginBottom:12 }}>
          Minta anak membuka profil Tusyen mereka, salin ID pelajar atau e-mel akaun, kemudian tampal di sini.
        </div>
        <div style={{ display:'grid', gap:8, marginBottom:12 }}>
          {[
            'Pastikan anak bersetuju untuk berkongsi kemajuan pembelajaran.',
            'Pautan ini hanya memaparkan kelas, pos sekolah, dan kemajuan anak.',
            'Anda boleh membuang pautan ini pada bila-bila masa di Tetapan.',
          ].map((line, index) => (
            <div key={line} style={{ display:'grid', gridTemplateColumns:'24px 1fr', gap:8, alignItems:'start' }}>
              <span style={{
                width:24, height:24, borderRadius:12,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                background:C.accDim, color:C.accPale, fontSize:11, fontWeight:900,
              }}>{index + 1}</span>
              <span style={{ fontSize:12, color:C.text, fontWeight:700, lineHeight:1.4 }}>{line}</span>
            </div>
          ))}
        </div>
        <label htmlFor="parent-add-child-identifier" style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:900, marginBottom:6 }}>
          ID pelajar atau e-mel akaun pelajar
        </label>
        <input
          id="parent-add-child-identifier"
          value={identifier}
          onChange={e => {
            const next = e.target.value;
            setIdentifier(next);
            if (errors.identifier) {
              setErrors(prev => ({ ...prev, identifier:validateChildIdentifier(next) }));
            }
          }}
          onBlur={() => setErrors(prev => ({ ...prev, identifier:validateChildIdentifier(identifier) }))}
          autoFocus
          placeholder="Contoh: pelajar@email.com"
          aria-describedby={[
            identifierHintId,
            errors.identifier ? identifierErrorId : '',
            status ? statusId : '',
          ].filter(Boolean).join(' ')}
          aria-invalid={!!errors.identifier}
          style={{
            width:'100%', boxSizing:'border-box',
            background:C.bg, border:`1px solid ${errors.identifier ? C.red : C.border}`,
            borderRadius:10, padding:'10px 11px',
            color:C.text, fontFamily:'Nunito', fontWeight:750,
            fontSize:13,
          }}
        />
        <div id={identifierHintId} style={{ marginTop:6, fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.4 }}>
          Masukkan ID daripada profil anak atau e-mel akaun pelajar. Kod kelas guru tidak boleh digunakan.
        </div>
        {errors.identifier && (
          <div id={identifierErrorId} role="alert" style={{ marginTop:6, fontSize:11, color:C.red, fontWeight:850, lineHeight:1.35 }}>
            {errors.identifier}
          </div>
        )}
        <label style={{
          display:'grid',
          gridTemplateColumns:'44px 1fr',
          gap:8,
          alignItems:'start',
          marginTop:10,
          marginBottom:errors.consent ? 6 : 10,
          cursor:busy ? 'not-allowed' : 'pointer',
        }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => {
              const checked = e.target.checked;
              setConsent(checked);
              setErrors(prev => ({ ...prev, consent:checked ? '' : prev.consent }));
            }}
            disabled={busy}
            aria-describedby={[consentHintId, errors.consent ? consentErrorId : ''].filter(Boolean).join(' ')}
            aria-invalid={!!errors.consent}
            style={{
              width:22,
              height:22,
              margin:'2px 0 0',
              accentColor:C.acc,
            }}
          />
          <span id={consentHintId} style={{ fontSize:11, color:C.text, fontWeight:800, lineHeight:1.45 }}>
            Saya mengesahkan anak bersetuju berkongsi kemajuan pembelajaran dengan akaun ibu bapa ini.
          </span>
        </label>
        {errors.consent && (
          <div id={consentErrorId} role="alert" style={{ marginBottom:10, fontSize:11, color:C.red, fontWeight:850, lineHeight:1.35 }}>
            {errors.consent}
          </div>
        )}
        {status && (
          <div id={statusId} aria-live="polite" style={{ marginBottom:10, fontSize:11, fontWeight:850, color:parentStatusIsSuccess(status) ? C.green : C.red }}>
            {status}
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, flexWrap:'wrap' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{
            background:'transparent', border:`1px solid ${C.border}`,
            borderRadius:10, padding:'9px 13px',
            color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
            cursor:busy ? 'not-allowed' : 'pointer',
          }}>Batal</button>
          <button type="submit" disabled={busy} style={{
            background:C.accDim, border:`1px solid ${C.borderB}`,
            borderRadius:10, padding:'9px 13px',
            color:C.accPale, fontFamily:'Nunito', fontWeight:900,
            cursor:busy ? 'not-allowed' : 'pointer',
            opacity:busy ? 0.6 : 1,
          }}>{busy ? 'Memaut...' : 'Pautkan Anak'}</button>
        </div>
      </form>
    </div>
  );
};

const parentChipStyle = (tone = 'neutral') => {
  const palette = {
    good: { color:C.green, bg:'rgba(34,197,94,.10)', border:'rgba(34,197,94,.28)' },
    warn: { color:C.orange, bg:'rgba(245,158,11,.10)', border:'rgba(245,158,11,.28)' },
    bad:  { color:C.red, bg:'rgba(239,68,68,.10)', border:'rgba(239,68,68,.28)' },
    info: { color:C.blue, bg:'rgba(56,189,248,.10)', border:'rgba(56,189,248,.28)' },
    neutral: { color:C.textMuted, bg:C.accDim, border:C.border },
  }[tone] || {};
  return {
    display:'inline-flex', alignItems:'center', minHeight:24,
    border:`1px solid ${palette.border}`,
    borderRadius:999, padding:'2px 8px',
    color:palette.color, background:palette.bg,
    fontSize:10, fontWeight:900,
  };
};

const alertSeverityTone = (severity) => (
  severity === 'high' ? 'bad'
    : severity === 'medium' ? 'warn'
    : severity === 'good' ? 'good'
    : 'info'
);

const alertSeverityLabel = (severity) => ({
  high:'Keutamaan tinggi',
  medium:'Perlu perhatian',
  good:'Berita baik',
  info:'Makluman',
}[severity] || 'Makluman');

const alertWhyText = (alert) => {
  const text = `${alert.title || ''} ${alert.desc || ''}`.toLowerCase();
  if (alert.severity === 'high' || text.includes('skor') || text.includes('prestasi')) {
    return 'Ini membantu ibu bapa mengesan topik yang mungkin perlukan sokongan guru sebelum ia menjejaskan tugasan seterusnya.';
  }
  if (text.includes('log') || text.includes('aktiviti') || text.includes('kehadiran')) {
    return 'Rutin yang terputus biasanya mengurangkan latihan ulang kaji; semakan awal lebih mudah daripada mengejar semula kemudian.';
  }
  if (text.includes('kuiz') || text.includes('tugasan') || text.includes('assignment')) {
    return 'Tugasan baharu ada tarikh dan arahan kelas; semak awal supaya anak tahu langkah seterusnya.';
  }
  if (alert.severity === 'good' || text.includes('streak') || text.includes('pencapaian')) {
    return 'Pengiktirafan kecil menguatkan tabiat belajar yang sedang menjadi.';
  }
  return 'Makluman ini memberi konteks supaya ibu bapa boleh memilih tindakan yang sesuai.';
};

const alertRecommendedAction = (alert) => {
  const text = `${alert.title || ''} ${alert.desc || ''} ${alert.action || ''}`.toLowerCase();
  if (alert.severity === 'high' || text.includes('guru') || text.includes('prestasi') || text.includes('skor rendah')) {
    return 'Tandai tindak lanjut, kemudian hubungi guru atau pihak sekolah jika corak ini berulang.';
  }
  if (text.includes('log') || text.includes('aktiviti') || text.includes('kehadiran')) {
    return 'Tetapkan sesi belajar ringkas hari ini dan semak Kemajuan selepas anak selesai.';
  }
  if (text.includes('kuiz') || text.includes('tugasan') || text.includes('assignment')) {
    return 'Baca pos kelas dan pastikan anak faham tugasan yang perlu disiapkan.';
  }
  if (alert.severity === 'good' || text.includes('streak') || text.includes('pencapaian')) {
    return 'Ucap tahniah kepada anak dan kekalkan jadual belajar yang sama.';
  }
  return 'Semak butiran dan tandai dibaca selepas tindakan sesuai dibuat.';
};

const alertSummaryText = (alert) => {
  const summary = parentBodyText(alert?.summary || alert?.shortSummary || alert?.short_summary, '', 112);
  if (summary) return summary;

  const desc = parentBodyText(alert?.desc, '', 160);
  if (!desc) return parentTitle(alert?.title, 'Makluman baharu memerlukan semakan ringkas.');

  const firstSentence = desc.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || desc;
  return firstSentence.length > 112 ? `${firstSentence.slice(0, 109).trim()}...` : firstSentence;
};

const alertPrimaryAction = (alert) => {
  const text = `${alert.title || ''} ${alert.desc || ''} ${alert.action || ''}`.toLowerCase();
  if (text.includes('kuiz') || text.includes('tugasan') || text.includes('assignment')) {
    return { label:parentActionLabel(alert.action) || 'Lihat Pos Kelas', target:'posts' };
  }
  if (text.includes('kemajuan') || text.includes('log') || text.includes('aktiviti') || text.includes('kehadiran')) {
    return { label:parentActionLabel(alert.action) || 'Semak Kemajuan', target:'progress' };
  }
  if (alert.severity === 'high' || text.includes('guru') || text.includes('tindak') || text.includes('prestasi') || text.includes('skor')) {
    return { label:parentActionLabel(alert.action) || 'Tandai Tindak Lanjut', target:'followup' };
  }
  return { label:parentActionLabel(alert.action) || 'Tandai Dibaca', target:'read' };
};

const alertFollowUpExplanation = (alert) => {
  const action = alertPrimaryAction(alert);
  if (action.target === 'followup') {
    return 'Tindak lanjut menyimpan penanda pada peranti ini supaya ibu bapa boleh menyemak semula dan membawa soalan melalui saluran rasmi kelas atau sekolah.';
  }
  if (action.target === 'progress') {
    return 'Butang ini membuka Kemajuan anak untuk melihat subjek, masa belajar, dan corak mingguan.';
  }
  if (action.target === 'posts') {
    return 'Butang ini membuka Pos Kelas supaya ibu bapa boleh membaca arahan guru dan maklum balas yang dibenarkan.';
  }
  return 'Tindakan ini hanya menandakan makluman sebagai dibaca pada peranti ini.';
};

const subjectNextStep = (subject) => {
  const score = scoreValue(subject?.score);
  if (score === null) return 'Minta guru mengesahkan aktiviti pertama yang perlu dibuat untuk mula merekod kemajuan.';
  if (score < 50) return `Utamakan ${subject.name}: ulang satu topik asas, buat latihan pendek, kemudian semak dengan guru.`;
  if (score < 60) return `Jadualkan 20 minit latihan ${subject.name} dan minta anak catat soalan yang masih keliru.`;
  if (subject?.trend === '↓') return `Pantau ${subject.name} minggu ini; skor masih lulus tetapi trend menurun.`;
  return `Kekalkan rutin ${subject.name} dan tambah satu latihan cabaran jika masa mencukupi.`;
};

const childStatusSummary = (child) => {
  const avg = scoreValue(child?.avg);
  const hasWeek = child?.hasWeekData !== false && child?.weekTimeSeconds !== null && child?.weekTimeSeconds !== undefined;
  if (avg !== null && avg < 60) {
    return {
      label:'Perlu sokongan',
      detail:`Purata semasa ${avg}%. Fokus pada satu subjek lemah dahulu.`,
      tone:'bad',
    };
  }
  if (hasWeek && Number(child.weekTimeSeconds || 0) < 20 * 60) {
    return {
      label:'Aktiviti rendah',
      detail:'Minggu ini belum banyak masa belajar direkodkan.',
      tone:'warn',
    };
  }
  if (avg !== null && avg >= 75) {
    return {
      label:'Stabil',
      detail:`Purata ${avg}% dengan rutin yang sedang berjalan.`,
      tone:'good',
    };
  }
  if (avg !== null) {
    return {
      label:'Dalam pemerhatian',
      detail:`Purata ${avg}%. Semak trend subjek sebelum minggu berakhir.`,
      tone:'info',
    };
  }
  return {
    label:'Belum cukup data',
    detail:'Kemajuan akan lebih jelas selepas beberapa pelajaran atau kuiz direkodkan.',
    tone:'neutral',
  };
};

const todayPlanForParent = ({ child, attention, alert }) => {
  const status = childStatusSummary(child);
  if (attention) {
    return {
      status,
      concern:`${attention.name} berada pada ${formatScore(attention.score)}.`,
      actionLabel:TEACHER_QUESTION_LABEL,
      actionKind:'teacher',
      actionDetail:'Minta anak tunjuk satu soalan yang susah, kemudian bawa konteks itu kepada guru.',
    };
  }
  if (alert) {
    const action = alertPrimaryAction(alert);
    return {
      status,
      concern:parentTitle(alert.title, 'Ada makluman baharu daripada kelas.'),
      actionLabel:action.label,
      actionKind:'alert',
      actionDetail:alertRecommendedAction(alert),
      alert,
    };
  }
  if (status.tone === 'warn') {
    return {
      status,
      concern:'Rutin minggu ini masih perlahan.',
      actionLabel:'Semak kemajuan',
      actionKind:'progress',
      actionDetail:'Cari masa 15-20 minit untuk ulang kaji ringkas hari ini.',
    };
  }
  return {
    status,
    concern:'Tiada isu besar dikesan daripada data terkini.',
    actionLabel:'Lihat kemajuan',
    actionKind:'progress',
    actionDetail:'Teruskan rutin belajar dan semak trend subjek apabila ada data baharu.',
  };
};

const progressInterpretation = (metrics, weakSubjects, periodLabel) => {
  if (!metrics.hasActivity) {
    return `Belum ada aktiviti untuk ${periodLabel.toLowerCase()}. Mulakan dengan satu sesi pendek supaya guru dan ibu bapa ada data untuk dibincangkan.`;
  }
  const avg = scoreValue(metrics.avg);
  if (weakSubjects.length) {
    const first = weakSubjects[0];
    return `${first.name} perlukan perhatian. Skor atau trend subjek ini menunjukkan anak mungkin perlu ulang topik sebelum bergerak ke latihan seterusnya.`;
  }
  if (avg !== null && avg >= 80) {
    return `Prestasi ${periodLabel.toLowerCase()} kelihatan kukuh. Cabaran seterusnya ialah kekalkan rutin dan tambah latihan yang sedikit lebih sukar.`;
  }
  if (avg !== null && avg >= 60) {
    return `Kemajuan ${periodLabel.toLowerCase()} berada dalam julat lulus. Semak subjek yang mendatar supaya anak tidak hilang momentum.`;
  }
  return `Data ${periodLabel.toLowerCase()} masih belum cukup jelas. Bantu anak selesaikan satu pelajaran dan semak semula selepas skor baharu direkodkan.`;
};

const ParentHome = ({ displayName, childState, child, childOptions, selectedId, onSelectChild, onOpenSettings, onNavigate }) => {
  const announcementState = useParentAnnouncements(child);
  const alertsState = useParentAlerts(child?.id);
  const [notice, setNotice] = React.useState('');
  const prefs = readParentPrefs();
  const greetingName = parentGreetingName(currentUser(), prefs);
  const childActivity = child?.activity || [];
  const announcements = announcementState.data || [];
  const subjectRows = (child?.subjects || []).filter(subject => subject.hasData !== false && scoreValue(subject.score) !== null);
  const attention = subjectRows
    .filter(subject => subject.score < 60)
    ?.sort((a, b) => a.score - b.score)[0];
  const hasOverallScore = child?.hasProgressData !== false && scoreValue(child?.avg) !== null;
  const hasWeekTime = child?.hasWeekData !== false && child?.weekTimeSeconds !== null && child?.weekTimeSeconds !== undefined;
  const weekRange = currentWeekRangeLabel();
  const dismissedHomeAlertIds = child ? readLocal(alertStorageKey(child.id, 'dismissed_alerts'), []) : [];
  const readHomeAlertIds = child ? readLocal(alertStorageKey(child.id, 'read_alerts'), []) : [];
  const followUpHomeAlertIds = child ? readLocal(alertStorageKey(child.id, 'followup_alerts'), []) : [];
  const homeAlerts = (alertsState.data || [])
    .filter(alert => alertAllowedByPrefs(alert, prefs))
    .filter(alert => !dismissedHomeAlertIds.includes(alertId(alert)) && !alertStatusFlag(alert, 'dismissed', 'dismissed'))
    .slice(0, 2);
  const weekMetrics = child ? periodMetrics(child, 'week') : null;
  const insightActionStyle = {
    width:'100%',
    background:'transparent',
    border:'none',
    borderRadius:12,
    padding:'8px 4px',
    color:'inherit',
    fontFamily:'Nunito',
    cursor:'pointer',
  };

  const markTeacherFollowUp = (subject) => {
    if (!child) return;
    const key = `tusyen_parent_teacher_followups_${child.id}`;
    const next = uniqueBy([...readLocal(key, []), `${subject.name}|${new Date().toISOString()}`], item => item);
    writeLocal(key, next);
    setNotice(`${TEACHER_FOLLOWUP_CONFIRMATION} Fokus: ${subject.name}.`);
  };

  const actOnHomeAlert = (alert) => {
    if (!child) return;
    const action = alertPrimaryAction(alert);
    const id = alertId(alert);
    const childId = alertChildId(alert) || child.id;
    const readKey = alertStorageKey(child.id, 'read_alerts');
    const markHomeAlertRead = () => {
      writeLocal(readKey, uniqueBy([...readLocal(readKey, []), id], item => item));
    };
    const syncHomeAlertRead = () => {
      markHomeAlertRead();
      if (currentUser()?.role === 'parent') {
        window.tusyenApi.updateParentAlertStatus({
          childId,
          alertId: id,
          read: true,
        }).catch(() => {
          markHomeAlertRead();
        });
      }
    };
    if (action.target === 'progress' || action.target === 'posts') {
      syncHomeAlertRead();
      onNavigate?.(action.target);
      return;
    }
    if (action.target === 'followup') {
      markHomeAlertRead();
      const key = alertStorageKey(child.id, 'followup_alerts');
      writeLocal(key, uniqueBy([...readLocal(key, []), id], item => item));
      if (currentUser()?.role === 'parent') {
        window.tusyenApi.updateParentAlertStatus({
          childId,
          alertId: id,
          read: true,
          followUp: true,
        }).then(() => {
          setNotice('Tindak lanjut disimpan dan disegerakkan dengan akaun ibu bapa. Gunakan saluran rasmi kelas atau sekolah jika soalan perlu dihantar.');
        }).catch(() => {
          setNotice('Tindak lanjut disimpan pada peranti ini. Penyegerakan pelayan belum tersedia.');
        });
        return;
      }
      setNotice('Tindak lanjut disimpan pada peranti ini. Gunakan saluran rasmi kelas atau sekolah jika soalan perlu dihantar.');
      return;
    }
    syncHomeAlertRead();
    setNotice('Makluman ditandai dibaca pada peranti ini.');
  };

  const todayPlan = child ? todayPlanForParent({ child, attention, alert:homeAlerts[0] }) : null;
  const handleTodayAction = () => {
    if (!todayPlan) return;
    if (todayPlan.actionKind === 'teacher' && attention) {
      markTeacherFollowUp(attention);
      return;
    }
    if (todayPlan.actionKind === 'alert' && todayPlan.alert) {
      actOnHomeAlert(todayPlan.alert);
      return;
    }
    onNavigate?.('progress');
  };
  const openHomeInsight = (target) => {
    if (!target) return;
    onNavigate?.(target);
  };
  const handleHomeInsightKey = (event, target) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openHomeInsight(target);
    }
  };
  const homeInsightCards = [
    {
      v:formatScore(child?.avg, hasOverallScore),
      l:'Purata Skor',
      sub:hasOverallScore ? 'Purata rekod pelajaran dan kuiz' : 'Belum ada data',
      target:'progress',
      aria:'Buka Kemajuan untuk melihat purata skor anak',
    },
    {
      v:weekMetrics?.hasActivity ? formatStudyTime(weekMetrics.timeSeconds) : (hasWeekTime ? formatStudyTime(child.weekTimeSeconds) : '—'),
      l:'Minggu Ini',
      sub:weekRange,
      target:'progress',
      aria:'Buka Kemajuan untuk melihat aktiviti minggu ini',
    },
    {
      v:child?.rank ? `#${child.rank}` : '—',
      l:child?.rank ? 'Kedudukan Kelas' : 'Kedudukan belum tersedia',
      sub:child?.rank ? 'Berdasarkan papan markah kelas' : 'Muncul bila kelas ada papan markah',
      target:'children',
      aria:'Buka profil anak untuk melihat ringkasan kelas',
    },
  ];

  if (!child) return <NoLinkedChild onOpenSettings={onOpenSettings} childState={childState} />;
  return (
  <div style={{ padding:'14px 16px 10px' }}>
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>Assalamualaikum,</div>
      <div style={{ fontSize:21, fontWeight:800, color:C.text }}>{greetingName} 👋</div>
    </div>

    <ChildSwitcher childOptions={childOptions} selectedId={selectedId} onSelect={onSelectChild} />

    {childState.error && (
      <div style={{ marginBottom:14 }}>
        <ErrorRetry message={childState.error.message || 'Tidak dapat memuat anak terpaut.'} onRetry={childState.refresh} />
      </div>
    )}

    {notice && (
      <Card success style={{ marginBottom:10, padding:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:12, color:C.green, fontWeight:800, lineHeight:1.4 }}>{notice}</div>
          <button onClick={() => setNotice('')} style={{
            background:'transparent', border:'none', color:C.textFaint,
            cursor:'pointer', fontWeight:900, fontSize:16,
          }}>×</button>
        </div>
      </Card>
    )}

    {todayPlan && (
      <Card glow style={{ marginBottom:14, border:`1px solid ${C.borderB}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:12, minWidth:0 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, color:C.accPale, fontWeight:900, textTransform:'uppercase', marginBottom:4 }}>
              Perhatian Hari Ini
            </div>
            <div style={{ fontSize:15, color:C.text, fontWeight:900, lineHeight:1.3 }}>
              Apa yang perlu ibu bapa buat untuk {child.name}
            </div>
          </div>
          <span style={parentChipStyle(todayPlan.status.tone)}>{todayPlan.status.label}</span>
        </div>
        <div style={{ display:'grid', gap:8, marginBottom:12 }}>
          {[
            { label:'Status', value:todayPlan.status.detail, color:C.text },
            { label:'Kebimbangan', value:todayPlan.concern, color:C.text },
            { label:'Tindakan ibu bapa', value:todayPlan.actionDetail, color:C.accPale },
          ].map((item, index) => (
            <div key={item.label} style={{
              display:'grid',
              gridTemplateColumns:'104px minmax(0, 1fr)',
              gap:10,
              alignItems:'start',
              paddingTop:index ? 8 : 0,
              borderTop:index ? `1px solid ${C.border}` : 'none',
              minWidth:0,
            }}>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:900, textTransform:'uppercase', lineHeight:1.35 }}>
                {item.label}
              </div>
              <div style={{ fontSize:12, color:item.color, fontWeight:760, lineHeight:1.45, minWidth:0, overflowWrap:'anywhere' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={handleTodayAction} style={{
          width:'100%',
          minHeight:44,
          background:'linear-gradient(135deg, var(--c-acc-lo), var(--c-acc))',
          border:'none',
          borderRadius:12,
          padding:'10px 12px',
          color:'#fff',
          fontFamily:'Nunito',
          fontWeight:900,
          fontSize:12,
          cursor:'pointer',
        }}>{todayPlan.actionLabel}</button>
      </Card>
    )}

    {childState.loading ? (
      <Card style={{ marginBottom:14, border:`1px solid ${C.borderB}`, boxShadow:'0 0 20px var(--c-acc-glow)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <Skeleton width={52} height={52} radius={26} />
          <div style={{ flex:1 }}>
            <Skeleton width="58%" height={16} radius={8} style={{ marginBottom:8 }} />
            <Skeleton width="45%" height={12} radius={6} style={{ marginBottom:9 }} />
            <div style={{ display:'flex', gap:6 }}>
              <Skeleton width={78} height={20} radius={20} />
              <Skeleton width={88} height={20} radius={20} />
            </div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-around', paddingTop:10, borderTop:`1px solid ${C.border}` }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <Skeleton width={42} height={16} radius={8} />
              <Skeleton width={58} height={10} radius={5} />
            </div>
          ))}
        </div>
      </Card>
    ) : (
    <Card style={{ marginBottom:14, border:`1px solid ${C.borderB}`, boxShadow:'0 0 20px var(--c-acc-glow)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <Avatar name={child.name} size={52} />
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:16, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{child.name}</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Tingkatan {child.form} • {child.cls}</div>
          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontWeight:800, color:C.orange, background:'rgba(255,150,0,.12)', borderRadius:20, padding:'2px 9px' }}>🔥 {child.streak} hari</span>
            <span style={{ fontSize:11, fontWeight:800, color:C.gold,   background:'rgba(245,166,35,.12)', borderRadius:20, padding:'2px 9px' }}>⚡ {child.xp} XP</span>
          </div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        {homeInsightCards.map((s,i) => (
          <button
            key={i}
            type="button"
            onClick={() => openHomeInsight(s.target)}
            aria-label={s.aria}
            style={insightActionStyle}
          >
          <div style={{ textAlign:'center', minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:16, color:C.accPale }}>{s.v}</div>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{s.l}</div>
            {s.sub && <div style={{ fontSize:9, color:C.textFaint, fontWeight:600, marginTop:1 }}>{s.sub}</div>}
          </div>
          </button>
        ))}
      </div>
    </Card>
    )}

    {attention ? (
      <Card warn style={{ marginBottom:14, cursor:'pointer' }} onClick={() => openHomeInsight('progress')} role="button" tabIndex={0} onKeyDown={(event) => handleHomeInsightKey(event, 'progress')}>
        <div style={{ fontWeight:800, fontSize:11, color:C.orange, textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>⚠️ Perlu Perhatian</div>
        <div style={{ fontSize:13, color:C.text, fontWeight:600, lineHeight:1.5 }}>
          <strong>{attention.name}</strong>: purata rendah ({formatScore(attention.score)}). Semak topik yang sukar bersama guru atau pihak sekolah.
        </div>
        <div style={{ marginTop:8, fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
          <strong>Mengapa penting:</strong> subjek di bawah 60% boleh menjejaskan keyakinan anak dalam tugasan seterusnya.
        </div>
        <div style={{ marginTop:4, fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
          <strong>Tindakan dicadang:</strong> {subjectNextStep(attention)}
        </div>
        <button onClick={(event) => { event.stopPropagation(); markTeacherFollowUp(attention); }} onKeyDown={(event) => event.stopPropagation()} style={{
          marginTop:10,
          background:`color-mix(in srgb,${C.blue} 12%,transparent)`,
          border:`1px solid color-mix(in srgb,${C.blue} 35%,transparent)`,
          borderRadius:10, padding:'9px 12px', minHeight:44,
          color:C.blue, fontFamily:'Nunito', fontWeight:900,
          fontSize:11, cursor:'pointer',
        }}>{TEACHER_QUESTION_LABEL}</button>
      </Card>
    ) : subjectRows.length ? (
      <Card success style={{ marginBottom:14, cursor:'pointer' }} onClick={() => openHomeInsight('progress')} role="button" tabIndex={0} onKeyDown={(event) => handleHomeInsightKey(event, 'progress')}>
        <div style={{ fontWeight:800, fontSize:11, color:C.green, textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>✅ Stabil</div>
        <div style={{ fontSize:13, color:C.text, fontWeight:600, lineHeight:1.5 }}>
          Tiada subjek di bawah 60% untuk data terkini.
        </div>
      </Card>
    ) : (
      <Card style={{ marginBottom:14, cursor:'pointer' }} onClick={() => openHomeInsight('progress')} role="button" tabIndex={0} onKeyDown={(event) => handleHomeInsightKey(event, 'progress')}>
        <div style={{ fontWeight:800, fontSize:11, color:C.textMuted, textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>Belum ada data</div>
        <div style={{ fontSize:13, color:C.text, fontWeight:600, lineHeight:1.5 }}>
          Kemajuan anak akan dipaparkan selepas pelajaran atau kuiz pertama direkodkan.
        </div>
      </Card>
    )}

    {homeAlerts.length > 0 && (
      <>
      <SectionLabel>Makluman Terkini</SectionLabel>
      {homeAlerts.map(alert => {
        const id = alertId(alert);
        const action = alertPrimaryAction(alert);
        const tone = alertSeverityTone(alert.severity);
        const read = readHomeAlertIds.includes(id) || alertStatusFlag(alert, 'read', 'read');
        const followed = followUpHomeAlertIds.includes(id) || alertStatusFlag(alert, 'followUp', 'follow_up');
        return (
          <Card key={id} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap', marginBottom:5 }}>
                  <span style={{ fontSize:17 }}>{alert.icon}</span>
                  <span style={parentChipStyle(tone)}>{alertSeverityLabel(alert.severity)}</span>
                  {read && <span style={{ fontSize:10, color:C.textMuted, fontWeight:900 }}>Dibaca</span>}
                  {followed && <span style={{ fontSize:10, color:C.textMuted, fontWeight:900 }}>Tindak lanjut</span>}
                </div>
                <div style={{ fontWeight:900, fontSize:14, color:C.text, lineHeight:1.35 }}>{parentTitle(alert.title, 'Makluman')}</div>
              </div>
                <span style={{ fontSize:10, color:C.textFaint, fontWeight:700, flexShrink:0 }}>{alert.time}</span>
              </div>
              <div style={{ fontSize:12, color:C.text, fontWeight:650, lineHeight:1.5, marginBottom:8 }}>{parentBodyText(alert.desc, '', 180)}</div>
              <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:4 }}>
                <strong>Mengapa penting:</strong> {alertWhyText(alert)}
              </div>
              <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:10 }}>
                <strong>Tindakan dicadang:</strong> {alertRecommendedAction(alert)}
              </div>
              <button onClick={() => actOnHomeAlert(alert)} style={{
                background:C.accDim, border:`1px solid ${C.borderB}`,
                borderRadius:10, padding:'9px 12px', minHeight:44,
                color:C.accPale, fontFamily:'Nunito', fontWeight:900,
                fontSize:12, cursor:'pointer',
              }}>{action.label}</button>
            </Card>
          );
        })}
      </>
    )}

    <SectionLabel>📊 Prestasi Subjek</SectionLabel>
    <Card style={{ marginBottom:14, padding:'10px 14px' }}>
      {childState.loading ? [0,1,2,3,4].map(i => (
        <div key={i} style={{ marginBottom: i < 4 ? 12 : 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
            <Skeleton width={86} height={13} radius={7} />
            <Skeleton width={44} height={13} radius={7} />
          </div>
          <Skeleton width="100%" height={7} radius={999} />
        </div>
      )) : subjectRows.length ? subjectRows.map((s,i) => (
        <div key={s.name} style={{ marginBottom: i < subjectRows.length - 1 ? 12 : 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{s.name}</span>
            <span style={{ fontWeight:800, fontSize:13, color: s.score >= 60 ? C.green : C.red }}>
              {formatScore(s.score)} <span style={{ fontSize:11 }}>{s.trend}</span>
            </span>
          </div>
          <ProgressBar value={s.score} color={s.score >= 60 ? s.color : C.red} height={7} />
        </div>
      )) : (
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5 }}>Belum ada data subjek untuk anak ini.</div>
      )}
    </Card>

    <SectionLabel>🕐 Aktiviti Anak</SectionLabel>
    <TimelineList
      loading={childState.loading}
      items={childActivity}
      emptyText="Belum ada aktiviti anak direkodkan."
    />

    <SectionLabel>📣 Pengumuman Kelas</SectionLabel>
    <TimelineList
      loading={announcementState.loading}
      items={announcements}
      emptyText="Belum ada pengumuman kelas untuk anak ini."
      style={{ marginBottom:0 }}
    />
    <div style={{ height:8 }} />
  </div>
  );
};

const ParentProgress = ({ childState, child, childOptions, selectedId, onSelectChild, onOpenSettings }) => {
  const [period, setPeriod] = React.useState('week');
  const [notice, setNotice] = React.useState('');
  if (!child) return <NoLinkedChild onOpenSettings={onOpenSettings} childState={childState} errorMessage="Tidak dapat memuat kemajuan." />;
  const metrics = periodMetrics(child, period);
  const periodLabel = period === 'week' ? 'Minggu Ini' : 'Bulan Ini';
  const chartRows = (child.subjects || []).map((subject) => {
    const history = buildHistory(child, subject, period);
    const scores = history.scores;
    const latest = [...scores].reverse().find(score => score !== null) ?? null;
    const prev = [...scores].slice(0, -1).reverse().find(score => score !== null) ?? latest;
    const delta = latest !== null && prev !== null ? latest - prev : 0;
    return {
      subject,
      history,
      scores,
      latest,
      delta,
      tColor: delta > 0 ? C.green : delta < 0 ? C.red : C.textMuted,
      tArrow: delta > 0 ? '↑' : delta < 0 ? '↓' : '→',
    };
  }).filter(row => row.history.hasData);
  const weakSubjects = (child.subjects || [])
    .filter(subject => {
      const score = scoreValue(subject.score);
      return score !== null && (score < 60 || subject.trend === '↓');
    })
    .slice(0, 4);
  const primaryConcern = weakSubjects[0] || null;
  const saveTeacherContactNote = () => {
    const key = `tusyen_parent_teacher_followups_${child.id}`;
    const label = primaryConcern?.name || 'Kemajuan umum';
    const next = uniqueBy([...readLocal(key, []), `${label}|${period}|${new Date().toISOString()}`], item => item);
    writeLocal(key, next);
    setNotice(primaryConcern
      ? `${TEACHER_FOLLOWUP_CONFIRMATION} Fokus: ${primaryConcern.name}.`
      : TEACHER_FOLLOWUP_CONFIRMATION);
  };

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <ChildSwitcher childOptions={childOptions} selectedId={selectedId} onSelect={onSelectChild} />

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['week','📅 Minggu Ini'],['month','📆 Bulan Ini']].map(([p,label]) => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            minHeight:44,
            background: period === p ? C.accDim : 'transparent',
            border:`1.5px solid ${period === p ? C.borderB : C.border}`,
            borderRadius:20, padding:'8px 16px',
            fontSize:12, fontWeight:700, cursor:'pointer',
            color: period === p ? C.accPale : C.textMuted,
            fontFamily:'Nunito', transition:'all .2s',
          }}>{label}</button>
        ))}
      </div>
      {period === 'week' && (
        <div style={{ marginTop:-8, marginBottom:12, fontSize:11, color:C.textFaint, fontWeight:700 }}>
          {currentWeekRangeLabel()}
        </div>
      )}

      {childState.error && (
        <div style={{ marginBottom:14 }}>
          <ErrorRetry message={childState.error.message || 'Tidak dapat memuat kemajuan.'} onRetry={childState.refresh} />
        </div>
      )}

      {notice && (
        <Card success style={{ marginBottom:10, padding:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:12, color:C.green, fontWeight:800, lineHeight:1.4 }}>{notice}</div>
            <button type="button" onClick={() => setNotice('')} style={{
              background:'transparent', border:'none', color:C.textFaint,
              cursor:'pointer', fontWeight:900, fontSize:12, minHeight:44,
            }}>Tutup</button>
          </div>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { v:metrics.hasActivity ? formatStudyTime(metrics.timeSeconds) : '—', l:'Masa Belajar', i:'⏱️', c:C.acc },
          { v:metrics.hasActivity ? String(metrics.lessons) : '—', l:'Pelajaran', i:'📚', c:C.blue },
          { v:formatScore(metrics.avg, metrics.hasScore), l:metrics.hasScore ? 'Purata Skor' : 'Purata belum ada data', i:'📊', c:C.green },
          { v:metrics.rank ? `#${metrics.rank}` : '—', l:metrics.rank ? 'Kedudukan Kelas' : 'Kedudukan belum tersedia', i:'🏆', c:C.gold },
        ].map((s,i) => (
          <Card key={i} style={{ padding:12, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:26 }}>{s.i}</span>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:s.c, lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, textTransform:'uppercase' }}>{s.l}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom:14, border:`1px solid ${primaryConcern ? 'rgba(245,158,11,.34)' : C.border}` }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:8 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:13, color:C.text, lineHeight:1.35 }}>Maksud kemajuan ini</div>
            <div style={{ fontSize:11, color:C.textFaint, fontWeight:700, marginTop:2 }}>{periodLabel}</div>
          </div>
          {primaryConcern && <span style={parentChipStyle('warn')}>Perlu semak</span>}
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.5, marginBottom:10 }}>
          {progressInterpretation(metrics, weakSubjects, periodLabel)}
        </div>
        <button type="button" onClick={saveTeacherContactNote} style={{
          width:'100%',
          minHeight:44,
          background:primaryConcern ? `color-mix(in srgb,${C.orange} 13%,transparent)` : C.accDim,
          border:`1px solid ${primaryConcern ? 'rgba(245,158,11,.38)' : C.borderB}`,
          borderRadius:12,
          padding:'10px 12px',
          color:primaryConcern ? C.orange : C.accPale,
          fontFamily:'Nunito',
          fontWeight:900,
          fontSize:12,
          cursor:'pointer',
        }}>{primaryConcern ? `${TEACHER_QUESTION_LABEL}: ${primaryConcern.name}` : TEACHER_QUESTION_LABEL}</button>
      </Card>

      <SectionLabel>📈 Trend Prestasi — {periodLabel}</SectionLabel>
      {chartRows.length ? chartRows.map(({ subject:s, history, scores, latest, tColor, tArrow }) => (
          <Card key={s.name} style={{ marginBottom:10, padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{s.name}</div>
              <div style={{ fontWeight:800, fontSize:13, color:tColor }}>{formatScore(latest)} {tArrow}</div>
            </div>

            <div style={{ position:'relative', paddingTop:8 }}>
              {[
                { label:'Lulus 60%', value:60, color:C.orange },
                { label:'Cemerlang 80%', value:80, color:C.green },
              ].map(threshold => (
                <div key={threshold.label} style={{
                  position:'absolute',
                  left:0,
                  right:0,
                  top:`${8 + (1 - threshold.value / 100) * 112}px`,
                  borderTop:`1px dashed color-mix(in srgb,${threshold.color} 58%,transparent)`,
                  zIndex:1,
                  pointerEvents:'none',
                }}>
                  <span style={{
                    position:'absolute',
                    right:0,
                    top:-8,
                    fontSize:9,
                    fontWeight:900,
                    color:threshold.color,
                    background:C.card,
                    paddingLeft:4,
                  }}>{threshold.label}</span>
                </div>
              ))}
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, minHeight:154, position:'relative', zIndex:2 }}>
              {scores.map((score, i) => {
                const isLast = i === scores.length - 1;
                const height = score !== null ? Math.max(8, (score / 100) * 112) : 0;
                return (
                  <div key={i} style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <div style={{ height:112, width:'100%', display:'flex', alignItems:'flex-end' }}>
                    <div style={{
                      width:'100%', borderRadius:'5px 5px 0 0',
                      height:`${height}px`,
                      background: isLast
                        ? `linear-gradient(180deg, ${s.color}, color-mix(in srgb,${s.color} 55%,transparent))`
                        : `color-mix(in srgb,${s.color} 28%,transparent)`,
                      border: score !== null ? `1px solid ${isLast
                        ? s.color
                        : `color-mix(in srgb,${s.color} 20%,transparent)`}` : '1px solid transparent',
                      transition:'height .5s ease',
                    }} />
                    </div>
                    <div style={{ minHeight:14, fontSize:10, color:score !== null ? C.text : C.textFaint, fontWeight:900 }}>
                      {score !== null ? `${score}%` : '-'}
                    </div>
                    <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.1, textAlign:'center' }}>{history.labels[i]}</div>
                  </div>
                );
              })}
            </div>
            </div>
          </Card>
      )) : (
        <Card>
          <div style={{ fontWeight:800, fontSize:13, color:C.text, marginBottom:4 }}>Belum ada data</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5 }}>
            Tiada rekod kemajuan dalam tempoh {periodLabel.toLowerCase()}.
          </div>
        </Card>
      )}
      {weakSubjects.length > 0 && (
        <>
          <SectionLabel>Cadangan Langkah Seterusnya</SectionLabel>
          <Card style={{ marginBottom:10 }}>
            {weakSubjects.map((subject, i) => (
              <div key={subject.name} style={{
                padding:'8px 0',
                borderBottom:i < weakSubjects.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', marginBottom:4 }}>
                  <div style={{ fontWeight:900, fontSize:13, color:C.text }}>{subject.name}</div>
                  <span style={parentChipStyle(scoreValue(subject.score) < 60 ? 'bad' : 'warn')}>{formatScore(subject.score)}</span>
                </div>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
                  {subjectNextStep(subject)}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
      <div style={{ height:8 }} />
    </div>
  );
};

const alertStorageKey = (childId, type) => `tusyen_parent_${type}_${childId || 'all'}`;
const alertId = (alert) => alert.id || `${alertChildId(alert)}|${alert.title || ''}|${alert.desc || ''}|${alert.time || ''}`;
const alertStatusFlag = (alert, camelKey, snakeKey) => alert?.[camelKey] === true || alert?.[snakeKey] === true;
const alertAllowedByPrefs = (alert, prefs) => {
  const text = `${alert.title || ''} ${alert.desc || ''} ${alert.action || ''}`.toLowerCase();
  if (alert.severity === 'good' || text.includes('streak') || text.includes('pencapaian')) return !!prefs.streaks;
  if (text.includes('kuiz') || text.includes('tugasan') || text.includes('assignment')) return !!prefs.assignments;
  if (text.includes('log') || text.includes('aktiviti') || text.includes('kehadiran')) return !!prefs.inactivity;
  if (alert.severity === 'high' || text.includes('prestasi') || text.includes('skor')) return !!prefs.lowScore;
  return true;
};

const shouldOfferTeacherContact = (alert) => {
  const text = `${alert.title || ''} ${alert.desc || ''} ${alert.action || ''}`.toLowerCase();
  return alert.severity === 'high'
    || text.includes('guru')
    || text.includes('teacher')
    || text.includes('prestasi')
    || text.includes('skor rendah');
};

const ParentAlerts = ({ childState, child, childOptions, selectedId, onSelectChild, onNavigate, onOpenSettings }) => {
  const alertsState = useParentAlerts(child?.id);
  const [readIds, setReadIds] = React.useState(() => readLocal(alertStorageKey(child?.id, 'read_alerts'), []));
  const [dismissedIds, setDismissedIds] = React.useState(() => readLocal(alertStorageKey(child?.id, 'dismissed_alerts'), []));
  const [notice, setNotice] = React.useState('');

  React.useEffect(() => {
    setReadIds(readLocal(alertStorageKey(child?.id, 'read_alerts'), []));
    setDismissedIds(readLocal(alertStorageKey(child?.id, 'dismissed_alerts'), []));
  }, [child?.id]);

  if (!child) return <NoLinkedChild onOpenSettings={onOpenSettings} childState={childState} />;

  const prefs = readParentPrefs();
  const rawAlerts = alertsState.data || [];
  const visibleAlerts = rawAlerts
    .filter(alert => alertAllowedByPrefs(alert, prefs))
    .filter(alert => !dismissedIds.includes(alertId(alert)));

  const markRead = (alert) => {
    const next = uniqueBy([...readIds, alertId(alert)], item => item);
    setReadIds(next);
    writeLocal(alertStorageKey(child.id, 'read_alerts'), next);
  };

  const dismissAlert = (alert) => {
    const id = alertId(alert);
    const next = uniqueBy([...dismissedIds, id], item => item);
    setDismissedIds(next);
    writeLocal(alertStorageKey(child.id, 'dismissed_alerts'), next);
    setNotice('Amaran disembunyikan pada peranti ini sahaja. Ia boleh muncul semula pada peranti lain.');
  };

  const clearAll = () => {
    const next = uniqueBy([...dismissedIds, ...visibleAlerts.map(alertId)], item => item);
    setDismissedIds(next);
    writeLocal(alertStorageKey(child.id, 'dismissed_alerts'), next);
    setNotice('Semua amaran aktif disembunyikan pada peranti ini sahaja.');
  };

  const openProgress = (alert) => {
    const targetChildId = alertChildId(alert) || child.id;
    if (targetChildId) onSelectChild(targetChildId);
    onNavigate('progress');
  };

  const markAlertFollowUp = (alert, teacher = false) => {
    markRead(alert);
    const next = uniqueBy([...readLocal(alertStorageKey(child.id, 'followup_alerts'), []), alertId(alert)], item => item);
    writeLocal(alertStorageKey(child.id, 'followup_alerts'), next);
    setNotice(teacher
      ? TEACHER_FOLLOWUP_CONFIRMATION
      : 'Amaran ditandai untuk tindak lanjut pada peranti ini sahaja.');
  };

  const handleAction = (alert) => {
    const label = `${alert.action || ''}`.toLowerCase();
    if (label.includes('tindak') || label.includes('guru')) {
      markAlertFollowUp(alert, label.includes('guru'));
      return;
    }
    markRead(alert);
    openProgress(alert);
  };

  return (
  <div style={{ padding:'14px 16px 10px' }}>
    <div style={{ marginBottom:14 }}>
      <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Amaran & Notifikasi</div>
      <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>{child.name} • Tingkatan {child.form}</div>
    </div>

    <ChildSwitcher childOptions={childOptions} selectedId={selectedId} onSelect={onSelectChild} />

    {notice && (
      <Card success style={{ marginBottom:10, padding:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:12, color:C.green, fontWeight:800, lineHeight:1.4 }}>{notice}</div>
          <button onClick={() => setNotice('')} style={{
            background:'transparent', border:'none', color:C.textFaint,
            cursor:'pointer', fontWeight:900, fontSize:16,
          }}>×</button>
        </div>
      </Card>
    )}

    {childState.error && (
      <div style={{ marginBottom:14 }}>
        <ErrorRetry message={childState.error.message || 'Tidak dapat memuat anak terpaut.'} onRetry={childState.refresh} />
      </div>
    )}

    <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.4, marginBottom:10 }}>
      Status dibaca, tindak lanjut, dan sembunyikan amaran disimpan pada peranti ini sahaja.
    </div>

    {visibleAlerts.length > 1 && (
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
        <button onClick={clearAll} style={{
          background:C.accDim, border:`1px solid ${C.border}`,
          borderRadius:10, padding:'6px 10px',
          color:C.accPale, fontFamily:'Nunito', fontWeight:800,
          fontSize:11, cursor:'pointer',
        }}>Bersihkan semua</button>
      </div>
    )}

    {alertsState.loading ? [0,1,2,3].map(i => (
      <div key={i} style={{
        background:C.card, border:`1px solid ${C.border}`,
        borderRadius:16, padding:14, marginBottom:10,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
            <Skeleton width={18} height={18} radius={6} />
            <Skeleton width={i === 0 ? '64%' : '52%'} height={14} radius={7} />
          </div>
          <Skeleton width={52} height={10} radius={5} />
        </div>
        <div style={{ paddingLeft:26 }}>
          <Skeleton width="100%" height={12} radius={6} style={{ marginBottom:7 }} />
          <Skeleton width="76%" height={12} radius={6} />
        </div>
      </div>
    )) : visibleAlerts.length ? visibleAlerts.map((alert, i) => {
      const read = readIds.includes(alertId(alert));
      const actionLabel = `${alert.action || ''}`.toLowerCase();
      const showTeacherButton = shouldOfferTeacherContact(alert) && !actionLabel.includes('guru');
      const palette = {
        high:   { border:'rgba(239,68,68,.35)',  bg:'rgba(239,68,68,.06)',  title:C.red,      btn:C.red    },
        medium: { border:'rgba(245,158,11,.35)', bg:'rgba(245,158,11,.06)', title:C.orange,   btn:C.orange },
        good:   { border:'rgba(34,197,94,.35)',  bg:'rgba(34,197,94,.06)',  title:C.green,    btn:C.green  },
        info:   { border:C.border,               bg:C.card,                 title:C.accPale,  btn:C.acc    },
      }[alert.severity] || { border:C.border, bg:C.card, title:C.text, btn:C.acc };

      return (
        <div key={alertId(alert)} style={{
          background: read ? C.card : palette.bg,
          border:`1px solid ${read ? C.border : palette.border}`,
          borderRadius:16, padding:14, marginBottom:10,
          opacity: read ? 0.78 : 1,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
              <span style={{ fontSize:18 }}>{alert.icon}</span>
              <div style={{ fontWeight:800, fontSize:14, color:palette.title }}>{parentTitle(alert.title, 'Makluman')}</div>
            </div>
            <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, flexShrink:0, marginLeft:8 }}>{alert.time}</div>
          </div>
          <div style={{ fontSize:12, color:C.text, fontWeight:600, lineHeight:1.5, paddingLeft:26 }}>{parentBodyText(alert.desc, '', 180)}</div>
          <div style={{ paddingLeft:26, marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
            {alert.action && (
              <button onClick={() => handleAction(alert)} style={{
                background:`color-mix(in srgb,${palette.btn} 12%,transparent)`,
                border:`1px solid color-mix(in srgb,${palette.btn} 35%,transparent)`,
                borderRadius:10, padding:'6px 12px',
                fontSize:11, fontWeight:800, color:palette.btn,
                cursor:'pointer', fontFamily:'Nunito',
              }}>{alert.action}</button>
            )}
            {showTeacherButton && (
              <button onClick={() => markAlertFollowUp(alert, true)} style={{
                background:`color-mix(in srgb,${C.blue} 12%,transparent)`,
                border:`1px solid color-mix(in srgb,${C.blue} 35%,transparent)`,
                borderRadius:10, padding:'6px 12px',
                fontSize:11, fontWeight:800, color:C.blue,
                cursor:'pointer', fontFamily:'Nunito',
              }}>{TEACHER_QUESTION_LABEL}</button>
            )}
            {!read && (
              <button onClick={() => markRead(alert)} style={{
                background:C.accDim, border:`1px solid ${C.border}`,
                borderRadius:10, padding:'6px 12px',
                fontSize:11, fontWeight:800, color:C.accPale,
                cursor:'pointer', fontFamily:'Nunito',
              }}>Tandai dibaca</button>
            )}
            <button onClick={() => dismissAlert(alert)} style={{
              background:'transparent', border:`1px solid ${C.border}`,
              borderRadius:10, padding:'6px 12px',
              fontSize:11, fontWeight:600, color:C.textMuted,
              cursor:'pointer', fontFamily:'Nunito',
            }}>Sembunyi</button>
          </div>
        </div>
      );
    }) : (
      <Card success>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:20 }}>✅</span>
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:C.green }}>Tiada amaran aktif</div>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, lineHeight:1.4, marginTop:2 }}>Notifikasi yang dibaca atau dibuang tidak akan muncul semula di peranti ini.</div>
          </div>
        </div>
      </Card>
    )}
    <div style={{ height:8 }} />
  </div>
  );
};

const ParentAlertsV2 = ({ childState, child, childOptions, selectedId, onSelectChild, onNavigate, onOpenSettings }) => {
  const alertsState = useParentAlerts(child?.id);
  const [readIds, setReadIds] = React.useState(() => readLocal(alertStorageKey(child?.id, 'read_alerts'), []));
  const [dismissedIds, setDismissedIds] = React.useState(() => readLocal(alertStorageKey(child?.id, 'dismissed_alerts'), []));
  const [followUpIds, setFollowUpIds] = React.useState(() => readLocal(alertStorageKey(child?.id, 'followup_alerts'), []));
  const [expandedDetailIds, setExpandedDetailIds] = React.useState([]);
  const [notice, setNotice] = React.useState('');

  React.useEffect(() => {
    setReadIds(readLocal(alertStorageKey(child?.id, 'read_alerts'), []));
    setDismissedIds(readLocal(alertStorageKey(child?.id, 'dismissed_alerts'), []));
    setFollowUpIds(readLocal(alertStorageKey(child?.id, 'followup_alerts'), []));
    setExpandedDetailIds([]);
  }, [child?.id]);

  React.useEffect(() => {
    if (!child?.id || currentUser()?.role !== 'parent') return;
    const alerts = alertsState.data || [];
    const backendReadIds = alerts.filter(alert => alertStatusFlag(alert, 'read', 'read')).map(alertId);
    const backendDismissedIds = alerts.filter(alert => alertStatusFlag(alert, 'dismissed', 'dismissed')).map(alertId);
    const backendFollowUpIds = alerts.filter(alert => alertStatusFlag(alert, 'followUp', 'follow_up')).map(alertId);
    if (backendReadIds.length) {
      setReadIds(prev => {
        const next = uniqueBy([...prev, ...backendReadIds], item => item);
        writeLocal(alertStorageKey(child.id, 'read_alerts'), next);
        return next;
      });
    }
    if (backendDismissedIds.length) {
      setDismissedIds(prev => {
        const next = uniqueBy([...prev, ...backendDismissedIds], item => item);
        writeLocal(alertStorageKey(child.id, 'dismissed_alerts'), next);
        return next;
      });
    }
    if (backendFollowUpIds.length) {
      setFollowUpIds(prev => {
        const next = uniqueBy([...prev, ...backendFollowUpIds], item => item);
        writeLocal(alertStorageKey(child.id, 'followup_alerts'), next);
        return next;
      });
    }
  }, [child?.id, alertsState.data]);

  if (!child) return <NoLinkedChild onOpenSettings={onOpenSettings} childState={childState} />;

  const prefs = readParentPrefs();
  const visibleAlerts = (alertsState.data || [])
    .filter(alert => alertAllowedByPrefs(alert, prefs))
    .filter(alert => !dismissedIds.includes(alertId(alert)) && !alertStatusFlag(alert, 'dismissed', 'dismissed'));

  const markRead = (alert) => {
    const id = alertId(alert);
    const next = uniqueBy([...readIds, id], item => item);
    setReadIds(next);
    writeLocal(alertStorageKey(child.id, 'read_alerts'), next);
    if (currentUser()?.role === 'parent') {
      window.tusyenApi.updateParentAlertStatus({
        childId: alertChildId(alert) || child.id,
        alertId: id,
        read: true,
      }).catch(() => {
        setNotice('Makluman ditandai dibaca pada peranti ini. Penyegerakan pelayan belum tersedia.');
      });
    }
  };

  const dismissAlert = (alert) => {
    const id = alertId(alert);
    const next = uniqueBy([...dismissedIds, id], item => item);
    setDismissedIds(next);
    writeLocal(alertStorageKey(child.id, 'dismissed_alerts'), next);
    if (currentUser()?.role === 'parent') {
      window.tusyenApi.updateParentAlertStatus({
        childId: alertChildId(alert) || child.id,
        alertId: id,
        dismissed: true,
      }).then(() => {
        setNotice('Amaran disembunyikan dan disegerakkan dengan akaun ibu bapa.');
      }).catch(() => {
        setNotice('Amaran disembunyikan pada peranti ini. Penyegerakan pelayan belum tersedia.');
      });
      return;
    }
    setNotice('Amaran disembunyikan pada peranti ini sahaja. Ia boleh muncul semula pada peranti lain.');
  };

  const clearAll = () => {
    const ids = visibleAlerts.map(alertId);
    const next = uniqueBy([...dismissedIds, ...ids], item => item);
    setDismissedIds(next);
    writeLocal(alertStorageKey(child.id, 'dismissed_alerts'), next);
    if (currentUser()?.role === 'parent') {
      window.tusyenApi.updateParentAlertsStatus({
        childId: child.id,
        alertIds: ids,
        dismissed: true,
      }).then(() => {
        setNotice('Semua amaran aktif disembunyikan dan disegerakkan dengan akaun ibu bapa.');
      }).catch(() => {
        setNotice('Semua amaran aktif disembunyikan pada peranti ini. Penyegerakan pelayan belum tersedia.');
      });
      return;
    }
    setNotice('Semua amaran aktif disembunyikan pada peranti ini sahaja.');
  };

  const openTarget = (alert, target) => {
    const targetChildId = alertChildId(alert) || child.id;
    if (targetChildId) onSelectChild(targetChildId);
    onNavigate(target);
  };

  const markAlertFollowUp = (alert) => {
    const id = alertId(alert);
    const nextRead = uniqueBy([...readIds, id], item => item);
    const next = uniqueBy([...followUpIds, id], item => item);
    setReadIds(nextRead);
    writeLocal(alertStorageKey(child.id, 'read_alerts'), nextRead);
    setFollowUpIds(next);
    writeLocal(alertStorageKey(child.id, 'followup_alerts'), next);
    if (currentUser()?.role === 'parent') {
      window.tusyenApi.updateParentAlertStatus({
        childId: alertChildId(alert) || child.id,
        alertId: id,
        read: true,
        followUp: true,
      }).then(() => {
        setNotice('Tindak lanjut disimpan dan disegerakkan dengan akaun ibu bapa. Gunakan saluran rasmi kelas atau sekolah jika soalan perlu dihantar.');
      }).catch(() => {
        setNotice('Tindak lanjut disimpan pada peranti ini. Penyegerakan pelayan belum tersedia.');
      });
      return;
    }
    setNotice('Tindak lanjut disimpan pada peranti ini. Gunakan saluran rasmi kelas atau sekolah jika soalan perlu dihantar.');
  };

  const handlePrimaryAction = (alert) => {
    const action = alertPrimaryAction(alert);
    if (action.target === 'progress' || action.target === 'posts') {
      markRead(alert);
      openTarget(alert, action.target);
      return;
    }
    if (action.target === 'followup') {
      markAlertFollowUp(alert);
      return;
    }
    markRead(alert);
    setNotice(currentUser()?.role === 'parent'
      ? 'Makluman ditandai dibaca dan akan disegerakkan dengan akaun ibu bapa.'
      : 'Makluman ditandai dibaca pada peranti ini.');
  };

  const toggleAlertDetail = (id) => {
    setExpandedDetailIds(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ));
  };

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Amaran & Notifikasi</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>{child.name} - Tingkatan {child.form}</div>
      </div>

      <ChildSwitcher childOptions={childOptions} selectedId={selectedId} onSelect={onSelectChild} />

      {notice && (
        <Card success style={{ marginBottom:10, padding:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:12, color:C.green, fontWeight:800, lineHeight:1.4 }}>{notice}</div>
            <button onClick={() => setNotice('')} style={{
              background:'transparent', border:'none', color:C.textFaint,
              cursor:'pointer', fontWeight:900, fontSize:12, minHeight:44,
            }}>Tutup</button>
          </div>
        </Card>
      )}

      {childState.error && (
        <div style={{ marginBottom:14 }}>
          <ErrorRetry message={childState.error.message || 'Tidak dapat memuat anak terpaut.'} onRetry={childState.refresh} />
        </div>
      )}

      <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.4, marginBottom:10 }}>
        Status dibaca, tindak lanjut, dan sembunyikan amaran disegerakkan dengan akaun ibu bapa apabila pelayan tersedia.
      </div>

      {visibleAlerts.length > 1 && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <button onClick={clearAll} style={{
            background:'transparent', border:`1px solid ${C.border}`,
            borderRadius:10, padding:'9px 12px', minHeight:44,
            color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
            fontSize:11, cursor:'pointer',
          }}>Sembunyikan semua</button>
        </div>
      )}

      {alertsState.loading ? [0,1,2,3].map(i => (
        <div key={i} style={{
          background:C.card, border:`1px solid ${C.border}`,
          borderRadius:16, padding:14, marginBottom:10,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
              <Skeleton width={18} height={18} radius={6} />
              <Skeleton width={i === 0 ? '64%' : '52%'} height={14} radius={7} />
            </div>
            <Skeleton width={52} height={10} radius={5} />
          </div>
          <div>
            <Skeleton width="100%" height={12} radius={6} style={{ marginBottom:7 }} />
            <Skeleton width="76%" height={12} radius={6} />
          </div>
        </div>
      )) : visibleAlerts.length ? visibleAlerts.map((alert) => {
        const id = alertId(alert);
        const read = readIds.includes(id) || alertStatusFlag(alert, 'read', 'read');
        const followed = followUpIds.includes(id) || alertStatusFlag(alert, 'followUp', 'follow_up');
        const tone = alertSeverityTone(alert.severity);
        const action = alertPrimaryAction(alert);
        const palette = {
          high:   { border:'rgba(239,68,68,.35)',  bg:'rgba(239,68,68,.06)',  title:C.red,     btn:C.red },
          medium: { border:'rgba(245,158,11,.35)', bg:'rgba(245,158,11,.06)', title:C.orange,  btn:C.orange },
          good:   { border:'rgba(34,197,94,.35)',  bg:'rgba(34,197,94,.06)',  title:C.green,   btn:C.green },
          info:   { border:C.border,               bg:C.card,                 title:C.accPale, btn:C.acc },
        }[alert.severity] || { border:C.border, bg:C.card, title:C.text, btn:C.acc };
        const summary = alertSummaryText(alert);
        const expanded = expandedDetailIds.includes(id);
        const detailDomId = `parent-alert-detail-${`${id}`.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

        return (
          <div key={id} className="parent-alert-card" style={{
            background: read ? C.card : palette.bg,
            border:`1px solid ${read ? C.border : palette.border}`,
            borderRadius:16, padding:14, marginBottom:10,
            opacity: read ? 0.86 : 1,
            maxWidth:'100%', minWidth:0, overflow:'hidden', boxSizing:'border-box',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:5 }}>
                  <span style={{ fontSize:18 }}>{alert.icon}</span>
                  <span style={parentChipStyle(tone)}>{alertSeverityLabel(alert.severity)}</span>
                  <span style={parentChipStyle(read ? 'neutral' : 'info')}>{read ? 'Dibaca' : 'Belum dibaca'}</span>
                  {followed && <span style={parentChipStyle('good')}>Tindak lanjut disimpan</span>}
                </div>
                <div style={{ fontWeight:900, fontSize:14, color:palette.title, lineHeight:1.35 }}>{parentTitle(alert.title, 'Makluman')}</div>
              </div>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, flexShrink:0 }}>{alert.time}</div>
            </div>
            <div style={{ fontSize:12, color:C.text, fontWeight:720, lineHeight:1.45, marginBottom:6, minWidth:0, overflowWrap:'anywhere' }}>
              {summary}
            </div>
            <button
              type="button"
              onClick={() => toggleAlertDetail(id)}
              aria-expanded={expanded}
              aria-controls={detailDomId}
              style={{
                display:'inline-flex', alignItems:'center', justifyContent:'flex-start', gap:6,
                minHeight:44, minWidth:44, padding:'8px 0', marginBottom:expanded ? 6 : 8,
                background:'transparent', border:'none',
                color:C.accPale, fontFamily:'Nunito', fontSize:11, fontWeight:900,
                cursor:'pointer', textAlign:'left',
              }}
            >
              <span>{expanded ? 'Sembunyikan butiran' : 'Lihat sebab dan cadangan'}</span>
              <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
            </button>
            {expanded && (
              <div id={detailDomId} style={{
                borderTop:`1px solid ${C.border}`,
                paddingTop:9,
                marginBottom:10,
                minWidth:0,
              }}>
                {alert.desc && parentBodyText(alert.desc, '', 180) !== summary && (
                  <div style={{ fontSize:12, color:C.text, fontWeight:650, lineHeight:1.5, marginBottom:8, overflowWrap:'anywhere' }}>
                    {parentBodyText(alert.desc, '', 180)}
                  </div>
                )}
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:4 }}>
                  <strong>Mengapa penting:</strong> {alertWhyText(alert)}
                </div>
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:8 }}>
                  <strong>Tindakan dicadang:</strong> {alertRecommendedAction(alert)}
                </div>
                <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.4 }}>
                  {alertFollowUpExplanation(alert)}
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8, flexWrap:'nowrap', alignItems:'center', justifyContent:'space-between', maxWidth:'100%', minWidth:0 }}>
              <button onClick={() => handlePrimaryAction(alert)} style={{
                flex:'1 1 190px',
                minWidth:0,
                background:`color-mix(in srgb,${palette.btn} 13%,transparent)`,
                border:`1px solid color-mix(in srgb,${palette.btn} 38%,transparent)`,
                borderRadius:10, padding:'9px 12px', minHeight:44,
                fontSize:12, fontWeight:900, color:palette.btn,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                cursor:'pointer', fontFamily:'Nunito',
              }}>{action.label}</button>
              <ActionMenu
                label="Pilihan amaran"
                trigger={<span aria-hidden="true">...</span>}
                items={[
                  !read && { id:'read', label:'Tandai dibaca', icon:'✓', onSelect:() => markRead(alert) },
                  { id:'hide', label:'Sembunyikan amaran', icon:'×', destructive:true, onSelect:() => dismissAlert(alert) },
                ]}
              />
            </div>
          </div>
        );
      }) : (
        <Card success>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontWeight:800, fontSize:13, color:C.green }}>Tiada amaran aktif</div>
              <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, lineHeight:1.4, marginTop:2 }}>Notifikasi yang dibaca atau dibuang tidak akan muncul semula selepas status akaun disegerakkan.</div>
            </div>
          </div>
        </Card>
      )}
      <div style={{ height:8 }} />
    </div>
  );
};

const settingsInputStyle = {
  width:'100%',
  boxSizing:'border-box',
  background:C.bg,
  border:`1px solid ${C.border}`,
  borderRadius:10,
  padding:'10px 11px',
  color:C.text,
  fontFamily:'Nunito',
  fontWeight:700,
  fontSize:12,
};

const ToggleRow = ({ label, checked, onChange }) => (
  <button type="button" onClick={() => onChange(!checked)} aria-pressed={!!checked} style={{
    width:'100%',
    minHeight:52,
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
    padding:'10px 0', border:'none', borderBottom:`1px solid ${C.border}`,
    background:'transparent',
    fontSize:13, color:C.text, fontWeight:700,
    fontFamily:'Nunito',
    textAlign:'left',
    cursor:'pointer',
  }}>
    <span style={{ minWidth:0 }}>{label}</span>
    <span
      aria-hidden="true"
      style={{
        width:48, height:28, borderRadius:14, flexShrink:0,
        background: checked
          ? 'linear-gradient(90deg,var(--c-acc-lo),var(--c-acc))'
          : C.surface,
        border:`1.5px solid ${checked ? 'var(--c-acc)' : C.border}`,
        position:'relative', transition:'all .2s',
        boxShadow: checked ? '0 0 8px var(--c-acc-glow)' : 'none',
      }}
    >
      <span style={{
        width:20, height:20, borderRadius:'50%',
        background:'#fff',
        position:'absolute', top:2,
        left: checked ? 22 : 2,
        transition:'left .2s',
        boxShadow:'0 1px 4px rgba(0,0,0,.25)',
      }} />
    </span>
  </button>
);

const PasswordField = ({ id, label, value, onChange, placeholder, visible, onToggle, minLength, autoComplete, helper }) => {
  const fieldId = id || `parent-password-${`${placeholder || 'field'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const helperId = `${fieldId}-hint`;
  const labelText = label || placeholder;
  return (
    <div>
      {label && (
        <label htmlFor={fieldId} style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:900, marginBottom:6 }}>
          {label}
        </label>
      )}
      <div style={{ position:'relative' }}>
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          aria-label={label ? undefined : placeholder}
          aria-describedby={helper ? helperId : undefined}
          style={{ ...settingsInputStyle, minHeight:52, paddingRight:104 }}
        />
        <button type="button" onClick={onToggle} aria-label={`${visible ? 'Sembunyikan' : 'Tunjuk'} ${labelText}`} style={{
          position:'absolute', top:4, right:4,
          minWidth:44, minHeight:44,
          border:`1px solid ${C.border}`,
          background:C.accDim,
          color:C.accPale,
          borderRadius:8,
          padding:'5px 10px',
          fontFamily:'Nunito',
          fontSize:11,
          fontWeight:900,
          cursor:'pointer',
        }}>{visible ? 'Sembunyi' : 'Tunjuk'}</button>
      </div>
      {helper && (
        <div id={helperId} style={{ marginTop:5, fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.35 }}>
          {helper}
        </div>
      )}
    </div>
  );
};

const passwordStrength = (value) => {
  const password = `${value || ''}`;
  if (!password) return { score:0, label:'Belum diisi', color:C.textFaint, hint:'Gunakan sekurang-kurangnya 8 aksara.' };
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (checks <= 2) return { score:1, label:'Lemah', color:C.red, hint:'Tambah panjang, huruf besar/kecil, nombor, atau simbol.' };
  if (checks <= 3) return { score:2, label:'Sederhana', color:C.orange, hint:'Boleh dikuatkan dengan 12 aksara dan simbol.' };
  if (checks <= 4) return { score:3, label:'Kuat', color:C.green, hint:'Baik. Frasa panjang yang unik lebih selamat.' };
  return { score:4, label:'Sangat kuat', color:C.green, hint:'Kata laluan ini kelihatan kukuh.' };
};

const PasswordStrengthMeter = ({ value }) => {
  const strength = passwordStrength(value);
  return (
    <div style={{ marginTop:-2 }}>
      <div style={{ display:'flex', gap:4, marginBottom:5 }}>
        {[1,2,3,4].map(step => (
          <div key={step} style={{
            flex:1,
            height:5,
            borderRadius:999,
            background: step <= strength.score ? strength.color : C.accDim,
          }} />
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
        <span style={{ fontSize:10, color:strength.color, fontWeight:900 }}>{strength.label}</span>
        <span style={{ fontSize:10, color:C.textFaint, fontWeight:700, textAlign:'right' }}>{strength.hint}</span>
      </div>
    </div>
  );
};

const ParentSettings = ({ childState, childOptions, selectedId, onSelectChild }) => {
  const user = currentUser();
  const [prefs, setPrefs] = React.useState(() => readParentPrefs());
  const [studentId, setStudentId] = React.useState('');
  const [studentConsent, setStudentConsent] = React.useState(false);
  const [studentErrors, setStudentErrors] = React.useState({});
  const [linkStatus, setLinkStatus] = React.useState('');
  const [unlinkConfirm, setUnlinkConfirm] = React.useState(null);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordStatus, setPasswordStatus] = React.useState('');
  const [showPasswords, setShowPasswords] = React.useState({
    current:false,
    next:false,
    confirm:false,
  });
  const [busy, setBusy] = React.useState(false);

  const savePrefs = (next) => {
    setPrefs(next);
    writeLocal('tusyen_parent_prefs', next);
  };

  const updatePref = (key, value) => savePrefs({ ...prefs, [key]:value });
  const togglePassword = (key) => setShowPasswords(prev => ({ ...prev, [key]:!prev[key] }));

  const linkChild = async (e) => {
    e.preventDefault();
    const id = studentId.trim();
    const identifierError = validateChildIdentifier(id);
    const consentError = studentConsent ? '' : 'Sahkan persetujuan anak sebelum memaut akaun.';
    const nextErrors = {
      ...(identifierError ? { identifier:identifierError } : {}),
      ...(consentError ? { consent:consentError } : {}),
    };
    setStudentErrors(nextErrors);
    if (identifierError || consentError) return;
    setBusy(true);
    setLinkStatus('');
    try {
      await window.tusyenApi.linkParent(id);
      setStudentId('');
      setStudentConsent(false);
      setStudentErrors({});
      setLinkStatus('Anak berjaya dipaut.');
      childState.refresh();
    } catch (err) {
      setLinkStatus(parentLinkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unlinkChild = async (child) => {
    if (unlinkConfirm !== child.id) {
      setUnlinkConfirm(child.id);
      return;
    }
    setUnlinkConfirm(null);
    setBusy(true);
    setLinkStatus('');
    try {
      await window.tusyenApi.unlinkStudent(child.id);
      setLinkStatus(`${child.name} telah dikeluarkan daripada senarai.`);
      if (selectedId === child.id) onSelectChild('');
      childState.refresh();
    } catch (err) {
      setLinkStatus(err.message || 'Tidak dapat membuang pautan anak.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus('');
    if (newPassword !== confirmPassword) {
      setPasswordStatus('Kata laluan baharu tidak sepadan.');
      return;
    }
    setBusy(true);
    try {
      await window.tusyenApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('Kata laluan berjaya dikemas kini.');
    } catch (err) {
      setPasswordStatus(err.message || 'Tidak dapat menukar kata laluan.');
    } finally {
      setBusy(false);
    }
  };

  const inferredPreferredName = parentPreferredName(user, { ...prefs, preferredName:'' });
  const notificationOptions = [
    { value:'instant', label:'Serta-merta' },
    { value:'daily', label:'Harian' },
    { value:'weekly', label:'Mingguan' },
  ];

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Tetapan Ibu Bapa</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>{parentEmailText(user?.email)}</div>
      </div>

      <SectionLabel>👤 Paparan</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:800, marginBottom:6 }}>
          Nama panggilan untuk ucapan
        </label>
        <input
          value={prefs.preferredName || ''}
          onChange={e => updatePref('preferredName', e.target.value)}
          placeholder={inferredPreferredName}
          aria-label="Nama panggilan untuk ucapan"
          style={settingsInputStyle}
        />
        <div style={{ marginTop:7, fontSize:11, lineHeight:1.4, color:C.textFaint, fontWeight:700 }}>
          Jika kosong, Tusyen guna nama pertama akaun. Gelaran kehormat hanya dipaparkan jika akaun menyimpannya.
        </div>
      </Card>

      <ThemeSettingsCard />

      <SectionLabel>🔔 Notifikasi</SectionLabel>
      <Card style={{ marginBottom:14, padding:'4px 14px' }}>
        <ToggleRow label="Skor subjek rendah" checked={!!prefs.lowScore} onChange={value => updatePref('lowScore', value)} />
        <ToggleRow label="Kurang aktiviti belajar" checked={!!prefs.inactivity} onChange={value => updatePref('inactivity', value)} />
        <ToggleRow label="Tugasan atau kuiz baharu" checked={!!prefs.assignments} onChange={value => updatePref('assignments', value)} />
        <div style={{ borderBottom:'none' }}>
          <ToggleRow label="Pencapaian dan streak" checked={!!prefs.streaks} onChange={value => updatePref('streaks', value)} />
        </div>
        <div style={{ padding:'10px 0 6px' }}>
          <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, marginBottom:7 }}>Kekerapan ringkasan</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {notificationOptions.map(option => {
              const on = (prefs.notificationFrequency || 'daily') === option.value;
              return (
                <button key={option.value} onClick={() => updatePref('notificationFrequency', option.value)} style={{
                  flex:'1 1 92px',
                  background:on ? C.accDim : 'transparent',
                  border:`1.5px solid ${on ? C.borderB : C.border}`,
                  borderRadius:12, padding:'8px 9px',
                  color:on ? C.accPale : C.textMuted,
                  fontFamily:'Nunito', fontWeight:800, cursor:'pointer',
                  fontSize:11,
                }}>{option.label}</button>
              );
            })}
          </div>
          <div style={{ marginTop:7, fontSize:10, lineHeight:1.4, color:C.textFaint, fontWeight:700 }}>
            Pilihan ini mengawal ringkasan dalam aplikasi. Penghantaran luar aplikasi masih bergantung pada saluran notifikasi sekolah.
          </div>
        </div>
      </Card>

      <SectionLabel>👪 Anak Dipaut</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        {childState.loading ? [0,1].map(i => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
            <Skeleton width={34} height={34} radius={17} />
            <div style={{ flex:1 }}>
              <Skeleton width="55%" height={12} radius={6} style={{ marginBottom:6 }} />
              <Skeleton width="35%" height={10} radius={5} />
            </div>
          </div>
        )) : childOptions.length ? childOptions.map((child, i) => (
          <div key={child.id} style={{
            display:'flex', alignItems:'center', gap:10, padding:'8px 0',
            borderBottom:i < childOptions.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <Avatar name={child.name} size={34} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:13, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{child.name}</div>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>Tingkatan {child.form} • {child.cls}</div>
            </div>
            <button onClick={() => onSelectChild(child.id)} style={{
              background:selectedId === child.id ? C.accDim : 'transparent',
              border:`1px solid ${selectedId === child.id ? C.borderB : C.border}`,
              borderRadius:10, padding:'6px 9px',
              color:selectedId === child.id ? C.accPale : C.textMuted,
              fontFamily:'Nunito', fontWeight:800, fontSize:11, cursor:'pointer',
            }}>{selectedId === child.id ? 'Dipilih' : 'Pilih'}</button>
            {unlinkConfirm === child.id ? (
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={() => unlinkChild(child)} disabled={busy} style={{
                  background:'rgba(239,68,68,.14)', border:`1px solid rgba(239,68,68,.45)`,
                  borderRadius:10, padding:'6px 9px',
                  color:C.red, fontFamily:'Nunito', fontWeight:900,
                  fontSize:11, cursor:busy ? 'not-allowed' : 'pointer',
                }}>Pasti?</button>
                <button onClick={() => setUnlinkConfirm(null)} style={{
                  background:'transparent', border:`1px solid ${C.border}`,
                  borderRadius:10, padding:'6px 9px',
                  color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
                  fontSize:11, cursor:'pointer',
                }}>Batal</button>
              </div>
            ) : (
              <button onClick={() => unlinkChild(child)} disabled={busy} style={{
                background:'transparent', border:`1px solid rgba(239,68,68,.35)`,
                borderRadius:10, padding:'6px 9px',
                color:C.red, fontFamily:'Nunito', fontWeight:800,
                fontSize:11, cursor:busy ? 'not-allowed' : 'pointer', opacity:busy ? 0.55 : 1,
              }}>Buang</button>
            )}
          </div>
        )) : (
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5 }}>Belum ada anak dipaut.</div>
        )}

        <form onSubmit={linkChild} style={{ display:'grid', gap:8, marginTop:12 }}>
          <div style={{ display:'flex', gap:8 }}>
          <input
            id="parent-inline-child-id"
            value={studentId}
            onChange={e => {
              const next = e.target.value;
              setStudentId(next);
              if (studentErrors.identifier) {
                setStudentErrors(prev => ({ ...prev, identifier:validateChildIdentifier(next) }));
              }
            }}
            onBlur={() => setStudentErrors(prev => ({ ...prev, identifier:validateChildIdentifier(studentId) }))}
            placeholder="ID pelajar atau e-mel akaun pelajar"
            aria-label="ID pelajar atau e-mel akaun pelajar"
            aria-describedby={[
              'parent-inline-child-id-hint',
              studentErrors.identifier ? 'parent-inline-child-id-error' : '',
              linkStatus ? 'parent-inline-child-status' : '',
            ].filter(Boolean).join(' ')}
            aria-invalid={!!studentErrors.identifier}
            style={{
            flex:1, minWidth:0, background:C.bg, border:`1px solid ${studentErrors.identifier ? C.red : C.border}`,
            borderRadius:10, padding:'9px 10px', color:C.text,
            fontFamily:'Nunito', fontWeight:700, fontSize:12,
          }} />
          <button type="submit" disabled={busy} style={{
            background:C.accDim, border:`1px solid ${C.borderB}`,
            borderRadius:10, padding:'9px 12px',
            color:C.accPale, fontFamily:'Nunito', fontWeight:800,
            fontSize:12, cursor:busy ? 'not-allowed' : 'pointer',
            opacity:busy ? 0.6 : 1,
          }}>Tambah</button>
          </div>
          {studentErrors.identifier && <div id="parent-inline-child-id-error" role="alert" style={{ fontSize:11, color:C.red, fontWeight:850, lineHeight:1.35 }}>{studentErrors.identifier}</div>}
          <label style={{ display:'grid', gridTemplateColumns:'28px 1fr', gap:8, alignItems:'start', cursor:busy ? 'not-allowed' : 'pointer' }}>
            <input
              type="checkbox"
              checked={studentConsent}
              onChange={e => {
                const checked = e.target.checked;
                setStudentConsent(checked);
                setStudentErrors(prev => ({ ...prev, consent:checked ? '' : prev.consent }));
              }}
              disabled={busy}
              aria-describedby={studentErrors.consent ? 'parent-inline-child-consent-error' : 'parent-inline-child-id-hint'}
              aria-invalid={!!studentErrors.consent}
              style={{ width:20, height:20, margin:'1px 0 0', accentColor:C.acc }}
            />
            <span style={{ fontSize:11, color:C.text, fontWeight:750, lineHeight:1.4 }}>
              Saya mengesahkan anak bersetuju berkongsi kemajuan pembelajaran dengan akaun ibu bapa ini.
            </span>
          </label>
          {studentErrors.consent && <div id="parent-inline-child-consent-error" role="alert" style={{ fontSize:11, color:C.red, fontWeight:850, lineHeight:1.35 }}>{studentErrors.consent}</div>}
        </form>
        <div id="parent-inline-child-id-hint" style={{ marginTop:7, fontSize:11, lineHeight:1.4, color:C.textFaint, fontWeight:600 }}>
          Masukkan ID Tusyen pelajar dari profil anak atau e-mel akaun pelajar. Kod kelas guru tidak boleh digunakan di sini.
        </div>
        {linkStatus && <div id="parent-inline-child-status" aria-live="polite" style={{ marginTop:8, fontSize:11, color:parentStatusIsSuccess(linkStatus) ? C.green : C.red, fontWeight:800 }}>{linkStatus}</div>}
      </Card>

      <SectionLabel>🔐 Keselamatan Akaun</SectionLabel>
      <Card>
        <form onSubmit={changePassword} style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <PasswordField
            id="parent-settings-current-password"
            label="Kata laluan semasa"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Kata laluan semasa"
            autoComplete="current-password"
            visible={showPasswords.current}
            onToggle={() => togglePassword('current')}
          />
          <PasswordField
            id="parent-settings-new-password"
            label="Kata laluan baharu"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Kata laluan baharu"
            minLength={8}
            autoComplete="new-password"
            helper="Gunakan sekurang-kurangnya 8 aksara; frasa panjang yang unik lebih selamat."
            visible={showPasswords.next}
            onToggle={() => togglePassword('next')}
          />
          <PasswordStrengthMeter value={newPassword} />
          <PasswordField
            id="parent-settings-confirm-password"
            label="Sahkan kata laluan baharu"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Sahkan kata laluan baharu"
            minLength={8}
            autoComplete="new-password"
            visible={showPasswords.confirm}
            onToggle={() => togglePassword('confirm')}
          />
          <button type="submit" disabled={busy || !currentPassword || !newPassword || !confirmPassword} style={{
            background:'linear-gradient(135deg, var(--c-acc-lo), var(--c-acc))',
            border:'none', borderRadius:12, padding:'11px 12px',
            color:'#fff', fontFamily:'Nunito', fontWeight:800,
            fontSize:13, cursor:busy ? 'not-allowed' : 'pointer',
            opacity:busy || !currentPassword || !newPassword || !confirmPassword ? 0.55 : 1,
          }}>Kemas kini kata laluan</button>
        </form>
        {passwordStatus && <div role="alert" style={{ marginTop:8, fontSize:11, color:parentStatusIsSuccess(passwordStatus) ? C.green : C.red, fontWeight:800 }}>{passwordStatus}</div>}
      </Card>

      <AccountActionsCard />

      <div style={{ height:8 }} />
    </div>
  );
};

// ── ParentPostsPage ───────────────────────────────────────────

const SettingsAccordion = ({ title, subtitle, open, saved, onToggle, children }) => (
  <section style={{ marginBottom:12 }}>
    <button type="button" onClick={onToggle} aria-expanded={open} style={{
      width:'100%', minHeight:54,
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      background:C.card, border:`1px solid ${open ? C.borderB : C.border}`,
      borderRadius:12, padding:'10px 12px',
      color:C.text, fontFamily:'Nunito', cursor:'pointer', textAlign:'left',
    }}>
      <span style={{ minWidth:0 }}>
        <span style={{ display:'block', fontWeight:900, fontSize:14, color:C.text }}>{title}</span>
        {subtitle && <span style={{ display:'block', marginTop:2, fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.35 }}>{subtitle}</span>}
      </span>
      <span style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        {saved && <span style={parentChipStyle('good')}>Disimpan</span>}
        <span aria-hidden="true" style={{ fontSize:16, color:C.textMuted }}>{open ? '-' : '+'}</span>
      </span>
    </button>
    {open && <div style={{ padding:'10px 0 2px' }}>{children}</div>}
  </section>
);

const ParentSettingsV2 = ({ childState, childOptions, selectedId, onSelectChild }) => {
  const user = currentUser();
  const [prefs, setPrefs] = React.useState(() => readParentPrefs());
  const [openSections, setOpenSections] = React.useState({ notifications:true, privacy:false, children:false, language:false, account:false, security:false });
  const [savedSection, setSavedSection] = React.useState('');
  const [linkStatus, setLinkStatus] = React.useState('');
  const [showAddChild, setShowAddChild] = React.useState(false);
  const [unlinkTarget, setUnlinkTarget] = React.useState(null);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordStatus, setPasswordStatus] = React.useState('');
  const [showPasswords, setShowPasswords] = React.useState({ current:false, next:false, confirm:false });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.lang = (prefs.language || 'ms') === 'en' ? 'en' : 'ms';
  }, [prefs.language]);

  const markSaved = (section) => {
    setSavedSection(section);
    if (ParentSettingsV2._saveTimer) window.clearTimeout?.(ParentSettingsV2._saveTimer);
    ParentSettingsV2._saveTimer = window.setTimeout?.(() => setSavedSection(''), 2200);
  };

  const toggleSection = (section) => setOpenSections(prev => ({ ...prev, [section]:!prev[section] }));
  const togglePassword = (key) => setShowPasswords(prev => ({ ...prev, [key]:!prev[key] }));
  const savePrefs = (next, section = 'notifications') => {
    setPrefs(next);
    writeLocal('tusyen_parent_prefs', next);
    markSaved(section);
  };
  const updatePref = (key, value, section = 'notifications') => savePrefs({ ...prefs, [key]:value }, section);

  const linkChildById = async (identifier) => {
    const id = `${identifier || ''}`.trim();
    if (!id) return;
    setBusy(true);
    setLinkStatus('');
    try {
      await window.tusyenApi.linkParent(id);
      setLinkStatus('Anak berjaya dipaut.');
      setShowAddChild(false);
      markSaved('children');
      childState.refresh();
    } catch (err) {
      setLinkStatus(parentLinkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmUnlinkChild = async () => {
    if (!unlinkTarget) return;
    setBusy(true);
    setLinkStatus('');
    try {
      await window.tusyenApi.unlinkStudent(unlinkTarget.id);
      setLinkStatus(`${unlinkTarget.name} telah dikeluarkan daripada senarai.`);
      if (selectedId === unlinkTarget.id) onSelectChild('');
      setUnlinkTarget(null);
      markSaved('children');
      childState.refresh();
    } catch (err) {
      setLinkStatus(err.message || 'Tidak dapat membuang pautan anak.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus('');
    if (newPassword !== confirmPassword) {
      setPasswordStatus('Kata laluan baharu tidak sepadan.');
      return;
    }
    setBusy(true);
    try {
      await window.tusyenApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('Kata laluan berjaya dikemas kini.');
      markSaved('security');
    } catch (err) {
      setPasswordStatus(err.message || 'Tidak dapat menukar kata laluan.');
    } finally {
      setBusy(false);
    }
  };

  const inferredPreferredName = parentPreferredName(user, { ...prefs, preferredName:'' });
  const notificationOptions = [
    { value:'instant', label:'Serta-merta' },
    { value:'daily', label:'Harian' },
    { value:'weekly', label:'Mingguan' },
  ];
  const languageOptions = [
    { value:'ms', label:'Bahasa Melayu', hint:'Istilah sekolah dan ibu bapa dikekalkan.' },
    { value:'en', label:'English', hint:'Stores the preference for English app copy.' },
  ];

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Tetapan Ibu Bapa</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>{parentEmailText(user?.email)}</div>
      </div>

      <SettingsAccordion title="Notifikasi" subtitle="Pilih makluman yang penting dan kekerapan ringkasan." open={openSections.notifications} saved={savedSection === 'notifications'} onToggle={() => toggleSection('notifications')}>
        <Card style={{ marginBottom:0, padding:'4px 14px' }}>
          <ToggleRow label="Skor subjek rendah" checked={!!prefs.lowScore} onChange={value => updatePref('lowScore', value, 'notifications')} />
          <ToggleRow label="Kurang aktiviti belajar" checked={!!prefs.inactivity} onChange={value => updatePref('inactivity', value, 'notifications')} />
          <ToggleRow label="Tugasan atau kuiz baharu" checked={!!prefs.assignments} onChange={value => updatePref('assignments', value, 'notifications')} />
          <div style={{ borderBottom:'none' }}>
            <ToggleRow label="Pencapaian dan streak" checked={!!prefs.streaks} onChange={value => updatePref('streaks', value, 'notifications')} />
          </div>
          <div style={{ padding:'10px 0 6px' }}>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, marginBottom:7 }}>Kekerapan ringkasan</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(104px, 1fr))', gap:8 }}>
              {notificationOptions.map(option => {
                const on = (prefs.notificationFrequency || 'daily') === option.value;
                return (
                  <button key={option.value} onClick={() => updatePref('notificationFrequency', option.value, 'notifications')} style={{
                    minHeight:44,
                    background:on ? C.accDim : 'transparent',
                    border:`1.5px solid ${on ? C.borderB : C.border}`,
                    borderRadius:12, padding:'9px 10px',
                    color:on ? C.accPale : C.textMuted,
                    fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
                    fontSize:12,
                  }}>{option.label}</button>
                );
              })}
            </div>
            <div style={{ marginTop:8, fontSize:10, lineHeight:1.4, color:C.textFaint, fontWeight:700 }}>
              Pilihan ini mengawal ringkasan dalam aplikasi. Penghantaran luar aplikasi masih bergantung pada saluran notifikasi sekolah.
            </div>
          </div>
        </Card>
      </SettingsAccordion>

      <SettingsAccordion title="Privasi" subtitle="Kawal cara data ibu bapa dan anak diterangkan dalam aplikasi." open={openSections.privacy} saved={savedSection === 'privacy'} onToggle={() => toggleSection('privacy')}>
        <Card style={{ marginBottom:0 }}>
          <div style={{ fontSize:12, color:C.text, fontWeight:800, lineHeight:1.45, marginBottom:8 }}>
            Pautan ibu bapa hanya memaparkan kemajuan, kelas, amaran, dan pos yang berkaitan dengan anak dipaut.
          </div>
          <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.5, marginBottom:10 }}>
            Status dibaca, amaran disembunyikan, dan soalan untuk guru disimpan pada peranti ini sahaja. Ia tidak menghantar mesej kepada guru secara automatik.
          </div>
          <button type="button" onClick={() => markSaved('privacy')} style={{
            width:'100%', minHeight:44,
            background:'transparent', border:`1px solid ${C.border}`,
            borderRadius:10, padding:'10px 12px',
            color:C.textMuted, fontFamily:'Nunito', fontWeight:900,
            fontSize:12, cursor:'pointer',
          }}>Saya faham</button>
        </Card>
      </SettingsAccordion>

      <SettingsAccordion title="Anak Dipaut" subtitle={`${childOptions.length} anak dipaut. Pautan memerlukan ID atau e-mel akaun pelajar.`} open={openSections.children} saved={savedSection === 'children'} onToggle={() => toggleSection('children')}>
        <Card style={{ marginBottom:0 }}>
          <div style={{ background:C.accDim, border:`1px solid ${C.borderB}`, borderRadius:12, padding:10, marginBottom:10, fontSize:11, color:C.accPale, fontWeight:800, lineHeight:1.45 }}>
            Privasi: ibu bapa hanya melihat kemajuan, kelas, dan pos berkaitan anak yang dipaut. Pastikan anak bersetuju sebelum memaut akaun.
          </div>
          {childState.loading ? [0,1].map(i => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
              <Skeleton width={34} height={34} radius={17} />
              <div style={{ flex:1 }}>
                <Skeleton width="55%" height={12} radius={6} style={{ marginBottom:6 }} />
                <Skeleton width="35%" height={10} radius={5} />
              </div>
            </div>
          )) : childOptions.length ? childOptions.map((child, i) => (
            <div key={child.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:i < childOptions.length - 1 ? `1px solid ${C.border}` : 'none', flexWrap:'wrap' }}>
              <Avatar name={child.name} size={34} />
              <div style={{ flex:'1 1 150px', minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:13, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{child.name}</div>
                <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>Tingkatan {child.form} - {child.cls}</div>
              </div>
              <button onClick={() => { onSelectChild(child.id); markSaved('children'); }} style={{ minHeight:44, background:selectedId === child.id ? C.accDim : 'transparent', border:`1px solid ${selectedId === child.id ? C.borderB : C.border}`, borderRadius:10, padding:'9px 11px', color:selectedId === child.id ? C.accPale : C.textMuted, fontFamily:'Nunito', fontWeight:900, fontSize:11, cursor:'pointer' }}>{selectedId === child.id ? 'Dipilih' : 'Pilih'}</button>
              <button onClick={() => setUnlinkTarget(child)} disabled={busy} style={{ minHeight:44, background:'transparent', border:`1px solid rgba(239,68,68,.35)`, borderRadius:10, padding:'9px 11px', color:C.red, fontFamily:'Nunito', fontWeight:850, fontSize:11, cursor:busy ? 'not-allowed' : 'pointer', opacity:busy ? 0.55 : 1 }}>Buang Pautan</button>
            </div>
          )) : (
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5, marginBottom:10 }}>Belum ada anak dipaut.</div>
          )}
          <button
            type="button"
            data-testid="add-child"
            onClick={() => setShowAddChild(true)}
            style={{ width:'100%', minHeight:44, marginTop:12, background:C.accDim, border:`1px solid ${C.borderB}`, borderRadius:10, padding:'10px 12px', color:C.accPale, fontFamily:'Nunito', fontWeight:900, fontSize:12, cursor:'pointer' }}
          >
            Tambah Anak
          </button>
          {linkStatus && <div style={{ marginTop:8, fontSize:11, color:parentStatusIsSuccess(linkStatus) ? C.green : C.red, fontWeight:800 }}>{linkStatus}</div>}
        </Card>
      </SettingsAccordion>

      <SettingsAccordion title="Bahasa" subtitle="Simpan pilihan bahasa untuk paparan ibu bapa." open={openSections.language} saved={savedSection === 'language'} onToggle={() => toggleSection('language')}>
        <Card style={{ marginBottom:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(132px, 1fr))', gap:8 }}>
            {languageOptions.map(option => {
              const on = (prefs.language || 'ms') === option.value;
              return (
                <button key={option.value} type="button" onClick={() => updatePref('language', option.value, 'language')} style={{
                  minHeight:58,
                  background:on ? C.accDim : 'transparent',
                  border:`1.5px solid ${on ? C.borderB : C.border}`,
                  borderRadius:12,
                  padding:'10px 11px',
                  color:on ? C.accPale : C.text,
                  fontFamily:'Nunito',
                  fontWeight:900,
                  fontSize:12,
                  cursor:'pointer',
                  textAlign:'left',
                }}>
                  <span style={{ display:'block' }}>{option.label}</span>
                  <span style={{ display:'block', marginTop:3, color:C.textFaint, fontWeight:700, fontSize:10, lineHeight:1.3 }}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </SettingsAccordion>

      <SettingsAccordion title="Akaun" subtitle="Nama panggilan, tema, dan tindakan akaun." open={openSections.account} saved={savedSection === 'account'} onToggle={() => toggleSection('account')}>
        <Card style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:11, color:C.textMuted, fontWeight:800, marginBottom:6 }}>Nama panggilan untuk ucapan</label>
          <input value={prefs.preferredName || ''} onChange={e => updatePref('preferredName', e.target.value, 'account')} placeholder={inferredPreferredName} aria-label="Nama panggilan untuk ucapan" style={settingsInputStyle} />
          <div style={{ marginTop:7, fontSize:11, lineHeight:1.4, color:C.textFaint, fontWeight:700 }}>
            Jika kosong, Tusyen guna nama pertama akaun. Gelaran kehormat hanya dipaparkan jika akaun menyimpannya.
          </div>
        </Card>
        <ThemeSettingsCard />
        <AccountActionsCard />
      </SettingsAccordion>

      <SettingsAccordion title="Keselamatan Akaun" subtitle="Tukar kata laluan akaun ibu bapa. Butang tunjuk/sembunyi hanya mengubah paparan medan." open={openSections.security} saved={savedSection === 'security'} onToggle={() => toggleSection('security')}>
        <Card>
          <form onSubmit={changePassword} style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <PasswordField id="parent-security-current-password" label="Kata laluan semasa" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Kata laluan semasa" autoComplete="current-password" visible={showPasswords.current} onToggle={() => togglePassword('current')} />
            <PasswordField id="parent-security-new-password" label="Kata laluan baharu" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Kata laluan baharu" minLength={8} autoComplete="new-password" helper="Gunakan sekurang-kurangnya 8 aksara; frasa panjang yang unik lebih selamat." visible={showPasswords.next} onToggle={() => togglePassword('next')} />
            <PasswordStrengthMeter value={newPassword} />
            <PasswordField id="parent-security-confirm-password" label="Sahkan kata laluan baharu" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Sahkan kata laluan baharu" minLength={8} autoComplete="new-password" visible={showPasswords.confirm} onToggle={() => togglePassword('confirm')} />
            <button type="submit" disabled={busy || !currentPassword || !newPassword || !confirmPassword} style={{ minHeight:44, background:'linear-gradient(135deg, var(--c-acc-lo), var(--c-acc))', border:'none', borderRadius:12, padding:'11px 12px', color:'#fff', fontFamily:'Nunito', fontWeight:900, fontSize:13, cursor:busy ? 'not-allowed' : 'pointer', opacity:busy || !currentPassword || !newPassword || !confirmPassword ? 0.55 : 1 }}>Kemas kini kata laluan</button>
          </form>
          {passwordStatus && <div role="alert" style={{ marginTop:8, fontSize:11, color:parentStatusIsSuccess(passwordStatus) ? C.green : C.red, fontWeight:800 }}>{passwordStatus}</div>}
        </Card>
      </SettingsAccordion>

      <GuidedAddChildModal open={showAddChild} busy={busy} status={linkStatus} onSubmit={linkChildById} onClose={() => setShowAddChild(false)} />

      {unlinkTarget && (
        <ParentConfirmModal title="Buang pautan anak?" confirmLabel="Buang Pautan" cancelLabel="Batal" danger busy={busy} onCancel={() => !busy && setUnlinkTarget(null)} onConfirm={confirmUnlinkChild}>
          Ini tidak memadam akaun {unlinkTarget.name}. Ibu bapa hanya tidak lagi melihat kemajuan dan pos kelas anak ini dalam akaun ini.
        </ParentConfirmModal>
      )}

      <div style={{ height:8 }} />
    </div>
  );
};

const POST_TYPE_META = {
  announcement: { icon:'📢', label:'Pengumuman', color: () => C.blue   },
  assignment:   { icon:'📋', label:'Tugasan', color: () => C.orange  },
  general:      { icon:'💬', label:'Perbincangan', color: () => C.textMuted },
};

const postTypeMeta = (type) =>
  POST_TYPE_META[(type || '').toLowerCase()] || { icon:'✅', label:'Pos', color: () => C.textMuted };

const parentPostMode = (post) => {
  const type = `${post?.post_type || ''}`.toLowerCase();
  if (type === 'announcement') {
    return {
      label:'Pengumuman baca sahaja',
      tone:'info',
      canComment:false,
      reactionLabel:'Saya sudah baca',
      commentLabel:'Komen ditutup',
      hint:'Pengumuman ini untuk dibaca sahaja. Gunakan reaksi sebagai tanda ibu bapa sudah melihat makluman.',
    };
  }
  if (type === 'assignment') {
    return {
      label:'Perlu tindakan ibu bapa',
      tone:'warn',
      canComment:true,
      reactionLabel:'Tandai sudah baca',
      commentLabel:'Maklum balas',
      hint:'Semak arahan guru bersama anak. Reaksi menandakan pos sudah dilihat; komen boleh digunakan untuk maklum balas ringkas.',
    };
  }
  return {
    label:'Perbincangan dibuka',
    tone:'neutral',
    canComment:true,
    reactionLabel:'Reaksi',
    commentLabel:'Perbincangan',
    hint:'Pos ini membenarkan perbincangan. Ibu bapa boleh memberi reaksi atau menulis komen yang berkaitan kelas.',
  };
};

const ParentPostsPage = ({ childState, child, childOptions, selectedId, onSelectChild, onOpenSettings }) => {
  const [filterClassroomId, setFilterClassroomId] = React.useState(null);
  const [postsData, setPostsData] = React.useState({ posts:[], loading:true, error:null });
  const [likeMap, setLikeMap] = React.useState({});     // postId → { count, reacted }
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const [commentsMap, setCommentsMap] = React.useState({});  // postId → { list, loading }
  const [commentDraft, setCommentDraft] = React.useState({});  // postId → string
  const [teacherModalId, setTeacherModalId] = React.useState(null);
  const [deleteCommentTarget, setDeleteCommentTarget] = React.useState(null);
  const narrow = useNarrow(640);

  // Derive classrooms from the selected child
  const childClassroomIds = new Set((child?.classrooms || []).map(cls => cls.id));

  const loadPosts = React.useCallback(async (clsId) => {
    setPostsData(prev => ({ ...prev, loading:true, error:null }));
    try {
      const params = clsId ? { classroomId:clsId, limit:30 } : { limit:30 };
      const { posts } = await window.tusyenApi.feedPosts(params);
      const filtered = (posts || []).filter(post =>
        childClassroomIds.size === 0 || childClassroomIds.has(post.classroom_id)
      );
      setPostsData({ posts:filtered, loading:false, error:null });
      // Initialise like map for posts not yet tracked
      setLikeMap(prev => {
        const next = { ...prev };
        filtered.forEach(p => {
          if (!(p.id in next)) {
            next[p.id] = { count:Number(p.like_count || 0), reacted:!!p.user_has_reacted };
          }
        });
        return next;
      });
    } catch (err) {
      setPostsData({ posts:[], loading:false, error:err });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  React.useEffect(() => {
    if (!child) return;
    loadPosts(filterClassroomId);
  }, [child?.id, filterClassroomId, loadPosts]);

  // Derive unique classrooms from loaded posts (matching child)
  const classroomChips = React.useMemo(() => {
    const seen = new Map();
    postsData.posts.forEach(p => {
      if (p.classroom_id && !seen.has(p.classroom_id)) {
        seen.set(p.classroom_id, parentText(p.classroom_name, 'Kelas', 54));
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [postsData.posts]);

  const toggleLike = async (post) => {
    const prev = likeMap[post.id] || { count:Number(post.like_count || 0), reacted:!!post.user_has_reacted };
    const next = { count:prev.count + (prev.reacted ? -1 : 1), reacted:!prev.reacted };
    setLikeMap(m => ({ ...m, [post.id]:next }));
    try {
      await window.tusyenApi.toggleReaction(post.id);
    } catch {
      setLikeMap(m => ({ ...m, [post.id]:prev }));
    }
  };

  const toggleExpand = async (postId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) { next.delete(postId); return next; }
      next.add(postId);
      return next;
    });
    // Lazy-load comments on first open
    if (!commentsMap[postId]) {
      setCommentsMap(m => ({ ...m, [postId]:{ list:[], loading:true } }));
      try {
        const { comments } = await window.tusyenApi.postComments(postId);
        setCommentsMap(m => ({ ...m, [postId]:{ list:comments || [], loading:false } }));
      } catch {
        setCommentsMap(m => ({ ...m, [postId]:{ list:[], loading:false } }));
      }
    }
  };

  const submitComment = async (postId) => {
    const text = (commentDraft[postId] || '').trim();
    if (!text) return;
    setCommentDraft(d => ({ ...d, [postId]:'' }));
    try {
      const { comment } = await window.tusyenApi.addComment(postId, text);
      setCommentsMap(m => ({
        ...m,
        [postId]:{ list:[...(m[postId]?.list || []), comment], loading:false },
      }));
    } catch {
      setCommentDraft(d => ({ ...d, [postId]:text }));
    }
  };

  const deleteComment = async () => {
    if (!deleteCommentTarget) return;
    const { postId, commentId } = deleteCommentTarget;
    try {
      await window.tusyenApi.deleteComment(postId, commentId);
      setCommentsMap(m => ({
        ...m,
        [postId]:{ ...m[postId], list:(m[postId]?.list || []).filter(c => c.id !== commentId) },
      }));
      setDeleteCommentTarget(null);
    } catch {
      // Silently fail — comment stays visible
    }
  };

  if (!child) return <NoLinkedChild onOpenSettings={onOpenSettings} childState={childState} />;
  const teacherAnnouncements = postsData.posts.filter(post => `${post.post_type || ''}`.toLowerCase() === 'announcement');
  const discussionPosts = postsData.posts.filter(post => `${post.post_type || ''}`.toLowerCase() !== 'announcement');
  const postSections = [
    { id:'announcements', title:'Pengumuman Guru', posts:teacherAnnouncements },
    { id:'discussion', title:'Perbincangan & Balasan', posts:discussionPosts },
  ].filter(section => section.posts.length);

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Pos Kelas</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>{child.name}</div>
      </div>

      <ChildSwitcher childOptions={childOptions} selectedId={selectedId} onSelect={onSelectChild} />

      {/* Classroom filter chips */}
      {classroomChips.length > 0 && (
        <div style={{
          display:'flex',
          gap:6,
          flexWrap:narrow ? 'wrap' : 'nowrap',
          overflowX:narrow ? 'visible' : 'auto',
          paddingBottom:4,
          marginBottom:12,
        }}>
          {[{ id:null, name:'Semua' }, ...classroomChips].map(chip => {
            const on = filterClassroomId === chip.id;
            return (
              <button key={chip.id || '__all'} onClick={() => setFilterClassroomId(chip.id)} style={{
                flexShrink:narrow ? 1 : 0,
                maxWidth:'100%',
                minHeight:44,
                background: on ? C.accDim : 'transparent',
                border: on ? `1.5px solid ${C.borderB}` : `1.5px solid ${C.border}`,
                borderRadius:20, padding:'8px 14px',
                fontSize:12, fontWeight:700, cursor:'pointer',
                color: on ? C.accPale : C.textMuted,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                fontFamily:'Nunito', transition:'all .2s',
              }}>{parentText(chip.name, 'Kelas', 54)}</button>
            );
          })}
        </div>
      )}

      {postsData.error && (
        <div style={{ marginBottom:14 }}>
          <ErrorRetry message={postsData.error.message || 'Tidak dapat memuat pos.'} onRetry={() => loadPosts(filterClassroomId)} />
        </div>
      )}

      {postsData.loading ? [0,1,2].map(i => (
        <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:14, marginBottom:10 }}>
          <Skeleton width="35%" height={12} radius={6} style={{ marginBottom:8 }} />
          <Skeleton width="78%" height={15} radius={8} style={{ marginBottom:7 }} />
          <Skeleton width="95%" height={11} radius={6} style={{ marginBottom:5 }} />
          <Skeleton width="60%" height={11} radius={6} />
        </div>
      )) : postsData.posts.length ? postSections.map(section => (
        <React.Fragment key={section.id}>
          <SectionLabel>{section.title}</SectionLabel>
          {section.posts.map(post => {
        const meta = postTypeMeta(post.post_type);
        const mode = parentPostMode(post);
        const like = likeMap[post.id] || { count:Number(post.like_count || 0), reacted:!!post.user_has_reacted };
        const expanded = expandedIds.has(post.id);
        const cmts = commentsMap[post.id];
        const cleanContent = parentBodyText(post.content, '', 220);
        const snippet = cleanContent.length > 120 ? cleanContent.slice(0, 120) + '…' : cleanContent;
        const postTitle = parentTitle(post.title, '');
        const classroomLabel = parentText(post.classroom_name, '', 54);
        const teacherLabel = parentName(post.teacher_name, '');

        return (
          <div key={post.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:14, marginBottom:10 }}>
            {/* Header row */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <span style={{
                fontSize:10, fontWeight:800, color:meta.color(),
                background:`color-mix(in srgb,${meta.color()} 14%,transparent)`,
                borderRadius:20, padding:'2px 8px',
              }}>{meta.icon} {meta.label}</span>
              <span style={parentChipStyle(mode.tone)}>{mode.label}</span>
              {post.is_pinned && <span style={{ fontSize:11 }}>📌</span>}
              <span style={{ flex:1 }} />
              <span style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>{window.timeAgo(post.created_at)}</span>
            </div>

            {/* Classroom & teacher meta */}
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:5 }}>
              {classroomLabel && <span>{classroomLabel}</span>}
              {classroomLabel && teacherLabel && <span> • </span>}
              {teacherLabel && (
                window.TeacherProfileModal
                  ? <span
                      onClick={() => setTeacherModalId(post.teacher_id)}
                      style={{ cursor:'pointer', color:C.accPale, textDecoration:'underline dotted' }}
                    >{teacherLabel}</span>
                  : <span>{teacherLabel}</span>
              )}
            </div>

            {/* Title & snippet */}
            {postTitle && (
              <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:4, lineHeight:1.4 }}>{postTitle}</div>
            )}
            {snippet && (
              <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, lineHeight:1.5, marginBottom:8 }}>{snippet}</div>
            )}
            <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.4, marginBottom:8 }}>
              {mode.hint}
            </div>

            {/* Actions row */}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4, flexWrap:'wrap' }}>
              {mode.canComment ? (
                <>
                  <button onClick={() => toggleExpand(post.id)} style={{
                    flex:'1 1 170px',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    background: expanded ? C.accDim : `color-mix(in srgb,${C.acc} 13%,transparent)`,
                    border:`1px solid ${expanded ? C.borderB : 'color-mix(in srgb,var(--c-acc) 36%,transparent)'}`,
                    borderRadius:12, padding:'9px 12px', minHeight:44,
                    color:C.accPale,
                    fontFamily:'Nunito', fontWeight:900, fontSize:12, cursor:'pointer',
                  }}>
                    💬 {mode.commentLabel} ({cmts ? cmts.list.length : Number(post.comment_count || 0)})
                  </button>
                  <button onClick={() => toggleLike(post)} style={{
                    display:'flex', alignItems:'center', gap:4,
                    background:'transparent', border:'none',
                    borderRadius:10, padding:'8px 8px', minHeight:44,
                    color: like.reacted ? C.red : C.textFaint,
                    fontFamily:'Nunito', fontWeight:800, fontSize:11, cursor:'pointer',
                  }}>
                    <span>{like.reacted ? '❤️' : '🤍'}</span>
                    <span>{mode.reactionLabel}</span>
                    <span>{like.count}</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => toggleLike(post)} style={{
                    flex:'1 1 170px',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    background:like.reacted ? 'rgba(34,197,94,.10)' : C.accDim,
                    border:`1px solid ${like.reacted ? 'rgba(34,197,94,.30)' : C.borderB}`,
                    borderRadius:12, padding:'9px 12px', minHeight:44,
                    color: like.reacted ? C.green : C.accPale,
                    fontFamily:'Nunito', fontWeight:900, fontSize:12, cursor:'pointer',
                  }}>
                    <span>{like.reacted ? '❤️' : '🤍'}</span>
                    <span>{mode.reactionLabel}</span>
                    <span>{like.count}</span>
                  </button>
                  <span style={parentChipStyle('neutral')}>{mode.commentLabel}</span>
                </>
              )}
            </div>

            {/* Expanded comments */}
            {expanded && mode.canComment && (
              <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                {cmts?.loading ? (
                  <div style={{ padding:'6px 0' }}>
                    <Skeleton width="70%" height={11} radius={6} style={{ marginBottom:6 }} />
                    <Skeleton width="50%" height={11} radius={6} />
                  </div>
                ) : (cmts?.list || []).length ? (cmts.list).map(comment => (
                  <div key={comment.id} style={{ display:'flex', gap:8, marginBottom:10, alignItems:'flex-start' }}>
                    <Avatar name={parentName(comment.author_name, 'Pengguna')} size={28} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontWeight:700, fontSize:12, color:C.text }}>{parentName(comment.author_name, 'Pengguna')}</span>
                        <span style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>{window.timeAgo(comment.created_at)}</span>
                      </div>
                      <div style={{ fontSize:12, color:C.text, lineHeight:1.4, marginTop:2 }}>{parentBodyText(comment.content, '', 180)}</div>
                    </div>
                    {comment.author_id === window.tusyenUser?.id && (
                      <button onClick={() => setDeleteCommentTarget({ postId:post.id, commentId:comment.id })} style={{
                        flexShrink:0, background:'transparent', border:'none',
                        color:C.red, fontFamily:'Nunito', fontWeight:800, fontSize:11,
                        cursor:'pointer', padding:'8px 6px', minHeight:44,
                      }}>Padam</button>
                    )}
                  </div>
                )) : (
                  <div style={{ fontSize:12, color:C.textFaint, fontWeight:600, marginBottom:10 }}>Tiada ulasan lagi.</div>
                )}

                {/* Comment compose */}
                <div style={{ display:'flex', gap:8, alignItems:'flex-end', marginTop:6 }}>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={commentDraft[post.id] || ''}
                    onChange={e => setCommentDraft(d => ({ ...d, [post.id]:e.target.value }))}
                    placeholder="Tulis ulasan…"
                    style={{
                      flex:1, background:C.bg, border:`1px solid ${C.border}`,
                      borderRadius:10, padding:'8px 10px', color:C.text,
                      fontFamily:'Nunito', fontWeight:700, fontSize:12,
                      resize:'vertical', minHeight:44,
                    }}
                  />
                  <button
                    onClick={() => submitComment(post.id)}
                    disabled={!(commentDraft[post.id] || '').trim()}
                    style={{
                      background:C.accDim, border:`1px solid ${C.borderB}`,
                      borderRadius:10, padding:'8px 12px', minHeight:44,
                      color:C.accPale, fontFamily:'Nunito', fontWeight:800,
                      fontSize:12, cursor:'pointer',
                      opacity:(commentDraft[post.id] || '').trim() ? 1 : 0.5,
                    }}>Hantar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
        </React.Fragment>
      )) : (
        <EmptyState icon="📢" title="Tiada pos" subtitle="Pos daripada kelas anak akan muncul di sini." />
      )}

      {/* Teacher profile modal */}
      {teacherModalId && window.TeacherProfileModal && (
        <window.TeacherProfileModal teacherId={teacherModalId} onClose={() => setTeacherModalId(null)} />
      )}

      {deleteCommentTarget && (
        <ParentConfirmModal
          title="Padam komen?"
          confirmLabel="Padam"
          cancelLabel="Batal"
          danger
          onCancel={() => setDeleteCommentTarget(null)}
          onConfirm={deleteComment}
        >
          Komen ini akan disembunyikan daripada perbincangan pos kelas.
        </ParentConfirmModal>
      )}

      <div style={{ height:8 }} />
    </div>
  );
};

// ── ParentChildrenPage ────────────────────────────────────────

const ParentChildrenPage = ({ childState, childOptions, selectedId, onSelectChild, onOpenSettings, onNavigate }) => {
  const [linkStatus, setLinkStatus] = React.useState('');
  const [showAddChild, setShowAddChild] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const linkChild = async (identifier) => {
    const id = `${identifier || ''}`.trim();
    if (!id) return;
    setBusy(true);
    setLinkStatus('');
    try {
      await window.tusyenApi.linkParent(id);
      setLinkStatus('Anak berjaya dipaut.');
      setShowAddChild(false);
      childState.refresh();
    } catch (err) {
      setLinkStatus(parentLinkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Anak Dipaut</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>
          {childState.loading
            ? 'Memuatkan…'
            : `${childOptions.length} anak didaftarkan`}
        </div>
      </div>

      <ChildSwitcher childOptions={childOptions} selectedId={selectedId} onSelect={onSelectChild} />

      {childState.loading ? [0,1].map(i => (
        <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:14, marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Skeleton width={48} height={48} radius={24} />
            <div style={{ flex:1 }}>
              <Skeleton width="55%" height={15} radius={8} style={{ marginBottom:7 }} />
              <Skeleton width="38%" height={11} radius={6} style={{ marginBottom:7 }} />
              <div style={{ display:'flex', gap:6 }}>
                <Skeleton width={62} height={18} radius={20} />
                <Skeleton width={70} height={18} radius={20} />
              </div>
            </div>
          </div>
        </div>
      )) : childOptions.length === 0 ? (
        <NoLinkedChild onOpenSettings={onOpenSettings} childState={childState} />
      ) : childOptions.map(child => {
        const isActive = child.id === selectedId;
        return (
          <Card key={child.id} style={{ marginBottom:10, border:`1px solid ${isActive ? C.borderB : C.border}`, boxShadow: isActive ? `0 0 16px ${C.accGlow}` : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <Avatar name={child.name} size={48} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0, flexWrap:'wrap' }}>
                  <div style={{ fontWeight:800, fontSize:16, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{child.name}</div>
                  {isActive && <span style={parentChipStyle('info')}>Sedang dilihat</span>}
                </div>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>Tingkatan {child.form} • {child.cls}</div>
                <div style={{ fontSize:11, color:C.textFaint, fontWeight:600, marginTop:1 }}>{parentEmailText(child.email, '')}</div>
                <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, fontWeight:800, color:C.orange, background:'rgba(255,150,0,.12)', borderRadius:20, padding:'2px 8px' }}>🔥 {child.streak} hari</span>
                  <span style={{ fontSize:11, fontWeight:800, color:C.gold,   background:'rgba(245,166,35,.12)', borderRadius:20, padding:'2px 8px' }}>⚡ {child.xp} XP</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              <button onClick={() => onSelectChild(child.id)} style={{
                background: isActive ? C.accDim : 'transparent',
                border:`1.5px solid ${isActive ? C.borderB : C.border}`,
                borderRadius:12, padding:'9px 14px', minHeight:44,
                color: isActive ? C.accPale : C.textMuted,
                fontFamily:'Nunito', fontWeight:800, fontSize:12, cursor:'pointer',
              }}>{isActive ? 'Dipilih' : 'Pilih'}</button>
              <button onClick={() => { onSelectChild(child.id); onNavigate('progress'); }} style={{
                background:'transparent',
                border:`1.5px solid ${C.border}`,
                borderRadius:12, padding:'9px 14px', minHeight:44,
                color:C.textMuted,
                fontFamily:'Nunito', fontWeight:800, fontSize:12, cursor:'pointer',
              }}>Lihat Kemajuan</button>
            </div>
          </Card>
        );
      })}

      <SectionLabel>Tambah Anak</SectionLabel>
      <Card>
        <div style={{
          background:C.accDim, border:`1px solid ${C.borderB}`,
          borderRadius:12, padding:10, marginBottom:10,
          fontSize:11, color:C.accPale, fontWeight:800, lineHeight:1.45,
        }}>
          Privasi: pautan ibu bapa hanya memaparkan kemajuan, kelas, dan pos berkaitan anak. Pastikan anak bersetuju sebelum memaut akaun.
        </div>
        <button type="button" data-testid="add-child" onClick={() => setShowAddChild(true)} style={{
          width:'100%', minHeight:44,
          background:C.accDim, border:`1px solid ${C.borderB}`,
          borderRadius:10, padding:'10px 12px',
          color:C.accPale, fontFamily:'Nunito', fontWeight:900,
          fontSize:12, cursor:'pointer',
        }}>Buka Panduan Tambah Anak</button>
        <div style={{ marginTop:7, fontSize:11, lineHeight:1.4, color:C.textFaint, fontWeight:600 }}>
          Anda perlukan ID Tusyen pelajar atau e-mel akaun pelajar. Kod kelas guru tidak digunakan di sini.
        </div>
        {linkStatus && (
          <div style={{ marginTop:8, fontSize:11, fontWeight:800, color:parentStatusIsSuccess(linkStatus) ? C.green : C.red }}>
            {linkStatus}
          </div>
        )}
      </Card>

      <GuidedAddChildModal
        open={showAddChild}
        busy={busy}
        status={linkStatus}
        onSubmit={linkChild}
        onClose={() => setShowAddChild(false)}
      />

      <div style={{ height:8 }} />
    </div>
  );
};

// ── ParentApp ─────────────────────────────────────────────────

const ParentSidebarSummary = ({ child, childCount, loading, error, onOpenChildren, onOpenProgress }) => {
  const hasScore = child?.hasProgressData !== false && scoreValue(child?.avg) !== null;
  const hasWeek = child?.hasWeekData !== false && child?.weekTimeSeconds !== null && child?.weekTimeSeconds !== undefined;
  const rows = [
    { value:loading ? '...' : String(childCount || 0), label:'Anak dipaut' },
    { value:child ? formatScore(child.avg, hasScore) : '--', label:'Purata skor' },
    { value:child && hasWeek ? formatStudyTime(child.weekTimeSeconds) : '--', label:'Masa minggu ini' },
  ];
  const subtitle = error
    ? 'Data anak belum dapat dimuat.'
    : child
      ? `Memantau ${child.name}`
      : 'Pautkan anak untuk mula memantau.';
  return (
    <div className="parent-sidebar-summary" style={{ padding:'12px 14px 14px', borderBottom:`1px solid ${C.border}` }}>
      <div style={{ fontSize:10, color:C.textFaint, fontWeight:900, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>
        Ringkasan ibu bapa
      </div>
      <div style={{ fontSize:12, color:error ? C.orange : C.textMuted, fontWeight:800, lineHeight:1.35, marginBottom:9 }}>
        {subtitle}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:6, marginBottom:9 }}>
        {rows.map(row => (
          <div key={row.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 6px', textAlign:'center', minWidth:0 }}>
            <div style={{ color:C.accPale, fontSize:14, fontWeight:900, lineHeight:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row.value}</div>
            <div style={{ color:C.textFaint, fontSize:8, fontWeight:800, lineHeight:1.2, marginTop:4, textTransform:'uppercase' }}>{row.label}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={child ? onOpenProgress : onOpenChildren} style={{
        width:'100%',
        minHeight:44,
        border:`1px solid ${C.borderB}`,
        background:C.accDim,
        borderRadius:10,
        color:C.accPale,
        fontFamily:'Nunito',
        fontSize:11,
        fontWeight:900,
        cursor:'pointer',
      }}>
        {child ? 'Semak Kemajuan' : 'Tambah Anak'}
      </button>
    </div>
  );
};

const ParentApp = ({ sidebarExtraTop } = {}) => {
  const [screen, setScreen] = React.useState('home');
  const childState = useParentChildren();
  const childOptions = childState.data?.children || [];
  const [selectedId, setSelectedId] = React.useState(() => localStorage.getItem('tusyen_parent_selected_child') || '');
  const displayName = parentName(currentUser()?.fullName || currentUser()?.full_name || currentUser()?.email, 'Hafiz');

  const selectedChild = React.useMemo(() => {
    return childOptions.find(child => child.id === selectedId) || childOptions[0] || null;
  }, [childOptions, selectedId]);

  React.useEffect(() => {
    if (selectedChild?.id && selectedChild.id !== selectedId) {
      setSelectedId(selectedChild.id);
      localStorage.setItem('tusyen_parent_selected_child', selectedChild.id);
    }
  }, [selectedChild?.id, selectedId]);

  const selectChild = (id) => {
    setSelectedId(id);
    if (id) localStorage.setItem('tusyen_parent_selected_child', id);
    else localStorage.removeItem('tusyen_parent_selected_child');
  };

  const nav = [
    { id:'home',     icon:'🏠', label:'Pemantauan' },
    { id:'children', icon:'👪', label:'Anak'      },
    { id:'progress', icon:'📈', label:'Kemajuan'  },
    { id:'posts',    icon:'📢', label:'Pos Kelas' },
    { id:'alerts',   icon:'🔔', label:'Amaran'    },
    { id:'settings', icon:'⚙️', label:'Tetapan'   },
  ];

  const navEnglish = {
    home:'Monitoring',
    children:'Children',
    progress:'Progress',
    posts:'Class Posts',
    alerts:'Alerts',
    settings:'Settings',
  };
  const localizedNav = nav.map(item => ({ ...item, en: navEnglish[item.id] || item.en }));

  const commonProps = {
    childState,
    child: selectedChild,
    childOptions,
    selectedId: selectedChild?.id || selectedId,
    onSelectChild: selectChild,
    onOpenSettings: () => setScreen('settings'),
    onNavigate: setScreen,
  };

  const screenMeta = {
    home:     { title:'Pemantauan', en:selectedChild ? selectedChild.name : 'Ibu bapa'     },
    children: { title:'Anak',        en:`${childOptions.length} anak`                     },
    progress: { title:'Kemajuan',   en:selectedChild ? selectedChild.name : 'Pilih anak'   },
    posts:    { title:'Pos Kelas',  en:selectedChild ? selectedChild.name : 'Pos kelas'    },
    alerts:   { title:'Amaran',     en:selectedChild ? selectedChild.name : 'Notifikasi'   },
    settings: { title:'Tetapan',    en:displayName                                         },
  };
  const meta = screenMeta[screen] || screenMeta.home;
  useScreenFocus(screen);

  return (
    <div className="app-shell parent-mobile-nav-shell">
      <ParentMobileNavStyles />
      <AppSidebar
        navItems={localizedNav}
        active={screen}
        onNav={setScreen}
        user={window.tusyenUser}
        stats={null}
        onSignOut={() => window.tusyenSignOut?.()}
        extraTop={(
          <>
            {sidebarExtraTop}
            <ParentSidebarSummary
              child={selectedChild}
              childCount={childOptions.length}
              loading={childState.loading}
              error={childState.error}
              onOpenChildren={() => setScreen('children')}
              onOpenProgress={() => setScreen('progress')}
            />
          </>
        )}
      />
      <main id="main-content" className="main-area" tabIndex="-1" aria-label={`${meta.title}${meta.en ? ` / ${meta.en}` : ''}`}>
        <TopBarMobile
          title={meta.title}
          subtitle={meta.en}
          right={<Avatar name={displayName} size={32} />}
        />
        <DataModeBanner role="parent" />
        <div className="main-content" key={screen}>
          <h1 className="sr-only">{meta.title}{meta.en ? ` / ${meta.en}` : ''}</h1>
          {screen === 'home'     && <ParentHome displayName={displayName} {...commonProps} />}
          {screen === 'children' && <ParentChildrenPage childState={childState} childOptions={childOptions} selectedId={selectedChild?.id || selectedId} onSelectChild={selectChild} onOpenSettings={() => setScreen('settings')} onNavigate={setScreen} />}
          {screen === 'progress' && <ParentProgress {...commonProps} />}
          {screen === 'posts'    && <ParentPostsPage childState={childState} child={selectedChild} childOptions={childOptions} selectedId={selectedChild?.id || selectedId} onSelectChild={selectChild} onOpenSettings={() => setScreen('settings')} />}
          {screen === 'alerts'   && <ParentAlertsV2 {...commonProps} onNavigate={setScreen} />}
          {screen === 'settings' && <ParentSettingsV2 childState={childState} childOptions={childOptions} selectedId={selectedChild?.id || selectedId} onSelectChild={selectChild} />}
        </div>
        <BottomNavMobile items={localizedNav} active={screen} onNav={setScreen} />
      </main>
    </div>
  );
};

window.ParentApp = ParentApp;
