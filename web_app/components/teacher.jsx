// Tusyen — Teacher Role UI v2 (full port)

const CLASSES = [
  { id:'c1', name:'Matematik 4A', subject:'Matematik', subj:'📐 Matematik', students:28, avg:72, riskCount:2, form:4, code:'MTH-4A2', color:'#8B5CF6', lastActivity:'2026-05-16T09:30:00+08:00' },
  { id:'c2', name:'Matematik 4B', subject:'Matematik', subj:'📐 Matematik', students:25, avg:65, riskCount:1, form:4, code:'MTH-4B2', color:'#7C3AED', lastActivity:'2026-05-15T14:00:00+08:00' },
  { id:'c3', name:'Fizik 5A',     subject:'Fizik',     subj:'⚡ Fizik',     students:30, avg:68, riskCount:0, form:5, code:'PHY-5A1', color:'#38BDF8', lastActivity:'2026-05-14T11:15:00+08:00' },
];

const STUDS = [
  { name:'Siti Nora',    score:92, streak:12, attempted:14, completed:13, risk:false },
  { name:'Ahmad Hafiz',  score:88, streak:7,  attempted:12, completed:11, risk:false },
  { name:'Haziq Razif',  score:75, streak:3,  attempted:10, completed:8,  risk:false },
  { name:'Nurul Ain',    score:45, streak:0,  attempted:8,  completed:3,  risk:true  },
  { name:'Izzat Faiz',   score:60, streak:2,  attempted:9,  completed:6,  risk:false },
  { name:'Aina Sofia',   score:38, streak:0,  attempted:7,  completed:2,  risk:true  },
];

const WEEK_DATA = [62, 74, 55, 82, 71];
const WEEK_DAYS = ['Isnin','Selasa','Rabu','Khamis','Jumaat'];

const teacherFirstName = (full) => {
  const parts = (full || '').split(' ').filter(Boolean);
  return parts[parts.length - 1] || 'Cikgu';
};
const teacherText = (value, fallback = 'Item', max = 80) =>
  window.cleanUiText ? window.cleanUiText(value, { fallback, max }) : `${value || fallback}`;
const teacherName = (value, fallback = 'Pengguna') =>
  window.cleanUiName ? window.cleanUiName(value, fallback) : teacherText(value, fallback, 42);
const stripTeacherHonorific = (value) => `${value || ''}`.replace(/^\s*(?:(?:cikgu|guru)\b\s*)+/i, '').trim();
const teacherHonorificName = (value, fallback = 'Pengguna') => {
  const cleaned = stripTeacherHonorific(teacherName(value, fallback));
  return cleaned ? `Cikgu ${cleaned}` : 'Cikgu';
};
const teacherTitle = (value, fallback = 'Tanpa tajuk') =>
  window.cleanUiTitle ? window.cleanUiTitle(value, fallback) : teacherText(value, fallback, 68);
const teacherBodyText = (value, fallback = '', max = 180) =>
  window.cleanUiText ? window.cleanUiText(value, { fallback, max, preserveCase:true }) : `${value || fallback}`;
const teacherEmailText = (value, fallback = 'Belum tersedia') => {
  const text = `${value || ''}`.trim();
  if (!text) return fallback;
  if (/(?:qaqc|qa|test|demo|playwright|automation|abcdef|\d{8,})/i.test(text)) return fallback;
  return text;
};

const SUBJ_ICON = {
  'bahasa melayu':'BM Bahasa Melayu', 'bm':'BM Bahasa Melayu',
  'bahasa inggeris':'BI Bahasa Inggeris',
  'geografi':'GEO Geografi',
  'reka bentuk dan teknologi':'RBT Reka Bentuk dan Teknologi',
  'asas sains komputer':'ASK Asas Sains Komputer',
  'prinsip perakaunan':'PA Prinsip Perakaunan',
  'ekonomi':'EKO Ekonomi',
  'mathematics':'📐 Matematik', 'matematik':'📐 Matematik',
  'science':'🔬 Sains',         'sains':'🔬 Sains',
  'physics':'⚡ Fizik',          'fizik':'⚡ Fizik',
  'chemistry':'🧪 Kimia',       'kimia':'🧪 Kimia',
  'biology':'🌿 Biologi',       'biologi':'🌿 Biologi',
  'english':'🔤 English',       'sejarah':'📜 Sejarah',
};
const SUBJ_COLOR = {
  'bahasa melayu':'#EF4444', 'bm':'#EF4444',
  'bahasa inggeris':'#A78BFA',
  'geografi':'#14B8A6',
  'reka bentuk dan teknologi':'#F97316',
  'asas sains komputer':'#38BDF8',
  'prinsip perakaunan':'#F5A623',
  'ekonomi':'#22C55E',
  'mathematics':'#8B5CF6', 'matematik':'#8B5CF6',
  'science':'#22C55E',     'sains':'#22C55E',
  'physics':'#38BDF8',     'fizik':'#38BDF8',
  'chemistry':'#F59E0B',   'kimia':'#F59E0B',
  'biology':'#22C55E',     'biologi':'#22C55E',
  'english':'#A78BFA',     'sejarah':'#EF4444',
};

const CLASS_SUBJECTS = [
  'Bahasa Melayu',
  'Bahasa Inggeris',
  'Matematik',
  'Sains',
  'Sejarah',
  'Geografi',
  'Reka Bentuk dan Teknologi',
  'Asas Sains Komputer',
  'Fizik',
  'Kimia',
  'Biologi',
  'Prinsip Perakaunan',
  'Ekonomi',
];
const CLASS_FORM_LEVELS = [1, 2, 3, 4, 5];

const isLiveClassId = (id) => typeof id === 'string' && id.includes('-');

const clampPercent = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
};

const isAtRiskStudent = (student) => {
  if (student?.risk) return true;
  const score = clampPercent(student?.score);
  if (score !== null) return score < 60;
  const attempted = Number(student?.attempted) || 0;
  const completed = Number(student?.completed) || 0;
  return attempted >= 2 && completed / attempted < 0.5;
};

const classInviteText = (cls) => `Kod kelas ${teacherText(cls.name, 'kelas', 54)}: ${cls.code}. Sertai kelas ini dalam Tusyen.`;

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};

const subjectLabel = (subject) => {
  const clean = teacherText(subject, 'Subjek', 48);
  const key = `${clean || ''}`.toLowerCase();
  return SUBJ_ICON[key] || (clean ? `📚 ${clean}` : '📚 Subjek');
};

const subjectText = (subject) => subjectLabel(subject).replace(/^[^\s]+\s*/, '');

const formatDateShort = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('ms-MY', { day:'numeric', month:'short' });
};

const formatActivityStatus = (value) => {
  if (!value) return 'Belum ada aktiviti direkod';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Belum ada aktiviti direkod';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startToday - startValue) / 86400000);
  if (dayDiff <= 0) return 'Aktif hari ini';
  if (dayDiff === 1) return 'Aktif semalam';
  if (dayDiff < 7) return `Aktif ${dayDiff} hari lepas`;
  return `Aktif ${formatDateShort(value)}`;
};

const completionContextText = (scoredCount, totalCount) => (
  scoredCount > 0
    ? `Purata siap dikira daripada ${scoredCount}/${totalCount} kelas yang sudah ada rekod kemajuan. Kelas tanpa rekod belum dikira.`
    : 'Purata siap akan muncul selepas pelajar mula menyelesaikan pelajaran.'
);

const CLASS_RISK_EXPLANATION = 'Risiko ditanda apabila skor bawah 60% atau kemajuan kurang separuh selepas sekurang-kurangnya dua percubaan.';

const currentSchoolWeekLabel = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return `Minggu ${formatDateShort(monday)}-${formatDateShort(friday)}`;
};

const formatLiveClass = (c, i, analytics = null) => {
  const subjKey = (c.subject || '').toLowerCase();
  const progressCount = Number(analytics?.progressCount ?? analytics?.progress_count ?? c.progress_count) || 0;
  const avgProgress = analytics?.averageProgress ?? analytics?.average_progress ?? c.average_progress;
  const avg = progressCount > 0 ? clampPercent(avgProgress) : null;
  const riskCount = Number(c.at_risk_count ?? c.atRiskCount ?? analytics?.atRiskCount ?? analytics?.at_risk_count) || 0;
  return {
    id: c.id || `c${i}`,
    name: teacherText(c.name, 'Kelas', 54),
    subject: teacherText(c.subject, 'Subjek', 36),
    subj: subjectLabel(c.subject),
    students: c.student_count ?? 0,
    avg,
    riskCount: Math.max(0, Math.round(riskCount)),
    form: c.form_level ?? c.formLevel ?? 4,
    code: c.join_code || c.joinCode || '------',
    color: SUBJ_COLOR[subjKey] || '#8B5CF6',
    description: teacherBodyText(c.description, '', 140),
    teacherId: c.teacher_id || c.teacherId || '',
    isActive: c.is_active !== false,
    lastActivity: c.last_activity || c.lastActivity || c.last_activity_at || c.lastActiveAt || null,
  };
};

const demoTeacherProfile = (displayName) => ({
  full_name: displayName,
  email: window.tusyenUser?.email || 'teacher@tusyen.test',
  headline: 'Guru kelas KSSM',
  bio: '',
  specialties: ['Matematik', 'Fizik'],
  credentials: '',
  years_experience: 0,
  location: '',
  classroom_count: CLASSES.length,
  student_count: CLASSES.reduce((sum, c) => sum + c.students, 0),
  post_count: 0,
  subjects: ['Matematik', 'Fizik'],
});

const emptyTeacherProfile = (displayName) => ({
  full_name: displayName,
  email: window.tusyenUser?.email || '',
  headline: '',
  bio: '',
  specialties: [],
  credentials: '',
  years_experience: 0,
  location: '',
  classroom_count: 0,
  student_count: 0,
  post_count: 0,
  subjects: [],
});

const useTeacherProfile = (displayName) => {
  const initial = window.tusyenUser?.role === 'teacher'
    ? emptyTeacherProfile(displayName)
    : demoTeacherProfile(displayName);
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'teacher') return demoTeacherProfile(displayName);
    const { profile } = await window.tusyenApi.myProfile();
    return profile || emptyTeacherProfile(displayName);
  }, [displayName], initial);
};

const profileSubjects = (profile, classes = []) => {
  const preferred = [
    ...((profile?.specialties || []).filter(Boolean)),
    ...((profile?.subjects || []).filter(Boolean)),
  ];
  const fallback = classes.map(c => c.subject || c.subj).filter(Boolean);
  return [...new Set((preferred.length ? preferred : fallback).map(subjectText))]
    .filter(Boolean)
    .filter(value => !/^(?:subjek|subject)$/i.test(value));
};

const useTeacherClassrooms = () => {
  const initial = window.tusyenUser?.role === 'teacher'
    ? { classes: [], isLive:true }
    : { classes: CLASSES, isLive:false };
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'teacher') return { classes: CLASSES, isLive:false };
    const { classrooms } = await window.tusyenApi.classrooms();
    const live = (classrooms || []).map(formatLiveClass);
    return { classes: live, isLive:true };
  }, [], initial);
};

const WEAK_TOPICS_FALLBACK = [
  { topic:'Geometri', avgScore:45 },
  { topic:'Trigonometri', avgScore:52 },
  { topic:'Nombor Kompleks', avgScore:58 },
];

const useClassRoster = (classroomId) => {
  return useAsync(async () => {
    if (!isLiveClassId(classroomId)) return STUDS;
    const { students } = await window.tusyenApi.classroomProgress(classroomId);
    return (students || []).map(s => {
      const rawScore = s.average_score ?? s.avg_score;
      const parsedScore = rawScore === null || rawScore === undefined ? null : Math.round(Number(rawScore));
      const score = Number.isFinite(parsedScore) ? parsedScore : null;
      return {
        id: s.student_id || s.id,
        name: teacherName(s.full_name || s.email, 'Pelajar'),
        email: s.email || '',
        score,
        streak: Number(s.current_streak ?? s.streak) || 0,
        attempted: Number(s.lessons_attempted) || 0,
        completed: Number(s.lessons_completed ?? s.completed_lessons) || 0,
        lastActive: s.last_activity || s.last_active_at,
        joinedAt: s.joined_at,
        risk: score !== null && score < 60,
      };
    });
  }, [classroomId], isLiveClassId(classroomId) ? [] : STUDS);
};

const useStudentProgress = (studentId, classroomId) => {
  return useAsync(async () => {
    if (!studentId || !isLiveClassId(classroomId)) return [];
    const { progress } = await window.tusyenApi.studentProgress(studentId, { classroomId });
    return progress || [];
  }, [studentId, classroomId], []);
};

const useClassFeed = (classroomId) => {
  return useAsync(async () => {
    if (!isLiveClassId(classroomId)) return [];
    const { posts } = await window.tusyenApi.feedPosts({ classroomId, limit:20 });
    return (posts || []).slice().sort((a, b) => {
      const pinnedDelta = Number(Boolean(b.is_pinned || b.isPinned)) - Number(Boolean(a.is_pinned || a.isPinned));
      if (pinnedDelta !== 0) return pinnedDelta;
      return new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime();
    });
  }, [classroomId], []);
};

const useClassAnalytics = (classroomId) => {
  const fallback = {
    weeklyActivity: WEEK_DAYS.map((day, i) => ({ day, count: WEEK_DATA[i], pct: WEEK_DATA[i] })),
    weakTopics: isLiveClassId(classroomId) ? [] : WEAK_TOPICS_FALLBACK,
    averageProgress: null,
    progressCount: 0,
    atRiskCount: 0,
  };
  return useAsync(async () => {
    if (!isLiveClassId(classroomId)) return fallback;
    const data = await window.tusyenApi.classroomAnalytics(classroomId);
    const rawWeek = data.weeklyActivity || [];
    const maxCount = Math.max(1, ...rawWeek.map(d => Number(d.count) || 0));
    const weeklyActivity = WEEK_DAYS.map((day, i) => {
      const row = rawWeek.find(d => d.day === day) || {};
      const count = Number(row.count ?? WEEK_DATA[i]) || 0;
      return { day, count, pct: Math.max(6, Math.round((count / maxCount) * 100)) };
    });
    const weakTopics = (data.weakTopics || []).map(t => {
      const topic = teacherTitle(t.topic, 'Topik');
      const avgScore = Math.round(Number(t.avgScore ?? t.avg_score) || 0);
      return { topic, avgScore };
    }).filter(Boolean);
    return {
      averageProgress: Math.round(Number(data.averageProgress ?? data.average_progress) || 0),
      progressCount: Number(data.progressCount ?? data.progress_count) || 0,
      atRiskCount: Number(data.atRiskCount ?? data.at_risk_count) || 0,
      weeklyActivity,
      weakTopics,
    };
  }, [classroomId], fallback);
};

// ─── Posts Feed ────────────────────────────────────────────────────────────

const POST_TYPE_META = {
  announcement: { label:'Pengumuman', icon:'!', color:C.blue, bg:'rgba(56,189,248,.12)', border:'rgba(56,189,248,.35)' },
  assignment:   { label:'Tugasan', icon:'Task', color:C.gold, bg:'rgba(245,166,35,.13)', border:'rgba(245,166,35,.42)' },
  general:      { label:'Perbincangan', icon:'Chat', color:C.green, bg:'rgba(34,197,94,.12)', border:'rgba(34,197,94,.34)' },
};
const POST_TYPE_OPTIONS = [
  { value:'announcement', label:'Pengumuman', hint:'Makluman penting untuk semua pelajar.' },
  { value:'assignment', label:'Tugasan', hint:'Arahan kerja, bahan rujukan, dan tarikh hantar.' },
  { value:'general', label:'Perbincangan', hint:'Soalan, refleksi, atau nota kelas.' },
];
const postComposerPlaceholder = (type) => {
  if (type === 'assignment') return 'Tulis arahan tugasan, bahan rujukan, dan kriteria siap.';
  if (type === 'general') return 'Buka perbincangan, soalan refleksi, atau nota kelas.';
  return 'Tulis pengumuman ringkas untuk kelas.';
};

const postTypeMeta = (type) => POST_TYPE_META[type] || POST_TYPE_META.general;
const postAttachments = (post) => Array.isArray(post.attachments) ? post.attachments : [];
const attachmentLabel = (attachment) => teacherTitle(attachment.name || attachment.title || attachment.url, 'Lampiran');
const attachmentTypeLabel = (type) => ({
  link:'Pautan',
  image:'Imej',
  video:'Video',
  gif:'GIF',
  embed:'Embed',
  file:'Fail',
}[`${type || 'file'}`.toLowerCase()] || 'Lampiran');

const embedProviderLabel = (url = '') => {
  const value = `${url || ''}`.toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'YouTube';
  if (value.includes('vimeo.com')) return 'Vimeo';
  if (value.includes('loom.com')) return 'Loom';
  return '';
};

const createMediaUrlAttachment = (url) => {
  const cleaned = `${url || ''}`.trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  const embedProvider = embedProviderLabel(cleaned);
  if (embedProvider) return { type:'embed', url:cleaned, name:embedProvider };
  if (/\.gif(?:[?#]|$)/i.test(lower) || lower.includes('giphy') || lower.includes('tenor')) {
    return { type:'gif', url:cleaned, name:'GIF' };
  }
  return { type:'image', url:cleaned, name:'Media' };
};

const PostAttachments = ({ attachments }) => {
  if (!attachments.length) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, margin:'8px 0 10px' }}>
      {attachments.map((attachment, index) => {
        const type = `${attachment.type || 'file'}`.toLowerCase();
        const label = attachmentLabel(attachment);
        const url = attachment.url || attachment.embedUrl || attachment.downloadUrl;
        return (
          <a key={`${url || label}-${index}`} href={url || '#'} target={url ? '_blank' : undefined} rel={url ? 'noreferrer' : undefined} onClick={(event) => { if (!url) event.preventDefault(); }} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
            background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
            padding:'8px 10px', color:C.text, textDecoration:'none', fontSize:12, fontWeight:800,
          }}>
            <span style={{ minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {attachmentTypeLabel(type)}: {label}
            </span>
            <span style={{ color:C.accPale, flexShrink:0 }}>Buka</span>
          </a>
        );
      })}
    </div>
  );
};

const PostCard = ({ post, currentUserId, onDelete, onPin, onReact, onComment }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [commentText, setCommentText] = React.useState('');
  const [commentAttachmentUrl, setCommentAttachmentUrl] = React.useState('');
  const [commentAttachment, setCommentAttachment] = React.useState(null);
  const [showCommentAttachment, setShowCommentAttachment] = React.useState(false);
  const [comments, setComments] = React.useState(null);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const isOwner = post.teacher_id === currentUserId || post.author_id === currentUserId || post.user_id === currentUserId;
  const pinned = post.is_pinned || post.isPinned;
  const meta = postTypeMeta(post.post_type || post.postType);
  const attachments = postAttachments(post);
  const postTitle = teacherTitle(post.title, '');
  const postContent = teacherBodyText(post.content, '', 220);

  const loadComments = async () => {
    if (comments !== null) { setExpanded(v => !v); return; }
    setLoadingComments(true);
    try {
      const data = await window.tusyenApi.postComments(post.id);
      setComments(data.comments || []);
      setExpanded(true);
    } catch { setComments([]); setExpanded(true); }
    finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    const attachments = commentAttachment ? [commentAttachment] : [];
    if (!text && attachments.length === 0) return;
    setSubmitting(true);
    try {
      if (attachments.length) await window.tusyenApi.addComment(post.id, text, attachments);
      else await window.tusyenApi.addComment(post.id, text);
      setCommentText('');
      setCommentAttachment(null);
      setCommentAttachmentUrl('');
      setShowCommentAttachment(false);
      const data = await window.tusyenApi.postComments(post.id);
      setComments(data.comments || []);
      onComment && onComment();
    } catch { }
    finally { setSubmitting(false); }
  };

  const addCommentAttachment = () => {
    const attachment = createMediaUrlAttachment(commentAttachmentUrl);
    if (!attachment) return;
    setCommentAttachment(attachment);
    setCommentAttachmentUrl('');
    setShowCommentAttachment(false);
  };

  const deleteComment = async (commentId) => {
    try {
      await window.tusyenApi.deleteComment(post.id, commentId);
      setComments(prev => (prev || []).filter(c => c.id !== commentId));
    } catch { }
  };

  return (
    <Card style={{
      marginBottom:10,
      border:`1px solid ${pinned ? C.gold : meta.border}`,
      boxShadow:pinned ? '0 0 0 2px rgba(245,166,35,.08)' : undefined,
      background:pinned ? 'color-mix(in srgb, #F5A623 6%, var(--c-card))' : undefined,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:6 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {pinned && <span style={{ fontSize:10, color:C.gold, fontWeight:900, background:'rgba(245,166,35,.15)', border:'1px solid rgba(245,166,35,.35)', borderRadius:999, padding:'2px 7px' }}>Disemat</span>}
            <span style={{
              fontSize:10, color:meta.color, fontWeight:900, background:meta.bg,
              border:`1px solid ${meta.border}`, borderRadius:999, padding:'2px 8px',
            }}>{meta.icon} {meta.label}</span>
            <span style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>{window.timeAgo(post.created_at)}</span>
          </div>
          {postTitle && <div style={{ fontWeight:800, fontSize:14, color:C.text, marginTop:2 }}>{postTitle}</div>}
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
          {isOwner && (
            <TeacherActionMenu
              label="Tindakan pos"
              items={[
                { label:pinned ? 'Nyahsemat pos' : 'Semat pos', icon:pinned ? '📌' : '📍', onClick:() => onPin && onPin(post) },
                { label:'Padam pos', icon:'🗑️', danger:true, onClick:() => onDelete && onDelete(post) },
              ]}
            />
          )}
        </div>
      </div>
      <div style={{ fontSize:13, color:C.text, fontWeight:600, whiteSpace:'pre-line', lineHeight:1.5, marginBottom:8 }}>{postContent}</div>
      <PostAttachments attachments={attachments} />
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <button onClick={() => onReact && onReact(post)} style={{
          background:'transparent', border:`1px solid ${C.border}`, borderRadius:20,
          padding:'4px 10px', minHeight:44, cursor:'pointer', fontSize:11, color:C.textMuted,
          fontFamily:'Nunito', fontWeight:800, display:'flex', alignItems:'center', gap:4,
        }}>
          Suka {post.like_count || post.reaction_count || post.reactions_count || 0}
        </button>
        <button onClick={loadComments} style={{
          background:'transparent', border:`1px solid ${C.border}`, borderRadius:20,
          padding:'4px 10px', minHeight:44, cursor:'pointer', fontSize:11, color:C.textMuted,
          fontFamily:'Nunito', fontWeight:800, display:'flex', alignItems:'center', gap:4,
        }}>
          {loadingComments ? '...' : `💬 ${post.comment_count || 0}`}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
          {(comments || []).map((c, i) => (
            <div key={c.id || i} style={{
              display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0',
              borderBottom: i < comments.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <Avatar name={teacherName(c.author_name || c.full_name, 'Pengguna')} size={26} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, color:C.accPale, fontWeight:800 }}>{teacherName(c.author_name || c.full_name, 'Pengguna')}</div>
                <div style={{ fontSize:12, color:C.text, fontWeight:600, lineHeight:1.4 }}>{teacherBodyText(c.content, '', 180)}</div>
                <PostAttachments attachments={postAttachments(c)} />
              </div>
              {(c.user_id === currentUserId || c.author_id === currentUserId) && (
                <button onClick={() => deleteComment(c.id)} title="Padam komen" aria-label="Padam komen" style={{
                  background:'transparent', border:'none', cursor:'pointer',
                  fontSize:12, color:C.red, flexShrink:0, minWidth:44, minHeight:44,
                }}>Padam</button>
              )}
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
              placeholder="Tulis komen..."
              aria-label="Tulis komen"
              style={{
                flex:1, background:C.surface, border:`1px solid ${C.border}`,
                borderRadius:10, padding:'7px 10px', minHeight:44, color:C.text,
                fontFamily:'Nunito', fontWeight:600, fontSize:12, outline:'none',
              }}
            />
            <button onClick={submitComment} disabled={submitting || !commentText.trim()} style={{
              background:C.accDim, border:`1px solid ${C.borderB}`,
              borderRadius:10, padding:'7px 12px', minHeight:44, cursor:'pointer',
              color:C.accPale, fontFamily:'Nunito', fontWeight:800, fontSize:12,
              opacity:submitting || !commentText.trim() ? 0.5 : 1,
            }}>Hantar</button>
          </div>
        </div>
      )}
    </Card>
  );
};

const PostComposerModal = ({ classroomId, onClose, onPosted }) => {
  const [type, setType] = React.useState('announcement');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkTitle, setLinkTitle] = React.useState('');
  const [isPinned, setIsPinned] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [err, setErr] = React.useState('');
  const selectedPostType = postTypeMeta(type);

  const submit = async () => {
    const cleanedLink = linkUrl.trim();
    const attachments = cleanedLink
      ? [{ type:'link', url:cleanedLink, name:linkTitle.trim() || cleanedLink }]
      : [];
    if (!content.trim() && attachments.length === 0) { setErr('Isi mesej pos atau tambah pautan dahulu.'); return; }
    setPosting(true); setErr('');
    try {
      await window.tusyenApi.createPost({
        classroomId,
        content: content.trim(),
        postType: type,
        title: title.trim() || undefined,
        attachments,
        isPinned,
      });
      onPosted && onPosted();
      onClose();
    } catch (e) {
      setErr(e.message || 'Tidak dapat menghantar pos.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000,
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:C.card, borderRadius:'20px 20px 0 0', padding:'20px 18px 28px',
        width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto',
      }}>
        <div style={{ fontWeight:900, fontSize:16, color:C.text, marginBottom:4 }}>Pos baharu</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.35, marginBottom:12 }}>
          {selectedPostType.label} akan dipaparkan dalam suapan kelas.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:6, marginBottom:12 }}>
          {POST_TYPE_OPTIONS.map(option => (
            <button key={option.value} type="button" onClick={() => setType(option.value)} aria-pressed={type === option.value} style={{
              flex:1, background:type === option.value ? C.accDim : 'transparent',
              border:`1.5px solid ${type === option.value ? C.borderB : C.border}`,
              borderRadius:10, padding:'8px 7px', minHeight:58, cursor:'pointer',
              color:type === option.value ? C.accPale : C.textMuted,
              fontFamily:'Nunito', fontWeight:800, fontSize:10,
              display:'grid', gap:2, alignContent:'center', textAlign:'left',
            }}>
              <span style={{ fontSize:11, color:type === option.value ? C.accPale : C.text, fontWeight:900 }}>{option.label}</span>
              <span style={{ fontSize:9, color:C.textFaint, fontWeight:700, lineHeight:1.2 }}>{option.hint}</span>
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Tajuk pos (pilihan)"
          style={{
            width:'100%', boxSizing:'border-box', marginBottom:8,
            background:C.surface, border:`1px solid ${C.border}`,
            borderRadius:10, padding:'9px 10px', color:C.text,
            fontFamily:'Nunito', fontWeight:700, fontSize:13, outline:'none',
          }}
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={postComposerPlaceholder(type)}
          rows={5}
          style={{
            width:'100%', boxSizing:'border-box', resize:'vertical',
            background:C.surface, border:`1px solid ${C.border}`,
            borderRadius:12, padding:10, color:C.text,
            fontFamily:'Nunito', fontWeight:600, fontSize:13, outline:'none', marginBottom:8,
          }}
        />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="Pautan bahan (pilihan)"
            style={{
              minWidth:0, background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:10, padding:'9px 10px', color:C.text,
              fontFamily:'Nunito', fontWeight:700, fontSize:12, outline:'none',
            }}
          />
          <input
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
            placeholder="Nama bahan"
            style={{
              minWidth:0, background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:10, padding:'9px 10px', color:C.text,
              fontFamily:'Nunito', fontWeight:700, fontSize:12, outline:'none',
            }}
          />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, cursor:'pointer' }}>
          <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ accentColor:C.acc }} />
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Semat di atas suapan kelas</span>
        </label>
        {err && <div style={{ color:C.red, fontSize:11, fontWeight:800, marginBottom:8 }}>{err}</div>}
        <div style={{ display:'flex', gap:8 }}>
          <GlowButton onClick={submit} disabled={posting} style={{ flex:1 }}>{posting ? 'Menghantar...' : 'Hantar ke kelas'}</GlowButton>
          <button onClick={onClose} style={{
            background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
            padding:'0 16px', minHeight:44, color:C.textMuted, fontFamily:'Nunito', fontWeight:800, cursor:'pointer',
          }}>Batal</button>
        </div>
      </div>
    </div>
  );
};

