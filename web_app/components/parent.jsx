// Tusyen — Parent Role UI v2
// Ported from the Claude Design handoff.

const CHILD = {
  name:'Ahmad Hafiz', form:4, cls:'4A',
  streak:7, xp:2450, weekTime:'8j 42m', rank:4,
  subjects:[
    { name:'Matematik', score:78, color:'#8B5CF6', trend:'↑' },
    { name:'Biologi',   score:65, color:'#22C55E', trend:'↑' },
    { name:'Fizik',     score:42, color:'#38BDF8', trend:'↓' },
    { name:'Kimia',     score:55, color:'#F59E0B', trend:'→' },
    { name:'Sejarah',   score:72, color:'#EF4444', trend:'↑' },
  ],
  activity:[
    { icon:'✅', label:'Selesai pelajaran Matematik Bab 3', time:'2j lepas'    },
    { icon:'🎯', label:'Skor 90% dalam kuiz Biologi',      time:'5j lepas'    },
    { icon:'🔥', label:'Streak 7 hari! Bonus XP diterima', time:'1 hari lepas' },
    { icon:'📝', label:'Mula bab baru: Fizik Bab 5',       time:'2 hari lepas' },
  ],
};

const WEEK_SCORES = {
  Matematik: [72, 75, 71, 78, 80],
  Biologi:   [60, 63, 65, 62, 65],
  Fizik:     [58, 50, 45, 40, 42],
  Kimia:     [52, 55, 54, 55, 55],
  Sejarah:   [68, 70, 72, 71, 72],
};
const WEEK_LABELS = ['I','S','R','K','J'];

const PARENT_ALERTS = [
  {
    icon:'🔴', title:'Prestasi Fizik Merosot',
    desc:'Purata turun dari 58% ke 42% dalam 2 minggu. Disarankan jumpa guru.',
    severity:'high', time:'Hari ini', action:'Hubungi Guru',
  },
  {
    icon:'🟡', title:'Kehadiran Log Masuk Rendah',
    desc:'Ahmad hanya log masuk 2 kali minggu lepas. Galakkan belajar harian.',
    severity:'medium', time:'3 hari lepas', action:'Lihat Jadual',
  },
  {
    icon:'🟢', title:'Streak Tujuh Hari!',
    desc:'Ahmad berjaya mengekalkan streak 7 hari berturut-turut. Tahniah!',
    severity:'good', time:'Semalam', action:null,
  },
  {
    icon:'📋', title:'Kuiz Baharu Dihantar',
    desc:'Cikgu Azman hantar kuiz Geometri untuk Bab 3. Tarikh akhir: Jumaat.',
    severity:'info', time:'2 hari lepas', action:'Lihat Kuiz',
  },
];

const parentLastName = (full) => {
  const parts = (full || '').split(' ').filter(Boolean);
  return parts[parts.length - 1] || 'Hafiz';
};

const postIcon = (type) => {
  switch ((type || '').toLowerCase()) {
    case 'assignment':   return '📋';
    case 'announcement': return '📢';
    case 'general':      return '💬';
    default:             return '✅';
  }
};

const useParentActivity = (defaultActivity) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'parent') return defaultActivity;
    const { posts } = await window.tusyenApi.feedPosts({ limit: 5 });
    const items = (posts || []).slice(0, 5).map(p => ({
      icon:  postIcon(p.post_type),
      label: p.title || p.content?.slice(0, 80) || 'Pos baharu di kelas',
      time:  window.timeAgo(p.created_at),
    }));
    return items.length ? items : defaultActivity;
  }, [defaultActivity], defaultActivity);
};

const useLinkedChild = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'parent') return CHILD;
    const { students } = await window.tusyenApi.linkedStudents();
    const first = (students || [])[0];
    if (!first) return CHILD;
    const next = { ...CHILD, id:first.id, name:first.full_name || CHILD.name };
    try {
      const stats = await window.tusyenApi.studentStats(first.id);
      if (!stats) return next;
      const overall = stats.overall || {};
      const avg = overall.average_score != null ? Math.round(Number(overall.average_score)) : null;
      return {
        ...next,
        streak: Number(stats.streak) || next.streak,
        xp:     Number(stats.quiz?.quizXpTotal) || next.xp,
        avg:    avg ?? next.avg ?? 78,
      };
    } catch (err) {
      return next;
    }
  }, [], CHILD);
};

const useParentAlerts = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'parent') return PARENT_ALERTS;
    const { alerts } = await window.tusyenApi.parentAlerts();
    return Array.isArray(alerts) && alerts.length ? alerts : PARENT_ALERTS;
  }, [], PARENT_ALERTS);
};

