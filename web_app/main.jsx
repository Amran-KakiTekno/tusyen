const ROLES = [
  { id:'student', label:'🎓 Pelajar'   },
  { id:'teacher', label:'👨‍🏫 Guru'    },
  { id:'parent',  label:'👪 Ibu Bapa'  },
  { id:'admin',   label:'🛡️ Admin'     },
];
const LOCAL_QA_HOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const SHOW_ADMIN_DEMO = LOCAL_QA_HOST && new URLSearchParams(window.location.search).get('demoAdmin') === '1';
const GUIDE_QUERY_KEY = 'guide';

const isGuideRoute = () => new URLSearchParams(window.location.search).get(GUIDE_QUERY_KEY) === '1';

const guideHref = (showGuide) => {
  const url = new URL(window.location.href);
  if (showGuide) url.searchParams.set(GUIDE_QUERY_KEY, '1');
  else url.searchParams.delete(GUIDE_QUERY_KEY);
  url.hash = '';
  return url.toString();
};

const setGuideRoute = (showGuide) => {
  window.history.pushState(
    { publicPage: showGuide ? 'guide' : 'login' },
    '',
    guideHref(showGuide)
  );
};

const GUIDE_BASICS = [
  {
    title:'1. Masuk atau daftar',
    titleEn:'1. Sign in or register',
    text:'Gunakan e-mel dan kata laluan. Pilih peranan yang betul semasa daftar supaya ruang kerja yang dibuka sepadan dengan akaun.',
    textEn:'Use email and password. Pick the correct role during registration so the right workspace opens for the account.',
  },
  {
    title:'2. Gunakan navigasi utama',
    titleEn:'2. Use the main navigation',
    text:'Selepas log masuk, pilih menu di tepi atau bar bawah untuk bergerak antara kelas, pembelajaran, kuiz, kemajuan, dan tetapan.',
    textEn:'After signing in, use the side menu or bottom bar to move between classes, learning, quizzes, progress, and settings.',
  },
  {
    title:'3. Semak tindakan seterusnya',
    titleEn:'3. Check the next action',
    text:'Mulakan dengan kelas aktif, tugasan terkini, amaran penting, atau papan pemuka mengikut peranan anda.',
    textEn:'Start with active classes, recent assignments, important alerts, or the dashboard for your role.',
  },
];