const TeacherPostsScreen = ({ classrooms }) => {
  const [selectedClassId, setSelectedClassId] = React.useState(classrooms[0]?.id || '');
  const [showComposer, setShowComposer] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(null);
  const [deletingPostId, setDeletingPostId] = React.useState('');
  const feedState = useClassFeed(selectedClassId);
  const currentUserId = window.tusyenUser?.id;

  React.useEffect(() => {
    const firstClassId = classrooms[0]?.id || '';
    const stillAvailable = classrooms.some(cls => cls.id === selectedClassId);
    if (!firstClassId) {
      if (selectedClassId) setSelectedClassId('');
      return;
    }
    if (!selectedClassId || !stillAvailable) setSelectedClassId(firstClassId);
  }, [classrooms, selectedClassId]);

  const handleDelete = (post) => {
    setDeleteConfirm(post);
  };

  const confirmDeletePost = async () => {
    if (!deleteConfirm?.id) return;
    setDeletingPostId(deleteConfirm.id);
    try {
      await window.tusyenApi.deletePost(deleteConfirm.id);
      feedState.refresh();
    } catch { }
    setDeletingPostId('');
    setDeleteConfirm(null);
  };

  const handlePin = async (post) => {
    try {
      await window.tusyenApi.pinPost(post.id, !(post.is_pinned || post.isPinned));
      feedState.refresh();
    } catch { }
  };

  const handleReact = async (post) => {
    try {
      await window.tusyenApi.toggleReaction(post.id);
      feedState.refresh();
    } catch { }
  };

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      {classrooms.length > 1 && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:12, scrollbarWidth:'none' }}>
          {classrooms.map(cls => (
            <button key={cls.id} onClick={() => setSelectedClassId(cls.id)} style={{
              flexShrink:0, background:selectedClassId === cls.id ? C.accDim : 'transparent',
              border:`1.5px solid ${selectedClassId === cls.id ? C.borderB : C.border}`,
              borderRadius:20, padding:'5px 14px', minHeight:44, cursor:'pointer',
              color:selectedClassId === cls.id ? C.accPale : C.textMuted,
              fontFamily:'Nunito', fontWeight:800, fontSize:11, whiteSpace:'nowrap',
            }}>{cls.name}</button>
          ))}
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:15, color:C.text }}>Suapan Kelas</div>
        <GlowButton onClick={() => setShowComposer(true)} style={{ padding:'7px 14px', fontSize:12 }}>+ Pos baharu</GlowButton>
      </div>
      {feedState.error && <ErrorRetry message={feedState.error.message || 'Tidak dapat memuat pos.'} onRetry={feedState.refresh} />}
      {feedState.loading ? [0,1,2,3].map(i => (
        <Card key={i} style={{ marginBottom:10, padding:14 }}>
          <Skeleton width="60%" height={13} radius={7} style={{ marginBottom:8 }} />
          <Skeleton width="100%" height={10} radius={5} style={{ marginBottom:6 }} />
          <Skeleton width="80%" height={10} radius={5} />
        </Card>
      )) : (feedState.data || []).length === 0 ? (
        <Card>
          <EmptyState icon="📢" title="Belum ada pos" subtitle="Cipta pos pertama untuk kelas ini." />
        </Card>
      ) : (feedState.data || []).map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onPin={handlePin}
          onReact={handleReact}
          onComment={() => feedState.refresh()}
        />
      ))}
      <TeacherConfirmModal
        open={Boolean(deleteConfirm)}
        title="Padam pos?"
        message={`Pos "${deleteConfirm?.title || 'tanpa tajuk'}" akan dibuang daripada suapan kelas ini.`}
        confirmLabel="Padam pos"
        danger
        busy={Boolean(deletingPostId)}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDeletePost}
      />
      {showComposer && selectedClassId && (
        <PostComposerModal
          classroomId={selectedClassId}
          onClose={() => setShowComposer(false)}
          onPosted={() => feedState.refresh()}
        />
      )}
      <div style={{ height:8 }} />
    </div>
  );
};

// ─── Lessons ───────────────────────────────────────────────────────────────

const TeacherField = ({ label, children, style, required = false, hint = '', error = '' }) => (
  <label style={{
    display:'grid', gap:4,
    fontSize:10, color:C.textMuted, fontWeight:600,
    textTransform:'uppercase', letterSpacing:.5,
    ...style,
  }}>
    <span>
      {label}
      {required && <span aria-hidden="true" style={{ color:C.red, marginLeft:3 }}>*</span>}
    </span>
    {children}
    {hint && <span style={{ color:C.textFaint, fontWeight:700, lineHeight:1.35, textTransform:'none', letterSpacing:0 }}>{hint}</span>}
    {error && <span role="alert" style={{ color:C.red, fontWeight:900, lineHeight:1.35, textTransform:'none', letterSpacing:0 }}>{error}</span>}
  </label>
);

const TeacherBadge = ({ children, tone = 'neutral', style }) => {
  const palette = {
    neutral:{ bg:C.accDim, border:C.border, color:C.accPale },
    good:{ bg:'rgba(34,197,94,.10)', border:'rgba(34,197,94,.28)', color:C.green },
    warn:{ bg:'rgba(245,166,35,.10)', border:'rgba(245,166,35,.28)', color:C.gold },
    bad:{ bg:'rgba(239,68,68,.10)', border:'rgba(239,68,68,.28)', color:C.red },
  }[tone] || {};
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      background:palette.bg, border:`1px solid ${palette.border}`,
      color:palette.color, borderRadius:999, padding:'2px 7px',
      fontSize:10, fontWeight:900, whiteSpace:'nowrap',
      ...style,
    }}>{children}</span>
  );
};

const TeacherSmallButton = ({ children, onClick, disabled, danger, success, style, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      background: danger ? 'rgba(239,68,68,.10)' : success ? 'rgba(34,197,94,.10)' : C.accDim,
      border:`1px solid ${danger ? 'rgba(239,68,68,.28)' : success ? 'rgba(34,197,94,.28)' : C.border}`,
      borderRadius:9, padding:'6px 9px',
      minHeight:44,
      color: danger ? C.red : success ? C.green : C.accPale,
      fontFamily:'Nunito', fontWeight:900, fontSize:10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .55 : 1, whiteSpace:'nowrap',
      ...style,
    }}
  >{children}</button>
);

const TeacherActionMenu = ({ items = [], label = 'Tindakan', align = 'right' }) => {
  const [open, setOpen] = React.useState(false);
  const visibleItems = items.filter(Boolean);
  if (!visibleItems.length) return null;
  return (
    <div style={{ position:'relative', display:'inline-flex', flexShrink:0 }} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        style={{
          width:44, height:44, borderRadius:10,
          background:C.surface, border:`1px solid ${C.border}`,
          color:C.textMuted, cursor:'pointer',
          fontFamily:'Nunito', fontWeight:900, fontSize:18,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}
      >...</button>
      {open && (
        <div
          role="menu"
          className="tv2-slidedown"
          style={{
            position:'absolute', top:48,
            right:align === 'right' ? 0 : 'auto',
            left:align === 'left' ? 0 : 'auto',
            zIndex:360, minWidth:190, padding:6,
            background:C.bg, border:`1px solid ${C.borderB}`,
            borderRadius:12, boxShadow:'0 16px 38px rgba(0,0,0,.32)',
          }}
        >
          {visibleItems.map((item, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onClick && item.onClick(event);
              }}
              style={{
                width:'100%', minHeight:44,
                display:'flex', alignItems:'center', gap:8,
                background:'transparent', border:'none', borderRadius:9,
                padding:'9px 10px', textAlign:'left',
                color:item.danger ? C.red : C.text,
                fontFamily:'Nunito', fontWeight:900, fontSize:12,
                cursor:item.disabled ? 'not-allowed' : 'pointer',
                opacity:item.disabled ? .5 : 1,
              }}
            >
              {item.icon && <span aria-hidden="true" style={{ width:18, textAlign:'center' }}>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TeacherConfirmModal = ({
  open,
  title,
  message,
  confirmLabel = 'Sahkan',
  cancelLabel = 'Batal',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.62)', zIndex:1600,
        display:'flex', alignItems:'center', justifyContent:'center', padding:18,
      }}
      onClick={event => event.target === event.currentTarget && !busy && onCancel?.()}
    >
      <div className="tv2-pop" style={{
        width:'100%', maxWidth:420,
        background:C.card, border:`1px solid ${danger ? 'rgba(239,68,68,.38)' : C.borderB}`,
        borderRadius:18, padding:'18px 16px',
        boxShadow:'0 22px 54px rgba(0,0,0,.38)',
      }}>
        <div style={{ fontWeight:900, fontSize:16, color:danger ? C.red : C.text, marginBottom:6 }}>{title}</div>
        {message && (
          <div style={{ fontSize:13, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:14 }}>
            {message}
          </div>
        )}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              minHeight:44, background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:12, padding:'0 14px', color:C.textMuted,
              fontFamily:'Nunito', fontWeight:900, cursor:busy ? 'not-allowed' : 'pointer',
            }}
          >{cancelLabel}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              minHeight:44,
              background:danger ? 'rgba(239,68,68,.14)' : C.accDim,
              border:`1px solid ${danger ? 'rgba(239,68,68,.36)' : C.borderB}`,
              borderRadius:12, padding:'0 16px',
              color:danger ? C.red : C.accPale,
              fontFamily:'Nunito', fontWeight:900,
              cursor:busy ? 'not-allowed' : 'pointer',
              opacity:busy ? .62 : 1,
            }}
          >{busy ? 'Memproses...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const teacherInputBase = {
  width:'100%', boxSizing:'border-box',
  background:C.surface, border:`1px solid ${C.border}`,
  borderRadius:10, padding:'9px 10px',
  minHeight:44,
  color:C.text, fontFamily:'Nunito', fontWeight:700,
  fontSize:12, outline:'none',
};
const teacherInvalidInputStyle = {
  border:'1px solid rgba(239,68,68,.72)',
  boxShadow:'0 0 0 2px rgba(239,68,68,.12)',
};

const createEmptyLessonBlock = () => ({
  id:`b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title:'',
  body:'',
});

const createEmptyTeacherQuestion = () => ({
  id:`q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type:'multiple_choice',
  questionText:'',
  options:['', '', '', ''],
  correctOption:'0',
  trueFalseAnswer:'true',
  explanation:'',
});

const normalizeTeacherQuizQuestion = (question) => {
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

  return {
    questionText,
    questionType:'multiple_choice',
    options,
    correctAnswer: Math.max(0, Math.min(options.length - 1, Number(question.correctOption) || 0)),
    explanation: `${question.explanation || ''}`.trim(),
  };
};

const lessonContentObject = (content) => {
  if (!content) return {};
  if (typeof content === 'object') return content;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : { summary:String(content) };
  } catch {
    return { summary:String(content) };
  }
};

const lessonSummary = (content) => {
  const value = lessonContentObject(content);
  return value.summary || value.description || '';
};

const lessonBlocks = (content) => {
  const value = lessonContentObject(content);
  return Array.isArray(value.blocks) ? value.blocks.filter(Boolean) : [];
};

const useSyllabusOptions = ({ subject, formLevel }) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'teacher') return [];
    const data = await window.tusyenApi.syllabus(subject || undefined, formLevel || undefined).catch(() => ({ syllabus:[] }));
    return data.syllabus || [];
  }, [subject, formLevel], []);
};

const useLessonCatalog = ({ subject, formLevel, difficulty, search }) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'teacher') return [];
    const data = await window.tusyenApi.lessonCatalog({
      subject: subject || undefined,
      formLevel: formLevel && formLevel !== 'Semua' ? formLevel : undefined,
      difficulty: difficulty && difficulty !== 'Semua' ? difficulty : undefined,
      search: search || undefined,
      limit: 30,
    }).catch(() => ({ lessons:[] }));
    return data.lessons || [];
  }, [subject, formLevel, difficulty, search], []);
};

const LESSON_DIFF_LABEL = { easy:'Mudah', medium:'Sederhana', hard:'Sukar' };
const LESSON_DIFF_COLOR = { easy:C.green, medium:C.gold, hard:C.red };
const LESSON_BUILDER_STEPS = [
  { id:'info', label:'Info' },
  { id:'content', label:'Kandungan' },
  { id:'questions', label:'Soalan' },
];
const TEACHER_LESSON_DRAFT_KEY = 'tusyen_teacher_lesson_draft';
const TEACHER_LESSON_DRAFT_AUTOSAVE_MS = 600;

const createDefaultLessonForm = (subject, formLevel) => ({
  subject,
  formLevel,
  syllabusId:'',
  title:'',
  difficulty:'medium',
  estimatedMinutes:'15',
  summary:'',
});

const normalizeTeacherLessonDraftForm = (form = {}, fallback = {}) => ({
  ...fallback,
  ...form,
  subject: form.subject || fallback.subject,
  formLevel: `${form.formLevel || fallback.formLevel || 4}`,
  syllabusId: `${form.syllabusId || ''}`,
  title: `${form.title || ''}`,
  difficulty: LESSON_DIFF_LABEL[form.difficulty] ? form.difficulty : (fallback.difficulty || 'medium'),
  estimatedMinutes: form.estimatedMinutes === undefined ? (fallback.estimatedMinutes || '15') : `${form.estimatedMinutes}`,
  summary: `${form.summary || ''}`,
});

const normalizeTeacherLessonDraftBlock = (block = {}) => {
  const empty = createEmptyLessonBlock();
  return {
    ...empty,
    ...block,
    id: block.id || empty.id,
    title: `${block.title || ''}`,
    body: `${block.body || ''}`,
  };
};

const normalizeTeacherLessonDraftQuestion = (question = {}) => {
  const empty = createEmptyTeacherQuestion();
  const options = Array.isArray(question.options) && question.options.length
    ? question.options.map(option => `${option || ''}`)
    : empty.options;
  return {
    ...empty,
    ...question,
    id: question.id || empty.id,
    type: question.type === 'true_false' ? 'true_false' : 'multiple_choice',
    questionText: `${question.questionText || ''}`,
    options,
    correctOption: question.correctOption === undefined ? empty.correctOption : `${question.correctOption}`,
    trueFalseAnswer: question.trueFalseAnswer === 'false' ? 'false' : 'true',
    explanation: `${question.explanation || ''}`,
  };
};

const hasTeacherLessonDraftContent = ({ lessonForm = {}, contentBlocks = [], quizDraft = {}, quizQuestions = [] } = {}) => (
  Boolean(
    `${lessonForm.syllabusId || ''}`.trim()
    || `${lessonForm.title || ''}`.trim()
    || `${lessonForm.summary || ''}`.trim()
    || contentBlocks.some(block => `${block.title || ''}${block.body || ''}`.trim())
    || `${quizDraft.questionText || ''}`.trim()
    || `${quizDraft.explanation || ''}`.trim()
    || (quizDraft.options || []).some(option => `${option || ''}`.trim())
    || quizQuestions.length > 0
  )
);

const humanizeLessonWords = (text) => `${text}`.replace(/\b[\w']+\b/g, (word) => {
  if (/^(kssm|spm|pt3|mcq|kbat)$/i.test(word)) return word.toUpperCase();
  if (/^[ivx]+$/i.test(word)) return word.toUpperCase();
  if (word.length <= 2 && word === word.toUpperCase()) return word;
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
});

const cleanLessonDisplayText = (value = '', fallback = 'Pelajaran') => {
  const raw = `${value || ''}`.trim();
  if (!raw) return fallback;
  const slugLike = /[_/|]|[a-z0-9]-[a-z0-9]/i.test(raw);
  let cleaned = raw
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ' ')
    .replace(/\b[0-9a-f]{12,}\b/gi, ' ')
    .replace(/\b[A-Z0-9]{14,}\b/g, ' ')
    .replace(/\b(?:full|btn|seed|record|item|row|tmp|temp)[-_.]+[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]+--[a-z0-9-]{3,}\b/gi, ' ')
    .replace(/\b[a-z]{2,}\d{3,}\b/gi, ' ')
    .replace(/\b20\d{2}(?:\d{2}){2,5}\b/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\.[a-z0-9]{2,5}$/i, ' ')
    .replace(/[-_/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:qa|qaqc|test|smoke|seed|demo|fixture|internal|autogen|generated|tmp|e2e|spec|uuid|id)\b/gi, ' ')
    .replace(/^(q\s*&\s*a|qa|test|ujian|quiz|kuiz|latihan)\s*[:.\-]\s*/i, '')
    .replace(/^(q(uestion)?|soalan)\s*\d*\s*[:.\-]\s*/i, '')
    .replace(/^(practice|sample)\s+(question|set)\s*[:.\-]?\s*/i, '')
    .replace(/\b(?:lesson|pelajaran|title)\b\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 4) return fallback;
  if (/^(?:subject|subjek|topic|topik|subtopic|lesson|pelajaran|content|class|classroom|kelas|item|record)$/i.test(cleaned)) return fallback;
  if (slugLike || cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    cleaned = humanizeLessonWords(cleaned);
  }
  return cleaned;
};

const compactLessonTitle = (title = '', fallback = 'Pelajaran') => {
  const cleaned = cleanLessonDisplayText(title, fallback);
  if (cleaned.length <= 64) return cleaned;
  return `${cleaned.slice(0, 61).trim()}...`;
};

const displayLessonTitle = (lesson = {}) => {
  const direct = compactLessonTitle(lesson.title || '', '');
  if (direct) return direct;
  const topic = compactLessonTitle(
    lesson.topic || lesson.subtopic || lesson.syllabus_topic || lesson.syllabusTopic || '',
    ''
  );
  if (topic) return topic;
  const subject = teacherText(lesson.subject || lesson.subj, 'Pelajaran', 42);
  const form = lesson.form_level || lesson.formLevel;
  return [subject || 'Pelajaran', form ? `Tingkatan ${form}` : ''].filter(Boolean).join(' - ');
};

