// Tusyen — Teacher Role UI v2
// Ported from the Claude Design handoff. Uses real logged-in teacher's name where available.

const CLASSES = [
  { id:'c1', name:'Matematik 4A', subj:'📐 Matematik', students:28, avg:72, form:4, code:'MTH-4A2', color:'#8B5CF6' },
  { id:'c2', name:'Matematik 4B', subj:'📐 Matematik', students:25, avg:65, form:4, code:'MTH-4B2', color:'#7C3AED' },
  { id:'c3', name:'Fizik 5A',     subj:'⚡ Fizik',     students:30, avg:68, form:5, code:'PHY-5A1', color:'#38BDF8' },
];

const STUDS = [
  { name:'Siti Nora',    score:92, streak:12, risk:false },
  { name:'Ahmad Hafiz',  score:88, streak:7,  risk:false },
  { name:'Haziq Razif',  score:75, streak:3,  risk:false },
  { name:'Nurul Ain',    score:45, streak:0,  risk:true  },
  { name:'Izzat Faiz',   score:60, streak:2,  risk:false },
  { name:'Aina Sofia',   score:38, streak:0,  risk:true  },
];

const WEEK_DATA = [62, 74, 55, 82, 71];
const WEEK_DAYS = ['Isnin','Selasa','Rabu','Khamis','Jumaat'];

const SCHEDULE = [
  { day:'Isnin',  time:'08:00–10:00', cls:'Matematik 4A', room:'B12',       color:'#8B5CF6' },
  { day:'Selasa', time:'09:00–11:00', cls:'Matematik 4B', room:'B14',       color:'#7C3AED' },
  { day:'Rabu',   time:'10:00–12:00', cls:'Fizik 5A',     room:'Lab Sains', color:'#38BDF8' },
  { day:'Khamis', time:'08:00–10:00', cls:'Matematik 4A', room:'B12',       color:'#8B5CF6' },
  { day:'Jumaat', time:'07:30–09:30', cls:'Fizik 5A',     room:'Lab Sains', color:'#38BDF8' },
];

const teacherFirstName = (full) => {
  const parts = (full || '').split(' ').filter(Boolean);
  return parts[parts.length - 1] || 'Cikgu';
};

const SUBJ_ICON = {
  'mathematics':'📐 Matematik', 'matematik':'📐 Matematik',
  'science':'🔬 Sains',         'sains':'🔬 Sains',
  'physics':'⚡ Fizik',          'fizik':'⚡ Fizik',
  'chemistry':'🧪 Kimia',       'kimia':'🧪 Kimia',
  'biology':'🌿 Biologi',       'biologi':'🌿 Biologi',
  'english':'🔤 English',       'sejarah':'📜 Sejarah',
};
const SUBJ_COLOR = {
  'mathematics':'#8B5CF6', 'matematik':'#8B5CF6',
  'science':'#22C55E',     'sains':'#22C55E',
  'physics':'#38BDF8',     'fizik':'#38BDF8',
  'chemistry':'#F59E0B',   'kimia':'#F59E0B',
  'biology':'#22C55E',     'biologi':'#22C55E',
  'english':'#A78BFA',     'sejarah':'#EF4444',
};

const formatLiveClass = (c, i) => {
  const subjKey = (c.subject || '').toLowerCase();
  return {
    id: c.id || `c${i}`,
    name: c.name || 'Kelas',
    subj: SUBJ_ICON[subjKey] || `📚 ${c.subject || 'Subjek'}`,
    students: c.student_count ?? 0,
    avg: 0, // not exposed by /classroom; fetch /classroom/:id/analytics if needed
    form: c.form_level ?? 4,
    code: c.join_code || '------',
    color: SUBJ_COLOR[subjKey] || '#8B5CF6',
  };
};

const useTeacherClassrooms = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'teacher') return CLASSES;
    const { classrooms } = await window.tusyenApi.classrooms();
    const live = (classrooms || []).map(formatLiveClass);
    return live.length ? live : CLASSES;
  }, [], CLASSES);
};

