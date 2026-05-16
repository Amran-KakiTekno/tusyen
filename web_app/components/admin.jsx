// Tusyen — Admin Role UI v2
// Ported from the Claude Design handoff. Pulls real platform stats when the API is reachable.

const SYS_FALLBACK = { students:247, teachers:18, parents:189, active:94 };

const METRICS_FALLBACK = [
  { label:'Pangkalan Data', val:99, color:'#22C55E', unit:'%', hint:'connected' },
  { label:'Cache (Redis)',  val:99, color:'#38BDF8', unit:'%', hint:'connected' },
  { label:'Notifikasi',     val:99, color:'#A78BFA', unit:'%', hint:'connected' },
  { label:'Storan',         val:28, color:'#F59E0B', unit:'%', hint:'—' },
];

const useAdminHealth = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return METRICS_FALLBACK;
    const h = await window.tusyenApi.adminHealth();
    if (!h) return METRICS_FALLBACK;
    const upDb     = h.database === 'connected';
    const upCache  = h.cache    === 'connected';
    const upNotif  = (h.notifications?.status || 'unknown') === 'connected' ||
                     (h.notifications?.status || 'unknown') === 'ok';
    const dbSize   = h.storage?.database_size || '—';
    return [
      { label:'Pangkalan Data', val: upDb    ? 100 : 5, color: upDb    ? '#22C55E' : '#EF4444', unit:'%', hint: h.database || (upDb ? 'connected' : 'error') },
      { label:'Cache (Redis)',  val: upCache ? 100 : 5, color: upCache ? '#38BDF8' : '#EF4444', unit:'%', hint: h.cache    || (upCache ? 'connected' : 'error') },
      { label:'Notifikasi',     val: upNotif ? 100 : 5, color: upNotif ? '#A78BFA' : '#F59E0B', unit:'%', hint: h.notifications?.status || (upNotif ? 'connected' : 'degraded') },
      { label:'Storan',         val: 60,                color:'#F59E0B', unit:'',   hint: dbSize },
    ];
  }, [], METRICS_FALLBACK);
};

const LOGS = [
  { type:'info',    msg:'Pelajar baru daftar: Nurul Huda',      time:'5m lepas'  },
  { type:'success', msg:'Sinkronisasi berjaya: 89 peranti',     time:'12m lepas' },
  { type:'warn',    msg:'Penggunaan RAM mencecah 61%',          time:'25m lepas' },
  { type:'info',    msg:'Guru baru: Cikgu Rosmah daftar masuk', time:'1j lepas'  },
  { type:'success', msg:'Backup pangkalan data berjaya',        time:'2j lepas'  },
  { type:'info',    msg:'47 pelajar log masuk hari ini',        time:'3j lepas'  },
];

const ALL_USERS = [
  { name:'Ahmad Hafiz',   role:'Pelajar',   cls:'4A', last:'5 min lepas',  active:true  },
  { name:'Siti Nora',     role:'Pelajar',   cls:'4A', last:'12 min lepas', active:true  },
  { name:'Haziq Razif',   role:'Pelajar',   cls:'4B', last:'1j lepas',     active:false },
  { name:'Nurul Ain',     role:'Pelajar',   cls:'4A', last:'5 hari lepas', active:false },
  { name:'Izzat Faiz',    role:'Pelajar',   cls:'4B', last:'2j lepas',     active:false },
  { name:'Cikgu Azman',   role:'Guru',      cls:'-',  last:'30 min lepas', active:true  },
  { name:'Cikgu Rosmah',  role:'Guru',      cls:'-',  last:'2j lepas',     active:false },
  { name:'Encik Hafiz',   role:'Ibu Bapa',  cls:'-',  last:'1 hari lepas', active:false },
  { name:'Puan Salmah',   role:'Ibu Bapa',  cls:'-',  last:'3 hari lepas', active:false },
];

const ROLE_STYLE = {
  'Pelajar':  { bg:'rgba(139,92,246,.12)', border:'rgba(139,92,246,.3)', text:'#A78BFA' },
  'Guru':     { bg:'rgba(56,189,248,.12)', border:'rgba(56,189,248,.3)', text:'#38BDF8' },
  'Ibu Bapa': { bg:'rgba(245,166,35,.12)', border:'rgba(245,166,35,.3)', text:'#F5A623' },
  'Admin':    { bg:'rgba(34,197,94,.12)', border:'rgba(34,197,94,.3)', text:'#22C55E' },
};

const logIcon  = t => t === 'success' ? '✅' : t === 'warn' ? '⚠️' : 'ℹ️';

const ROLE_LABEL = { student:'Pelajar', teacher:'Guru', parent:'Ibu Bapa', admin:'Admin' };
const ROLE_VALUE = { 'Pelajar':'student', 'Guru':'teacher', 'Ibu Bapa':'parent', 'Admin':'admin' };