const TeacherChecklistPanel = ({ title, items = [], style }) => {
  const required = items.filter(item => item.required !== false);
  const missing = required.filter(item => !item.done);
  const complete = required.length - missing.length;
  const tone = missing.length ? 'warn' : 'good';
  return (
    <div style={{
      background:missing.length ? 'rgba(245,166,35,.10)' : 'rgba(34,197,94,.10)',
      border:`1px solid ${missing.length ? 'rgba(245,166,35,.28)' : 'rgba(34,197,94,.28)'}`,
      borderRadius:12,
      padding:10,
      ...style,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:7 }}>
        <div style={{ fontSize:12, color:C.text, fontWeight:900 }}>{title}</div>
        <TeacherBadge tone={tone}>{complete}/{required.length} wajib</TeacherBadge>
      </div>
      <div style={{ display:'grid', gap:6 }}>
        {items.map((item, index) => (
          <div key={item.id || index} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
            <span aria-hidden="true" style={{
              width:18, height:18, borderRadius:9, flexShrink:0,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              marginTop:1,
              background:item.done ? 'rgba(34,197,94,.14)' : item.required === false ? C.surface : 'rgba(245,166,35,.16)',
              color:item.done ? C.green : item.required === false ? C.textMuted : C.gold,
              border:`1px solid ${item.done ? 'rgba(34,197,94,.32)' : item.required === false ? C.border : 'rgba(245,166,35,.32)'}`,
              fontSize:10, fontWeight:900,
            }}>{item.done ? 'OK' : item.required === false ? '-' : '!'}</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:11, color:item.done ? C.text : C.textMuted, fontWeight:900, lineHeight:1.35 }}>
                {item.label}
              </div>
              {item.detail && (
                <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, lineHeight:1.35 }}>
                  {item.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const lessonAssignmentMeta = (lesson = {}) => {
  const count = Number(lesson.assignment_count ?? lesson.assigned_count ?? lesson.classroom_assignment_count ?? 0);
  if (lesson.is_assigned || lesson.assigned || count > 0) {
    return { label:count > 0 ? `Ditugaskan: ${count}` : 'Ditugaskan', tone:'good' };
  }
  if (lesson.draft_assignment || lesson.assignment_status === 'draft') return { label:'Draf tugasan', tone:'warn' };
  return { label:'Belum ditugaskan', tone:'neutral' };
};

const lessonIsAssigned = (lesson = {}) => lessonAssignmentMeta(lesson).tone === 'good';

const AssignLessonModal = ({ lesson, classrooms, onAssigned, onClose }) => {
  const [classroomId, setClassroomId] = React.useState(classrooms[0]?.id || '');
  const [dueDate, setDueDate] = React.useState('');
  const [isRequired, setIsRequired] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const lessonDisplayTitle = displayLessonTitle(lesson);

  const submit = async () => {
    if (!classroomId) { setError('Pilih kelas dahulu.'); return; }
    setSubmitting(true); setError('');
    try {
      await window.tusyenApi.assignLessonToClassroom(classroomId, lesson.id, {
        dueDate: dueDate || null,
        isRequired,
      });
      onAssigned();
      onClose();
    } catch (e) {
      setError(e.message || 'Tidak dapat menetapkan pelajaran.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:C.surface, borderRadius:16, padding:24, width:'100%',
        maxWidth:440, maxHeight:'80vh', overflowY:'auto',
      }}>
        <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:4 }}>Tugaskan Pelajaran</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginBottom:14 }}>{lessonDisplayTitle}</div>
        <TeacherField label="Kelas">
          <select value={classroomId} onChange={e => setClassroomId(e.target.value)} style={{ ...teacherInputBase, marginBottom:10 }}>
            {classrooms.map(c => <option key={c.id} value={c.id}>{teacherText(c.name, 'Kelas', 54)}</option>)}
          </select>
        </TeacherField>
        <TeacherField label="Tarikh Akhir">
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...teacherInputBase, marginBottom:10 }} />
        </TeacherField>
        <label style={{ display:'flex', alignItems:'center', gap:7, color:C.textMuted, fontSize:11, fontWeight:900, marginBottom:12 }}>
          <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ accentColor:C.acc }} />
          Wajib
        </label>
        {error && <div style={{ fontSize:11, color:C.red, fontWeight:800, marginBottom:8 }}>{error}</div>}
        <div style={{ display:'flex', gap:8 }}>
          <GlowButton onClick={submit} disabled={submitting} style={{ flex:1 }}>
            {submitting ? 'Menetapkan...' : 'Tugaskan'}
          </GlowButton>
          <button onClick={onClose} style={{
            background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
            padding:'0 14px', minHeight:44, cursor:'pointer', color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
          }}>Batal</button>
        </div>
      </div>
    </div>
  );
};