const TeacherHome = ({ go, setCls, displayName }) => {
  const classState = useTeacherClassrooms();
  const list = classState.data || CLASSES;
  const totalStudents = list.reduce((sum, c) => sum + (c.students || 0), 0);
  return (
  <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
      <Avatar name={displayName} size={46} />
      <div>
        <div style={{ fontWeight:800, fontSize:16, color:C.text }}>Cikgu {teacherFirstName(displayName)}</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{displayName} • Matematik & Fizik</div>
      </div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
      {[{v:String(list.length),l:'Kelas',i:'🏫'},{v:String(totalStudents),l:'Pelajar',i:'👥'},{v:'68%',l:'Avg Skor',i:'📊'}].map((s,i) => (
        <Card key={i} style={{ textAlign:'center', padding:12 }}>
          <div style={{ fontSize:20 }}>{s.i}</div>
          <div style={{ fontWeight:800, fontSize:18, color:C.text }}>{s.v}</div>
          <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>{s.l}</div>
        </Card>
      ))}
    </div>

    <Card warn style={{ marginBottom:14 }}>
      <div style={{ fontWeight:800, fontSize:11, color:C.red, textTransform:'uppercase', letterSpacing:0.6, marginBottom:7 }}>⚠️ Perlu Perhatian</div>
      {['Nurul Ain (4A) — Skor 45%, tiada aktiviti 5 hari','Aina Sofia (4A) — Skor 38%, perlu bimbingan'].map((a,i) => (
        <div key={i} style={{
          fontSize:12, color:C.text, fontWeight:600, padding:'3px 0',
          borderBottom: i === 0 ? `1px solid rgba(239,68,68,.15)` : 'none',
        }}>• {a}</div>
      ))}
    </Card>

    <SectionLabel>Kelas Saya</SectionLabel>
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
    )) : list.map(cls => (
      <Card key={cls.id} style={{ marginBottom:10 }} onClick={() => { setCls(cls); go('class'); }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{cls.name}</div>
            <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{cls.subj} • Tingkatan {cls.form}</div>
          </div>
          <div style={{
            background:`color-mix(in srgb,${cls.color} 18%,transparent)`,
            border:`1px solid color-mix(in srgb,${cls.color} 35%,transparent)`,
            borderRadius:8, padding:'3px 9px',
            fontSize:11, fontWeight:800, color:cls.color,
          }}>{cls.code}</div>
        </div>
        <div style={{ display:'flex', gap:14, marginBottom:8 }}>
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>👥 {cls.students} pelajar</span>
          <span style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>📊 Avg {cls.avg}%</span>
        </div>
        <ProgressBar value={cls.avg} color={cls.color} height={6} />
      </Card>
    ))}

    <GlowButton outlined style={{ marginTop:4 }}>+ Cipta Kelas Baru</GlowButton>
    <div style={{ height:8 }} />
  </div>
  );
};

const useClassRoster = (classroomId) => {
  return useAsync(async () => {
    if (!classroomId || typeof classroomId !== 'string' || !classroomId.includes('-')) {
      // c1/c2/c3 mock IDs skip the API call and use design mock.
      return STUDS;
    }
    const { students } = await window.tusyenApi.classroomStudents(classroomId);
    const list = (students || []).map(s => {
      const completed = Number(s.completed_lessons) || 0;
      const score = Math.min(100, completed * 5); // crude derived score until a per-student avg endpoint exists
      return {
        name: s.full_name || s.email || 'Pelajar',
        score,
        streak: 0,
        risk: score < 60,
      };
    });
    return list.length ? list : STUDS;
  }, [classroomId], STUDS);
};

const WEAK_TOPICS_FALLBACK = [
  'Geometri (avg 45%)',
  'Trigonometri (avg 52%)',
  'Nombor Kompleks (avg 58%)',
];