const ParentHome = ({ displayName }) => {
  const childState = useLinkedChild();
  const child = childState.data || CHILD;
  const activityState = useParentActivity(child.activity);
  const activity = activityState.data || child.activity;
  return (
  <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>Assalamualaikum,</div>
      <div style={{ fontSize:21, fontWeight:800, color:C.text }}>Encik {parentLastName(displayName)} 👋</div>
    </div>

    {childState.error && (
      <div style={{ marginBottom:14 }}>
        <ErrorRetry message={childState.error.message || 'Tidak dapat memuat anak terpaut.'} onRetry={childState.refresh} />
      </div>
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
        <div>
          <div style={{ fontWeight:800, fontSize:16, color:C.text }}>{child.name}</div>
          <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>Tingkatan {child.form} • Kelas {child.cls}</div>
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <span style={{ fontSize:11, fontWeight:800, color:C.orange, background:'rgba(255,150,0,.12)', borderRadius:20, padding:'2px 9px' }}>🔥 {child.streak} hari</span>
            <span style={{ fontSize:11, fontWeight:800, color:C.gold,   background:'rgba(245,166,35,.12)', borderRadius:20, padding:'2px 9px' }}>⚡ {child.xp} XP</span>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-around', paddingTop:10, borderTop:`1px solid ${C.border}` }}>
        {[{v:`${child.avg ?? 78}%`,l:'Avg Skor'},{v:child.weekTime,l:'Minggu Ini'},{v:`#${child.rank}`,l:'Ranking'}].map((s,i) => (
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ fontWeight:800, fontSize:16, color:C.accPale }}>{s.v}</div>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:700 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </Card>
    )}

    <Card warn style={{ marginBottom:14 }}>
      <div style={{ fontWeight:800, fontSize:11, color:C.orange, textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>⚠️ Perlu Perhatian</div>
      <div style={{ fontSize:13, color:C.text, fontWeight:600, lineHeight:1.5 }}>
        <strong>Fizik</strong> — skor rendah (avg 42%). Disarankan semak semula topik bermasalah bersama guru atau tutor.
      </div>
    </Card>

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
      )) : child.subjects.map((s,i) => (
        <div key={i} style={{ marginBottom: i < child.subjects.length - 1 ? 12 : 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{s.name}</span>
            <span style={{ fontWeight:800, fontSize:13, color: s.score >= 60 ? C.green : C.red }}>
              {s.score}% <span style={{ fontSize:11 }}>{s.trend}</span>
            </span>
          </div>
          <ProgressBar value={s.score} color={s.score >= 60 ? s.color : C.red} height={7} />
        </div>
      ))}
    </Card>

    <SectionLabel>🕐 Aktiviti Terbaru</SectionLabel>
    <Card>
      {activityState.loading ? [0,1,2,3].map(i => (
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
      )) : activity.map((a,i) => (
        <div key={i} style={{
          display:'flex', gap:10, padding:'8px 0',
          borderBottom: i < activity.length - 1 ? `1px solid ${C.border}` : 'none',
          alignItems:'flex-start',
        }}>
          <span style={{ fontSize:17, flexShrink:0, marginTop:1 }}>{a.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:12, color:C.text, lineHeight:1.4 }}>{a.label}</div>
            <div style={{ fontSize:10, color:C.textFaint, marginTop:2 }}>{a.time}</div>
          </div>
        </div>
      ))}
    </Card>
    <div style={{ height:8 }} />
  </div>
  );
};

const ParentProgress = () => {
  const [period, setPeriod] = React.useState('week');
  const childState = useLinkedChild();
  const child = childState.data || CHILD;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['week','📅 Minggu Ini'],['month','📆 Bulan Ini']].map(([p,label]) => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            background: period === p ? C.accDim : 'transparent',
            border:`1.5px solid ${period === p ? C.borderB : C.border}`,
            borderRadius:20, padding:'6px 16px',
            fontSize:12, fontWeight:700, cursor:'pointer',
            color: period === p ? C.accPale : C.textMuted,
            fontFamily:'Nunito', transition:'all .2s',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { v:'8j 42m', l:'Masa Belajar', i:'⏱️', c:C.acc   },
          { v:'14',     l:'Pelajaran',    i:'📚', c:C.blue  },
          { v:'78%',    l:'Avg Skor',     i:'📊', c:C.green },
          { v:'#4',     l:'Ranking',      i:'🏆', c:C.gold  },
        ].map((s,i) => (
          <Card key={i} style={{ padding:12, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:26 }}>{s.i}</span>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:s.c, lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>{s.l}</div>
            </div>
          </Card>
        ))}
      </div>

      <SectionLabel>📈 Trend Prestasi — {period === 'week' ? 'Minggu Ini' : 'Bulan Ini'}</SectionLabel>
      {child.subjects.map((s, si) => {
        const scores  = WEEK_SCORES[s.name] || Array(5).fill(s.score);
        const latest  = scores[scores.length - 1];
        const prev    = scores[scores.length - 2];
        const delta   = latest - prev;
        const tColor  = delta > 0 ? C.green : delta < 0 ? C.red : C.textMuted;
        const tArrow  = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

        return (
          <Card key={si} style={{ marginBottom:10, padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{s.name}</div>
              <div style={{ fontWeight:800, fontSize:13, color:tColor }}>{latest}% {tArrow}</div>
            </div>

            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:44 }}>
              {scores.map((score, i) => {
                const isLast = i === scores.length - 1;
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{
                      width:'100%', borderRadius:'3px 3px 0 0',
                      height:`${(score / 100) * 36}px`,
                      minHeight:3,
                      background: isLast
                        ? `linear-gradient(180deg, ${s.color}, color-mix(in srgb,${s.color} 55%,transparent))`
                        : `color-mix(in srgb,${s.color} 28%,transparent)`,
                      border:`1px solid ${isLast
                        ? s.color
                        : `color-mix(in srgb,${s.color} 20%,transparent)`}`,
                      transition:'height .5s ease',
                    }} />
                    <div style={{ fontSize:8, color:C.textFaint, fontWeight:700 }}>{WEEK_LABELS[i]}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <div style={{ height:8 }} />
    </div>
  );
};

const ParentAlerts = () => {
  const alertsState = useParentAlerts();
  const childState = useLinkedChild();
  const alerts = alertsState.data || PARENT_ALERTS;
  const child = childState.data || CHILD;
  return (
  <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
    <div style={{ marginBottom:14 }}>
      <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Amaran & Notifikasi</div>
      <div style={{ fontSize:12, color:C.textMuted, fontWeight:600, marginTop:2 }}>{child.name} • Tingkatan {child.form}</div>
    </div>

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
    )) : alerts.map((alert, i) => {
      const palette = {
        high:   { border:'rgba(239,68,68,.35)',  bg:'rgba(239,68,68,.06)',  title:C.red,      btn:C.red    },
        medium: { border:'rgba(245,158,11,.35)', bg:'rgba(245,158,11,.06)', title:C.orange,   btn:C.orange },
        good:   { border:'rgba(34,197,94,.35)',  bg:'rgba(34,197,94,.06)',  title:C.green,    btn:C.green  },
        info:   { border:C.border,               bg:C.card,                 title:C.accPale,  btn:C.acc    },
      }[alert.severity];

      return (
        <div key={i} style={{
          background:palette.bg, border:`1px solid ${palette.border}`,
          borderRadius:16, padding:14, marginBottom:10,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
              <span style={{ fontSize:18 }}>{alert.icon}</span>
              <div style={{ fontWeight:800, fontSize:14, color:palette.title }}>{alert.title}</div>
            </div>
            <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, flexShrink:0, marginLeft:8 }}>{alert.time}</div>
          </div>
          <div style={{ fontSize:12, color:C.text, fontWeight:600, lineHeight:1.5, paddingLeft:26 }}>{alert.desc}</div>
          {alert.action && (
            <div style={{ paddingLeft:26, marginTop:10 }}>
              <button style={{
                background:`color-mix(in srgb,${palette.btn} 12%,transparent)`,
                border:`1px solid color-mix(in srgb,${palette.btn} 35%,transparent)`,
                borderRadius:10, padding:'6px 14px',
                fontSize:11, fontWeight:800, color:palette.btn,
                cursor:'pointer', fontFamily:'Nunito',
              }}>{alert.action}</button>
            </div>
          )}
        </div>
      );
    })}
    <div style={{ height:8 }} />
  </div>
  );
};

const ParentApp = () => {
  const [screen, setScreen] = React.useState('home');
  const displayName = window.tusyenUser?.fullName || window.tusyenUser?.email || 'Hafiz';
  const nav = [
    { id:'home',     icon:'🏠', label:'Utama'    },
    { id:'progress', icon:'📈', label:'Kemajuan' },
    { id:'alerts',   icon:'🔔', label:'Amaran'   },
    { id:'settings', icon:'⚙️', label:'Tetapan'  },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <TopBar title="Tusyen" subtitle="Pemantauan Ibu Bapa" />
      {screen === 'home'     && <ParentHome displayName={displayName} />}
      {screen === 'progress' && <ParentProgress />}
      {screen === 'alerts'   && <ParentAlerts />}
      {screen === 'settings' && (
        <EmptyState icon="⚙️" title="Tetapan" subtitle="Urus notifikasi, bahasa, dan pilihan akaun." />
      )}
      <BottomNav items={nav} active={screen} onSelect={setScreen} />
    </div>
  );
};

window.ParentApp = ParentApp;