const TeacherLessonsScreen = ({ classrooms }) => {
  const defaultClass = classrooms[0] || {};
  const defaultSubject = defaultClass.subject || subjectText(defaultClass.subj) || 'Matematik';
  const defaultFormLevel = String(defaultClass.form || defaultClass.formLevel || 4);
  const [tab, setTab] = React.useState('catalog');
  const [subject, setSubject] = React.useState('');
  const [formLevel, setFormLevel] = React.useState('Semua');
  const [difficulty, setDifficulty] = React.useState('Semua');
  const [search, setSearch] = React.useState('');
  const [createStep, setCreateStep] = React.useState(0);
  const [assigningLesson, setAssigningLesson] = React.useState(null);
  const [assignModal, setAssignModal] = React.useState(null);
  const [assignClassId, setAssignClassId] = React.useState(classrooms[0]?.id || '');
  const [assignDueDate, setAssignDueDate] = React.useState('');
  const [assignRequired, setAssignRequired] = React.useState(true);
  const [assigning, setAssigning] = React.useState(false);
  const [assignMsg, setAssignMsg] = React.useState('');
  const [previewState, setPreviewState] = React.useState({ loading:false, data:null, error:'' });
  const defaultLessonForm = React.useMemo(() => createDefaultLessonForm(defaultSubject, defaultFormLevel), [defaultSubject, defaultFormLevel]);
  const [lessonForm, setLessonForm] = React.useState(defaultLessonForm);
  const [contentBlocks, setContentBlocks] = React.useState([createEmptyLessonBlock()]);
  const [quizDraft, setQuizDraft] = React.useState(createEmptyTeacherQuestion);
  const [quizQuestions, setQuizQuestions] = React.useState([]);
  const [createTouched, setCreateTouched] = React.useState({});
  const [draftSavedAt, setDraftSavedAt] = React.useState('');
  const [createStatus, setCreateStatus] = React.useState('');
  const [createError, setCreateError] = React.useState('');
  const [createErrorItems, setCreateErrorItems] = React.useState([]);
  const [creatingLesson, setCreatingLesson] = React.useState(false);
  const createFieldRefs = React.useRef({});
  const lessonDraftReadyRef = React.useRef(false);
  const lessonDraftSkipAutoSaveRef = React.useRef(false);
  const catalogState = useLessonCatalog({ subject, formLevel, difficulty, search });
  const syllabusState = useSyllabusOptions({
    subject: lessonForm.subject,
    formLevel: Number(lessonForm.formLevel) || 4,
  });
  const catalogLessons = catalogState.data || [];
  const catalogGroups = [
    {
      key:'unassigned',
      title:'Belum Ditugaskan',
      hint:'Sedia untuk dipratonton dan diberikan kepada kelas.',
      lessons:catalogLessons.filter(lesson => !lessonIsAssigned(lesson)),
    },
    {
      key:'assigned',
      title:'Ditugaskan',
      hint:'Sudah pernah diberikan kepada satu atau lebih kelas.',
      lessons:catalogLessons.filter(lessonIsAssigned),
    },
  ].filter(group => group.lessons.length > 0);
  const hasLessonContent = contentBlocks.some(block => `${block.title || ''}${block.body || ''}`.trim());
  const createFieldInvalid = (field, invalid) => Boolean(createTouched[field] && invalid);
  const createInvalidStyle = (field, invalid) => createFieldInvalid(field, invalid) ? teacherInvalidInputStyle : null;
  const infoFieldError = (field, invalid, message) => createFieldInvalid(field, invalid) ? message : '';
  const markCreateTouched = (field) => setCreateTouched(prev => ({ ...prev, [field]:true }));
  const focusCreateField = (field) => {
    window.setTimeout(() => createFieldRefs.current[field]?.focus?.(), 0);
  };
  const createStepValidationErrors = (stepIndex) => {
    if (stepIndex === 0) {
      return [
        !lessonForm.syllabusId && { field:'syllabusId', label:'Item silibus', message:'Pilih topik silibus sebelum teruskan.' },
        !lessonForm.title.trim() && { field:'title', label:'Tajuk pelajaran', message:'Isi tajuk yang jelas untuk pelajar.' },
        (Number(lessonForm.estimatedMinutes) || 0) < 1 && { field:'estimatedMinutes', label:'Anggaran minit', message:'Isi 1 minit atau lebih.' },
      ].filter(Boolean);
    }
    if (stepIndex === 1 && !hasLessonContent && !lessonForm.summary.trim()) {
      return [{ field:'content', label:'Kandungan', message:'Tambah ringkasan atau sekurang-kurangnya satu bahagian kandungan.' }];
    }
    return [];
  };

  React.useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(TEACHER_LESSON_DRAFT_KEY);
      if (!savedDraft) return;
      const parsed = JSON.parse(savedDraft);
      const restoredBlocks = Array.isArray(parsed.contentBlocks) && parsed.contentBlocks.length
        ? parsed.contentBlocks.map(normalizeTeacherLessonDraftBlock)
        : [createEmptyLessonBlock()];
      const restoredQuestions = Array.isArray(parsed.quizQuestions)
        ? parsed.quizQuestions.map(normalizeTeacherLessonDraftQuestion)
        : [];
      setLessonForm(normalizeTeacherLessonDraftForm(parsed.lessonForm || {}, defaultLessonForm));
      setContentBlocks(restoredBlocks);
      setQuizDraft(normalizeTeacherLessonDraftQuestion(parsed.quizDraft || {}));
      setQuizQuestions(restoredQuestions);
      setCreateStep(Math.max(0, Math.min(LESSON_BUILDER_STEPS.length - 1, Number(parsed.createStep) || 0)));
      if (parsed.savedAt) {
        const savedAt = new Date(parsed.savedAt);
        if (!Number.isNaN(savedAt.getTime())) {
          setDraftSavedAt(savedAt.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit' }));
        }
      }
      setCreateStatus('Draf pelajaran dipulihkan dari peranti ini.');
    } catch {
      localStorage.removeItem(TEACHER_LESSON_DRAFT_KEY);
    } finally {
      lessonDraftReadyRef.current = true;
    }
  }, []);

  React.useEffect(() => {
    if (!lessonDraftReadyRef.current || lessonDraftSkipAutoSaveRef.current) return undefined;
    const draft = { lessonForm, contentBlocks, quizDraft, quizQuestions, createStep };
    if (!hasTeacherLessonDraftContent(draft)) return undefined;
    const timeout = window.setTimeout(() => {
      try {
        const savedAt = new Date();
        localStorage.setItem(TEACHER_LESSON_DRAFT_KEY, JSON.stringify({
          ...draft,
          savedAt:savedAt.toISOString(),
        }));
        setDraftSavedAt(savedAt.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit' }));
      } catch {
        setCreateError('Tidak dapat menyimpan draf pada peranti ini.');
      }
    }, TEACHER_LESSON_DRAFT_AUTOSAVE_MS);
    return () => window.clearTimeout(timeout);
  }, [lessonForm, contentBlocks, quizDraft, quizQuestions, createStep]);

  React.useEffect(() => {
    if (!assignModal) return;
    let cancelled = false;
    setPreviewState({ loading:true, data:null, error:'' });
    window.tusyenApi.lessonDetail(assignModal.id)
      .then(data => { if (!cancelled) setPreviewState({ loading:false, data, error:'' }); })
      .catch(err => { if (!cancelled) setPreviewState({ loading:false, data:null, error:err.message || 'Tidak dapat memuat pratonton.' }); });
    return () => { cancelled = true; };
  }, [assignModal?.id]);

  const openAssignModal = (lesson) => {
    setAssignModal(lesson);
    setAssignMsg('');
    setAssignDueDate('');
    setAssignRequired(true);
  };

  const assignLesson = async () => {
    if (!assignModal || !assignClassId) return;
    setAssigning(true); setAssignMsg('');
    try {
      await window.tusyenApi.assignLessonToClassroom(assignClassId, assignModal.id, {
        dueDate: assignDueDate || null,
        isRequired: assignRequired,
      });
      setAssignMsg('Pelajaran berjaya ditetapkan ke kelas.');
    } catch (e) {
      setAssignMsg(e.message || 'Tidak dapat menetapkan pelajaran.');
    } finally {
      setAssigning(false);
    }
  };

  const updateContentBlock = (id, patch) => {
    setCreateTouched(prev => ({ ...prev, content:true }));
    setContentBlocks(prev => prev.map(block => block.id === id ? { ...block, ...patch } : block));
  };

  const removeContentBlock = (id) => {
    setContentBlocks(prev => prev.length <= 1 ? prev : prev.filter(block => block.id !== id));
  };

  const updateQuizOption = (index, value) => {
    setQuizDraft(prev => ({
      ...prev,
      options: prev.options.map((option, optionIndex) => optionIndex === index ? value : option),
    }));
  };

  const addQuizQuestion = () => {
    setCreateStatus('');
    setCreateError('');
    setCreateErrorItems([]);
    try {
      const normalized = normalizeTeacherQuizQuestion(quizDraft);
      if (!normalized) throw new Error('Isi soalan dahulu.');
      setQuizQuestions(prev => [...prev, { ...quizDraft, id:`q-${Date.now()}-${prev.length}` }]);
      setQuizDraft(createEmptyTeacherQuestion());
      setCreateStatus('Soalan ditambah.');
    } catch (err) {
      setCreateError(err.message || 'Tidak dapat menambah soalan.');
    }
  };

  const validateCreateStep = (stepIndex = createStep) => {
    const errors = createStepValidationErrors(stepIndex);
    if (errors.length) {
      const touchedFields = errors.reduce((next, item) => ({ ...next, [item.field]:true }), {});
      setCreateTouched(prev => ({ ...prev, ...touchedFields }));
      setCreateError('Lengkapkan perkara wajib yang ditanda sebelum teruskan.');
      setCreateErrorItems(errors);
      setCreateStep(stepIndex);
      focusCreateField(errors[0].field);
      return false;
    }
    setCreateError('');
    setCreateErrorItems([]);
    return true;
  };

  const clearLessonDraft = () => {
    lessonDraftSkipAutoSaveRef.current = true;
    try {
      localStorage.removeItem(TEACHER_LESSON_DRAFT_KEY);
    } catch {}
    setDraftSavedAt('');
    window.setTimeout(() => { lessonDraftSkipAutoSaveRef.current = false; }, 0);
  };

  const saveLessonDraft = () => {
    setCreateError('');
    setCreateErrorItems([]);
    try {
      const savedAt = new Date();
      localStorage.setItem(TEACHER_LESSON_DRAFT_KEY, JSON.stringify({
        lessonForm,
        contentBlocks,
        quizDraft,
        quizQuestions,
        createStep,
        savedAt:savedAt.toISOString(),
      }));
      const time = savedAt.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit' });
      setDraftSavedAt(time);
      setCreateStatus(`Draf disimpan pada ${time}.`);
    } catch {
      setCreateError('Tidak dapat menyimpan draf pada peranti ini.');
    }
  };

  const createLesson = async () => {
    const syllabusId = lessonForm.syllabusId;
    if (!validateCreateStep(0) || !validateCreateStep(1)) return;
    setCreatingLesson(true);
    setCreateStatus('');
    setCreateError('');
    setCreateErrorItems([]);
    try {
      if (!syllabusId) throw new Error('Pilih item silibus dahulu.');
      if (!lessonForm.title.trim()) throw new Error('Tajuk pelajaran diperlukan.');
      const questions = quizQuestions.map(normalizeTeacherQuizQuestion).filter(Boolean);
      const draftQuestion = normalizeTeacherQuizQuestion(quizDraft);
      if (draftQuestion) questions.push(draftQuestion);
      const blocks = contentBlocks
        .map(block => ({
          type:'section',
          title:`${block.title || ''}`.trim(),
          body:`${block.body || ''}`.trim(),
        }))
        .filter(block => block.title || block.body);
      await window.tusyenApi.createTeacherLesson({
        syllabusId,
        title: lessonForm.title.trim(),
        content: {
          summary: lessonForm.summary.trim(),
          blocks,
        },
        difficulty: lessonForm.difficulty,
        estimatedMinutes: Number(lessonForm.estimatedMinutes) || 15,
        quizData: { questions },
      });
      clearLessonDraft();
      setCreateStatus('Pelajaran berjaya diterbitkan ke katalog.');
      setLessonForm(prev => ({ ...prev, syllabusId:'', title:'', summary:'' }));
      setContentBlocks([createEmptyLessonBlock()]);
      setQuizDraft(createEmptyTeacherQuestion());
      setQuizQuestions([]);
      setCreateTouched({});
      catalogState.refresh();
      setCreateStep(0);
      setTab('catalog');
    } catch (err) {
      setCreateErrorItems([]);
      setCreateError(err.message || 'Tidak dapat menerbitkan pelajaran.');
    } finally {
      setCreatingLesson(false);
    }
  };

  const createStepId = LESSON_BUILDER_STEPS[createStep]?.id || 'info';
  const lessonPreviewQuestions = quizQuestions.length + (quizDraft.questionText.trim() ? 1 : 0);
  const selectedSyllabus = (syllabusState.data || []).find(item => `${item.id}` === `${lessonForm.syllabusId}`);
  const filledBlockCount = contentBlocks.filter(block => `${block.title || ''}${block.body || ''}`.trim()).length;
  const infoChecks = [
    {
      id:'syllabus',
      label:'Item silibus dipilih',
      done:Boolean(lessonForm.syllabusId),
      detail:selectedSyllabus
        ? `${selectedSyllabus.topic || 'Topik'}${selectedSyllabus.subtopic ? ` - ${selectedSyllabus.subtopic}` : ''}`
        : 'Wajib supaya pelajaran masuk ke topik katalog yang betul.',
    },
    {
      id:'title',
      label:'Tajuk pelajaran jelas',
      done:Boolean(lessonForm.title.trim()),
      detail:lessonForm.title.trim() ? compactLessonTitle(lessonForm.title) : 'Wajib diisi sebelum langkah kandungan.',
    },
    {
      id:'minutes',
      label:'Anggaran masa sah',
      done:(Number(lessonForm.estimatedMinutes) || 0) >= 1,
      detail:(Number(lessonForm.estimatedMinutes) || 0) >= 1 ? `${lessonForm.estimatedMinutes} minit` : 'Isi 1 minit atau lebih.',
    },
  ];
  const contentChecks = [
    {
      id:'content',
      label:'Ringkasan atau kandungan tersedia',
      done:hasLessonContent || Boolean(lessonForm.summary.trim()),
      detail:filledBlockCount
        ? `${filledBlockCount} bahagian kandungan diisi.`
        : lessonForm.summary.trim()
          ? 'Ringkasan sudah cukup untuk meneruskan.'
          : 'Tambah ringkasan atau sekurang-kurangnya satu bahagian.',
    },
  ];
  const finalPreviewChecks = [
    ...infoChecks,
    ...contentChecks,
    {
      id:'difficulty',
      label:'Tahap kesukaran dipilih',
      done:Boolean(lessonForm.difficulty),
      detail:LESSON_DIFF_LABEL[lessonForm.difficulty] || 'Tahap belum dipilih.',
    },
    {
      id:'questions',
      label:'Soalan latihan',
      done:lessonPreviewQuestions > 0,
      required:false,
      detail:lessonPreviewQuestions > 0
        ? `${lessonPreviewQuestions} soalan akan diterbitkan.`
        : 'Pilihan, tetapi membantu semak kefahaman pelajar.',
    },
  ];
  const currentCreateChecks = createStepId === 'info'
    ? infoChecks
    : createStepId === 'content'
      ? contentChecks
      : finalPreviewChecks;
  const goNextCreateStep = () => {
    if (!validateCreateStep(createStep)) return;
    setCreateStep(step => Math.min(LESSON_BUILDER_STEPS.length - 1, step + 1));
  };
  const goPrevCreateStep = () => {
    setCreateError('');
    setCreateStep(step => Math.max(0, step - 1));
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px 0', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          {[['catalog','📚 Katalog'],['create','✏️ Cipta']].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)} style={{
              flex:1, background:tab === v ? C.accDim : 'transparent',
              border:`1.5px solid ${tab === v ? C.borderB : C.border}`,
              borderRadius:10, padding:'7px 0', minHeight:44, cursor:'pointer',
              color:tab === v ? C.accPale : C.textMuted,
              fontFamily:'Nunito', fontWeight:900, fontSize:12,
            }}>{l}</button>
          ))}
        </div>
        {tab === 'catalog' && (
          <div style={{ marginBottom:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 90px', gap:8, marginBottom:7 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari pelajaran..."
                aria-label="Cari pelajaran dalam katalog"
                style={{
                  background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:'8px 10px', color:C.text, fontFamily:'Nunito', fontWeight:700,
                  fontSize:12, outline:'none', minHeight:44,
                }}
              />
              <select value={formLevel} onChange={e => setFormLevel(e.target.value)} aria-label="Tapis tingkatan pelajaran" style={{
                background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
                padding:'8px 10px', minHeight:44, color:C.text, fontFamily:'Nunito', fontWeight:700, fontSize:12,
              }}>
                <option>Semua</option>
                {CLASS_FORM_LEVELS.map(item => <option key={item} value={String(item)}>Tingkatan {item}</option>)}
              </select>
            </div>
            <select value={subject} onChange={e => setSubject(e.target.value)} aria-label="Tapis subjek pelajaran" style={{
              width:'100%', marginBottom:7,
              background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
              padding:'8px 10px', minHeight:44, color:C.text,
              fontFamily:'Nunito', fontWeight:700, fontSize:12,
            }}>
              <option value="">Semua subjek</option>
              {CLASS_SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
              {[
                ['Semua','Semua'],
                ['easy','Mudah'],
                ['medium','Sederhana'],
                ['hard','Sukar'],
              ].map(([value, label]) => (
                <button key={value} onClick={() => setDifficulty(value)} aria-label={`Tapis tahap ${label}`} aria-pressed={difficulty === value} style={{
                  background:difficulty === value ? C.accDim : 'transparent',
                  border:`1.5px solid ${difficulty === value ? C.borderB : C.border}`,
                  borderRadius:20, padding:'4px 12px', minHeight:44,
                  color:difficulty === value ? C.accPale : C.textMuted,
                  fontFamily:'Nunito', fontWeight:900, fontSize:10,
                  cursor:'pointer', whiteSpace:'nowrap',
                }}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 10px' }}>
        {tab === 'catalog' && (
          <>
            {catalogState.loading ? [0,1,2,3].map(i => (
              <Card key={i} style={{ marginBottom:10, padding:12 }}>
                <Skeleton width="65%" height={13} radius={7} style={{ marginBottom:8 }} />
                <Skeleton width="45%" height={10} radius={5} style={{ marginBottom:6 }} />
                <Skeleton width="30%" height={10} radius={5} />
              </Card>
            )) : catalogState.error ? (
              <ErrorRetry message="Tidak dapat memuat katalog pelajaran." onRetry={catalogState.refresh} />
            ) : catalogLessons.length === 0 ? (
              <Card>
                <EmptyState icon="📚" title="Tiada pelajaran" subtitle="Tiada pelajaran dalam katalog bagi penapis ini." />
              </Card>
            ) : catalogGroups.map(group => (
              <div key={group.key} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, margin:'4px 0 8px' }}>
                  <div style={{ fontWeight:900, fontSize:12, color:C.text, textTransform:'uppercase' }}>{group.title}</div>
                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:800 }}>{group.lessons.length} pelajaran</div>
                </div>
                <div style={{ fontSize:11, color:C.textFaint, fontWeight:700, lineHeight:1.35, marginBottom:8 }}>{group.hint}</div>
                {group.lessons.map(lesson => {
                  const assignmentMeta = lessonAssignmentMeta(lesson);
                  const displayTitle = displayLessonTitle(lesson);
                  return (
                    <Card key={lesson.id} style={{ marginBottom:10, padding:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div
                            title={displayTitle}
                            style={{
                              fontWeight:800, fontSize:13, color:C.text, lineHeight:1.35,
                              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                              overflow:'hidden', overflowWrap:'anywhere',
                            }}
                          >{displayTitle}</div>
                          <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:2 }}>
                            {teacherText(lesson.subject, 'Subjek', 34)} - T{lesson.form_level || '-'}
                            {lesson.topic ? ` · ${compactLessonTitle(lesson.topic)}` : ''}
                          </div>
                          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                            <span style={{
                              fontSize:10, fontWeight:900,
                              color:LESSON_DIFF_COLOR[lesson.difficulty] || C.textMuted,
                              background:`color-mix(in srgb,${LESSON_DIFF_COLOR[lesson.difficulty] || C.acc} 12%,transparent)`,
                              border:`1px solid color-mix(in srgb,${LESSON_DIFF_COLOR[lesson.difficulty] || C.acc} 30%,transparent)`,
                              borderRadius:20, padding:'2px 8px',
                            }}>{LESSON_DIFF_LABEL[lesson.difficulty] || lesson.difficulty}</span>
                            {lesson.question_count > 0 && (
                              <span style={{ fontSize:10, fontWeight:600, color:C.textMuted }}>
                                {lesson.question_count} soalan
                              </span>
                            )}
                            {lesson.estimated_minutes && (
                              <span style={{ fontSize:10, fontWeight:600, color:C.textMuted }}>
                                {lesson.estimated_minutes} min
                              </span>
                            )}
                            <TeacherBadge tone={assignmentMeta.tone}>{assignmentMeta.label}</TeacherBadge>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                          <button onClick={() => openAssignModal(lesson)} aria-label={`Pratonton ${displayTitle}`} style={{
                            background:C.accDim, border:`1px solid ${C.borderB}`,
                            borderRadius:10, padding:'7px 10px', minHeight:44, cursor:'pointer',
                            color:C.accPale, fontFamily:'Nunito', fontWeight:900, fontSize:11,
                          }}>Pratonton</button>
                          <button onClick={() => setAssigningLesson(lesson)} aria-label={`Tugaskan ${displayTitle}`} style={{
                            background:C.accDim, border:`1px solid ${C.border}`,
                            borderRadius:8, padding:'5px 10px', minHeight:44, cursor:'pointer',
                            color:C.accPale, fontFamily:'Nunito', fontWeight:800, fontSize:11,
                          }}>Tugaskan</button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </>
        )}
        {tab === 'create' && (
          <Card style={{ marginBottom:12 }}>
            <div style={{ fontWeight:900, fontSize:13, color:C.accPale, marginBottom:8 }}>Cipta Pelajaran Berpandu</div>
            {createStatus && (
              <Card success style={{ marginBottom:8, padding:9 }}>
                <div style={{ fontSize:11, color:C.green, fontWeight:900 }}>{createStatus}</div>
              </Card>
            )}
            {createError && (
              <div role="alert" aria-live="assertive" style={{
                marginBottom:8,
                background:'rgba(239,68,68,.10)',
                border:'1px solid rgba(239,68,68,.34)',
                borderRadius:12,
                padding:10,
              }}>
                <div style={{ fontSize:12, color:C.red, fontWeight:900, marginBottom:3 }}>Semakan diperlukan</div>
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.35 }}>{createError}</div>
                {createErrorItems.length > 0 && (
                  <ul style={{ margin:'7px 0 0 18px', padding:0, color:C.text, fontSize:11, fontWeight:800, lineHeight:1.45 }}>
                    {createErrorItems.map(item => (
                      <li key={item.field}><span style={{ color:C.red }}>{item.label}:</span> {item.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginBottom:10 }}>
              {LESSON_BUILDER_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => { if (index <= createStep || validateCreateStep(createStep)) setCreateStep(index); }}
                  aria-current={createStep === index ? 'step' : undefined}
                  style={{
                    minHeight:44,
                    background:createStep === index ? C.accDim : 'transparent',
                    border:`1.5px solid ${createStep === index ? C.borderB : C.border}`,
                    borderRadius:10,
                    color:createStep === index ? C.accPale : C.textMuted,
                    fontFamily:'Nunito', fontWeight:900, fontSize:11,
                    cursor:'pointer',
                  }}
                >
                  {index + 1}. {step.label}
                </button>
              ))}
            </div>
            <TeacherChecklistPanel
              title={createStepId === 'questions' ? 'Senarai semak sebelum terbit' : 'Wajib lengkap sebelum teruskan'}
              items={currentCreateChecks}
              style={{ marginBottom:10 }}
            />
            <div style={{ display:'grid', gap:8 }}>
              {createStepId === 'info' && (
                <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 92px', gap:8 }}>
                <TeacherField label="Subjek" required>
                  <select value={lessonForm.subject} onChange={e => setLessonForm(prev => ({ ...prev, subject:e.target.value, syllabusId:'' }))} aria-label="Subjek pelajaran" style={teacherInputBase}>
                    {CLASS_SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </TeacherField>
                <TeacherField label="Tingkatan" required>
                  <select value={lessonForm.formLevel} onChange={e => setLessonForm(prev => ({ ...prev, formLevel:e.target.value, syllabusId:'' }))} aria-label="Tingkatan pelajaran" style={teacherInputBase}>
                    {CLASS_FORM_LEVELS.map(item => <option key={item} value={String(item)}>Tingkatan {item}</option>)}
                  </select>
                </TeacherField>
              </div>
              <TeacherField
                label="Item Silibus"
                required
                hint={lessonForm.syllabusId ? 'Topik ini akan digunakan dalam katalog pelajaran.' : 'Wajib dipilih sebelum ke langkah kandungan.'}
                error={infoFieldError('syllabusId', !lessonForm.syllabusId, 'Pilih topik silibus sebelum teruskan.')}
              >
                <select
                  ref={el => { createFieldRefs.current.syllabusId = el; }}
                  value={lessonForm.syllabusId}
                  onBlur={() => markCreateTouched('syllabusId')}
                  onChange={e => setLessonForm(prev => ({ ...prev, syllabusId:e.target.value }))}
                  aria-label="Item silibus pelajaran"
                  aria-invalid={createFieldInvalid('syllabusId', !lessonForm.syllabusId) ? 'true' : undefined}
                  style={{ ...teacherInputBase, ...(createInvalidStyle('syllabusId', !lessonForm.syllabusId) || {}) }}
                >
                  <option value="">Pilih topik silibus</option>
                  {(syllabusState.data || []).map(item => (
                    <option key={item.id} value={item.id}>{compactLessonTitle(item.topic, 'Topik')}{item.subtopic ? ` - ${compactLessonTitle(item.subtopic, 'Subtopik')}` : ''}</option>
                  ))}
                </select>
              </TeacherField>
              {syllabusState.loading && <Skeleton width="100%" height={28} radius={8} />}
              {!syllabusState.loading && (syllabusState.data || []).length === 0 && (
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>Tiada item silibus untuk subjek dan tingkatan ini.</div>
              )}
              <TeacherField
                label="Tajuk Pelajaran"
                required
                hint={lessonForm.title.trim() ? 'Tajuk ini dipaparkan kepada pelajar dan guru.' : 'Wajib diisi sebelum ke langkah kandungan.'}
                error={infoFieldError('title', !lessonForm.title.trim(), 'Tajuk wajib diisi.')}
              >
                <input
                  ref={el => { createFieldRefs.current.title = el; }}
                  value={lessonForm.title}
                  onBlur={() => markCreateTouched('title')}
                  onChange={e => setLessonForm(prev => ({ ...prev, title:e.target.value }))}
                  placeholder="Contoh: Kecerunan garis lurus"
                  aria-label="Tajuk pelajaran"
                  aria-invalid={createFieldInvalid('title', !lessonForm.title.trim()) ? 'true' : undefined}
                  style={{ ...teacherInputBase, ...(createInvalidStyle('title', !lessonForm.title.trim()) || {}) }}
                />
              </TeacherField>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <TeacherField label="Tahap" required>
                  <select value={lessonForm.difficulty} onChange={e => setLessonForm(prev => ({ ...prev, difficulty:e.target.value }))} aria-label="Tahap kesukaran pelajaran" style={teacherInputBase}>
                    <option value="easy">Mudah</option>
                    <option value="medium">Sederhana</option>
                    <option value="hard">Sukar</option>
                  </select>
                </TeacherField>
                <TeacherField
                  label="Anggaran Minit"
                  required
                  hint={(Number(lessonForm.estimatedMinutes) || 0) >= 1 ? 'Anggaran membantu guru menetapkan beban tugasan.' : 'Wajib 1 minit atau lebih.'}
                  error={infoFieldError('estimatedMinutes', (Number(lessonForm.estimatedMinutes) || 0) < 1, 'Isi 1 minit atau lebih.')}
                >
                  <input
                    ref={el => { createFieldRefs.current.estimatedMinutes = el; }}
                    type="number"
                    min="1"
                    value={lessonForm.estimatedMinutes}
                    onBlur={() => markCreateTouched('estimatedMinutes')}
                    onChange={e => setLessonForm(prev => ({ ...prev, estimatedMinutes:e.target.value }))}
                    aria-label="Anggaran minit pelajaran"
                    aria-invalid={createFieldInvalid('estimatedMinutes', (Number(lessonForm.estimatedMinutes) || 0) < 1) ? 'true' : undefined}
                    style={{ ...teacherInputBase, ...(createInvalidStyle('estimatedMinutes', (Number(lessonForm.estimatedMinutes) || 0) < 1) || {}) }}
                  />
                </TeacherField>
              </div>
              <TeacherField label="Ringkasan" hint="Ringkasan membantu pratonton sebelum pelajaran diterbitkan.">
                <textarea value={lessonForm.summary} onChange={e => setLessonForm(prev => ({ ...prev, summary:e.target.value }))} rows={3} placeholder="Nyatakan hasil pembelajaran utama." aria-label="Ringkasan pelajaran" style={{ ...teacherInputBase, resize:'vertical' }} />
              </TeacherField>
                </>
              )}

              {createStepId === 'content' && (
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:'grid', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div style={{ fontWeight:900, fontSize:12, color:C.text }}>Kandungan</div>
                  <TeacherSmallButton onClick={() => setContentBlocks(prev => [...prev, createEmptyLessonBlock()])}>Tambah Bahagian</TeacherSmallButton>
                </div>
                {createTouched.content && !hasLessonContent && !lessonForm.summary.trim() && (
                  <div role="alert" style={{ fontSize:11, color:C.red, fontWeight:900 }}>
                    Tambah ringkasan atau sekurang-kurangnya satu bahagian kandungan.
                  </div>
                )}
                {contentBlocks.map((block, index) => (
                  <div key={block.id} style={{ display:'grid', gap:6, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:9 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                      <TeacherBadge>Bahagian {index + 1}</TeacherBadge>
                      <TeacherSmallButton danger disabled={contentBlocks.length <= 1} onClick={() => removeContentBlock(block.id)}>Buang</TeacherSmallButton>
                    </div>
                    <input
                      ref={el => { if (index === 0) createFieldRefs.current.content = el; }}
                      value={block.title}
                      onChange={e => updateContentBlock(block.id, { title:e.target.value })}
                      placeholder="Tajuk bahagian"
                      aria-invalid={createFieldInvalid('content', !hasLessonContent && !lessonForm.summary.trim()) ? 'true' : undefined}
                      style={{ ...teacherInputBase, ...(index === 0 ? (createInvalidStyle('content', !hasLessonContent && !lessonForm.summary.trim()) || {}) : {}) }}
                    />
                    <textarea
                      value={block.body}
                      onChange={e => updateContentBlock(block.id, { body:e.target.value })}
                      rows={3}
                      placeholder="Penerangan, contoh, atau langkah kerja."
                      style={{ ...teacherInputBase, resize:'vertical', ...(index === 0 ? (createInvalidStyle('content', !hasLessonContent && !lessonForm.summary.trim()) || {}) : {}) }}
                    />
                  </div>
                ))}
              </div>
              )}

              {createStepId === 'questions' && (
                <>
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:'grid', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div style={{ fontWeight:900, fontSize:12, color:C.text }}>Soalan Latihan</div>
                  <TeacherBadge>{lessonPreviewQuestions} soalan</TeacherBadge>
                </div>
                {quizQuestions.length > 0 && (
                  <div style={{ display:'grid', gap:6 }}>
                    {quizQuestions.map((question, index) => (
                      <div key={question.id} style={{ display:'flex', alignItems:'center', gap:8, border:`1px solid ${C.border}`, borderRadius:9, padding:'7px 8px', background:C.surface }}>
                        <TeacherBadge>{index + 1}</TeacherBadge>
                        <div style={{ flex:1, minWidth:0, fontSize:11, color:C.textMuted, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {question.type === 'multiple_choice' ? 'MCQ' : 'Benar/Salah'} - {compactLessonTitle(question.questionText)}
                        </div>
                        <TeacherSmallButton danger onClick={() => setQuizQuestions(prev => prev.filter(item => item.id !== question.id))}>Buang</TeacherSmallButton>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <TeacherField label="Jenis">
                    <select value={quizDraft.type} onChange={e => setQuizDraft(prev => ({ ...prev, type:e.target.value }))} style={teacherInputBase}>
                      <option value="multiple_choice">MCQ</option>
                      <option value="true_false">Benar/Salah</option>
                    </select>
                  </TeacherField>
                  <TeacherField label="Jawapan">
                    {quizDraft.type === 'multiple_choice' ? (
                      <select value={quizDraft.correctOption} onChange={e => setQuizDraft(prev => ({ ...prev, correctOption:e.target.value }))} style={teacherInputBase}>
                        {quizDraft.options.map((_option, index) => <option key={index} value={String(index)}>Pilihan {index + 1}</option>)}
                      </select>
                    ) : (
                      <select value={quizDraft.trueFalseAnswer} onChange={e => setQuizDraft(prev => ({ ...prev, trueFalseAnswer:e.target.value }))} style={teacherInputBase}>
                        <option value="true">Benar</option>
                        <option value="false">Salah</option>
                      </select>
                    )}
                  </TeacherField>
                </div>
                <TeacherField label="Soalan">
                  <input value={quizDraft.questionText} onChange={e => setQuizDraft(prev => ({ ...prev, questionText:e.target.value }))} placeholder="Tulis soalan untuk pelajar" style={teacherInputBase} />
                </TeacherField>
                {quizDraft.type === 'multiple_choice' && (
                  <div style={{ display:'grid', gap:6 }}>
                    {quizDraft.options.map((option, index) => (
                      <input key={index} value={option} onChange={e => updateQuizOption(index, e.target.value)} placeholder={`Pilihan ${index + 1}`} style={teacherInputBase} />
                    ))}
                  </div>
                )}
                <TeacherField label="Penjelasan">
                  <input value={quizDraft.explanation} onChange={e => setQuizDraft(prev => ({ ...prev, explanation:e.target.value }))} placeholder="Penjelasan selepas pelajar menjawab" style={teacherInputBase} />
                </TeacherField>
                <TeacherSmallButton onClick={addQuizQuestion} style={{ justifySelf:'start' }}>Tambah Soalan</TeacherSmallButton>
              </div>

              <Card style={{ padding:11, background:C.surface }}>
                <div style={{ fontWeight:900, fontSize:12, color:C.text, marginBottom:7 }}>Pratonton sebelum terbit</div>
                <div style={{ fontSize:13, color:C.text, fontWeight:900, lineHeight:1.35, marginBottom:4 }}>
                  {compactLessonTitle(lessonForm.title) || 'Tajuk pelajaran'}
                </div>
                <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.45, marginBottom:8 }}>
                  {lessonForm.summary || 'Ringkasan belum diisi.'}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <TeacherBadge>{lessonForm.subject}</TeacherBadge>
                  <TeacherBadge>Tingkatan {lessonForm.formLevel}</TeacherBadge>
                  <TeacherBadge tone={lessonForm.difficulty === 'hard' ? 'bad' : lessonForm.difficulty === 'easy' ? 'good' : 'warn'}>
                    {LESSON_DIFF_LABEL[lessonForm.difficulty]}
                  </TeacherBadge>
                  <TeacherBadge>{contentBlocks.filter(block => block.title.trim() || block.body.trim()).length} bahagian</TeacherBadge>
                  <TeacherBadge>{lessonPreviewQuestions} soalan</TeacherBadge>
                </div>
              </Card>
                </>
              )}

              <div style={{ display:'flex', gap:8, flexWrap:'wrap', borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                <button onClick={saveLessonDraft} type="button" style={{
                  minHeight:44, background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:12, padding:'0 14px', color:C.textMuted,
                  fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
                }}>Simpan draf</button>
                {createStep > 0 && (
                  <button onClick={goPrevCreateStep} style={{
                    minHeight:44, background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:'0 14px', color:C.textMuted,
                    fontFamily:'Nunito', fontWeight:900, cursor:'pointer',
                  }}>Kembali</button>
                )}
                {createStep < LESSON_BUILDER_STEPS.length - 1 ? (
                  <GlowButton onClick={goNextCreateStep} style={{ flex:1, padding:'10px 12px', fontSize:13 }}>Seterusnya</GlowButton>
                ) : (
                  <GlowButton onClick={createLesson} disabled={creatingLesson} style={{ flex:1, padding:'10px 12px', fontSize:13 }}>
                    {creatingLesson ? 'Menerbitkan...' : 'Pratonton disemak, terbitkan'}
                  </GlowButton>
                )}
              </div>
              {draftSavedAt && (
                <div style={{ fontSize:11, color:C.green, fontWeight:900 }}>
                  Draf terakhir disimpan pada {draftSavedAt}.
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
      {assignModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }} onClick={e => e.target === e.currentTarget && setAssignModal(null)}>
          <div style={{ background:C.card, borderRadius:18, padding:'20px 18px', width:'100%', maxWidth:520, maxHeight:'86vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:4 }}>Pratonton Pelajaran</div>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{displayLessonTitle(assignModal)}</div>
              </div>
              <TeacherBadge tone={assignModal.difficulty === 'hard' ? 'bad' : assignModal.difficulty === 'easy' ? 'good' : 'warn'}>
                {LESSON_DIFF_LABEL[assignModal.difficulty] || assignModal.difficulty}
              </TeacherBadge>
            </div>
            {previewState.loading ? (
              <Card style={{ marginBottom:12, padding:10 }}>
                <Skeleton width="70%" height={13} radius={7} style={{ marginBottom:8 }} />
                <Skeleton width="100%" height={10} radius={5} style={{ marginBottom:6 }} />
                <Skeleton width="82%" height={10} radius={5} />
              </Card>
            ) : previewState.error ? (
              <div style={{ marginBottom:12 }}>
                <ErrorRetry message={previewState.error} />
              </div>
            ) : (
              <Card style={{ marginBottom:12, padding:11, background:C.surface }}>
                <div style={{ fontSize:12, color:C.text, fontWeight:800, lineHeight:1.45 }}>
                  {lessonSummary(previewState.data?.lesson?.content || assignModal.content) || 'Tiada ringkasan pelajaran.'}
                </div>
                {lessonBlocks(previewState.data?.lesson?.content || assignModal.content).slice(0,3).map((block, index) => (
                  <div key={index} style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                    {block.title && <div style={{ fontSize:11, color:C.accPale, fontWeight:900 }}>{block.title}</div>}
                    <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, lineHeight:1.4 }}>{block.body || block.text || 'Bahagian kandungan.'}</div>
                  </div>
                ))}
                <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                  <TeacherBadge>{previewState.data?.questions?.length ?? assignModal.question_count ?? 0} soalan</TeacherBadge>
                  {assignModal.estimated_minutes && <TeacherBadge>{assignModal.estimated_minutes} min</TeacherBadge>}
                  {assignModal.topic && <TeacherBadge>{compactLessonTitle(assignModal.topic, 'Topik')}</TeacherBadge>}
                </div>
              </Card>
            )}
            <TeacherField label="Kelas">
              <select value={assignClassId} onChange={e => setAssignClassId(e.target.value)} style={{ ...teacherInputBase, marginBottom:10 }}>
                {classrooms.map(c => <option key={c.id} value={c.id}>{teacherText(c.name, 'Kelas', 54)}</option>)}
              </select>
            </TeacherField>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'end', marginBottom:10 }}>
              <TeacherField label="Tarikh Hantar">
                <input type="date" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} style={teacherInputBase} />
              </TeacherField>
              <label style={{ display:'flex', alignItems:'center', gap:7, minHeight:44, color:C.textMuted, fontSize:11, fontWeight:900 }}>
                <input type="checkbox" checked={assignRequired} onChange={e => setAssignRequired(e.target.checked)} style={{ accentColor:C.acc }} />
                Wajib
              </label>
            </div>
            {assignMsg && (
              <div style={{ fontSize:11, color:assignMsg.includes('berjaya') ? C.green : C.red, fontWeight:800, marginBottom:8 }}>{assignMsg}</div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <GlowButton onClick={assignLesson} disabled={assigning} style={{ flex:1 }}>
                {assigning ? 'Menetapkan...' : 'Tetapkan ke Kelas'}
              </GlowButton>
              <button onClick={() => setAssignModal(null)} style={{
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
                padding:'0 14px', minHeight:44, cursor:'pointer', color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
              }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
      {assigningLesson && (
        <AssignLessonModal
          lesson={assigningLesson}
          classrooms={classrooms}
          onAssigned={() => {}}
          onClose={() => setAssigningLesson(null)}
        />
      )}
    </div>
  );
};

// ─── Whiteboard ────────────────────────────────────────────────────────────

const useWhiteboardSessions = (classroomId) => {
  return useAsync(async () => {
    if (!isLiveClassId(classroomId)) return { active:null, history:[] };
    const [activeData, historyData] = await Promise.all([
      window.tusyenApi.whiteboardActiveSession(classroomId).catch(() => null),
      window.tusyenApi.whiteboardSessions(classroomId).catch(() => ({ sessions:[] })),
    ]);
    return {
      active: activeData?.session || activeData?.activeSession || null,
      history: historyData?.sessions || [],
    };
  }, [classroomId], { active:null, history:[] });
};

const whiteboardParticipantCount = (session) => {
  const value = session?.participant_count ?? session?.participantCount ?? session?.viewer_count ?? session?.viewerCount ?? session?.participants;
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
};

const whiteboardReplayUrl = (session) => (
  session?.replay_url || session?.replayUrl || session?.recording_url || session?.recordingUrl || session?.playback_url || session?.playbackUrl || ''
);

const whiteboardSessionId = (session) => (
  session?.id || session?.session_id || session?.sessionId || ''
);

const whiteboardHasEventReplay = (session) => {
  if (!whiteboardSessionId(session)) return false;
  return Boolean(
    whiteboardReplayUrl(session) ||
    session?.ended_at ||
    session?.endedAt ||
    session?.event_count ||
    session?.eventCount ||
    session?.events_count ||
    session?.eventsCount
  );
};

const whiteboardRecordingLabel = (session) => {
  const status = `${session?.recording_status ?? session?.recordingStatus ?? ''}`.toLowerCase();
  if (whiteboardReplayUrl(session)) return 'Rakaman tersedia';
  if (status.includes('record') || status.includes('active') || status.includes('running')) return 'Rakaman berjalan';
  if (status.includes('process')) return 'Rakaman diproses';
  if (whiteboardHasEventReplay(session)) return 'Rakaman tersedia';
  if (status.includes('off') || status.includes('none') || session?.is_recording === false) return 'Tidak dirakam';
  return session?.ended_at || session?.endedAt ? 'Rakaman belum tersedia' : 'Sedia dirakam';
};

const whiteboardRecordingGuidance = (session) => {
  if (whiteboardReplayUrl(session) || whiteboardHasEventReplay(session)) return 'Ulangan boleh dimainkan semula daripada aktiviti papan putih sesi ini.';
  const label = whiteboardRecordingLabel(session);
  if (label === 'Tidak dirakam') return 'Sesi ini tidak dirakam; kongsi ringkasan sesi untuk rujukan pelajar.';
  if (session?.ended_at || session?.endedAt) return 'Rakaman biasanya muncul selepas pemprosesan selesai. Kongsi ringkasan sementara menunggu ulangan tersedia.';
  return 'Rakaman biasanya tersedia selepas sesi ditamatkan dan diproses.';
};

const whiteboardSummaryText = (session, classroom) => {
  const title = teacherTitle(session?.title, 'Sesi Papan Putih');
  const className = teacherText(classroom?.name, 'kelas ini', 54);
  const started = session?.started_at || session?.startedAt || session?.created_at || session?.createdAt;
  const replayUrl = whiteboardReplayUrl(session);
  return [
    `${title} - ${className}`,
    started ? `Bermula: ${formatActivityStatus(started)}` : '',
    `${whiteboardParticipantCount(session)} peserta`,
    whiteboardRecordingLabel(session),
    replayUrl ? `Ulangan: ${replayUrl}` : whiteboardHasEventReplay(session) ? 'Ulangan: tersedia dalam aplikasi' : '',
  ].filter(Boolean).join('\n');
};

const WHITEBOARD_REPLAY_BG = '#0f0f1a';

const whiteboardParseJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const whiteboardReplayPayload = (event) => {
  const parsed = whiteboardParseJson(event);
  if (!parsed || typeof parsed !== 'object') return null;
  const nested = whiteboardParseJson(parsed.payload ?? parsed.data ?? parsed.event ?? parsed.message ?? null);
  if (nested && typeof nested === 'object') return { ...parsed, ...nested };
  return parsed;
};

const whiteboardReplayEvents = (data) => {
  const rawEvents = Array.isArray(data)
    ? data
    : data?.events || data?.sessionEvents || data?.items || [];
  return rawEvents
    .map(whiteboardReplayPayload)
    .filter(Boolean)
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const aOrder = a.event.sequence ?? a.event.seq ?? a.event.order ?? a.event.created_at ?? a.event.createdAt ?? a.index;
      const bOrder = b.event.sequence ?? b.event.seq ?? b.event.order ?? b.event.created_at ?? b.event.createdAt ?? b.index;
      const aNum = Number(aOrder);
      const bNum = Number(bOrder);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
      const aTime = new Date(aOrder).getTime();
      const bTime = new Date(bOrder).getTime();
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return a.index - b.index;
    })
    .map(item => item.event);
};

const whiteboardReplayType = (event) => (
  `${event?.event_type ?? event?.eventType ?? event?.type ?? event?.action ?? event?.kind ?? ''}`.toLowerCase()
);

const whiteboardReplayCanvasSize = (event) => ({
  width: Number(event?.canvas_width ?? event?.canvasWidth ?? event?.canvas?.width ?? 800) || 800,
  height: Number(event?.canvas_height ?? event?.canvasHeight ?? event?.canvas?.height ?? 600) || 600,
});

const whiteboardReplayCoord = (value, currentMax, originalMax) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) <= 1) return n * currentMax;
  if (Number.isFinite(originalMax) && originalMax > 0 && originalMax !== currentMax) return (n / originalMax) * currentMax;
  return n;
};

const whiteboardReplayPoint = (event, xKeys, yKeys, canvas) => {
  const original = whiteboardReplayCanvasSize(event);
  const pick = (keys) => {
    for (const key of keys) {
      const value = key.split('.').reduce((obj, part) => obj?.[part], event);
      if (value !== undefined && value !== null) return value;
    }
    return null;
  };
  const x = whiteboardReplayCoord(pick(xKeys), canvas.width, original.width);
  const y = whiteboardReplayCoord(pick(yKeys), canvas.height, original.height);
  return x === null || y === null ? null : { x, y };
};

const whiteboardReplayPoints = (event, canvas) => {
  const raw = event?.points || event?.path || event?.stroke || [];
  if (!Array.isArray(raw)) return [];
  const original = whiteboardReplayCanvasSize(event);
  return raw
    .map(point => {
      if (Array.isArray(point)) {
        return {
          x: whiteboardReplayCoord(point[0], canvas.width, original.width),
          y: whiteboardReplayCoord(point[1], canvas.height, original.height),
        };
      }
      return {
        x: whiteboardReplayCoord(point?.x ?? point?.left, canvas.width, original.width),
        y: whiteboardReplayCoord(point?.y ?? point?.top, canvas.height, original.height),
      };
    })
    .filter(point => point.x !== null && point.y !== null);
};

const whiteboardDrawReplayEvent = (ctx, event) => {
  const type = whiteboardReplayType(event);
  if (type.includes('clear') || event?.clear === true) {
    ctx.fillStyle = WHITEBOARD_REPLAY_BG;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  const strokes = whiteboardParseJson(event?.strokes);
  if (Array.isArray(strokes) && strokes.length) {
    strokes.forEach(stroke => {
      const parsedStroke = whiteboardParseJson(stroke);
      if (!parsedStroke || typeof parsedStroke !== 'object') return;
      whiteboardDrawReplayEvent(ctx, { ...event, ...parsedStroke, strokes:null });
    });
    return;
  }
  const points = whiteboardReplayPoints(event, ctx.canvas);
  const from = points[0] || whiteboardReplayPoint(
    event,
    ['from.x', 'start.x', 'previous.x', 'last.x', 'x1', 'fromX', 'startX', 'prevX', 'lastX'],
    ['from.y', 'start.y', 'previous.y', 'last.y', 'y1', 'fromY', 'startY', 'prevY', 'lastY'],
    ctx.canvas
  );
  const to = points.length > 1 ? points[points.length - 1] : whiteboardReplayPoint(
    event,
    ['to.x', 'end.x', 'current.x', 'point.x', 'position.x', 'x2', 'toX', 'endX', 'x'],
    ['to.y', 'end.y', 'current.y', 'point.y', 'position.y', 'y2', 'toY', 'endY', 'y'],
    ctx.canvas
  );
  if (!from || !to) return;

  const tool = `${event?.tool ?? event?.mode ?? ''}`.toLowerCase();
  const width = Number(event?.line_width ?? event?.lineWidth ?? event?.stroke_width ?? event?.strokeWidth ?? event?.width ?? event?.size ?? 3);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Number.isFinite(width) ? Math.max(1, width) : 3;
  ctx.strokeStyle = tool.includes('eraser') || type.includes('erase')
    ? WHITEBOARD_REPLAY_BG
    : event?.color || event?.strokeStyle || event?.stroke_color || event?.strokeColor || '#A78BFA';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  if (points.length > 1) {
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  } else {
    ctx.lineTo(to.x, to.y);
  }
  ctx.stroke();
  ctx.restore();
};

const whiteboardRenderReplayEvents = (canvas, events, limit = events.length) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = WHITEBOARD_REPLAY_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  events.slice(0, limit).forEach(event => whiteboardDrawReplayEvent(ctx, event));
};

const WhiteboardReplay = ({ session, classroom, onClose }) => {
  const canvasRef = React.useRef(null);
  const timerRef = React.useRef(null);
  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState([]);
  const [error, setError] = React.useState('');
  const [playhead, setPlayhead] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const sessionId = whiteboardSessionId(session);
  const replayUrl = whiteboardReplayUrl(session);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!sessionId) {
        setLoading(false);
        setError('Sesi tidak sah.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await window.tusyenApi.whiteboardSessionEvents(sessionId);
        const nextEvents = whiteboardReplayEvents(data);
        if (cancelled) return;
        setEvents(nextEvents);
        setPlayhead(nextEvents.length);
        setError(nextEvents.length ? '' : 'Tiada aktiviti papan putih ditemui untuk ulangan ini.');
      } catch (e) {
        if (cancelled) return;
        setEvents([]);
        setPlayhead(0);
        setError(e.message || 'Tidak dapat memuatkan ulangan papan putih.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  React.useEffect(() => {
    whiteboardRenderReplayEvents(canvasRef.current, events, playhead);
  }, [events, playhead]);

  React.useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const stopPlayback = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  };

  const playReplay = () => {
    if (!events.length) return;
    stopPlayback();
    let index = 0;
    setPlayhead(0);
    setPlaying(true);
    timerRef.current = window.setInterval(() => {
      index += 1;
      setPlayhead(index);
      if (index >= events.length) stopPlayback();
    }, 45);
  };

  const showFinal = () => {
    stopPlayback();
    setPlayhead(events.length);
  };

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <Card style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:16, color:C.accPale, marginBottom:4 }}>🖌️ Ulangan Papan Putih</div>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.35 }}>
              {teacherTitle(session?.title, 'Sesi Papan Putih')} - {teacherText(classroom?.name, 'kelas ini', 54)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
            padding:'0 14px', minHeight:44, cursor:'pointer',
            color:C.accPale, fontFamily:'Nunito', fontWeight:900, fontSize:12,
          }}>Kembali</button>
        </div>
      </Card>
      <Card style={{ marginBottom:12, padding:0, overflow:'hidden' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{ width:'100%', background:WHITEBOARD_REPLAY_BG, display:'block' }}
        />
      </Card>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
        <GlowButton onClick={playReplay} disabled={loading || playing || !events.length} style={{ flex:1 }}>
          {playing ? 'Memainkan...' : 'Main semula'}
        </GlowButton>
        <button onClick={showFinal} disabled={loading || !events.length} style={{
          background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
          padding:'0 14px', minHeight:44, cursor:loading || !events.length ? 'not-allowed' : 'pointer',
          color:C.accPale, fontFamily:'Nunito', fontWeight:900, fontSize:12,
          opacity:loading || !events.length ? 0.55 : 1,
        }}>Tunjuk akhir</button>
        {replayUrl && (
          <a href={replayUrl} target="_blank" rel="noreferrer" style={{
            minHeight:44, display:'inline-flex', alignItems:'center',
            background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
            padding:'0 14px', color:C.accPale, textDecoration:'none',
            fontSize:12, fontWeight:900,
          }}>Buka fail</a>
        )}
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <TeacherBadge>{loading ? 'Memuatkan...' : `${playhead}/${events.length} aktiviti`}</TeacherBadge>
        <TeacherBadge tone={error ? 'warn' : 'good'}>{error || 'Ulangan sedia dimainkan'}</TeacherBadge>
      </div>
    </div>
  );
};

const WhiteboardCanvas = ({ sessionId, classroomId, onClose }) => {
  const canvasRef = React.useRef(null);
  const wsRef = React.useRef(null);
  const drawingRef = React.useRef(false);
  const lastPosRef = React.useRef(null);
  const [tool, setTool] = React.useState('pen');
  const [color, setColor] = React.useState('#A78BFA');
  const [lineWidth, setLineWidth] = React.useState(3);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const wsUrl = window.tusyenApi.buildClassroomWsUrl(classroomId);
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        const token = localStorage.getItem('tusyen_token') || '';
        ws.send(JSON.stringify({ type:'AUTH', token }));
      };
      ws.onclose = () => setConnected(false);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'AUTH_SUCCESS') {
            setConnected(true);
          } else if (msg.type === 'WHITEBOARD_DRAW') {
            (msg.strokes || []).forEach(stroke => drawStroke(ctx, stroke));
          } else if (msg.type === 'WHITEBOARD_CLEAR') {
            ctx.fillStyle = '#0f0f1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        } catch { }
      };
    } catch { setConnected(false); }

    return () => { ws?.close(); };
  }, [classroomId, sessionId]);

  const drawLine = (ctx, from, to, strokeColor, width, drawTool) => {
    ctx.globalCompositeOperation = drawTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const drawStroke = (ctx, stroke = {}) => {
    const points = stroke.points || [];
    if (points.length < 2) return;
    const from = Array.isArray(points[0]) ? { x:points[0][0], y:points[0][1] } : points[0];
    const to = Array.isArray(points[1]) ? { x:points[1][0], y:points[1][1] } : points[1];
    drawLine(ctx, from, to, stroke.color || color, stroke.width || stroke.lineWidth || lineWidth, stroke.tool || 'pen');
  };

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: ((touch.clientX - rect.left) / rect.width) * canvas.width,
      y: ((touch.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e) => {
    drawingRef.current = true;
    lastPosRef.current = getPos(e, canvasRef.current);
  };

  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const from = lastPosRef.current;
    const to = getPos(e, canvas);
    drawLine(ctx, from, to, color, lineWidth, tool);
    lastPosRef.current = to;
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        type:'WHITEBOARD_DRAW',
        strokes:[{ color, width:lineWidth, tool, points:[[from.x, from.y], [to.x, to.y]] }],
      }));
    }
  };

  const onPointerUp = () => { drawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type:'WHITEBOARD_CLEAR' }));
    }
  };

  const COLORS = ['#A78BFA','#38BDF8','#22C55E','#F59E0B','#EF4444','#fff','#0f0f1a'];

  return (
    <div style={{
      position:'fixed', inset:0, background:'#0f0f1a', zIndex:2000,
      display:'flex', flexDirection:'column',
    }}>
      <div style={{
        padding:'10px 14px', background:C.card, borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:10, flexShrink:0,
      }}>
        <button onClick={onClose} aria-label="Tutup papan putih" style={{
          background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
          cursor:'pointer', minWidth:44, minHeight:44, padding:'0 12px',
          fontSize:12, color:C.textMuted, fontFamily:'Nunito', fontWeight:900,
        }}>Kembali</button>
        <div style={{ fontWeight:800, fontSize:14, color:C.text, flex:1 }}>Papan Putih</div>
        <div style={{ fontSize:10, color:connected ? C.green : C.red, fontWeight:800 }}>
          {connected ? '● Bersambung' : '● Terputus'}
        </div>
      </div>
      <div style={{
        padding:'8px 12px', background:C.surface, borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap',
      }}>
        {[['pen','Pen'],['eraser','Pemadam']].map(([t,label]) => (
          <button key={t} onClick={() => setTool(t)} aria-label={`Alat ${label}`} aria-pressed={tool === t} style={{
            background:tool === t ? C.accDim : 'transparent',
            border:`1.5px solid ${tool === t ? C.borderB : C.border}`,
            borderRadius:10, padding:'0 12px', minHeight:44, minWidth:82, cursor:'pointer',
            color:tool === t ? C.accPale : C.textMuted,
            fontFamily:'Nunito', fontWeight:800, fontSize:12,
          }}>{label}</button>
        ))}
        <div aria-label="Warna pen" style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {COLORS.map((col, index) => (
            <button key={col} onClick={() => setColor(col)} aria-label={`Pilih warna ${index + 1}`} aria-pressed={color === col} style={{
              width:44, height:44, borderRadius:10, background:col, cursor:'pointer',
              border:color === col ? '2px solid #fff' : `1px solid ${C.border}`,
              padding:0, flexShrink:0,
            }} />
          ))}
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, minHeight:44, color:C.textMuted, fontSize:11, fontWeight:900 }}>
          Saiz
          <input
            type="range" min="1" max="20" value={lineWidth}
            onChange={e => setLineWidth(Number(e.target.value))}
            aria-label="Saiz garisan"
            style={{ width:92, accentColor:C.acc }}
          />
          <span style={{ color:C.accPale, minWidth:22 }}>{lineWidth}</span>
        </label>
        <button onClick={clearCanvas} style={{
          background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)',
          borderRadius:10, padding:'0 12px', minHeight:44, minWidth:92, cursor:'pointer',
          color:C.red, fontFamily:'Nunito', fontWeight:800, fontSize:11,
        }}>Padam papan</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ flex:1, touchAction:'none', cursor:tool === 'eraser' ? 'cell' : 'crosshair', maxWidth:'100%', display:'block' }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />
    </div>
  );
};