const useClassAnalytics = (classroomId) => {
  const fallback = {
    weeklyActivity: WEEK_DAYS.map((day, i) => ({ day, count: WEEK_DATA[i], pct: WEEK_DATA[i] })),
    weakTopics: WEAK_TOPICS_FALLBACK,
  };
  return useAsync(async () => {
    if (!classroomId || typeof classroomId !== 'string' || !classroomId.includes('-')) {
      return fallback;
    }
    const data = await window.tusyenApi.classroomAnalytics(classroomId);
    const rawWeek = data.weeklyActivity || [];
    const maxCount = Math.max(1, ...rawWeek.map(d => Number(d.count) || 0));
    const weeklyActivity = WEEK_DAYS.map((day, i) => {
      const row = rawWeek.find(d => d.day === day) || {};
      const count = Number(row.count ?? WEEK_DATA[i]) || 0;
      return { day, count, pct: Math.max(6, Math.round((count / maxCount) * 100)) };
    });
    const weakTopics = (data.weakTopics || []).map(t => {
      const topic = t.topic || 'Topik';
      const avgScore = Math.round(Number(t.avgScore ?? t.avg_score) || 0);
      return `${topic} (avg ${avgScore}%)`;
    }).filter(Boolean);
    return {
      weeklyActivity,
      weakTopics: weakTopics.length ? weakTopics : WEAK_TOPICS_FALLBACK,
    };
  }, [classroomId], fallback);
};