const GUIDE_ROLES = [
  {
    id:'student',
    label:'Pelajar',
    en:'Student',
    tone:'blue',
    intro:'Fokus kepada kelas, pembelajaran harian, kuiz, dan kemajuan sendiri.',
    introEn:'Focus on classes, daily learning, quizzes, and personal progress.',
    steps:[
      'Sertai kelas menggunakan kod yang diberikan oleh guru.',
      'Buka Belajar untuk melihat pelajaran yang diberi kepada kelas.',
      'Jawab latihan atau kuiz, kemudian hantar jawapan apabila selesai.',
      'Semak Kemajuan untuk XP, streak, pencapaian, dan topik yang perlu diulang kaji.',
    ],
    stepsEn:[
      'Join a class using the code provided by the teacher.',
      'Open Learning to view lessons assigned to the class.',
      'Answer exercises or quizzes, then submit when finished.',
      'Check Progress for XP, streak, achievements, and topics to review.',
    ],
  },
  {
    id:'teacher',
    label:'Guru',
    en:'Teacher',
    tone:'green',
    intro:'Sediakan kelas, kandungan, kuiz langsung, papan putih, dan semakan prestasi pelajar.',
    introEn:'Set up classes, content, live quizzes, whiteboards, and student performance reviews.',
    steps:[
      'Cipta kelas dan tetapkan subjek, tingkatan, serta penerangan yang jelas.',
      'Kongsi kod kelas kepada pelajar atau urus senarai pelajar daripada halaman kelas.',
      'Tetapkan pelajaran, cipta pos kelas, atau jalankan kuiz langsung apabila diperlukan.',
      'Semak analitik kelas untuk mengenal pasti pelajar yang perlukan bantuan.',
    ],
    stepsEn:[
      'Create a class and set the subject, form level, and clear description.',
      'Share the class code with students or manage students from the class page.',
      'Assign lessons, create class posts, or run live quizzes when needed.',
      'Review class analytics to identify students who need support.',
    ],
  },
  {
    id:'parent',
    label:'Ibu Bapa',
    en:'Parent',
    tone:'gold',
    intro:'Pantau perkembangan anak, amaran pembelajaran, dan tindakan susulan.',
    introEn:'Monitor child progress, learning alerts, and follow-up actions.',
    steps:[
      'Pautkan akaun anak menggunakan maklumat yang diberikan oleh sekolah atau pusat tuisyen.',
      'Buka paparan anak untuk melihat kemajuan, tugasan, dan kehadiran pembelajaran.',
      'Semak amaran atau notifikasi yang memerlukan perhatian.',
      'Gunakan tindakan susulan untuk merekod sokongan atau perkara yang perlu dibincang.',
    ],
    stepsEn:[
      'Link a child account using details provided by the school or tuition centre.',
      'Open the child view to see progress, assignments, and learning activity.',
      'Review alerts or notifications that need attention.',
      'Use follow-up actions to record support or items to discuss.',
    ],
  },
  {
    id:'admin',
    label:'Admin',
    en:'Admin',
    tone:'red',
    intro:'Urus pengguna, pautan keluarga, kelas, kandungan, dan kesihatan sistem.',
    introEn:'Manage users, family links, classes, content, and system health.',
    steps:[
      'Semak papan pemuka operasi untuk status sistem dan aktiviti terkini.',
      'Urus akaun pengguna, status aktif, peranan, dan pautan ibu bapa-pelajar.',
      'Semak kelas dan kandungan pembelajaran supaya data kekal kemas.',
      'Gunakan halaman Sistem untuk log, cache, notifikasi ujian, dan kesihatan perkhidmatan.',
    ],
    stepsEn:[
      'Check the operations dashboard for system status and recent activity.',
      'Manage user accounts, active status, roles, and parent-student links.',
      'Review classes and learning content so data stays clean.',
      'Use the System page for logs, cache, test notifications, and service health.',
    ],
  },
];