const TeacherWhiteboardScreen = ({ classrooms }) => {
  const [selectedClassId, setSelectedClassId] = React.useState(classrooms[0]?.id || '');
  const [activeCanvas, setActiveCanvas] = React.useState(null);
  const [replaySession, setReplaySession] = React.useState(null);
  const [starting, setStarting] = React.useState(false);
  const [ending, setEnding] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const sessState = useWhiteboardSessions(selectedClassId);
  const { active, history } = sessState.data || { active:null, history:[] };
  const selectedClass = classrooms.find(cls => cls.id === selectedClassId) || classrooms[0] || null;

  React.useEffect(() => {
    const firstClassId = classrooms[0]?.id || '';
    const stillAvailable = classrooms.some(cls => cls.id === selectedClassId);
    if (!firstClassId) {
      if (selectedClassId) setSelectedClassId('');
      return;
    }
    if (!selectedClassId || !stillAvailable) setSelectedClassId(firstClassId);
  }, [classrooms, selectedClassId]);

  const startSession = async () => {
    if (!selectedClassId || !isLiveClassId(selectedClassId)) {
      setMsg('Pilih kelas nyata untuk memulakan sesi.');
      return;
    }
    setStarting(true); setMsg('');
    try {
      const data = await window.tusyenApi.startWhiteboardSession({ classroomId: selectedClassId, title:'Sesi Papan Putih' });
      const session = data.session || data;
      sessState.refresh();
      if (session?.id) setActiveCanvas({ sessionId:session.id, classroomId:selectedClassId });
    } catch (e) {
      setMsg(e.message || 'Tidak dapat memulakan sesi.');
    } finally {
      setStarting(false);
    }
  };

  const endSession = async () => {
    if (!active?.id) return;
    setEnding(true); setMsg('');
    try {
      await window.tusyenApi.endWhiteboardSession(active.id);
      setMsg('Sesi tamat.');
      sessState.refresh();
    } catch (e) {
      setMsg(e.message || 'Tidak dapat menamatkan sesi.');
    } finally {
      setEnding(false);
    }
  };

  const shareSummary = async (session) => {
    if (!session) return;
    const text = whiteboardSummaryText(session, selectedClass);
    try {
      if (navigator.share) {
        await navigator.share({ title:session.title || 'Ringkasan papan putih', text });
        setMsg('Ringkasan sedia dikongsi.');
      } else {
        await copyTextToClipboard(text);
        setMsg('Ringkasan disalin.');
      }
    } catch {
      setMsg('');
    }
  };

  if (activeCanvas) {
    return <WhiteboardCanvas
      sessionId={activeCanvas.sessionId || activeCanvas}
      classroomId={activeCanvas.classroomId || selectedClassId}
      onClose={() => { setActiveCanvas(null); sessState.refresh(); }}
    />;
  }

  if (replaySession) {
    return <WhiteboardReplay
      session={replaySession}
      classroom={selectedClass}
      onClose={() => setReplaySession(null)}
    />;
  }

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <Card style={{ marginBottom:12, padding:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:150, display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' }}>
            {classrooms.map(cls => (
              <button key={cls.id} onClick={() => setSelectedClassId(cls.id)} style={{
                flexShrink:0, minHeight:44,
                background:selectedClassId === cls.id ? C.accDim : 'transparent',
                border:`1.5px solid ${selectedClassId === cls.id ? C.borderB : C.border}`,
                borderRadius:20, padding:'5px 14px', cursor:'pointer',
                color:selectedClassId === cls.id ? C.accPale : C.textMuted,
                fontFamily:'Nunito', fontWeight:800, fontSize:11, whiteSpace:'nowrap',
              }}>{cls.name}</button>
            ))}
          </div>
          <TeacherBadge tone={active ? 'good' : 'neutral'}>{active ? 'Sesi aktif' : 'Tiada sesi'}</TeacherBadge>
          <TeacherBadge>{whiteboardParticipantCount(active)} peserta</TeacherBadge>
        </div>
      </Card>
      {msg && <div style={{ fontSize:11, color:msg.includes('tamat') ? C.green : C.red, fontWeight:800, marginBottom:10 }}>{msg}</div>}
      {active ? (
        <Card style={{ marginBottom:14, border:`1px solid ${C.borderB}`, boxShadow:'0 0 16px var(--c-acc-glow)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:900, fontSize:14, color:C.accPale, marginBottom:3 }}>🖌️ Sesi Aktif</div>
              <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>
                {active.title || 'Sesi Papan Putih'} - Bermula {window.timeAgo(active.started_at || active.createdAt)}
              </div>
            </div>
            <TeacherBadge tone="good">{whiteboardParticipantCount(active)} peserta</TeacherBadge>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            <TeacherBadge>{whiteboardRecordingLabel(active)}</TeacherBadge>
            {whiteboardSessionId(active) && (
              <button onClick={() => setReplaySession(active)} style={{
                minHeight:44, display:'inline-flex', alignItems:'center',
                background:C.accDim, border:`1px solid ${C.borderB}`, borderRadius:10,
                padding:'0 10px', color:C.accPale,
                fontSize:11, fontWeight:900, fontFamily:'Nunito',
                cursor:'pointer',
              }}>Lihat ulangan</button>
            )}
          </div>
          <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.4, marginBottom:12 }}>
            {whiteboardRecordingGuidance(active)}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <GlowButton onClick={() => setActiveCanvas({
              sessionId:active.id,
              classroomId:active.classroom_id || active.classroomId || selectedClassId,
            })} style={{ flex:1 }}>Masuk Papan Putih</GlowButton>
            <button onClick={() => shareSummary(active)} style={{
              background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:12, padding:'0 14px', minHeight:44, cursor:'pointer',
              color:C.accPale, fontFamily:'Nunito', fontWeight:900, fontSize:12,
            }}>Kongsi ringkasan</button>
            <button onClick={endSession} disabled={ending} style={{
              background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
              borderRadius:12, padding:'0 14px', minHeight:44, cursor:ending ? 'not-allowed' : 'pointer',
              color:C.red, fontFamily:'Nunito', fontWeight:800, fontSize:12,
              opacity:ending ? 0.55 : 1,
            }}>{ending ? 'Menamatkan...' : 'Tamat Sesi'}</button>
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom:14, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{
              width:44, height:44, borderRadius:12, flexShrink:0,
              background:C.accDim, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22,
            }}>🖌️</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:900, fontSize:14, color:C.text }}>Tiada sesi aktif</div>
              <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.35 }}>
                {history.length ? 'Mulakan lagi papan putih untuk kelas yang dipilih.' : 'Mulakan papan putih untuk kelas yang dipilih.'}
              </div>
            </div>
          </div>
          <GlowButton onClick={startSession} disabled={starting}>
            {starting ? 'Memulakan...' : history.length ? 'Mula lagi' : 'Mulakan Sesi Papan Putih'}
          </GlowButton>
        </Card>
      )}
      {history.length > 0 && (
        <>
          <SectionLabel>Sejarah Sesi</SectionLabel>
          {history.map((s, i) => (
            <Card key={s.id || i} style={{ marginBottom:8, padding:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{teacherTitle(s.title, 'Sesi Papan Putih')}</div>
                  <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:2 }}>
                    {formatDateShort(s.started_at)} - {s.ended_at ? `Tamat ${window.timeAgo(s.ended_at)}` : 'Sedang berjalan'} - {whiteboardParticipantCount(s)} peserta
                  </div>
                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:800, marginTop:3 }}>{whiteboardRecordingLabel(s)}</div>
                </div>
                {whiteboardSessionId(s) && (
                  <button onClick={() => setReplaySession(s)} style={{
                    minHeight:44, display:'inline-flex', alignItems:'center',
                    background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
                    padding:'0 10px', color:C.accPale,
                    fontSize:11, fontWeight:900, flexShrink:0, cursor:'pointer',
                    fontFamily:'Nunito',
                  }}>Ulangan</button>
                )}
                <button onClick={() => shareSummary(s)} style={{
                  minHeight:44, display:'inline-flex', alignItems:'center',
                  background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:'0 10px', color:C.accPale,
                  fontSize:11, fontWeight:900, flexShrink:0, cursor:'pointer',
                  fontFamily:'Nunito',
                }}>Ringkasan</button>
              </div>
              {!whiteboardHasEventReplay(s) && (
                <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, lineHeight:1.35, marginTop:7 }}>
                  {whiteboardRecordingGuidance(s)}
                </div>
              )}
            </Card>
          ))}
        </>
      )}
      <div style={{ height:8 }} />
    </div>
  );
};

// ─── Class Detail ──────────────────────────────────────────────────────────