const TeacherClass = ({ cls }) => {
  const [tab, setTab] = React.useState('students');
  const [composer, setComposer] = React.useState(null);
  const [postText, setPostText] = React.useState('');
  const [postStatus, setPostStatus] = React.useState('');
  const [postError, setPostError] = React.useState('');
  const [posting, setPosting] = React.useState(false);
  const rosterState = useClassRoster(cls?.id);
  const analyticsState = useClassAnalytics(cls?.id);
  const roster = rosterState.data || STUDS;
  const analytics = analyticsState.data || {
    weeklyActivity: WEEK_DAYS.map((day, i) => ({ day, count: WEEK_DATA[i], pct: WEEK_DATA[i] })),
    weakTopics: WEAK_TOPICS_FALLBACK,
  };
  const createCards = [
    { icon:'📢', label:'Pengumuman',    desc:'Hantar mesej kepada kelas',        postType:'announcement', enabled:true  },
    { icon:'📋', label:'Tugasan',        desc:'Tetapkan tugasan & tarikh hantar', postType:'assignment',   enabled:true  },
    { icon:'🧪', label:'Kuiz Baru',      desc:'Bina kuiz MCQ atau subjektif',     enabled:false },
    { icon:'🎬', label:'Video Pelajaran', desc:'Upload video atau kongsi pautan', enabled:false },
  ];
  const openComposer = (item) => {
    if (!item.enabled) return;
    setComposer(item);
    setPostText('');
    setPostStatus('');
    setPostError('');
  };
  const submitPost = async () => {
    if (!composer || !postText.trim()) return;
    setPosting(true);
    setPostStatus('');
    setPostError('');
    try {
      await window.tusyenApi.createPost({
        classroomId: cls.id,
        content: postText,
        postType: composer.postType,
        title: composer.label,
      });
      setPostStatus('Berjaya dihantar.');
      setPostText('');
    } catch (err) {
      setPostError(err.message || 'Tidak dapat menghantar pos.');
    } finally {
      setPosting(false);
    }
  };
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{
        padding:'12px 16px', flexShrink:0,
        background:`color-mix(in srgb,${cls.color} 12%,var(--c-card))`,
        borderBottom:`1px solid ${C.border}`,
      }}>
        <div style={{ fontWeight:800, fontSize:17, color:C.text, marginBottom:2 }}>{cls.name}</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginBottom:10 }}>{cls.subj} • {cls.students} pelajar</div>
        <div style={{ display:'flex', gap:8 }}>
          <StatPill icon="📊" value={`${cls.avg}%`} label="AVG" color={cls.color} />
          <StatPill icon="🔑" value={cls.code}       label="KOD" color={C.accHi}  />
        </div>
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, flexShrink:0, background:C.surface }}>
        {['students','analytics','create'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:'10px 0', border:'none', cursor:'pointer',
            background:'none', fontFamily:'Nunito,sans-serif',
            fontWeight:800, fontSize:11, textTransform:'uppercase', letterSpacing:0.3,
            color: tab === t ? C.accHi : C.textFaint,
            borderBottom: tab === t ? '2px solid var(--c-acc)' : '2px solid transparent',
            transition:'all .2s',
          }}>
            {t === 'students' ? '👥 Pelajar' : t === 'analytics' ? '📊 Analitik' : '✏️ Cipta'}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
        {tab === 'students' && (rosterState.loading ? [0,1,2,3,4].map(i => (
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
        )) : roster.map((s,i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10, padding:'9px 0',
            borderBottom: i < roster.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <Avatar name={s.name} size={36} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{s.name}</div>
              <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:3 }}>🔥 {s.streak} hari</div>
              <ProgressBar value={s.score} color={s.score >= 60 ? C.green : C.red} height={4} />
            </div>
            <div style={{
              fontWeight:800, fontSize:13,
              color: s.score >= 60 ? C.green : C.red,
              background: s.score >= 60 ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
              border:`1px solid ${s.score >= 60 ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
              borderRadius:8, padding:'3px 9px',
            }}>{s.score}%</div>
          </div>
        )))}

        {tab === 'analytics' && (
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:12 }}>Prestasi Mingguan</div>
            {analyticsState.loading ? [0,1,2,3,4].map(i => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
                <Skeleton width={52} height={11} radius={5} />
                <Skeleton width="100%" height={22} radius={5} style={{ flex:1 }} />
              </div>
            )) : analytics.weeklyActivity.map((item,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
                <div style={{ width:52, fontSize:11, color:C.textMuted, fontWeight:700 }}>{item.day}</div>
                <div style={{ flex:1, height:22, background:C.surface, borderRadius:5, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', width:`${item.pct}%`,
                    background:'linear-gradient(90deg,var(--c-acc-lo),var(--c-acc))',
                    borderRadius:5, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:6,
                  }}>
                    <span style={{ fontSize:9, color:'#fff', fontWeight:800 }}>{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ fontWeight:800, fontSize:14, color:C.text, margin:'14px 0 10px' }}>Topik Lemah</div>
            {analyticsState.loading ? [0,1,2].map(i => (
              <Card warn key={i} style={{ marginBottom:8, padding:10 }}>
                <Skeleton width={i === 0 ? '72%' : '60%'} height={13} radius={7} />
              </Card>
            )) : analytics.weakTopics.map((t,i) => (
              <Card warn key={i} style={{ marginBottom:8, padding:10 }}>
                <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>⚠️ {t}</div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'create' && (
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:12 }}>Cipta Kandungan</div>
            {composer && (
              <Card style={{ marginBottom:10 }}>
                <div style={{ fontWeight:800, fontSize:13, color:C.accPale, marginBottom:8 }}>{composer.label}</div>
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Tulis mesej kelas..."
                  style={{
                    width:'100%', minHeight:96, resize:'vertical',
                    background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:10, color:C.text,
                    fontFamily:'Nunito,sans-serif', fontWeight:600, boxSizing:'border-box',
                  }}
                />
                {postStatus && (
                  <div style={{ fontSize:11, color:C.green, fontWeight:800, marginTop:7 }}>
                    {postStatus}
                  </div>
                )}
                {postError && (
                  <div style={{ marginTop:8 }}>
                    <ErrorRetry message={postError} onRetry={submitPost} />
                  </div>
                )}
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <GlowButton onClick={submitPost} disabled={posting || !postText.trim()} style={{ flex:1 }}>
                    {posting ? 'Menghantar...' : 'Hantar'}
                  </GlowButton>
                  <button onClick={() => setComposer(null)} style={{
                    background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:'0 14px', color:C.textMuted,
                    fontFamily:'Nunito', fontWeight:800, cursor:'pointer',
                  }}>Batal</button>
                </div>
              </Card>
            )}
            {[
              { icon:'📢', label:'Pengumuman',    desc:'Hantar mesej kepada kelas'         },
              { icon:'📋', label:'Tugasan',        desc:'Tetapkan tugasan & tarikh hantar'  },
              { icon:'🧪', label:'Kuiz Baru',      desc:'Bina kuiz MCQ atau subjektif'      },
              { icon:'🎬', label:'Video Pelajaran', desc:'Upload video atau kongsi pautan'  },
            ].map((item,i) => (
              <Card key={i} style={{ marginBottom:10, display:'flex', alignItems:'center', gap:12, opacity:createCards[i]?.enabled ? 1 : 0.65 }} onClick={() => openComposer(createCards[i])}>
                <div style={{
                  width:44, height:44, borderRadius:12, flexShrink:0,
                  background:C.accDim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                }}>{item.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{item.label}</div>
                  <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{item.desc}</div>
                </div>
                {!createCards[i]?.enabled && (
                  <div style={{
                    border:`1px solid ${C.border}`, borderRadius:8, padding:'2px 7px',
                    fontSize:10, color:C.textFaint, fontWeight:800,
                  }}>Soon</div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TeacherProfile = ({ displayName }) => {
  const initials = (displayName || 'AI').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
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
        <div style={{ fontWeight:800, fontSize:20, color:C.text }}>Cikgu {displayName}</div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>SMK Seri Tanjung Pinang</div>
        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
          {['📐 Matematik','⚡ Fizik'].map((s,i) => (
            <span key={i} style={{
              background:C.accDim, border:`1px solid ${C.border}`,
              borderRadius:20, padding:'3px 12px',
              fontSize:11, fontWeight:700, color:C.accPale,
            }}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[{v:'83',l:'Pelajar',i:'👥'},{v:'3',l:'Kelas',i:'🏫'},{v:'4.8★',l:'Rating',i:'⭐'}].map((s,i) => (
          <Card key={i} style={{ textAlign:'center', padding:12 }}>
            <div style={{ fontSize:20 }}>{s.i}</div>
            <div style={{ fontWeight:800, fontSize:17, color:C.text }}>{s.v}</div>
            <div style={{ fontSize:9, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>{s.l}</div>
          </Card>
        ))}
      </div>

      <SectionLabel>👤 Maklumat</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        {[
          { label:'Pengalaman',  value:'8 tahun mengajar',         icon:'🎖️' },
          { label:'Kelayakan',   value:'B.Sc Fizik, Universiti Malaya', icon:'🎓' },
          { label:'E-mel',       value: window.tusyenUser?.email || 'azman@smkstg.edu.my', icon:'✉️' },
          { label:'No. Pekerja', value:'T-2847',                   icon:'🪪' },
        ].map((r,i,arr) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10, padding:'9px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ fontSize:18, width:24, textAlign:'center' }}>{r.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:C.textFaint, fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{r.label}</div>
              <div style={{ fontSize:13, color:C.text, fontWeight:700 }}>{r.value}</div>
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>📅 Jadual Minggu Ini</SectionLabel>
      <Card style={{ marginBottom:14, padding:'10px 14px' }}>
        {SCHEDULE.map((s,i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10, padding:'8px 0',
            borderBottom: i < SCHEDULE.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{
              width:8, height:8, borderRadius:'50%', flexShrink:0,
              background: s.color,
              boxShadow:`0 0 6px ${s.color}`,
            }} />
            <div style={{ width:52, fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:0.3 }}>
              {s.day}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{s.cls}</div>
              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{s.time} • {s.room}</div>
            </div>
          </div>
        ))}
      </Card>

      <GlowButton outlined style={{ marginBottom:8 }}>✉️ Hantar Mesej</GlowButton>
      <div style={{ height:8 }} />
    </div>
  );
};

const TeacherApp = () => {
  const [screen, setScreen] = React.useState('home');
  const [cls,    setCls]    = React.useState(null);
  const displayName = window.tusyenUser?.fullName || window.tusyenUser?.email || 'Azman Ibrahim';

  const nav = [
    { id:'home',    icon:'🏫', label:'Kelas'   },
    { id:'class',   icon:'📊', label:'Detail'  },
    { id:'create',  icon:'✏️', label:'Cipta'   },
    { id:'profile', icon:'👤', label:'Profil'  },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <TopBar
        title="Tusyen"
        subtitle={screen === 'home' ? 'Panel Guru' : screen === 'profile' ? `Cikgu ${teacherFirstName(displayName)}` : (cls?.name || 'Kelas')}
        left={screen !== 'home' && screen !== 'profile' && <BackBtn onClick={() => setScreen('home')} />}
        right={<span style={{ fontSize:20, cursor:'pointer', color:C.textMuted }}>🔔</span>}
      />
      {screen === 'home'    && <TeacherHome go={setScreen} setCls={setCls} displayName={displayName} />}
      {(screen === 'class' || screen === 'create') && <TeacherClass cls={cls || CLASSES[0]} />}
      {screen === 'profile' && <TeacherProfile displayName={displayName} />}
      <BottomNav items={nav} active={screen} onSelect={setScreen} />
    </div>
  );
};

window.TeacherApp = TeacherApp;