const mapAdminUser = (u) => ({
  id: u.id,
  name: u.full_name || u.fullName || u.email || 'Pengguna',
  email: u.email,
  role: ROLE_LABEL[u.role] || u.role || 'Pelajar',
  roleValue: ROLE_VALUE[u.role] || u.role || 'student',
  cls: '-',
  last: u.last || window.timeAgo(u.last_login) || 'Belum log masuk',
  active: Boolean(u.is_active ?? u.active),
});

const useAdminStats = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return SYS_FALLBACK;
    const { stats: s } = await window.tusyenApi.adminStats();
    if (!s) return SYS_FALLBACK;
    return {
      students: Number(s.total_students)     || SYS_FALLBACK.students,
      teachers: Number(s.total_teachers)     || SYS_FALLBACK.teachers,
      parents:  Number(s.total_parents)      || SYS_FALLBACK.parents,
      active:   Number(s.activities_today)   || SYS_FALLBACK.active,
    };
  }, [], SYS_FALLBACK);
};

const AdminDash = ({ go }) => {
  const statsState = useAdminStats();
  const healthState = useAdminHealth();
  const SYS = statsState.data || SYS_FALLBACK;
  const METRICS = healthState.data || METRICS_FALLBACK;
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>Panel Admin</div>
          <div style={{ fontSize:21, fontWeight:800, color:C.text }}>Tusyen Online 🛡️</div>
        </div>
        <div style={{
          background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.35)',
          borderRadius:20, padding:'5px 12px',
          fontSize:12, fontWeight:800, color:C.green, display:'flex', alignItems:'center', gap:6,
        }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:C.green, display:'inline-block' }} />
          Sistem Aktif
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        {statsState.loading ? [0,1,2,3].map(i => (
          <Card key={i} style={{ padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <Skeleton width={58} height={26} radius={8} style={{ marginBottom:8 }} />
                <Skeleton width="68%" height={12} radius={6} />
              </div>
              <Skeleton width={24} height={24} radius={8} />
            </div>
          </Card>
        )) : [
          { v:SYS.students, l:'Pelajar',       i:'🎓', c:C.acc   },
          { v:SYS.teachers, l:'Guru',           i:'👨‍🏫', c:C.blue  },
          { v:SYS.parents,  l:'Ibu Bapa',       i:'👪', c:C.gold  },
          { v:SYS.active,   l:'Aktif Hari Ini', i:'🟢', c:C.green },
        ].map((s,i) => (
          <Card key={i} style={{ padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:26, color:s.c, lineHeight:1 }}>{s.v}</div>
                <div style={{ fontSize:12, color:C.textMuted, fontWeight:700, marginTop:3 }}>{s.l}</div>
              </div>
              <span style={{ fontSize:22 }}>{s.i}</span>
            </div>
          </Card>
        ))}
      </div>

      <SectionLabel>🖥️ Kesihatan Sistem</SectionLabel>
      <Card style={{ marginBottom:14, padding:'12px 14px' }}>
        {healthState.loading ? [0,1,2,3].map(i => (
          <div key={i} style={{ marginBottom: i < 3 ? 12 : 0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
              <Skeleton width={116} height={13} radius={7} />
              <Skeleton width={72} height={13} radius={7} />
            </div>
            <Skeleton width="100%" height={8} radius={999} />
          </div>
        )) : METRICS.map((m,i) => (
          <div key={i} style={{ marginBottom: i < METRICS.length - 1 ? 12 : 0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{m.label}</span>
              <span style={{ fontWeight:800, fontSize:13, color:m.color }}>{m.hint ?? `${m.val}${m.unit}`}</span>
            </div>
            <div style={{ height:8, borderRadius:999, background:C.accDim, overflow:'hidden' }}>
              <div style={{
                height:'100%', width:`${m.val}%`, borderRadius:999,
                background:`linear-gradient(90deg, color-mix(in srgb,${m.color} 60%,#000), ${m.color})`,
                boxShadow:`0 0 8px ${m.color}80`,
                transition:'width .6s ease',
              }} />
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>📋 Log Sistem</SectionLabel>
      <Card style={{ marginBottom:14, padding:'10px 14px' }}>
        {(statsState.loading || healthState.loading) ? [0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            display:'flex', gap:8, padding:'6px 0',
            borderBottom: i < 5 ? `1px solid ${C.border}` : 'none',
            alignItems:'flex-start',
          }}>
            <Skeleton width={16} height={16} radius={5} />
            <div style={{ flex:1 }}>
              <Skeleton width={i % 2 ? '72%' : '86%'} height={12} radius={6} style={{ marginBottom:6 }} />
              <Skeleton width={54} height={10} radius={5} />
            </div>
          </div>
        )) : LOGS.map((log,i) => (
          <div key={i} style={{
            display:'flex', gap:8, padding:'6px 0',
            borderBottom: i < LOGS.length - 1 ? `1px solid ${C.border}` : 'none',
            alignItems:'flex-start',
          }}>
            <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{logIcon(log.type)}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:C.text, fontWeight:600, lineHeight:1.3 }}>{log.msg}</div>
              <div style={{ fontSize:10, color:C.textFaint, marginTop:1 }}>{log.time}</div>
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>⚡ Tindakan Pantas</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        {[
          { icon:'👥', label:'Urus Pengguna',   screen:'users'   },
          { icon:'📚', label:'Kelola Silibus',  screen:'content' },
          { icon:'🔄', label:'Paksa Sinkron',   screen:null      },
          { icon:'🗑️', label:'Bersih Cache',    screen:null      },
        ].map((a,i) => (
          <Card key={i} style={{ padding:12, textAlign:'center' }} onClick={() => a.screen && go(a.screen)}>
            <div style={{ fontSize:24, marginBottom:4 }}>{a.icon}</div>
            <div style={{ fontSize:12, fontWeight:800, color:C.text }}>{a.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const useAdminUsers = (filter) => {
  const fallback = ALL_USERS.map(mapAdminUser);
  const state = useAsync(async () => {
    if (window.tusyenUser?.role !== 'admin') return fallback;
    const role = filter === 'Semua' ? undefined : ROLE_VALUE[filter];
    const { users } = await window.tusyenApi.adminUsers({ role });
    const mapped = (users || []).map(mapAdminUser);
    return mapped.length ? mapped : fallback;
  }, [filter], fallback);
  return { users: state.data || fallback, loading: state.loading, error: state.error, refresh: state.refresh };
};

const AdminUsers = () => {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('Semua');
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [mutationError, setMutationError] = React.useState(null);
  const filters = ['Semua','Pelajar','Guru','Ibu Bapa','Admin'];
  const { users, loading, refresh } = useAdminUsers(filter);

  const filtered = users.filter(u => {
    const matchRole   = filter === 'Semua' || u.role === filter;
    const haystack = `${u.name} ${u.email || ''}`.toLowerCase();
    const matchSearch = haystack.includes(search.toLowerCase());
    return matchRole && matchSearch;
  });
  const startEdit = (u) => {
    setEditing({ ...u, fullName: u.name, isActive: u.active, roleValue: u.roleValue });
    setMessage('');
    setMutationError(null);
  };
  const saveEdit = async () => {
    if (!editing?.id) return;
    setSaving(true);
    setMessage('');
    setMutationError(null);
    try {
      await window.tusyenApi.updateUser(editing.id, {
        fullName: editing.fullName,
        role: editing.roleValue,
        isActive: editing.isActive,
      });
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
      refresh();
    } catch (err) {
      setMutationError({ message: err.message || 'Tidak dapat menukar status.', retry: () => toggleStatus(u) });
    }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 16px 0', flexShrink:0 }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background:C.card, border:`1px solid ${C.border}`,
          borderRadius:12, padding:'8px 12px', marginBottom:10,
        }}>
          <span style={{ fontSize:15, opacity:.5 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari pengguna..."
            style={{
              flex:1, background:'none', border:'none', outline:'none',
              fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:600, color:C.text,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:14, color:C.textFaint, fontFamily:'Nunito', padding:0,
            }}>✕</button>
          )}
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? C.accDim : 'transparent',
              border:`1.5px solid ${filter === f ? C.borderB : C.border}`,
              borderRadius:20, padding:'4px 14px',
              fontSize:11, fontWeight:700, cursor:'pointer',
              color: filter === f ? C.accPale : C.textMuted,
              fontFamily:'Nunito', whiteSpace:'nowrap', transition:'all .2s',
            }}>{f}</button>
          ))}
        </div>

        <div style={{ fontSize:11, color:C.textFaint, fontWeight:600, marginBottom:8 }}>
          {filtered.length} pengguna ditemui
        </div>
        {message && (
          <div style={{ fontSize:11, color:C.green, fontWeight:800, marginBottom:8 }}>
            {message}
          </div>
        )}
        {mutationError && (
          <div style={{ marginBottom:8 }}>
            <ErrorRetry message={mutationError.message} onRetry={mutationError.retry} />
          </div>
        )}
        {editing && (
          <Card style={{ marginBottom:10 }}>
            <div style={{ fontWeight:800, fontSize:13, color:C.accPale, marginBottom:8 }}>Edit Pengguna</div>
            <input
              value={editing.fullName}
              onChange={e => setEditing(prev => ({ ...prev, fullName:e.target.value }))}
              style={{
                width:'100%', boxSizing:'border-box', marginBottom:8,
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
                padding:'8px 10px', color:C.text, fontFamily:'Nunito', fontWeight:700,
              }}
            />
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <select
                value={editing.roleValue}
                onChange={e => setEditing(prev => ({ ...prev, roleValue:e.target.value }))}
                style={{
                  flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:'8px 10px', color:C.text, fontFamily:'Nunito', fontWeight:700,
                }}
              >
                <option value="student">Pelajar</option>
                <option value="teacher">Guru</option>
                <option value="parent">Ibu Bapa</option>
                <option value="admin">Admin</option>
              </select>
              <label style={{
                display:'flex', alignItems:'center', gap:6, color:C.textMuted,
                fontSize:12, fontWeight:800,
              }}>
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={e => setEditing(prev => ({ ...prev, isActive:e.target.checked }))}
                />
                Aktif
              </label>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <GlowButton onClick={saveEdit} disabled={saving} style={{ flex:1 }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </GlowButton>
              <button onClick={() => setEditing(null)} style={{
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
                padding:'0 14px', color:C.textMuted, fontFamily:'Nunito', fontWeight:800,
                cursor:'pointer',
              }}>Batal</button>
            </div>
          </Card>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 10px' }}>
        {loading ? [0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 0',
            borderBottom: i < 5 ? `1px solid ${C.border}` : 'none',
          }}>
            <Skeleton width={38} height={38} radius={19} />
            <div style={{ flex:1, minWidth:0 }}>
              <Skeleton width={i % 2 ? '48%' : '62%'} height={13} radius={7} style={{ marginBottom:7 }} />
              <Skeleton width="42%" height={10} radius={5} />
            </div>
            <Skeleton width={58} height={22} radius={8} />
            <Skeleton width={48} height={24} radius={8} />
            <Skeleton width={30} height={24} radius={8} />
          </div>
        )) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:C.textFaint, fontSize:13, fontWeight:600 }}>
            Tiada pengguna ditemui
          </div>
        ) : filtered.map((u, i) => {
          const rs = ROLE_STYLE[u.role] || ROLE_STYLE.Pelajar;
          return (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 0',
              borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <Avatar name={u.name} size={38} />
                {u.active && (
                  <div style={{
                    position:'absolute', bottom:0, right:0,
                    width:10, height:10, borderRadius:'50%',
                    background:C.green, border:`2px solid ${C.bg}`,
                  }} />
                )}
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{u.name}</div>
                <div style={{ fontSize:10, color:C.textFaint, fontWeight:600, marginTop:1 }}>
                  {u.cls !== '-' ? `Kelas ${u.cls} • ` : ''}{u.last}
                </div>
              </div>

              <div style={{
                background:rs.bg, border:`1px solid ${rs.border}`,
                borderRadius:8, padding:'3px 9px', flexShrink:0,
                fontSize:10, fontWeight:800, color:rs.text,
              }}>{u.role}</div>

              <button onClick={() => toggleStatus(u)} style={{
                background:u.active ? 'rgba(239,68,68,.10)' : 'rgba(34,197,94,.10)',
                border:`1px solid ${u.active ? 'rgba(239,68,68,.28)' : 'rgba(34,197,94,.28)'}`,
                borderRadius:8, padding:'5px 8px', cursor:u.id ? 'pointer' : 'not-allowed',
                fontSize:10, color:u.active ? C.red : C.green, flexShrink:0, fontWeight:800,
              }}>{u.active ? 'Lumpuh' : 'Aktif'}</button>

              <button onClick={() => startEdit(u)} style={{
                background:C.accDim, border:`1px solid ${C.border}`,
                borderRadius:8, padding:'5px 8px', cursor:'pointer',
                fontSize:13, color:C.textMuted, flexShrink:0,
              }}>✏️</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminApp = () => {
  const [screen, setScreen] = React.useState('home');
  const nav = [
    { id:'home',     icon:'📊', label:'Papan Pemuka' },
    { id:'users',    icon:'👥', label:'Pengguna'     },
    { id:'content',  icon:'📚', label:'Kandungan'    },
    { id:'settings', icon:'⚙️', label:'Sistem'       },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <TopBar
        title="Tusyen Admin"
        subtitle={screen === 'home' ? 'Papan Pemuka' : screen === 'users' ? 'Pengurusan Pengguna' : 'Pengurusan'}
      />
      {screen === 'home'     && <AdminDash go={setScreen} />}
      {screen === 'users'    && <AdminUsers />}
      {screen === 'content'  && <EmptyState icon="📚" title="Kandungan" subtitle="Urus silibus, pelajaran, dan kuiz yang diterbitkan." />}
      {screen === 'settings' && <EmptyState icon="⚙️" title="Sistem" subtitle="Konfigurasi pelayan, sandaran, dan keselamatan." />}
      <BottomNav items={nav} active={screen} onSelect={setScreen} />
    </div>
  );
};

window.AdminApp = AdminApp;