const ClassroomSettingsModal = ({ cls, onClose, onSaved, onArchived }) => {
  const [form, setForm] = React.useState({
    name: cls?.name || '',
    subject: cls?.subject || subjectText(cls?.subj) || 'Matematik',
    formLevel: String(cls?.form || 4),
    description: cls?.description || '',
  });
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [archiveConfirm, setArchiveConfirm] = React.useState(false);
  const live = isLiveClassId(cls?.id);

  const save = async () => {
    if (!form.name.trim()) { setError('Nama kelas diperlukan.'); return; }
    setBusy('save'); setError('');
    try {
      let updated = {
        ...cls,
        name: form.name.trim(),
        subject: form.subject,
        subj: subjectLabel(form.subject),
        form: Number(form.formLevel) || 4,
        description: form.description.trim(),
      };
      if (live) {
        const data = await window.tusyenApi.updateClassroom(cls.id, {
          name: form.name.trim(),
          subject: form.subject,
          formLevel: Number(form.formLevel) || 4,
          description: form.description.trim(),
        });
        updated = {
          ...updated,
          ...formatLiveClass({
            ...(data.classroom || {}),
            student_count: cls.students,
            average_progress: cls.avg,
            progress_count: cls.avg === null || cls.avg === undefined ? 0 : 1,
            at_risk_count: cls.riskCount,
          }, 0),
          students: cls.students,
          avg: cls.avg,
          riskCount: cls.riskCount,
        };
      }
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Tidak dapat menyimpan kelas.');
    } finally {
      setBusy('');
    }
  };

  const archive = async () => {
    setBusy('archive'); setError('');
    try {
      if (live) await window.tusyenApi.archiveClassroom(cls.id);
      onArchived(cls);
      onClose();
    } catch (err) {
      setError(err.message || 'Tidak dapat menyahaktifkan kelas.');
    } finally {
      setBusy('');
      setArchiveConfirm(false);
    }
  };

  return (
    <>
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000,
        display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      }} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background:C.card, borderRadius:18, padding:'20px 18px', width:'100%', maxWidth:460 }}>
          <div style={{ fontWeight:900, fontSize:15, color:C.text, marginBottom:12 }}>Tetapan Kelas</div>
          <div style={{ display:'grid', gap:8 }}>
            <TeacherField label="Nama Kelas">
              <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name:e.target.value }))} style={teacherInputBase} />
            </TeacherField>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <TeacherField label="Subjek">
                <select value={form.subject} onChange={e => setForm(prev => ({ ...prev, subject:e.target.value }))} style={teacherInputBase}>
                  {CLASS_SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </TeacherField>
              <TeacherField label="Tingkatan">
                <select value={form.formLevel} onChange={e => setForm(prev => ({ ...prev, formLevel:e.target.value }))} style={teacherInputBase}>
                  {CLASS_FORM_LEVELS.map(item => <option key={item} value={String(item)}>Tingkatan {item}</option>)}
                </select>
              </TeacherField>
            </div>
            <TeacherField label="Penerangan">
              <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description:e.target.value }))} rows={3} style={{ ...teacherInputBase, resize:'vertical' }} />
            </TeacherField>
            {error && <div style={{ fontSize:11, color:C.red, fontWeight:900 }}>{error}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <GlowButton onClick={save} disabled={busy === 'save'} style={{ flex:1 }}>
                {busy === 'save' ? 'Menyimpan...' : 'Simpan'}
              </GlowButton>
              <button onClick={onClose} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'0 14px', minHeight:44, color:C.textMuted, fontFamily:'Nunito', fontWeight:800, cursor:'pointer' }}>Batal</button>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
              <TeacherActionMenu
                label="Tindakan lanjut kelas"
                items={[
                  {
                    label:busy === 'archive' ? 'Menyahaktifkan...' : 'Nyahaktifkan kelas',
                    icon:'!',
                    danger:true,
                    disabled:busy === 'archive',
                    onClick:() => setArchiveConfirm(true),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <TeacherConfirmModal
        open={archiveConfirm}
        title="Nyahaktifkan kelas?"
        message={`${cls.name} tidak akan kelihatan kepada pelajar selepas dinyahaktifkan.`}
        confirmLabel="Nyahaktifkan"
        danger
        busy={busy === 'archive'}
        onCancel={() => setArchiveConfirm(false)}
        onConfirm={archive}
      />
    </>
  );
};

const TeacherClass = ({ cls, initialTab = 'students', initialFilter = 'all', onBack, onClassUpdated, onClassArchived }) => {
  const [tab, setTab] = React.useState(initialTab);
  const [composer, setComposer] = React.useState(null);
  const [postText, setPostText] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [postStatus, setPostStatus] = React.useState('');
  const [postError, setPostError] = React.useState('');
  const [createNotice, setCreateNotice] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const [selectedStudent, setSelectedStudent] = React.useState(null);
  const [studentFilter, setStudentFilter] = React.useState(initialFilter || 'all');
  const [removingStudentId, setRemovingStudentId] = React.useState('');
  const [rosterNotice, setRosterNotice] = React.useState('');
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [classNotice, setClassNotice] = React.useState('');
  const [removeConfirm, setRemoveConfirm] = React.useState(null);

  React.useEffect(() => {
    setTab(initialTab);
    setStudentFilter(initialFilter || 'all');
    setSelectedStudent(null);
  }, [initialTab, initialFilter, cls?.id]);

  const rosterState = useClassRoster(cls?.id);
  const analyticsState = useClassAnalytics(cls?.id);
  const feedState = useClassFeed(cls?.id);
  const progressState = useStudentProgress(selectedStudent?.id, cls?.id);
  const roster = rosterState.data || STUDS;
  const atRiskRoster = roster.filter(isAtRiskStudent);
  const displayedRoster = studentFilter === 'risk' ? atRiskRoster : roster;
  const analytics = analyticsState.data || {
    weeklyActivity: WEEK_DAYS.map((day, i) => ({ day, count: WEEK_DATA[i], pct: WEEK_DATA[i] })),
    weakTopics: isLiveClassId(cls?.id) ? [] : WEAK_TOPICS_FALLBACK,
    averageProgress: null,
    progressCount: 0,
    atRiskCount: 0,
  };
  const createCards = [
    { icon:'📢', label:'Pengumuman',    desc:'Maklumkan jadual, peringatan, atau nota penting.', postType:'announcement', enabled:true  },
    { icon:'📋', label:'Tugasan',        desc:'Tetapkan arahan kerja, bahan rujukan, dan tarikh hantar.', postType:'assignment', enabled:true  },
    { icon:'🧪', label:'Kuiz baharu',    desc:'Sediakan semakan pantas untuk kelas.', enabled:false },
    { icon:'🎬', label:'Video pelajaran', desc:'Kongsi penerangan atau pautan video.', enabled:false },
  ];
  const openComposer = (item) => {
    if (!item.enabled) {
      setCreateNotice(`${item.label} akan tersedia tidak lama lagi.`);
      return;
    }
    setComposer(item);
    setPostText('');
    setDueDate('');
    setPostStatus('');
    setPostError('');
    setCreateNotice('');
  };
  const startTopicAssignment = (topic) => {
    const assignment = createCards.find(item => item.postType === 'assignment');
    setTab('create');
    openComposer(assignment);
    setPostText(`Pemulihan topik: ${topic.topic}\n\nSila lengkapkan latihan fokus untuk topik ini dan hantar refleksi ringkas selepas siap.`);
  };
  const submitPost = async () => {
    if (!composer || !postText.trim()) return;
    if (composer.postType === 'assignment' && !dueDate) {
      setPostError('Tarikh hantar diperlukan untuk tugasan.');
      return;
    }
    setPosting(true);
    setPostStatus('');
    setPostError('');
    try {
      const content = composer.postType === 'assignment' && dueDate
        ? `Tarikh hantar: ${formatDateShort(dueDate)}\n\n${postText}`
        : postText;
      await window.tusyenApi.createPost({
        classroomId: cls.id,
        content,
        postType: composer.postType,
        title: composer.label,
      });
      setPostStatus('Berjaya dihantar. Pos terkini dipaparkan di bawah.');
      setPostText('');
      setDueDate('');
      setComposer(null);
      feedState.refresh();
    } catch (err) {
      setPostError(err.message || 'Tidak dapat menghantar pos.');
    } finally {
      setPosting(false);
    }
  };

  const quickAnnouncement = () => {
    const announcement = createCards.find(item => item.postType === 'announcement');
    setTab('create');
    openComposer(announcement);
  };

  const copyClassCode = async () => {
    try {
      await copyTextToClipboard(cls.code);
      setClassNotice('Kod kelas disalin.');
    } catch {
      setClassNotice('Salin kod gagal. Pilih kod dan salin secara manual.');
    }
  };

  const shareClassCode = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title:`Kod kelas ${cls.name}`, text:classInviteText(cls) });
        setClassNotice('Kod kelas sedia dikongsi.');
      } else {
        await copyTextToClipboard(classInviteText(cls));
        setClassNotice('Teks jemputan disalin.');
      }
    } catch {
      setClassNotice('');
    }
  };

  const requestRemoveStudent = (student, event) => {
    event?.stopPropagation?.();
    if (!student?.id || !isLiveClassId(cls?.id)) return;
    setRemoveConfirm(student);
  };

  const removeStudent = async () => {
    const student = removeConfirm;
    if (!student?.id || !isLiveClassId(cls?.id)) return;
    setRemovingStudentId(student.id);
    setRosterNotice('');
    try {
      await window.tusyenApi.removeClassroomStudent(cls.id, student.id);
      setRosterNotice(`${student.name} dibuang daripada roster.`);
      setSelectedStudent(prev => prev?.id === student.id ? null : prev);
      rosterState.refresh();
      onClassUpdated && onClassUpdated({ ...cls, students:Math.max(0, Number(cls.students || 0) - 1) });
    } catch (err) {
      setRosterNotice(err.message || 'Tidak dapat membuang pelajar.');
    } finally {
      setRemovingStudentId('');
      setRemoveConfirm(null);
    }
  };

  const liveAvg = Number(analytics?.progressCount) > 0 ? analytics.averageProgress : null;
  const displayAvg = cls?.avg ?? liveAvg;
  const classAvgLabel = displayAvg === null || displayAvg === undefined ? '—' : `${displayAvg}%`;
  const classLastActivity = roster
    .map(student => student.lastActive)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || cls?.lastActivity;
  const weeklyTotal = (analytics.weeklyActivity || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const weeklyPeak = (analytics.weeklyActivity || []).reduce((best, item) => (Number(item.count) || 0) > (Number(best?.count) || 0) ? item : best, null);
  const weeklyCounts = (analytics.weeklyActivity || []).map(item => Number(item.count) || 0);
  const earlyWeek = weeklyCounts.slice(0, Math.ceil(weeklyCounts.length / 2));
  const lateWeek = weeklyCounts.slice(Math.floor(weeklyCounts.length / 2));
  const averageCount = (items) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
  const trendDelta = Math.round(averageCount(lateWeek) - averageCount(earlyWeek));
  const activityTrend = weeklyTotal === 0
    ? {
      label:'Belum ada data',
      tone:'neutral',
      detail:'Aktiviti belum cukup untuk membaca corak minggu ini.',
      why:'Mengapa penting: trend membantu Cikgu memilih sama ada perlu dorongan kelas atau intervensi kecil.',
    }
    : trendDelta >= 2
      ? {
        label:'Trend menaik',
        tone:'good',
        detail:`Aktiviti terkini naik kira-kira ${trendDelta} berbanding awal minggu.`,
        why:'Mengapa penting: momentum sedang baik; kekalkan rentak dengan tugasan pendek atau pujian kelas.',
      }
      : trendDelta <= -2
        ? {
          label:'Trend menurun',
          tone:'bad',
          detail:`Aktiviti terkini turun kira-kira ${Math.abs(trendDelta)} berbanding awal minggu.`,
          why:'Mengapa penting: penurunan awal memberi peluang untuk hantar peringatan sebelum pelajar tertinggal.',
        }
        : {
          label:'Trend stabil',
          tone:'warn',
          detail:'Aktiviti kelas stabil tanpa lonjakan atau penurunan besar.',
          why:'Mengapa penting: kelas stabil sesuai diberi latihan pengukuhan ringan dan semakan topik lemah.',
        };
  const riskActionWhy = atRiskRoster.length > 0
    ? `${atRiskRoster.length} pelajar memerlukan semakan kerana skor atau kemajuan mereka berada di bawah ambang risiko.`
    : 'Tiada pelajar berisiko dikesan sekarang; terus pantau selepas tugasan baharu.';
  const weakTopicWhy = (topic) => {
    const score = Number(topic.avgScore) || 0;
    if (score < 50) return 'Mengapa penting: purata bawah 50% biasanya menandakan asas topik belum kukuh dan perlu pemulihan segera.';
    if (score < 60) return 'Mengapa penting: topik ini hampir menjadi risiko kelas; latihan fokus boleh cegah jurang bertambah.';
    return 'Mengapa penting: topik ini masih paling lemah berbanding topik lain dan sesuai untuk pengukuhan ringkas.';
  };
  const weeklyTrendLabel = weeklyPeak
    ? `${weeklyTotal} aktiviti minggu ini; hari paling aktif ${weeklyPeak.day} (${weeklyPeak.count}).`
    : 'Belum ada aktiviti minggu ini.';

  if (!cls) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <EmptyState icon="🏫" title="Pilih kelas dahulu" subtitle="Buka tab Kelas dan pilih kelas untuk melihat pelajar, analitik, atau mencipta kandungan." />
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{
        padding:'10px 16px', flexShrink:0,
        background:`color-mix(in srgb,${cls.color} 12%,var(--c-card))`,
        borderBottom:`1px solid ${C.border}`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, minWidth:0 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              minHeight:44,
              background:C.surface,
              border:`1px solid ${C.border}`,
              borderRadius:10,
              padding:'0 12px',
              color:C.accPale,
              fontFamily:'Nunito',
              fontWeight:900,
              fontSize:11,
              cursor:'pointer',
              flexShrink:0,
            }}
          >
            Kembali ke Kelas
          </button>
          <div style={{
            minWidth:0,
            color:C.textMuted,
            fontSize:11,
            fontWeight:800,
            whiteSpace:'nowrap',
            overflow:'hidden',
            textOverflow:'ellipsis',
          }}>
            Kelas / {cls.name}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:16, color:C.text, marginBottom:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cls.name}</div>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{cls.subj} • {cls.students} pelajar</div>
          </div>
          <button onClick={() => setSettingsOpen(true)} title="Sunting kelas" style={{
            background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
            width:44, height:44, color:C.accPale, cursor:'pointer',
            fontFamily:'Nunito', fontWeight:900, flexShrink:0,
          }}>⚙</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:8, alignItems:'stretch' }}>
          <StatPill icon="📊" value={classAvgLabel} label="Purata Siap" color={cls.color} />
          <div style={{
            display:'grid', gridTemplateColumns:'1fr auto auto', gap:6, alignItems:'center',
            background:`color-mix(in srgb,${cls.color} 16%,transparent)`,
            border:`1px solid color-mix(in srgb,${cls.color} 36%,transparent)`,
            borderRadius:12, padding:'5px 7px',
          }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:9, color:C.textMuted, fontWeight:900, textTransform:'uppercase' }}>Kod Kelas</div>
              <div style={{ fontSize:13, color:cls.color, fontWeight:900, letterSpacing:0 }}>{cls.code}</div>
            </div>
            <TeacherSmallButton onClick={copyClassCode}>Salin</TeacherSmallButton>
            <TeacherSmallButton onClick={shareClassCode}>Kongsi</TeacherSmallButton>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:9 }}>
          <TeacherSmallButton onClick={quickAnnouncement} style={{ flex:1 }}>Pengumuman baharu</TeacherSmallButton>
          <TeacherSmallButton onClick={() => { setTab('students'); setStudentFilter('risk'); }} danger={atRiskRoster.length > 0} style={{ flex:1 }}>
            {atRiskRoster.length} Pelajar Berisiko
          </TeacherSmallButton>
        </div>
        <div style={{ marginTop:8, fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.4 }}>
          Aktiviti terakhir: {formatActivityStatus(classLastActivity)}. Purata siap berdasarkan rekod pelajaran yang sudah dicuba dalam kelas ini.
        </div>
        {classNotice && <div style={{ fontSize:11, color:C.accPale, fontWeight:900, marginTop:7 }}>{classNotice}</div>}
      </div>

      <div role="tablist" aria-label="Bahagian detail kelas" style={{ display:'flex', borderBottom:`1px solid ${C.border}`, flexShrink:0, background:C.surface, overflowX:'auto' }}>
        {['students','analytics','create','quiz'].map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{
            flex:1, padding:'10px 0', minHeight:44, border:'none', cursor:'pointer',
            background:'none', fontFamily:'Nunito,sans-serif', minWidth:60,
            fontWeight:800, fontSize:10, textTransform:'uppercase', letterSpacing:0.3,
            color: tab === t ? C.accHi : C.textFaint,
            borderBottom: tab === t ? '2px solid var(--c-acc)' : '2px solid transparent',
            transition:'all .2s', whiteSpace:'nowrap',
          }}>
            {t === 'students' ? '👥 Pelajar' : t === 'analytics' ? '📊 Analitik' : t === 'create' ? '✏️ Cipta' : '🎮 Kuiz'}
          </button>
        ))}
      </div>

      <div style={{ padding:'14px 16px 10px' }}>
        {tab === 'students' && (
          <div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {[
                ['all', `Semua (${roster.length})`],
                ['risk', `Pelajar Berisiko (${atRiskRoster.length})`],
              ].map(([value, label]) => (
                <button key={value} onClick={() => setStudentFilter(value)} aria-pressed={studentFilter === value} style={{
                  background:studentFilter === value ? C.accDim : 'transparent',
                  border:`1.5px solid ${studentFilter === value ? C.borderB : C.border}`,
                  borderRadius:20, padding:'5px 12px', minHeight:44,
                  color:studentFilter === value ? C.accPale : C.textMuted,
                  fontFamily:'Nunito', fontWeight:900, fontSize:10,
                  cursor:'pointer',
                }}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.4, marginBottom:10 }}>
              {CLASS_RISK_EXPLANATION}
            </div>
            {rosterNotice && (
              <Card style={{ marginBottom:10, padding:9 }}>
                <div style={{ fontSize:11, color:rosterNotice.includes('Tidak') ? C.red : C.accPale, fontWeight:900 }}>{rosterNotice}</div>
              </Card>
            )}
          {rosterState.loading ? [0,1,2,3,4].map(i => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10, padding:'9px 0',
              borderBottom: i < 4 ? `1px solid ${C.border}` : 'none',
            }}>
              <Skeleton width={36} height={36} radius={18} />
              <div style={{ flex:1 }}>
                <Skeleton width="52%" height={13} radius={7} style={{ marginBottom:7 }} />
                <Skeleton width="35%" height={10} radius={5} style={{ marginBottom:6 }} />
                <Skeleton width="100%" height={4} radius={999} />
              </div>
              <Skeleton width={48} height={24} radius={8} />
            </div>
          )) : displayedRoster.length === 0 ? (
            <Card>
              <EmptyState
                icon="👥"
                title={studentFilter === 'risk' ? 'Tiada pelajar berisiko' : 'Belum ada pelajar'}
                subtitle={studentFilter === 'risk' ? 'Tiada pelajar berisiko berdasarkan markah dan kemajuan semasa.' : 'Kongsi kod kelas untuk mula menambah pelajar.'}
              />
            </Card>
          ) : (
            <div>
              {displayedRoster.map((s,i) => {
                const hasScore = s.score !== null && s.score !== undefined;
                const scoreGood = hasScore && s.score >= 60;
                const scoreColor = !hasScore ? C.textFaint : scoreGood ? C.green : C.red;
                const progressText = s.attempted > 0 ? `${s.completed}/${s.attempted} selesai` : 'Belum ada pelajaran';
                return (
                  <div key={s.id || i} onClick={() => setSelectedStudent(selectedStudent?.id === (s.id || i) ? null : s)} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'9px 0',
                    borderBottom: i < displayedRoster.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor:'pointer',
                  }}>
                    <Avatar name={s.name} size={36} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{s.name}</div>
                      <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:3 }}>
                        🔥 {s.streak} hari • {progressText}
                      </div>
                      <ProgressBar value={hasScore ? s.score : 0} color={scoreColor} height={4} style={{ opacity:hasScore ? 1 : 0.35 }} />
                    </div>
                    <div style={{
                      fontWeight:800, fontSize:13,
                      color:scoreColor,
                      background: hasScore ? (scoreGood ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)') : C.surface,
                      border:`1px solid ${hasScore ? (scoreGood ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)') : C.border}`,
                      borderRadius:8, padding:'3px 9px',
                    }}>{hasScore ? `${s.score}%` : '—'}</div>
                    <TeacherActionMenu
                      label={`Tindakan ${s.name}`}
                      items={[
                        { label:'Lihat kemajuan', icon:'📊', onClick:() => setSelectedStudent(s) },
                        isLiveClassId(cls?.id) && {
                          label:removingStudentId === s.id ? 'Membuang...' : 'Buang daripada kelas',
                          icon:'🗑️',
                          danger:true,
                          disabled:removingStudentId === s.id,
                          onClick:(event) => requestRemoveStudent(s, event),
                        },
                      ]}
                    />
                  </div>
                );
              })}
              {selectedStudent && (
                <Card style={{ marginTop:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{selectedStudent.name}</div>
                      <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>
                        {selectedStudent.lastActive ? `Aktif ${formatDateShort(selectedStudent.lastActive)}` : 'Belum ada aktiviti direkod'}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <TeacherActionMenu
                        label={`Tindakan ${selectedStudent.name}`}
                        items={[
                          isLiveClassId(cls?.id) && {
                            label:removingStudentId === selectedStudent.id ? 'Membuang...' : 'Buang daripada kelas',
                            icon:'🗑️',
                            danger:true,
                            disabled:removingStudentId === selectedStudent.id,
                            onClick:(event) => requestRemoveStudent(selectedStudent, event),
                          },
                        ]}
                      />
                      <button onClick={(e) => { e.stopPropagation(); setSelectedStudent(null); }} style={{
                        background:C.surface, border:`1px solid ${C.border}`, borderRadius:9,
                        color:C.textMuted, fontFamily:'Nunito', fontWeight:800, padding:'4px 9px', minHeight:44, cursor:'pointer',
                      }}>Tutup</button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
                    {[
                      { v:selectedStudent.score === null ? '—' : `${selectedStudent.score}%`, l:'Skor' },
                      { v:String(selectedStudent.completed), l:'Selesai' },
                      { v:String(selectedStudent.streak), l:'Streak' },
                    ].map((item, i) => (
                      <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:8, textAlign:'center' }}>
                        <div style={{ color:C.text, fontWeight:900, fontSize:14 }}>{item.v}</div>
                        <div style={{ color:C.textMuted, fontWeight:600, fontSize:9, textTransform:'uppercase' }}>{item.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontWeight:800, fontSize:12, color:C.text, marginBottom:7 }}>Sejarah Pelajaran</div>
                  {progressState.loading ? [0,1,2].map(i => (
                    <Skeleton key={i} width="100%" height={24} radius={8} style={{ marginBottom:6 }} />
                  )) : (progressState.data || []).length ? (progressState.data || []).slice(0,4).map((p,i) => (
                    <div key={p.id || i} style={{
                      display:'flex', justifyContent:'space-between', gap:8, padding:'7px 0',
                      borderBottom: i < Math.min((progressState.data || []).length, 4) - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, color:C.text, fontWeight:800, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {compactLessonTitle(p.lesson_title || p.title || '', 'Pelajaran')}
                        </div>
                        <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{p.topic || p.subject || 'Topik'}</div>
                      </div>
                      <div style={{ fontSize:12, color:C.accPale, fontWeight:900, flexShrink:0 }}>{Math.round(Number(p.score) || 0)}%</div>
                    </div>
                  )) : (
                    <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Tiada rekod pelajaran untuk kelas ini.</div>
                  )}
                </Card>
              )}
            </div>
          )}
          </div>
        )}

        {tab === 'analytics' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.text }}>Prestasi Mingguan</div>
              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{currentSchoolWeekLabel()}</div>
            </div>
            <Card style={{ marginBottom:12, padding:10, background:C.surface }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ fontSize:12, color:C.text, fontWeight:900, lineHeight:1.4 }}>{weeklyTrendLabel}</div>
                <TeacherBadge tone={activityTrend.tone}>{activityTrend.label}</TeacherBadge>
              </div>
              <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.4 }}>{activityTrend.detail}</div>
              <div style={{ fontSize:11, color:C.textFaint, fontWeight:800, lineHeight:1.4, marginTop:5 }}>{activityTrend.why}</div>
            </Card>
            {analyticsState.loading ? [0,1,2,3,4].map(i => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
                <Skeleton width={52} height={11} radius={5} />
                <Skeleton width="100%" height={22} radius={5} style={{ flex:1 }} />
              </div>
            )) : analytics.weeklyActivity.map((item,i) => {
              const safePct = Math.max(4, Math.min(100, Number(item.pct) || 0));
              return (
              <div key={i} aria-label={`${item.day}: ${item.count} aktiviti`} style={{ display:'grid', gridTemplateColumns:'58px minmax(0,1fr) 34px', alignItems:'center', gap:8, marginBottom:9 }}>
                <div style={{ width:52, fontSize:11, color:C.textMuted, fontWeight:600 }}>{item.day}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ flex:1, height:26, background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', width:`${safePct}%`,
                      background:`linear-gradient(90deg, ${cls.color}, var(--c-acc))`,
                      borderRadius:6,
                    }} />
                  </div>
                </div>
                <span style={{ fontSize:11, color:C.text, fontWeight:900, textAlign:'right' }}>{item.count}</span>
              </div>
              );
            })}
            <Card style={{ margin:'14px 0 12px', padding:12, background:atRiskRoster.length ? 'rgba(239,68,68,.08)' : C.surface, border:`1px solid ${atRiskRoster.length ? 'rgba(239,68,68,.26)' : C.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, color:C.text, fontWeight:900, marginBottom:4 }}>Tindakan risiko pelajar</div>
                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.45 }}>
                    Mengapa penting: {riskActionWhy}
                  </div>
                </div>
                <TeacherSmallButton
                  danger={atRiskRoster.length > 0}
                  onClick={() => { setTab('students'); setStudentFilter(atRiskRoster.length ? 'risk' : 'all'); }}
                  style={{ flexShrink:0 }}
                >
                  {atRiskRoster.length ? 'Semak risiko' : 'Lihat roster'}
                </TeacherSmallButton>
              </div>
            </Card>
            <div style={{ fontWeight:800, fontSize:14, color:C.text, margin:'14px 0 10px' }}>Topik Lemah</div>
            {analyticsState.loading ? [0,1,2].map(i => (
              <Card warn key={i} style={{ marginBottom:8, padding:10 }}>
                <Skeleton width={i === 0 ? '72%' : '60%'} height={13} radius={7} />
              </Card>
            )) : analyticsState.error ? (
              <ErrorRetry message="Analitik topik tidak dapat dimuat." onRetry={analyticsState.refresh} />
            ) : analytics.weakTopics.length === 0 ? (
              <Card style={{ marginBottom:8, padding:12 }}>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:800, lineHeight:1.4 }}>
                  Tiada topik lemah dikesan berdasarkan data kelas semasa.
                </div>
              </Card>
            ) : analytics.weakTopics.map((t,i) => {
              const weakTone = Number(t.avgScore) < 50 ? 'bad' : Number(t.avgScore) < 60 ? 'warn' : 'neutral';
              const weakLabel = Number(t.avgScore) < 50 ? 'Kritikal' : Number(t.avgScore) < 60 ? 'Perlu pemulihan' : 'Pengukuhan';
              return (
              <Card warn key={i} style={{ marginBottom:8, padding:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>⚠️ {t.topic} (purata {t.avgScore}%)</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:5 }}>
                      <TeacherBadge tone={weakTone}>{weakLabel}</TeacherBadge>
                      <TeacherBadge tone="neutral">Purata {t.avgScore}%</TeacherBadge>
                    </div>
                    <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.45, marginTop:5 }}>
                      {weakTopicWhy(t)}
                    </div>
                  </div>
                  <button onClick={() => { startTopicAssignment(t); }} style={{
                    background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.25)',
                    borderRadius:9, padding:'6px 8px', minHeight:44, color:C.red,
                    fontFamily:'Nunito', fontWeight:900, fontSize:10, cursor:'pointer', flexShrink:0,
                  }}>Tugaskan pemulihan</button>
                </div>
              </Card>
              );
            })}
          </div>
        )}

        {tab === 'create' && (
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:12 }}>Cipta Kandungan</div>
            {postStatus && (
              <Card success style={{ marginBottom:10, padding:10 }}>
                <div style={{ fontSize:12, color:C.green, fontWeight:900 }}>{postStatus}</div>
              </Card>
            )}
            {createNotice && (
              <Card style={{ marginBottom:10, padding:10 }}>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{createNotice}</div>
              </Card>
            )}
            {composer && (
              <Card style={{ marginBottom:10 }}>
                <div style={{ fontWeight:800, fontSize:13, color:C.accPale, marginBottom:8 }}>{composer.label}</div>
                {composer.postType === 'assignment' && (
                  <label style={{ display:'block', fontSize:10, color:C.textFaint, fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>
                    Tarikh Hantar
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      style={{
                        width:'100%', boxSizing:'border-box', marginTop:5,
                        background:C.surface, border:`1px solid ${C.border}`,
                        borderRadius:10, padding:9, color:C.text,
                        fontFamily:'Nunito', fontWeight:700,
                      }}
                    />
                  </label>
                )}
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder={composer.postType === 'assignment' ? 'Tulis arahan tugasan, bahan rujukan, dan kriteria siap...' : 'Tulis pengumuman ringkas untuk kelas...'}
                  style={{
                    width:'100%', minHeight:96, resize:'vertical',
                    background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:10, color:C.text,
                    fontFamily:'Nunito,sans-serif', fontWeight:600, boxSizing:'border-box',
                  }}
                />
                {postError && (
                  <div style={{ marginTop:8 }}>
                    <ErrorRetry message={postError} onRetry={submitPost} />
                  </div>
                )}
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <GlowButton onClick={submitPost} disabled={posting || !postText.trim() || (composer.postType === 'assignment' && !dueDate)} style={{ flex:1 }}>
                    {posting ? 'Menghantar...' : 'Hantar'}
                  </GlowButton>
                  <button onClick={() => setComposer(null)} style={{
                    background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:'0 14px', minHeight:44, color:C.textMuted,
                    fontFamily:'Nunito', fontWeight:800, cursor:'pointer',
                  }}>Batal</button>
                </div>
              </Card>
            )}
            {createCards.map((item) => (
              <Card key={item.label} style={{ marginBottom:10, display:'flex', alignItems:'center', gap:12, opacity:item.enabled ? 1 : 0.65 }} onClick={() => openComposer(item)}>
                <div style={{
                  width:44, height:44, borderRadius:12, flexShrink:0,
                  background:C.accDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                }}>{item.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{item.label}</div>
                  <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{item.desc}</div>
                </div>
                {!item.enabled && (
                  <div style={{
                    border:`1px solid ${C.border}`, borderRadius:8, padding:'2px 7px',
                    fontSize:10, color:C.textFaint, fontWeight:600,
                  }}>Segera</div>
                )}
              </Card>
            ))}
            <SectionLabel>Suapan Kelas</SectionLabel>
            {feedState.loading ? [0,1,2].map(i => (
              <Card key={i} style={{ marginBottom:8, padding:10 }}>
                <Skeleton width={i === 0 ? '68%' : '52%'} height={13} radius={7} style={{ marginBottom:7 }} />
                <Skeleton width="100%" height={10} radius={5} />
              </Card>
            )) : (feedState.data || []).length ? (feedState.data || []).map(post => (
              <Card key={post.id} style={{ marginBottom:8, padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:4 }}>
                  <div style={{ fontSize:12, color:C.accPale, fontWeight:900 }}>{teacherTitle(post.title, post.post_type === 'assignment' ? 'Tugasan' : 'Pengumuman')}</div>
                  <div style={{ fontSize:10, color:C.textFaint, fontWeight:600 }}>{window.timeAgo(post.created_at)}</div>
                </div>
                <div style={{ fontSize:12, color:C.text, fontWeight:700, whiteSpace:'pre-line', lineHeight:1.35 }}>{teacherBodyText(post.content, '', 180)}</div>
              </Card>
            )) : (
              <Card style={{ marginBottom:8, padding:12 }}>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Belum ada pos dalam suapan kelas.</div>
              </Card>
            )}
          </div>
        )}

        {tab === 'quiz' && window.TeacherQuizTab && (
          <window.TeacherQuizTab classroomId={cls?.id} />
        )}
      </div>
      {settingsOpen && (
        <ClassroomSettingsModal
          cls={cls}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => onClassUpdated && onClassUpdated(updated)}
          onArchived={(archived) => onClassArchived && onClassArchived(archived)}
        />
      )}
      <TeacherConfirmModal
        open={Boolean(removeConfirm)}
        title="Buang pelajar?"
        message={`${removeConfirm?.name || 'Pelajar'} akan dikeluarkan daripada ${cls?.name || 'kelas ini'}. Rekod kemajuan sedia ada tidak dipadam.`}
        confirmLabel="Buang daripada kelas"
        danger
        busy={Boolean(removingStudentId)}
        onCancel={() => setRemoveConfirm(null)}
        onConfirm={removeStudent}
      />
    </div>
  );
};

// ─── Home ──────────────────────────────────────────────────────────────────

const TeacherHome = ({ go, setCls, openClass, displayName, notice }) => {
  const classState = useTeacherClassrooms();
  const profileState = useTeacherProfile(displayName);
  const { classes:list = CLASSES, isLive = false } = classState.data || { classes:CLASSES, isLive:false };
  const profile = profileState.data || emptyTeacherProfile(displayName);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState('');
  const [newClass, setNewClass] = React.useState({
    name:'', subject:'Matematik', formLevel:4, description:'',
  });
  const totalStudents = list.reduce((sum, c) => sum + (c.students || 0), 0);
  const scoredClasses = list.filter(c => c.avg !== null && c.avg !== undefined);
  const avgCompletion = scoredClasses.length
    ? Math.round(scoredClasses.reduce((sum, c) => sum + c.avg, 0) / scoredClasses.length)
    : null;
  const completionExplanation = completionContextText(scoredClasses.length, list.length);
  const riskCount = list.reduce((sum, c) => sum + (Number(c.riskCount) || 0), 0);
  const firstRiskClass = list.find(c => Number(c.riskCount) > 0 || (c.avg !== null && c.avg < 60));
  const [localNotice, setLocalNotice] = React.useState('');
  const subjects = profileSubjects(profile, list);
  const subjectLine = profileState.loading
    ? 'Memuat profil...'
    : (subjects.length ? subjects.slice(0, 3).join(' & ') : 'Subjek belum dikemaskini');
  const attentionItems = isLive
    ? list
        .filter(c => Number(c.riskCount) > 0 || (c.avg !== null && c.avg < 60))
        .map(c => ({
          text:Number(c.riskCount) > 0
            ? `${c.name} - ${c.riskCount} pelajar berisiko`
            : `${c.name} - Purata siap ${c.avg}%, perlu semakan`,
          classRef:c,
          tab:Number(c.riskCount) > 0 ? 'students' : 'analytics',
          filter:Number(c.riskCount) > 0 ? 'risk' : 'all',
          action:Number(c.riskCount) > 0 ? 'Lihat roster' : 'Buka intervensi',
        }))
    : [
        { text:'Nurul Ain (4A) - Skor 45%, tiada aktiviti 5 hari', classRef:list[0], tab:'students', filter:'risk', action:'Lihat roster' },
        { text:'Aina Sofia (4A) - Skor 38%, perlu bimbingan', classRef:list[0], tab:'students', filter:'risk', action:'Lihat roster' },
      ];

  const copyClassCodeFromCard = async (cls, event) => {
    event.stopPropagation();
    try {
      await copyTextToClipboard(cls.code);
      setLocalNotice(`Kod ${cls.name} disalin.`);
    } catch {
      setLocalNotice('Salin kod gagal. Pilih kod dan salin secara manual.');
    }
  };

  const shareClassCodeFromCard = async (cls, event) => {
    event.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title:`Kod kelas ${cls.name}`, text:classInviteText(cls) });
        setLocalNotice('Kod kelas sedia dikongsi.');
      } else {
        await copyTextToClipboard(classInviteText(cls));
        setLocalNotice(`Teks jemputan ${cls.name} disalin.`);
      }
    } catch {
      setLocalNotice('');
    }
  };

  const openRiskRoster = () => {
    if (!firstRiskClass) return;
    openClass(firstRiskClass, { tab:'students', filter:'risk' });
  };

  const submitCreateClass = async () => {
    const name = newClass.name.trim();
    if (!name) { setCreateError('Nama kelas diperlukan.'); return; }
    setCreating(true); setCreateError('');
    try {
      const data = await window.tusyenApi.createClassroom({
        name, subject: newClass.subject,
        formLevel: Number(newClass.formLevel),
        description: newClass.description.trim(),
      });
      const created = formatLiveClass(data.classroom || { name, subject: newClass.subject, formLevel: Number(newClass.formLevel) }, 0);
      setCls(created);
      classState.refresh();
      setShowCreate(false);
      setNewClass({ name:'', subject:'Matematik', formLevel:4, description:'' });
      openClass ? openClass(created, { tab:'students' }) : go('class');
    } catch (err) {
      setCreateError(err.message || 'Tidak dapat mencipta kelas.');
    } finally {
      setCreating(false);
    }
  };

  return (
  <div style={{ padding:'14px 16px 10px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
      <Avatar name={displayName} size={46} />
      <div>
        <div style={{ fontWeight:800, fontSize:16, color:C.text }}>{teacherHonorificName(teacherFirstName(displayName), displayName)}</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{displayName} • {subjectLine}</div>
      </div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(112px, 1fr))', gap:8, marginBottom:14 }}>
      {[
        {v:String(list.length),l:'Kelas',i:'🏫'},
        {v:String(totalStudents),l:'Pelajar',i:'👥'},
        {v:avgCompletion === null ? '—' : `${avgCompletion}%`,l:'Purata Siap',i:'📊'},
        {v:String(riskCount),l:'Pelajar Berisiko',i:'⚠️', danger:riskCount > 0, onClick:riskCount > 0 ? openRiskRoster : undefined},
      ].map((s,i) => (
        <Card key={i} warn={s.danger} onClick={s.onClick} style={{ textAlign:'center', padding:12 }}>
          <div style={{ fontSize:20 }}>{s.i}</div>
          <div style={{ fontWeight:800, fontSize:18, color:s.danger ? C.red : C.text }}>{s.v}</div>
          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, textTransform:'uppercase' }}>{s.l}</div>
        </Card>
      ))}
    </div>
    <Card style={{ marginBottom:14, padding:10, background:C.surface }}>
      <div style={{ fontSize:12, color:C.textMuted, fontWeight:800, lineHeight:1.45 }}>
        {completionExplanation}
        {avgCompletion === 100 && ' 100% bermaksud rekod kemajuan yang tersedia sudah lengkap untuk kelas yang dikira.'}
      </div>
    </Card>

    <Card warn style={{ marginBottom:14 }}>
      <div style={{ fontWeight:800, fontSize:11, color:C.red, textTransform:'uppercase', letterSpacing:0.6, marginBottom:7 }}>⚠️ Perlu Perhatian</div>
      {attentionItems.length ? attentionItems.map((item,i) => (
        <div key={i} style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'5px 0',
          borderBottom: i < attentionItems.length - 1 ? `1px solid rgba(239,68,68,.15)` : 'none',
        }}>
          <div style={{ flex:1, minWidth:0, fontSize:12, color:C.text, fontWeight:700, lineHeight:1.35 }}>{item.text}</div>
          {item.classRef && (
            <button
              onClick={() => openClass(item.classRef, { tab:item.tab, filter:item.filter })}
              style={{
                minHeight:44, flexShrink:0,
                background:'rgba(239,68,68,.10)',
                border:'1px solid rgba(239,68,68,.30)',
                borderRadius:10, padding:'0 10px',
                color:C.red, fontFamily:'Nunito', fontWeight:900, fontSize:11,
                cursor:'pointer',
              }}
            >{item.action}</button>
          )}
        </div>
      )) : (
        <div style={{ fontSize:12, color:C.text, fontWeight:700, padding:'3px 0' }}>Tiada amaran kelas berdasarkan data semasa.</div>
      )}
    </Card>

    <SectionLabel>Kelas Saya</SectionLabel>
    {notice && (
      <Card style={{ marginBottom:10, padding:10, border:`1px solid ${C.borderB}`, background:C.accDim }}>
        <div style={{ fontSize:12, color:C.accPale, fontWeight:900 }}>ℹ️ {notice}</div>
      </Card>
    )}
    {localNotice && (
      <Card style={{ marginBottom:10, padding:10, border:`1px solid ${C.borderB}`, background:C.accDim }}>
        <div style={{ fontSize:12, color:C.accPale, fontWeight:900 }}>{localNotice}</div>
      </Card>
    )}
    {classState.error && (
      <div style={{ marginBottom:10 }}>
        <ErrorRetry message={classState.error.message || 'Tidak dapat memuat kelas.'} onRetry={classState.refresh} />
      </div>
    )}
    {showCreate && (
      <Card style={{ marginBottom:10 }}>
        <div style={{ fontWeight:800, fontSize:13, color:C.accPale, marginBottom:8 }}>Kelas baharu</div>
        <input
          value={newClass.name}
          onChange={e => setNewClass({ ...newClass, name:e.target.value })}
          placeholder="Nama kelas, contoh: Matematik 4A"
          style={{ width:'100%', boxSizing:'border-box', marginBottom:8, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:10, color:C.text, fontFamily:'Nunito', fontWeight:700 }}
        />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <select value={newClass.subject} onChange={e => setNewClass({ ...newClass, subject:e.target.value })} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:10, color:C.text, fontFamily:'Nunito', fontWeight:700 }}>
            {CLASS_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={newClass.formLevel} onChange={e => setNewClass({ ...newClass, formLevel:Number(e.target.value) })} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:10, color:C.text, fontFamily:'Nunito', fontWeight:700 }}>
            {CLASS_FORM_LEVELS.map(level => <option key={level} value={level}>Tingkatan {level}</option>)}
          </select>
        </div>
        <textarea value={newClass.description} onChange={e => setNewClass({ ...newClass, description:e.target.value })} placeholder="Penerangan ringkas kelas" style={{ width:'100%', minHeight:72, resize:'vertical', boxSizing:'border-box', background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:10, color:C.text, fontFamily:'Nunito', fontWeight:600 }} />
        {createError && <div style={{ color:C.red, fontSize:11, fontWeight:800, marginTop:7 }}>{createError}</div>}
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <GlowButton onClick={submitCreateClass} disabled={creating} style={{ flex:1 }}>{creating ? 'Mencipta...' : 'Cipta Kelas'}</GlowButton>
          <button onClick={() => setShowCreate(false)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'0 14px', minHeight:44, color:C.textMuted, fontFamily:'Nunito', fontWeight:800, cursor:'pointer' }}>Batal</button>
        </div>
      </Card>
    )}
    {classState.loading ? [0,1,2].map(i => (
      <Card key={i} style={{ marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <Skeleton width="58%" height={15} radius={7} style={{ marginBottom:7 }} />
            <Skeleton width="72%" height={12} radius={6} />
          </div>
          <Skeleton width={68} height={24} radius={8} />
        </div>
        <div style={{ display:'flex', gap:14, marginBottom:10 }}>
          <Skeleton width={92} height={12} radius={6} />
          <Skeleton width={82} height={12} radius={6} />
        </div>
        <Skeleton width="100%" height={6} radius={999} />
      </Card>
    )) : list.length === 0 ? (
      <Card style={{ marginBottom:10 }}>
        <EmptyState icon="🏫" title="Cipta kelas pertama anda" subtitle="Mulakan kelas untuk jemput pelajar, berkongsi tugasan, dan melihat kemajuan." />
        <div style={{ display:'grid', gap:7, margin:'0 auto 14px', maxWidth:300 }}>
          {['Namakan kelas dan subjek.', 'Kongsi kod kelas kepada pelajar.', 'Tetapkan pelajaran pertama dengan tarikh hantar.'].map((item, index) => (
            <div key={index} style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, color:C.textMuted, fontWeight:800 }}>
              <TeacherBadge>{index + 1}</TeacherBadge>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <GlowButton onClick={() => setShowCreate(true)} style={{ marginTop:4 }}>Cipta kelas pertama anda</GlowButton>
      </Card>
    ) : list.map(cls => {
      const hasAvg = cls.avg !== null && cls.avg !== undefined;
      return (
      <Card key={cls.id} style={{ marginBottom:10, border:`1px solid color-mix(in srgb,${cls.color} 28%,var(--c-bdr))` }} onClick={() => openClass ? openClass(cls, { tab:'students' }) : (setCls(cls), go('class'))}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{cls.name}</div>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{cls.subj} • Tingkatan {cls.form}</div>
          </div>
          {Number(cls.riskCount) > 0 && <TeacherBadge tone="bad">{cls.riskCount} risiko</TeacherBadge>}
        </div>
        <div onClick={e => e.stopPropagation()} style={{
          display:'grid', gridTemplateColumns:'1fr auto auto', gap:6, alignItems:'center',
          background:C.surface,
          border:`1px solid ${C.border}`,
          borderRadius:10, padding:'7px 8px', marginBottom:9,
        }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:9, color:C.textMuted, fontWeight:900, textTransform:'uppercase' }}>Kod Kelas</div>
            <div style={{ fontSize:13, fontWeight:900, color:cls.color, letterSpacing:0 }}>{cls.code}</div>
          </div>
          <TeacherSmallButton onClick={(event) => copyClassCodeFromCard(cls, event)}>Salin</TeacherSmallButton>
          <TeacherSmallButton onClick={(event) => shareClassCodeFromCard(cls, event)}>Kongsi</TeacherSmallButton>
        </div>
        <div style={{ display:'flex', gap:14, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:700 }}>👥 {cls.students} pelajar</span>
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:700 }}>📊 {hasAvg ? `Purata Siap ${cls.avg}%` : 'Purata Siap belum ada'}</span>
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:700 }}>Aktiviti terakhir: {formatActivityStatus(cls.lastActivity)}</span>
        </div>
        <ProgressBar value={hasAvg ? cls.avg : 0} color={cls.color} height={6} style={{ opacity:hasAvg ? 1 : 0.35 }} />
        <button
          onClick={(event) => { event.stopPropagation(); openClass ? openClass(cls, { tab:'students' }) : (setCls(cls), go('class')); }}
          style={{
            width:'100%', minHeight:44, marginTop:10,
            background:`color-mix(in srgb,${cls.color} 18%,var(--c-acc-dim))`,
            border:`1px solid color-mix(in srgb,${cls.color} 42%,var(--c-bdr))`,
            borderRadius:12, color:C.text,
            fontFamily:'Nunito', fontWeight:900, fontSize:13,
            cursor:'pointer',
          }}
        >Lihat kelas</button>
      </Card>
      );
    })}
    <GlowButton outlined onClick={() => setShowCreate(v => !v)} style={{ marginTop:4 }}>
      {showCreate ? 'Tutup borang' : '+ Cipta kelas baharu'}
    </GlowButton>
    <div style={{ height:8 }} />
  </div>
  );
};

// ─── Profile ───────────────────────────────────────────────────────────────

const TeacherProfile = ({ displayName }) => {
  const profileState = useTeacherProfile(displayName);
  const classState = useTeacherClassrooms();
  const profile = profileState.data || emptyTeacherProfile(displayName);
  const { classes = [] } = classState.data || { classes:[] };
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [previewAudience, setPreviewAudience] = React.useState('student');
  const [profileError, setProfileError] = React.useState('');
  const [profileStatus, setProfileStatus] = React.useState('');
  const [profileForm, setProfileForm] = React.useState({
    headline:'', bio:'', specialties:'', credentials:'', yearsExperience:0, location:'',
  });
  const fullName = stripTeacherHonorific(teacherName(profile.full_name || displayName, displayName)) || stripTeacherHonorific(displayName) || displayName;
  const initials = (fullName || 'AI').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const subjects = profileSubjects(profile, classes);
  const yearsExperience = Number(profile.years_experience ?? profile.yearsExperience) || 0;
  const profileHeadline = teacherTitle(profile.headline, '');
  const profileBio = teacherBodyText(profile.bio, '', 220);
  const profileCredentials = teacherBodyText(profile.credentials, '', 180);
  const profileLocation = teacherText(profile.location, '', 48);
  const canEdit = window.tusyenUser?.role === 'teacher';
  const inputStyle = { width:'100%', boxSizing:'border-box', background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:10, color:C.text, fontFamily:'Nunito', fontWeight:700 };

  const startEdit = () => {
    setProfileForm({ headline:profile.headline||'', bio:profile.bio||'', specialties:(profile.specialties||[]).join(', '), credentials:profile.credentials||'', yearsExperience, location:profile.location||'' });
    setProfileStatus(''); setProfileError(''); setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true); setProfileError(''); setProfileStatus('');
    try {
      await window.tusyenApi.updateTeacherProfile({
        headline:profileForm.headline, bio:profileForm.bio, specialties:profileForm.specialties,
        credentials:profileForm.credentials, yearsExperience:Number(profileForm.yearsExperience)||0, location:profileForm.location,
      });
      setProfileStatus('Profil dikemas kini.');
      setEditing(false);
      profileState.refresh();
    } catch (err) {
      setProfileError(err.message || 'Tidak dapat mengemas kini profil.');
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { label:'Tajuk', value:profileHeadline || 'Belum dikemaskini', icon:'👤' },
    { label:'Pengalaman', value:yearsExperience ? `${yearsExperience} tahun mengajar` : 'Belum dikemaskini', icon:'🎖️' },
    { label:'Kelayakan', value:profileCredentials || 'Tambah kelayakan seperti B.Ed, MSc, sijil pedagogi, atau pengalaman peperiksaan.', icon:'🎓' },
    { label:'E-mel', value:teacherEmailText(profile.email || window.tusyenUser?.email), icon:'✉️' },
    { label:'Lokasi', value:profileLocation || 'Belum dikemaskini', icon:'📍' },
  ];
  const completionItems = [
    { label:'tajuk', done:Boolean(profileHeadline) },
    { label:'bio', done:Boolean(profileBio) },
    { label:'subjek', done:subjects.length > 0 },
    { label:'kelayakan', done:Boolean(profileCredentials) },
    { label:'pengalaman', done:yearsExperience > 0 },
    { label:'lokasi', done:Boolean(profileLocation) },
  ];
  const completionChecks = completionItems.map(item => item.done);
  const missingCompletion = completionItems.filter(item => !item.done).map(item => item.label);
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);
  const previewText = previewAudience === 'parent'
    ? {
        title:'Pratonton ibu bapa',
        body:profileBio || 'Ibu bapa akan melihat pengenalan cikgu, kelayakan, subjek, dan kelas aktif di sini.',
        meta:profileCredentials || 'Kelayakan belum dikemaskini',
      }
    : {
        title:'Pratonton pelajar',
        body:profileBio || 'Pelajar akan melihat gaya mengajar dan cara cikgu menyokong pembelajaran mereka.',
        meta:subjects.length ? subjects.join(', ') : 'Subjek belum dikemaskini',
      };

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'20px 16px 10px' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:18 }}>
        <div style={{
          width:82, height:82, borderRadius:'50%', marginBottom:10,
          background:'linear-gradient(135deg,var(--c-acc-lo),var(--c-acc-hi))',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, fontWeight:800, color:'#fff',
          boxShadow:'0 0 28px var(--c-acc-glow)',
          border:'3px solid color-mix(in srgb,var(--c-acc) 40%,transparent)',
        }}>{initials}</div>
        <button
          type="button"
          onClick={canEdit ? startEdit : undefined}
          disabled={!canEdit}
          style={{
            minHeight:44, marginTop:-4, marginBottom:8,
            background:C.surface, border:`1px solid ${C.border}`,
            borderRadius:999, padding:'0 12px',
            color:C.textMuted, fontFamily:'Nunito', fontWeight:900, fontSize:11,
            cursor:canEdit ? 'pointer' : 'default',
          }}
        >Avatar inisial</button>
        <div style={{ fontWeight:800, fontSize:20, color:C.text }}>{teacherHonorificName(fullName, displayName)}</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2, textAlign:'center' }}>
          {profileHeadline || profileLocation || 'Profil guru'}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
          {(subjects.length ? subjects : ['Subjek belum dikemaskini']).map((s,i) => (
            <span key={i} style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:700, color:C.accPale }}>{s}</span>
          ))}
        </div>
      </div>

      <SectionLabel>Kelengkapan Profil</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:8 }}>
          <div style={{ fontWeight:900, fontSize:13, color:C.text }}>Profil {completionPercent}% lengkap</div>
          <TeacherBadge tone={completionPercent >= 80 ? 'good' : completionPercent >= 50 ? 'warn' : 'bad'}>
            {completionChecks.filter(Boolean).length}/{completionChecks.length}
          </TeacherBadge>
        </div>
        <ProgressBar value={completionPercent} color={completionPercent >= 80 ? C.green : completionPercent >= 50 ? C.gold : C.red} height={8} />
        <div style={{ fontSize:11, color:C.textMuted, fontWeight:800, lineHeight:1.4, marginTop:8 }}>
          Dikira daripada tajuk, bio, subjek, kelayakan, pengalaman, dan lokasi.
          {missingCompletion.length ? ` Seterusnya: ${missingCompletion.slice(0, 2).join(', ')}.` : ' Semua item asas lengkap.'}
        </div>
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          {v:String(Number(profile.student_count)||0),l:'Pelajar',i:'👥'},
          {v:String(Number(profile.classroom_count)||classes.length||0),l:'Kelas',i:'🏫'},
          {v:String(Number(profile.post_count)||0),l:'Pos',i:'📢'},
        ].map((s,i) => (
          <Card key={i} style={{ textAlign:'center', padding:12 }}>
            <div style={{ fontSize:20 }}>{s.i}</div>
            <div style={{ fontWeight:800, fontSize:17, color:C.text }}>{s.v}</div>
            <div style={{ fontSize:9, color:C.textMuted, fontWeight:600, textTransform:'uppercase' }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {profileState.error && <div style={{ marginBottom:10 }}><ErrorRetry message={profileState.error.message||'Tidak dapat memuat profil.'} onRetry={profileState.refresh} /></div>}
      {profileStatus && <Card success style={{ marginBottom:10, padding:10 }}><div style={{ fontSize:12, color:C.green, fontWeight:900 }}>{profileStatus}</div></Card>}
      {profileError && <div style={{ marginBottom:10 }}><ErrorRetry message={profileError} onRetry={saveProfile} /></div>}

      <SectionLabel>Tentang Cikgu</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, color:C.text, fontWeight:700, lineHeight:1.55, whiteSpace:'pre-line' }}>
          {profileBio || 'Tulis pengenalan ringkas supaya pelajar dan ibu bapa tahu gaya mengajar, fokus subjek, dan cara terbaik mendapatkan bantuan.'}
        </div>
      </Card>

      <SectionLabel>Pratonton</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
          {[
            ['student','Sebagai pelajar'],
            ['parent','Sebagai ibu bapa'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setPreviewAudience(value)} style={{
              minHeight:44,
              background:previewAudience === value ? C.accDim : 'transparent',
              border:`1.5px solid ${previewAudience === value ? C.borderB : C.border}`,
              borderRadius:10, color:previewAudience === value ? C.accPale : C.textMuted,
              fontFamily:'Nunito', fontWeight:900, fontSize:11, cursor:'pointer',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:12 }}>
          <div style={{ fontSize:10, color:C.textFaint, fontWeight:900, textTransform:'uppercase', marginBottom:4 }}>{previewText.title}</div>
          <div style={{ fontWeight:900, fontSize:14, color:C.text }}>{teacherHonorificName(fullName, displayName)}</div>
          <div style={{ fontSize:12, color:C.accPale, fontWeight:800, margin:'2px 0 7px' }}>{previewText.meta}</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>{previewText.body}</div>
        </div>
      </Card>

      {editing && (
        <Card style={{ marginBottom:14 }}>
          <div style={{ fontWeight:800, fontSize:13, color:C.accPale, marginBottom:8 }}>Sunting profil</div>
          <input value={profileForm.headline} onChange={e => setProfileForm({ ...profileForm, headline:e.target.value })} placeholder="Tajuk profil" style={{ ...inputStyle, marginBottom:8 }} />
          <textarea value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio:e.target.value })} placeholder="Tentang Cikgu: gaya mengajar, fokus subjek, dan sokongan untuk pelajar" style={{ ...inputStyle, minHeight:80, resize:'vertical', marginBottom:8 }} />
          <input value={profileForm.specialties} onChange={e => setProfileForm({ ...profileForm, specialties:e.target.value })} placeholder="Kepakaran" style={{ ...inputStyle, marginBottom:4 }} />
          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, lineHeight:1.35, marginBottom:8 }}>Pisahkan setiap kepakaran dengan koma, contoh: Matematik, Fizik.</div>
          <input value={profileForm.credentials} onChange={e => setProfileForm({ ...profileForm, credentials:e.target.value })} placeholder="Kelayakan, sijil, pengalaman peperiksaan, atau pencapaian mengajar" style={{ ...inputStyle, marginBottom:8 }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <input type="number" min="0" value={profileForm.yearsExperience} onChange={e => setProfileForm({ ...profileForm, yearsExperience:e.target.value })} placeholder="Tahun pengalaman" style={inputStyle} />
            <input value={profileForm.location} onChange={e => setProfileForm({ ...profileForm, location:e.target.value })} placeholder="Lokasi / sekolah" style={inputStyle} />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <GlowButton onClick={saveProfile} disabled={saving} style={{ flex:1 }}>{saving ? 'Menyimpan...' : 'Simpan Profil'}</GlowButton>
            <button onClick={() => setEditing(false)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'0 14px', minHeight:44, color:C.textMuted, fontFamily:'Nunito', fontWeight:800, cursor:'pointer' }}>Batal</button>
          </div>
        </Card>
      )}

      <SectionLabel>Kelayakan</SectionLabel>
      <Card style={{ marginBottom:14, border:`1px solid ${profileCredentials ? C.borderB : C.border}` }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{
            width:44, height:44, borderRadius:12, flexShrink:0,
            background:C.accDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
          }}>🎓</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:13, color:C.text, marginBottom:3 }}>
              {profileCredentials ? 'Kelayakan disiarkan' : 'Kelayakan belum lengkap'}
            </div>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.45 }}>
              {profileCredentials || 'Tambah kelayakan akademik, sijil, atau pengalaman peperiksaan supaya profil lebih meyakinkan.'}
            </div>
          </div>
        </div>
      </Card>

      <SectionLabel>👤 Maklumat</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        {infoRows.map((r,i,arr) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <span style={{ fontSize:18, width:24, textAlign:'center' }}>{r.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, textTransform:'uppercase', letterSpacing:0.4 }}>{r.label}</div>
              <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>{r.value}</div>
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>🏫 Kelas Aktif</SectionLabel>
      <Card style={{ marginBottom:14, padding:'10px 14px' }}>
        {classState.loading ? [0,1,2].map(i => (
          <Skeleton key={i} width="100%" height={30} radius={8} style={{ margin:'6px 0' }} />
        )) : classes.length ? classes.map((s,i) => (
          <div key={s.id||i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i < classes.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:s.color, boxShadow:`0 0 6px ${s.color}` }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{s.name}</div>
              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{s.subj} • {s.students} pelajar • Kod {s.code}</div>
            </div>
          </div>
        )) : (
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, padding:'8px 0' }}>Belum ada kelas aktif.</div>
        )}
      </Card>

      <div style={{
        position:'sticky', bottom:0, zIndex:20, margin:'0 -16px 14px',
        padding:'10px 16px',
        background:'color-mix(in srgb,var(--c-bg) 92%,transparent)',
        borderTop:`1px solid ${C.border}`,
        backdropFilter:'blur(10px)',
      }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8 }}>
          <button onClick={() => setPreviewAudience('student')} aria-pressed={previewAudience === 'student'} style={{
            minHeight:44, background:previewAudience === 'student' ? C.accDim : C.surface,
            border:`1px solid ${previewAudience === 'student' ? C.borderB : C.border}`,
            borderRadius:12, color:previewAudience === 'student' ? C.accPale : C.textMuted,
            fontFamily:'Nunito', fontWeight:900, fontSize:11, cursor:'pointer',
          }}>Pelajar</button>
          <button onClick={() => setPreviewAudience('parent')} aria-pressed={previewAudience === 'parent'} style={{
            minHeight:44, background:previewAudience === 'parent' ? C.accDim : C.surface,
            border:`1px solid ${previewAudience === 'parent' ? C.borderB : C.border}`,
            borderRadius:12, color:previewAudience === 'parent' ? C.accPale : C.textMuted,
            fontFamily:'Nunito', fontWeight:900, fontSize:11, cursor:'pointer',
          }}>Ibu bapa</button>
          <button onClick={startEdit} disabled={!canEdit} style={{
            minHeight:44, background:C.accDim, border:`1px solid ${C.borderB}`,
            borderRadius:12, padding:'0 14px', color:C.accPale,
            fontFamily:'Nunito', fontWeight:900, fontSize:11,
            cursor:canEdit ? 'pointer' : 'not-allowed', opacity:canEdit ? 1 : .55,
          }}>{canEdit ? 'Sunting' : 'Kunci'}</button>
        </div>
      </div>

      <SectionLabel>Tetapan Akaun</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, color:C.text, fontWeight:800 }}>Tampilan</div>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, lineHeight:1.4 }}>Pilih tema yang selesa untuk akaun guru ini.</div>
          </div>
        </div>
        <ThemeToggle />
        <div style={{ marginTop:10 }}>
          <LanguageToggle />
        </div>
      </Card>
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, color:C.text, fontWeight:800, marginBottom:8 }}>Akaun</div>
        <button onClick={() => window.tusyenSignOut?.()} style={{
          width:'100%', minHeight:44,
          background:'rgba(239,68,68,.10)',
          border:'1px solid rgba(239,68,68,.32)',
          color:C.red, borderRadius:12, padding:'10px 12px',
          fontFamily:'Nunito', fontWeight:900, fontSize:13,
          cursor:'pointer',
        }}>Log Keluar</button>
      </Card>
      <div style={{ height:8 }} />
    </div>
  );
};

// ─── TeacherQuizScreen ──────────────────────────────────────────────────────

const TeacherQuizScreen = ({ classrooms }) => {
  const { t } = useLanguage();
  const [selectedClassroomId, setSelectedClassroomId] = React.useState(() => classrooms[0]?.id || null);
  const decksState = useAsync(() => window.tusyenApi.quizDecks({}), []);
  const decks = decksState.data?.decks || decksState.data || [];
  const totalQuestions = decks.reduce((sum, d) => sum + (d.questionCount ?? d.question_count ?? d.questions?.length ?? 0), 0);

  const activeClassroom = classrooms.find(c => c.id === selectedClassroomId) || classrooms[0] || null;

  React.useEffect(() => {
    const firstClassId = classrooms[0]?.id || null;
    const stillAvailable = classrooms.some(cls => cls.id === selectedClassroomId);
    if (!firstClassId) {
      if (selectedClassroomId) setSelectedClassroomId(null);
      return;
    }
    if (!selectedClassroomId || !stillAvailable) setSelectedClassroomId(firstClassId);
  }, [classrooms, selectedClassroomId]);

  if (!classrooms.length) {
    return (
      <div style={{ padding:'14px 16px 10px' }}>
        <EmptyState icon="🎮" title="Belum ada kelas" subtitle="Buat kelas dahulu untuk boleh mulakan sesi kuiz langsung." />
      </div>
    );
  }

  return (
    <div style={{ padding:'14px 16px 10px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        <Card style={{ padding:12, textAlign:'center' }}>
          <div style={{ fontWeight:900, fontSize:22, color:C.accPale }}>{decks.length}</div>
          <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>{t('Dek Kuiz', 'Quiz Decks')}</div>
        </Card>
        <Card style={{ padding:12, textAlign:'center' }}>
          <div style={{ fontWeight:900, fontSize:22, color:C.accPale }}>{totalQuestions}</div>
          <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>{t('Jumlah Soalan', 'Total Questions')}</div>
        </Card>
      </div>

      <SectionLabel>{t('Pilih Kelas', 'Select Class')}</SectionLabel>
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6, marginBottom:14 }}>
        {classrooms.map(cls => {
          const on = cls.id === selectedClassroomId;
          return (
            <button key={cls.id} onClick={() => setSelectedClassroomId(cls.id)} style={{
              flexShrink:0,
              background: on ? C.accDim : 'transparent',
              border:`1.5px solid ${on ? C.borderB : C.border}`,
              borderRadius:20, padding:'6px 14px', minHeight:44,
              color: on ? C.accPale : C.textMuted,
              fontFamily:'Nunito', fontWeight:800, fontSize:12, cursor:'pointer',
            }}>{cls.name}</button>
          );
        })}
      </div>

      {window.TeacherQuizTab ? (
        <window.TeacherQuizTab classroomId={activeClassroom?.id || selectedClassroomId} />
      ) : (
        <Card><div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>{t('Komponen kuiz tidak dapat dimuatkan.', 'Quiz component could not be loaded.')}</div></Card>
      )}
    </div>
  );
};

// ─── App Shell ─────────────────────────────────────────────────────────────

const TeacherSidebarStats = ({ classes = [] }) => {
  const { t } = useLanguage();
  const totalStudents = classes.reduce((sum, cls) => sum + (Number(cls.students) || 0), 0);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'10px 0' }}>
      {[
        { value:String(classes.length), label:t('Kelas', 'Classes') },
        { value:String(totalStudents), label:t('Pelajar', 'Students') },
      ].map((item) => (
        <div key={item.label} style={{
          background:C.surface,
          border:`1px solid ${C.border}`,
          borderRadius:12,
          padding:'10px 8px',
          textAlign:'center',
        }}>
          <div style={{ fontWeight:900, fontSize:17, color:C.accPale, lineHeight:1 }}>{item.value}</div>
          <div style={{ fontSize:9, color:C.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginTop:3 }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

const TeacherApp = ({ sidebarExtraTop } = {}) => {
  const [screen, setScreen] = React.useState('home');
  const [cls, setCls] = React.useState(null);
  const [classView, setClassView] = React.useState({ tab:'students', filter:'all' });
  const [homeNotice, setHomeNotice] = React.useState('');
  const rawDisplayName = teacherName(window.tusyenUser?.fullName || window.tusyenUser?.full_name || window.tusyenUser?.email, 'Azman Ibrahim');
  const displayName = stripTeacherHonorific(rawDisplayName) || rawDisplayName;
  const classState = useTeacherClassrooms();
  const classes = classState.data?.classes || CLASSES;

  const screenMeta = {
    home:      { title:'Kelas Saya',       en:'My Classes' },
    class:     { title:cls?.name || 'Detail Kelas', en:'Class Detail' },
    posts:     { title:'Suapan & Pos',     en:'Feed & Posts' },
    lessons:   { title:'Pelajaran',        en:'Lessons' },
    quiz:      { title:'Dek Kuiz',         en:'Quiz Decks' },
    whiteboard:{ title:'Papan Putih',      en:'Whiteboard' },
    profile:   { title:'Profil Guru',      en:'Teacher Profile' },
  };

  const nav = [
    { id:'home',       icon:'🏫', label:'Kelas',      en:'Classes'    },
    { id:'posts',      icon:'📢', label:'Pos',         en:'Posts'      },
    { id:'lessons',    icon:'📚', label:'Pelajaran',   en:'Lessons'    },
    { id:'quiz',       icon:'🎮', label:'Kuiz',        en:'Quiz'       },
    { id:'whiteboard', icon:'🖌️', label:'Papan Putih', en:'Whiteboard' },
    { id:'profile',    icon:'👤', label:'Profil',      en:'Profile'    },
  ];

  const go = (next) => { setHomeNotice(''); setScreen(next); };

  const openClass = (nextClass, options = {}) => {
    setCls(nextClass);
    setClassView({
      tab: options.tab || 'students',
      filter: options.filter || 'all',
    });
    go('class');
  };

  const handleClassUpdated = (updated) => {
    setCls(updated);
    classState.refresh();
  };

  const handleClassArchived = () => {
    setCls(null);
    setClassView({ tab:'students', filter:'all' });
    classState.refresh();
    setHomeNotice('Kelas telah dinyahaktifkan.');
    setScreen('home');
  };

  const selectNav = (next) => {
    if (next === 'class' && !cls) {
      setHomeNotice('Pilih kelas dahulu untuk melihat detail.');
      setScreen('home');
      return;
    }
    go(next);
  };

  const meta = screenMeta[screen] || screenMeta.home;
  const activeNavId = screen === 'class' ? 'home' : screen;
  useScreenFocus(screen);

  return (
    <div className="app-shell mobile-bottom-nav teacher-app-shell">
      <style>{`.teacher-app-shell .sidebar-stats,.teacher-app-shell .sidebar-user>div:last-child{display:none!important;}`}</style>
      <AppSidebar
        navItems={nav}
        active={activeNavId}
        onNav={selectNav}
        user={window.tusyenUser}
        stats={{ streak:classes.length, xp:classes.reduce((sum, item) => sum + (Number(item.students) || 0), 0) }}
        onSignOut={() => window.tusyenSignOut?.()}
        extraTop={sidebarExtraTop}
        extraBottom={<TeacherSidebarStats classes={classes} />}
      />
      <main id="main-content" className="main-area" tabIndex="-1" aria-label={`${meta.title}${meta.en ? ` / ${meta.en}` : ''}`}>
        <TopBarMobile
          title={meta.title}
          subtitle={meta.en}
          right={<Avatar name={displayName} size={32} />}
        />
        <DataModeBanner role="teacher" />
        <div className="main-content" key={screen}>
          <h1 className="sr-only">{meta.title}{meta.en ? ` / ${meta.en}` : ''}</h1>
          {homeNotice && (
            <div style={{ marginBottom:12, padding:10, background:C.accDim, border:`1px solid ${C.borderB}`, borderRadius:12 }}>
              <div style={{ fontSize:12, color:C.accPale, fontWeight:900 }}>ℹ️ {homeNotice}</div>
            </div>
          )}
          {screen === 'home'       && <TeacherHome go={go} setCls={setCls} openClass={openClass} displayName={displayName} notice="" />}
          {screen === 'class'      && (
            <TeacherClass
              cls={cls}
              initialTab={classView.tab}
              initialFilter={classView.filter}
              onBack={() => go('home')}
              onClassUpdated={handleClassUpdated}
              onClassArchived={handleClassArchived}
            />
          )}
          {screen === 'posts'      && <TeacherPostsScreen classrooms={classes} />}
          {screen === 'lessons'    && <TeacherLessonsScreen classrooms={classes} />}
          {screen === 'quiz'       && <TeacherQuizScreen classrooms={classes} />}
          {screen === 'whiteboard' && <TeacherWhiteboardScreen classrooms={classes} />}
          {screen === 'profile'    && <TeacherProfile displayName={displayName} />}
        </div>
        <BottomNavMobile
          items={nav}
          active={activeNavId}
          onNav={selectNav}
          label="Navigasi guru"
        />
      </main>
    </div>
  );
};

window.TeacherApp = TeacherApp;