const GuidePage = ({ onBackToLogin, loginHref }) => {
  const { language, t } = useLanguage();
  return (
    <main id="main-content" className="guide-shell" tabIndex="-1" aria-labelledby="guide-title">
      <header className="guide-topbar">
        <a className="guide-brand" href={loginHref} onClick={onBackToLogin} aria-label={t('Kembali ke log masuk Tusyen', 'Back to Tusyen login')}>
          <span className="guide-mark" aria-hidden="true">T</span>
          <span>Tusyen</span>
        </a>
        <div className="guide-topbar-actions">
          <LanguageToggle compact />
          <a className="guide-login-link" href={loginHref} onClick={onBackToLogin}>{t('Log Masuk', 'Sign In')}</a>
        </div>
      </header>

      <section className="guide-hero" aria-labelledby="guide-title">
        <div className="guide-hero-copy">
          <div className="guide-eyebrow">{t('Panduan Penggunaan', 'User Guide')}</div>
          <h1 id="guide-title">{t('Cara mula menggunakan Tusyen', 'How to get started with Tusyen')}</h1>
          <p>
            {t(
              'Satu halaman ringkas untuk faham laluan utama dalam aplikasi sebelum log masuk: pelajar, guru, ibu bapa, dan admin.',
              'A short page to understand the main app paths before signing in: students, teachers, parents, and admins.'
            )}
          </p>
          <nav className="guide-role-nav" aria-label={t('Lompat ke panduan peranan', 'Jump to role guide')}>
            {GUIDE_ROLES.map(role => (
              <a key={role.id} className={`guide-role-pill ${role.tone}`} href={`#${role.id}-guide`}>
                {languageText(role.label, role.en, language)}
              </a>
            ))}
          </nav>
        </div>

        <aside className="guide-start-panel" aria-label={t('Mula cepat', 'Quick start')}>
          <div className="guide-panel-label">{t('Mula cepat', 'Quick start')}</div>
          <ol>
            <li>{t('Pilih peranan akaun anda.', 'Choose your account role.')}</li>
            <li>{t('Masuk ke ruang kerja yang sepadan.', 'Enter the matching workspace.')}</li>
            <li>{t('Ikut tindakan pertama pada papan pemuka.', 'Follow the first action on the dashboard.')}</li>
          </ol>
        </aside>
      </section>

      <section className="guide-section" aria-labelledby="guide-basics-title">
        <div className="guide-section-head">
          <div>
            <span className="guide-kicker">{t('Asas aplikasi', 'App basics')}</span>
            <h2 id="guide-basics-title">{t('Aliran yang sama untuk semua pengguna', 'The same flow for every user')}</h2>
          </div>
          <p>{t('Gunakan bahagian ini sebagai rujukan sebelum meneroka panduan peranan.', 'Use this section as a reference before exploring each role guide.')}</p>
        </div>
        <div className="guide-basic-grid">
          {GUIDE_BASICS.map(item => (
            <article key={item.title} className="guide-basic-card">
              <h3>{languageText(item.title, item.titleEn, language)}</h3>
              <p>{languageText(item.text, item.textEn, language)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section guide-role-section" aria-labelledby="guide-roles-title">
        <div className="guide-section-head">
          <div>
            <span className="guide-kicker">{t('Panduan peranan', 'Role guide')}</span>
            <h2 id="guide-roles-title">{t('Apa yang perlu dibuat selepas log masuk', 'What to do after signing in')}</h2>
          </div>
          <p>{t('Setiap peranan mempunyai laluan kerja berbeza, tetapi semua bermula daripada papan pemuka masing-masing.', 'Each role has a different workflow, but all start from their own dashboard.')}</p>
        </div>
        <div className="guide-role-grid">
          {GUIDE_ROLES.map(role => (
            <article key={role.id} id={`${role.id}-guide`} className={`guide-role-card ${role.tone}`}>
              <div className="guide-role-card-head">
                <div>
                  <h3>{languageText(role.label, role.en, language)}</h3>
                  {language === 'ms' && <span lang="en">{role.en}</span>}
                </div>
              </div>
              <p>{languageText(role.intro, role.introEn, language)}</p>
              <ol>
                {(language === 'en' ? role.stepsEn : role.steps).map(step => <li key={step}>{step}</li>)}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section guide-cta" aria-labelledby="guide-ready-title">
        <div>
          <span className="guide-kicker">{t('Sedia mula', 'Ready to start')}</span>
          <h2 id="guide-ready-title">{t('Kembali ke log masuk untuk teruskan', 'Return to sign in to continue')}</h2>
          <p>{t('Panduan ini kekal boleh dibuka semula daripada halaman log masuk apabila pengguna perlukan rujukan cepat.', 'This guide remains available from the login page whenever users need a quick reference.')}</p>
        </div>
        <a className="guide-primary-action" href={loginHref} onClick={onBackToLogin}>{t('Pergi ke Log Masuk', 'Go to Sign In')}</a>
      </section>
    </main>
  );
};

const LoginScreen = ({ onSignedIn, apiStatus, onShowGuide, guideUrl }) => {
  const { t } = useLanguage();
  const [mode, setMode] = React.useState('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [role, setRole] = React.useState('student');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const demoAccounts = [
    { role:'student', label:'🎓 Pelajar',  email:'student@tusyen.test' },
    { role:'teacher', label:'👨‍🏫 Guru',    email:'teacher@tusyen.test' },
    { role:'parent',  label:'👪 Ibu Bapa',  email:'parent@tusyen.test'  },
    ...(SHOW_ADMIN_DEMO ? [{ role:'admin', label:'🛡️ Admin', email:'admin@tusyen.test' }] : []),
  ];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const data = mode === 'login'
        ? await window.tusyenApi.login(email, password)
        : await window.tusyenApi.register({ fullName, email, password, role });
      onSignedIn(data);
    } catch (err) {
      setError(err.message || t('Ralat tidak dijangka.', 'Unexpected error.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main-content" className="login-shell" tabIndex="-1" aria-labelledby="login-title">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">T</div>
          <div>
            <div className="login-eyebrow">Tusyen Online</div>
            <h1 id="login-title" className="login-title">{t('Belajar bersama Tusyen', 'Learn with Tusyen')}</h1>
          </div>
          <div className="login-language">
            <LanguageToggle compact />
          </div>
        </div>
        <div role="status" className={'login-status ' + (apiStatus.ok ? 'ok' : apiStatus.checked ? 'bad' : '')}>
          {apiStatus.text}
        </div>

        <a className="login-guide-button" href={guideUrl} onClick={onShowGuide}>
          {t('Lihat Panduan Penggunaan', 'View User Guide')}
        </a>

        <div className="login-tabs">
          <button className={'login-tab' + (mode === 'login'    ? ' on' : '')} onClick={() => { setMode('login');    setError(''); }}>{t('Log Masuk', 'Sign In')}</button>
          <button className={'login-tab' + (mode === 'register' ? ' on' : '')} onClick={() => { setMode('register'); setError(''); }}>{t('Daftar', 'Register')}</button>
        </div>

        <form className="login-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>{t('Nama Penuh', 'Full Name')}
              <input value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label>{t('E-mel', 'Email')}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>{t('Kata Laluan', 'Password')}
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {mode === 'register' && (
            <label>{t('Peranan', 'Role')}
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="student">{t('Pelajar', 'Student')}</option>
                <option value="teacher">{t('Guru', 'Teacher')}</option>
                <option value="parent">{t('Ibu Bapa', 'Parent')}</option>
                {SHOW_ADMIN_DEMO && <option value="admin">Admin</option>}
              </select>
            </label>
          )}
          {error && <div className="login-error" role="alert">{error}</div>}
          <button
            className="login-submit"
            type="submit"
            disabled={busy}
            data-mode={mode}
            data-busy={busy ? '1' : '0'}
            aria-label={busy ? t('Sila tunggu...', 'Please wait...') : (mode === 'login' ? t('Log Masuk', 'Sign In') : t('Cipta Akaun', 'Create Account'))}
          >
            {busy ? 'Sila tunggu…' : (mode === 'login' ? 'Log Masuk' : 'Cipta Akaun')}
          </button>
        </form>

        <div className="login-demo">
          <div className="login-demo-label">{t('Akaun demo (kata laluan: password123)', 'Demo accounts (password: password123)')}</div>
          <div className="login-demo-row">
            {demoAccounts.map(d => (
              <button
                key={d.role}
                className="login-demo-btn"
                data-role={d.role}
                aria-label={d.role === 'student' ? t('Akaun demo pelajar', 'Student demo account') : d.role === 'teacher' ? t('Akaun demo guru', 'Teacher demo account') : d.role === 'parent' ? t('Akaun demo ibu bapa', 'Parent demo account') : t('Akaun demo admin', 'Admin demo account')}
                onClick={() => { setMode('login'); setEmail(d.email); setPassword('password123'); }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

// Role switcher rendered inside the sidebar (as extraTop)
const RoleSwitcher = ({ role, setRole, isDemo, userRole }) => (
  <div className="role-switcher" role="group" aria-label="Penukar peranan demo" style={{ paddingBottom:10, borderBottom:'1px solid var(--c-bdr)' }}>
    <div style={{ fontSize:9, fontWeight:700, color:'var(--c-text3)', textTransform:'uppercase', letterSpacing:.8, width:'100%', marginBottom:4 }}>Peranan</div>
    {ROLES.filter(r => SHOW_ADMIN_DEMO || r.id !== 'admin' || userRole === 'admin').map(r => {
      const allowed = (isDemo && (SHOW_ADMIN_DEMO || r.id !== 'admin')) || r.id === userRole;
      return (
        <button key={r.id}
          className={'role-btn' + (role === r.id ? ' on' : '') + (allowed ? '' : ' locked')}
          onClick={() => allowed && setRole(r.id)}
          aria-pressed={role === r.id}
          aria-disabled={!allowed}
          title={allowed ? '' : 'Akaun anda hanya boleh menggunakan paparan ' + userRole}>
          {r.label}
        </button>
      );
    })}
  </div>
);

const App = () => {
  const [auth, setAuth]   = React.useState(() => window.tusyenApi.restoreSession());
  const [apiStatus, setApiStatus] = React.useState({ ok:false, checked:false, text:'Memeriksa API…' });
  const [role, setRole]   = React.useState('student');
  const [showGuide, setShowGuide] = React.useState(isGuideRoute);

  const openGuide = React.useCallback((event) => {
    event?.preventDefault?.();
    setGuideRoute(true);
    setShowGuide(true);
  }, []);

  const openLogin = React.useCallback((event) => {
    event?.preventDefault?.();
    setGuideRoute(false);
    setShowGuide(false);
  }, []);

  const signOut = React.useCallback(() => {
    window.tusyenApi.signOut();
    window.tusyenUser = null;
    setAuth(null);
    setRole('student');
  }, []);

  React.useEffect(() => {
    window.tusyenApi.health()
      .then(h => setApiStatus({ ok:true, checked:true, text:`API ${h.status} · DB ${h.database}` }))
      .catch(err => setApiStatus({ ok:false, checked:true, text:`API tidak dicapai: ${err.message}` }));
  }, []);

  React.useEffect(() => {
    if (auth?.user?.role) setRole(auth.user.role);
  }, [auth]);

  React.useEffect(() => {
    const syncPublicRoute = () => setShowGuide(isGuideRoute());
    window.addEventListener('popstate', syncPublicRoute);
    return () => window.removeEventListener('popstate', syncPublicRoute);
  }, []);

  React.useEffect(() => {
    window.tusyenUser = auth?.user || null;
  }, [auth]);

  React.useEffect(() => {
    window.tusyenApiStatus = apiStatus;
    window.tusyenSignOut = signOut;
    return () => {
      if (window.tusyenSignOut === signOut) window.tusyenSignOut = null;
    };
  }, [apiStatus, signOut]);

  window.tusyenUser = auth?.user || null;
  window.tusyenApiStatus = apiStatus;

  if (!auth && showGuide) {
    return <GuidePage onBackToLogin={openLogin} loginHref={guideHref(false)} />;
  }

  if (!auth) {
    return <LoginScreen onSignedIn={setAuth} apiStatus={apiStatus} onShowGuide={openGuide} guideUrl={guideHref(true)} />;
  }

  const isDemo = auth.user?.email?.endsWith?.('@tusyen.test');
  const showRoleSwitcher = isDemo
    && LOCAL_QA_HOST
    && new URLSearchParams(window.location.search).get('demoRoles') === '1';

  const roleSwitcher = showRoleSwitcher ? (
    <RoleSwitcher role={role} setRole={setRole} isDemo={isDemo} userRole={auth.user.role} />
  ) : null;

  // Student gets the fully redesigned layout (sidebar built-in)
  if (role === 'student') {
    return (
      <div className="phone role-view">
      <window.StudentApp
        sidebarExtraTop={roleSwitcher}
      />
      </div>
    );
  }

  // Other roles have their own built-in app-shell — render directly like StudentApp
  if (role === 'teacher') return <div className="phone role-view"><window.TeacherApp sidebarExtraTop={roleSwitcher} /></div>;
  if (role === 'parent')  return <div className="phone role-view"><window.ParentApp  sidebarExtraTop={roleSwitcher} /></div>;
  if (role === 'admin')   return <div className="phone role-view"><window.AdminApp   sidebarExtraTop={roleSwitcher} /></div>;

  return null;
};

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
