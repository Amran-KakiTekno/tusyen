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
  <div style={{
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'10px 18px', minHeight:52, flexShrink:0,
    background:C.surface, borderBottom:`1px solid ${C.border}`,
  }}>
    <div style={{ width:36 }}>{left}</div>
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontWeight:800, fontSize:16, color:C.text, lineHeight:1.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginTop:1 }}>{subtitle}</div>}
    </div>
    <div style={{ width:36, display:'flex', justifyContent:'flex-end', alignItems:'center' }}>{right}</div>
  </div>
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
        <button key={item.id} onClick={() => onSelect(item.id)} style={{
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
          <span style={{
            fontSize:22,
            filter: on ? `drop-shadow(0 0 7px ${C.accGlow})` : 'none',
            transition:'filter 0.2s',
          }}>{item.icon}</span>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:0.2 }}>{item.label}</span>
        </button>
      );
    })}
  </div>
);

const StatPill = ({ icon, value, color, label }) => (
  <div style={{
    display:'flex', alignItems:'center', gap:5,
    background:`color-mix(in srgb, ${color} 12%, transparent)`,
    border:`1.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
    borderRadius:99, padding:'5px 10px', whiteSpace:'nowrap',
  }}>
    <span style={{ fontSize:15 }}>{icon}</span>
    <div>
      <div style={{ fontWeight:800, fontSize:14, color, lineHeight:1 }}>{value}</div>
      {label && <div style={{ fontSize:9, color:C.textMuted, fontWeight:700, lineHeight:1 }}>{label}</div>}
    </div>
  </div>
);

const ProgressBar = ({ value, max=100, color, height=8, style:sx={} }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height, borderRadius:999, background:C.accDim, overflow:'hidden', ...sx }}>
      <div style={{
        height:'100%', width:`${pct}%`, borderRadius:999,
        background:`linear-gradient(90deg, var(--c-acc-lo), var(--c-acc))`,
        boxShadow:`0 0 10px ${C.accGlow}`,
        transition:'width 0.6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  );
};

const Card = ({ children, style:sx={}, onClick, warn, success }) => {
  const [hov, setHov] = React.useState(false);
  const isClick = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => isClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: warn ? 'rgba(239,68,68,0.06)' : success ? 'rgba(34,197,94,0.06)' : C.card,
        border:`1px solid ${
          warn    ? 'rgba(239,68,68,0.25)'  :
          success ? 'rgba(34,197,94,0.25)'  :
          hov     ? 'rgba(139,92,246,.44)'  : C.border
        }`,
        borderRadius:16, padding:14,
        cursor: isClick ? 'pointer' : 'default',
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? '0 6px 24px rgba(139,92,246,.14)' : 'none',
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
    width:'100%', opacity: disabled ? 0.5 : 1,
    boxShadow: outlined ? 'none' : '0 4px 24px var(--c-acc-glow)',
    transition:'opacity .2s, transform .1s', letterSpacing:0.3, ...sx,
  }}>{children}</button>
);

const Avatar = ({ name='?', size=40 }) => (
  <div style={{
    width:size, height:size, borderRadius:'50%', flexShrink:0,
    background:'linear-gradient(135deg, var(--c-acc-lo), var(--c-acc-hi))',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:800, fontSize:size * 0.36, color:'#fff',
    border:`2px solid color-mix(in srgb, var(--c-acc) 30%, transparent)`,
  }}>
    {name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
  </div>
);

const BackBtn = ({ onClick }) => (
  <button onClick={onClick} style={{
    background:C.accDim, border:`1px solid ${C.border}`,
    borderRadius:10, padding:'5px 11px',
    color:C.accPale, cursor:'pointer', fontSize:18,
    fontFamily:'Nunito, sans-serif', lineHeight:1,
  }}>‹</button>
);

const SectionLabel = ({ children }) => (
  <div style={{
    fontWeight:800, fontSize:11, color:C.textMuted,
    textTransform:'uppercase', letterSpacing:0.8, marginBottom:9,
  }}>{children}</div>
);

const NotifBell = ({ count=0, onClick }) => (
  <button onClick={onClick} style={{
    background:'none', border:'none', cursor:'pointer',
    position:'relative', padding:2, lineHeight:1, fontSize:20,
  }}>
    🔔
    {count > 0 && (
      <span style={{
        position:'absolute', top:-1, right:-1,
        minWidth:15, height:15, borderRadius:99,
        background:C.red, border:`1.5px solid ${C.surface}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:8, fontWeight:800, color:'#fff', padding:'0 2px',
      }}>{count > 9 ? '9+' : count}</span>
    )}
  </button>
);

const NotifPanel = ({ notifs, onClose }) => (
  <div className="tv2-slidedown" style={{
    position:'absolute', inset:0, zIndex:200,
    background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden',
  }}>
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'14px 18px', borderBottom:`1px solid ${C.border}`,
      background:C.surface, flexShrink:0,
    }}>
      <div style={{ fontWeight:800, fontSize:16, color:C.text }}>Notifikasi</div>
      <button onClick={onClose} style={{
        background:C.accDim, border:`1px solid ${C.border}`, borderRadius:8,
        padding:'5px 14px', color:C.textMuted, cursor:'pointer',
        fontSize:12, fontWeight:700, fontFamily:'Nunito',
      }}>Tutup</button>
    </div>
    <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
      {notifs.map((n, i) => (
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
);

const EmptyState = ({ icon, title, subtitle }) => (
  <div style={{
    flex:1, display:'flex', flexDirection:'column', alignItems:'center',
    justifyContent:'center', gap:10, padding:32, textAlign:'center',
  }}>
    <div style={{ fontSize:48 }}>{icon}</div>
    <div style={{ fontWeight:800, fontSize:17, color:C.text }}>{title}</div>
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
          color:C.red, fontFamily:'Nunito', fontWeight:800,
          fontSize:11, cursor:'pointer', flexShrink:0,
        }}>Cuba lagi</button>
      )}
    </div>
  </Card>
);

Object.assign(window, {
  C, TopBar, BottomNav, StatPill, ProgressBar,
  Card, GlowButton, Avatar, BackBtn, SectionLabel,
  useCountUp, useAsync, timeAgo, Skeleton, ErrorRetry,
  NotifBell, NotifPanel, EmptyState,
});
