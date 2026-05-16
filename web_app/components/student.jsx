// Tusyen — Student Role UI v2
// Ported from the Claude Design handoff. Uses real logged-in user's name where available.

const SUBJECTS = [
  { id:'math',    name:'Matematik', icon:'📐', color:'#8B5CF6', progress:65 },
  { id:'bio',     name:'Biologi',   icon:'🌿', color:'#22C55E', progress:42 },
  { id:'physics', name:'Fizik',     icon:'⚡', color:'#38BDF8', progress:30 },
  { id:'chem',    name:'Kimia',     icon:'🧪', color:'#F59E0B', progress:18 },
  { id:'hist',    name:'Sejarah',   icon:'📜', color:'#EF4444', progress:55 },
  { id:'geo',     name:'Geografi',  icon:'🌏', color:'#10B981', progress:22 },
];

const SKILL_NODES = [
  { id:1, label:'Nombor',       sub:'Numbers',      done:true,  locked:false, cur:false },
  { id:2, label:'Algebra',      sub:'Algebra',      done:true,  locked:false, cur:false },
  { id:3, label:'Geometri',     sub:'Geometry',     done:false, locked:false, cur:true  },
  { id:4, label:'Trigonometri', sub:'Trigonometry', done:false, locked:true,  cur:false },
  { id:5, label:'Statistik',    sub:'Statistics',   done:false, locked:true,  cur:false },
];

const LEADERBOARD_BASE = [
  { rank:1, name:'Siti Nora',   xp:3120, medal:'🥇' },
  { rank:2, name:'Haziq Razif', xp:2980, medal:'🥈' },
  { rank:3, name:'Nurul Ain',   xp:2760, medal:'🥉' },
  { rank:4, name:'Kamu',        xp:2450, me:true     },
  { rank:5, name:'Aina Sofia',  xp:2200              },
];

const QUESTIONS = [
  { q:'Apakah nilai x dalam persamaan 2x + 4 = 12?',
    sub:'What is x in 2x + 4 = 12?',
    opts:['x = 3','x = 4','x = 8','x = 6'], ans:1 },
  { q:'Berapakah luas segiempat sama dengan sisi 5 cm?',
    sub:'Area of a square with side 5 cm?',
    opts:['20 cm²','25 cm²','10 cm²','30 cm²'], ans:1 },
  { q:'Permudahkan: 3x + 2x − x',
    sub:'Simplify: 3x + 2x − x',
    opts:['4x','5x','6x','3x'], ans:0 },
];

const BADGES = [
  { icon:'🔥', name:'Streak 7 Hari',    desc:'Belajar 7 hari berturut', earned:true  },
  { icon:'⚡', name:'Pelajar Pantas',   desc:'10 pelajaran sehari',      earned:true  },
  { icon:'🎯', name:'Markah Sempurna',  desc:'Skor 100% dalam ujian',   earned:true  },
  { icon:'🏆', name:'Top 3 Kelas',      desc:'3 teratas dalam kelas',   earned:false },
  { icon:'💎', name:'Pelajar Elit',     desc:'Capai 5,000 XP',          earned:false },
  { icon:'🌟', name:'Penguasa Algebra', desc:'Selesai semua Algebra',   earned:false },
];

const STUDENT_NOTIFS = [
  { icon:'🎉', msg:'Tahniah! Kamu naik ke Tahap 12 — Pelajar Maju.',                     time:'Baru sahaja',  unread:true  },
  { icon:'📋', msg:'Cikgu Azman menetapkan kuiz baru: Geometri Bab 3.',                   time:'20 minit lepas', unread:true  },
  { icon:'🔥', msg:'Streak kamu dalam bahaya! Selesaikan sekurang-kurangnya 1 pelajaran.', time:'2j lepas',     unread:true  },
  { icon:'🏆', msg:'Haziq Razif mengatasi kamu dalam ranking. Jangan menyerah!',           time:'5j lepas',     unread:false },
  { icon:'✅', msg:'Matematik Bab 2 berjaya diselesaikan. +120 XP diterima.',              time:'Semalam',      unread:false },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat Pagi';
  if (h < 17) return 'Selamat Petang';
  return 'Selamat Malam';
};

const firstName = (full) => (full || '').split(' ')[0] || 'Pelajar';

const medalForRank = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
const subjectIcon = (subject='') => {
  const key = subject.toLowerCase();
  if (key.includes('bio')) return '🌿';
  if (key.includes('phys') || key.includes('fiz')) return '⚡';
  if (key.includes('chem') || key.includes('kim')) return '🧪';
  if (key.includes('sej') || key.includes('hist')) return '📜';
  if (key.includes('geo')) return '🌏';
  return '📐';
};

const normalizeLessonCard = (lesson={}) => ({
  id: lesson.id,
  classroomId: lesson.classroom_id || lesson.classroomId,
  title: lesson.title || 'Matematik • Bab 3',
  topic: lesson.topic || lesson.subtopic || lesson.subject || 'Geometri & Pengukuran',
  subject: lesson.subject || 'Matematik',
  progress: Math.max(0, Math.min(100, Math.round(Number(lesson.completion_percentage ?? lesson.progress ?? 60) || 0))),
  icon: subjectIcon(lesson.subject || lesson.title || ''),
});

const CONTINUE_FALLBACK = normalizeLessonCard({
  title:'Matematik • Bab 3',
  topic:'Geometri & Pengukuran',
  subject:'Matematik',
  progress:60,
});

const normalizeOption = (option) => {
  if (option && typeof option === 'object') {
    return option.text ?? option.label ?? option.value ?? option.answer ?? JSON.stringify(option);
  }
  return `${option ?? ''}`;
};

const normalizeLessonQuestion = (question, index) => {
  const options = Array.isArray(question.options)
    ? question.options.map(normalizeOption).filter(Boolean)
    : [];
  const fallbackOptions = question.question_type === 'true_false' ? ['Benar', 'Palsu'] : options;
  return {
    id: question.id || `mock-${index}`,
    q: question.question_text || question.q || `Soalan ${index + 1}`,
    sub: question.sub || '',
    opts: fallbackOptions.length ? fallbackOptions : ['A', 'B', 'C', 'D'],
    ans: Number.isInteger(question.ans) ? question.ans : null,
  };
};

const MOCK_QUESTIONS = QUESTIONS.map(normalizeLessonQuestion);

const useStudentStats = () => {
  const fallback = { streak:7, xp:2450, hearts:'5/5', lessons:138 };
  return useAsync(async () => {
    const u = window.tusyenUser;
    if (u?.role !== 'student' || !u?.id) return fallback;
    const data = await window.tusyenApi.studentStats(u.id);
    if (!data) return fallback;
    const overall = data.overall || {};
    return {
      streak:  Number(data.streak)               || fallback.streak,
      xp:      Number(data.quiz?.quizXpTotal)    || fallback.xp,
      hearts:  '5/5',
      lessons: Number(overall.lessons_completed) || fallback.lessons,
    };
  }, [], fallback);
};

const useAssignedLessons = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return [];
    const { lessons } = await window.tusyenApi.assignedLessons();
    return (lessons || []).map(normalizeLessonCard);
  }, [], []);
};

const useContinueLesson = () => {
  const lessons = useAssignedLessons();
  return {
    ...lessons,
    data: (lessons.data && lessons.data[0]) || CONTINUE_FALLBACK,
  };
};

const useClassroomLeaderboard = (displayName) => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return LEADERBOARD_BASE;
    const { classrooms } = await window.tusyenApi.classrooms();
    const first = (classrooms || [])[0];
    if (!first?.id) throw new Error('No classroom');
    const { leaderboard } = await window.tusyenApi.classroomLeaderboard(first.id);
    const mapped = (leaderboard || []).map((row, i) => {
      const rank = Number(row.rank || i + 1);
      const isMe = row.student_id === window.tusyenUser?.id;
      return {
        rank,
        name: row.full_name || row.name || 'Pelajar',
        xp: Number(row.total_xp ?? row.xp) || 0,
        medal: medalForRank(rank),
        me: isMe,
      };
    });
    return mapped.length ? mapped : LEADERBOARD_BASE;
  }, [displayName], LEADERBOARD_BASE);
};

const useAchievements = () => {
  return useAsync(async () => {
    if (window.tusyenUser?.role !== 'student') return BADGES;
    const { achievements } = await window.tusyenApi.myAchievements();
    const mapped = (achievements || []).map(a => ({
      icon: a.icon || a.icon_url || '🏅',
      name: a.name,
      desc: a.description || '',
      earned: Boolean(a.is_earned || a.earned_at),
    })).filter(a => a.name);
    return mapped.length ? mapped : BADGES;
  }, [], BADGES);
};

const SLessonResult = ({ correct, total, hearts, go, result, lesson }) => {
  const correctCount = Number(result?.correctAnswers ?? result?.correctCount ?? correct) || 0;
  const totalQuestions = Number(result?.totalQuestions ?? result?.total ?? total) || 1;
  correct = correctCount;
  total = totalQuestions;
  const accuracy = Math.round(Number(result?.score ?? ((correctCount / totalQuestions) * 100)) || 0);
  const bonus    = accuracy === 100 ? 50 : accuracy >= 80 ? 25 : 0;
  const xpEarned = Number(result?.xpEarned ?? result?.xp_earned) || (correctCount * 10 + bonus);
  const stars    = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
  const xpDisplay = useCountUp(xpEarned, 1000);

  const headline = accuracy === 100 ? 'Sempurna! 🌟' : accuracy >= 80 ? 'Bagus! 🎉' : 'Tamat!';

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'20px 20px 28px', gap:18,
      background:`radial-gradient(ellipse at 50% 25%,
        rgba(139,92,246,.18) 0%, transparent 65%), ${C.bg}`,
    }}>
      <div style={{
        fontSize:76, lineHeight:1,
        animation:'tv2-trophy .55s cubic-bezier(.34,1.56,.64,1) forwards',
        filter:`drop-shadow(0 0 32px ${C.accGlow})`,
      }}>🏆</div>

      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:900, fontSize:26, color:C.text, letterSpacing:-0.5 }}>{headline}</div>
        <div style={{ fontSize:13, color:C.textMuted, marginTop:3, fontWeight:600 }}>
          {lesson?.title || 'Matematik • Bab 3'} — {lesson?.topic || 'Geometri'}
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
              fontSize:9, color:C.textMuted, fontWeight:700,
              textTransform:'uppercase', letterSpacing:0.5, marginTop:3,
            }}>{st.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <span style={{ fontSize:11, color:C.textMuted, fontWeight:700 }}>Nyawa tinggal:</span>
        {[...Array(5)].map((_,i) => (
          <span key={i} style={{ fontSize:14, opacity: i < hearts ? 1 : 0.15 }}>❤️</span>
        ))}
      </div>

      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
        <GlowButton onClick={() => go('home')}>🏠 Kembali ke Utama</GlowButton>
        <GlowButton outlined onClick={() => go('lesson')}>🔄 Cuba Lagi</GlowButton>
      </div>
    </div>
  );
};

const SLessonLive = ({ go, selectedLesson }) => {
  const [qi, setQi] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const [hearts, setHearts] = React.useState(5);
  const [correct, setCorrect] = React.useState(0);
  const [phase, setPhase] = React.useState('quiz');
  const [lessonMeta, setLessonMeta] = React.useState(selectedLesson || CONTINUE_FALLBACK);
  const [questions, setQuestions] = React.useState(MOCK_QUESTIONS);
  const [answers, setAnswers] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [startedAt, setStartedAt] = React.useState(Date.now());

  React.useEffect(() => {
    let cancelled = false;
    const resetQuiz = () => {
      setQi(0);
      setSel(null);
      setDone(false);
      setHearts(5);
      setCorrect(0);
      setPhase('quiz');
      setAnswers({});
      setResult(null);
      setSubmitError('');
      setStartedAt(Date.now());
    };

    resetQuiz();
    if (window.tusyenUser?.role !== 'student') return;

    const loadLesson = async () => {
      setLoading(true);
      try {
        let target = selectedLesson?.id ? normalizeLessonCard(selectedLesson) : null;
        if (!target?.id) {
          const assigned = await window.tusyenApi.assignedLessons();
          target = (assigned.lessons || [])[0] ? normalizeLessonCard((assigned.lessons || [])[0]) : null;
        }
        if (!target?.id) {
          if (!cancelled) {
            setLessonMeta(CONTINUE_FALLBACK);
            setQuestions(MOCK_QUESTIONS);
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
        setQuestions(liveQuestions.length ? liveQuestions : MOCK_QUESTIONS);
      } catch (err) {
        if (!cancelled) {
          setLessonMeta(selectedLesson || CONTINUE_FALLBACK);
          setQuestions(MOCK_QUESTIONS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLesson();
    return () => { cancelled = true; };
  }, [selectedLesson?.id, selectedLesson?.classroomId]);

  const total = Math.max(questions.length, 1);
  const q = questions[qi] || MOCK_QUESTIONS[0];
  const hasAnswerKey = q.ans !== null && q.ans !== undefined;

  const pick = (i) => {
    if (done) return;
    setSel(i);
    setDone(true);
    setAnswers(prev => ({ ...prev, [q.id]: q.opts[i] }));
    if (!hasAnswerKey) return;
    if (i === q.ans) setCorrect(c => c + 1);
    else setHearts(h => Math.max(0, h - 1));
  };

  const localResult = () => ({
    score: Math.round((correct / total) * 100),
    correctAnswers: correct,
    totalQuestions: total,
  });

  const submit = async () => {
    if (!lessonMeta?.id) {
      setResult(localResult());
      setPhase('result');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    try {
      const data = await window.tusyenApi.submitLesson(lessonMeta.id, {
        classroomId: lessonMeta.classroomId,
        answers: questions.map(item => ({
          questionId: item.id,
          answer: answers[item.id] ?? '',
        })),
        timeSpentSeconds: seconds,
        contentReviewed: true,
        contentReviewSeconds: seconds,
      });
      const serverResult = data.result || {};
      setResult({
        score: Number(serverResult.score) || 0,
        correctAnswers: Number(serverResult.correctAnswers ?? serverResult.correctCount) || 0,
        totalQuestions: Number(serverResult.totalQuestions ?? serverResult.total) || total,
        xpEarned: serverResult.xpEarned ?? serverResult.xp_earned,
      });
      setPhase('result');
    } catch (err) {
      setSubmitError(err.message || 'Tidak dapat menghantar jawapan. Cuba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (qi >= total - 1) { submit(); return; }
    setQi(n => n + 1);
    setSel(null);
    setDone(false);
  };

  if (loading) {
    return <EmptyState icon="📐" title="Memuat pelajaran" subtitle="Soalan sebenar sedang diambil daripada kelas kamu." />;
  }

  if (phase === 'result') {
    return <SLessonResult correct={correct} total={total} hearts={hearts} go={go} result={result} lesson={lessonMeta} />;
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

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', padding:16, gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={() => go('learn')}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:C.textMuted }}>✕</button>
        <div style={{ flex:1 }}><ProgressBar value={(qi / total) * 100} height={8} /></div>
        <div style={{ display:'flex', gap:2 }}>
          {[...Array(5)].map((_,i) => (
            <span key={i} style={{ fontSize:15, opacity: i < hearts ? 1 : 0.15 }}>❤️</span>
          ))}
        </div>
      </div>

      <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>
        Soalan {qi + 1} / {total}
      </div>

      <div style={{ background:C.accDim, border:`1px solid ${C.border}`, borderRadius:16, padding:16, flexShrink:0 }}>
        <div style={{ fontWeight:800, fontSize:16, color:C.text, lineHeight:1.4, marginBottom:4 }}>{q.q}</div>
        <div style={{ fontSize:11, color:C.textMuted, fontStyle:'italic' }}>{q.sub || lessonMeta.topic}</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:9, flex:1 }}>
        {q.opts.map((opt, i) => {
          const s = optStyle(i);
          return (
            <button key={i} onClick={() => pick(i)} style={{
              background:s.bg, border:`1.5px solid ${s.bd}`, color:s.col,
              borderRadius:14, padding:'13px 14px',
              fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:15,
              cursor: done ? 'default' : 'pointer', textAlign:'left',
              display:'flex', alignItems:'center', gap:10, transition:'all .2s',
            }}>
              <span style={{
                width:27, height:27, borderRadius:'50%',
                background:`color-mix(in srgb,${s.col} 15%,transparent)`,
                border:`1.5px solid color-mix(in srgb,${s.col} 40%,transparent)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:800, flexShrink:0, color:s.col,
              }}>{['A','B','C','D'][i] || String(i + 1)}</span>
              {opt}
              {done && hasAnswerKey && i === q.ans && ' ✓'}
              {done && hasAnswerKey && i === sel && i !== q.ans && ' ✗'}
            </button>
          );
        })}
      </div>

      {done && (
        <div style={{ flexShrink:0 }}>
          <div style={{
            padding:'10px 14px', borderRadius:12, marginBottom:10,
            background: !hasAnswerKey || sel === q.ans ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
            border:`1px solid ${!hasAnswerKey || sel === q.ans ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'}`,
          }}>
            <div style={{ fontWeight:800, fontSize:14, color: !hasAnswerKey || sel === q.ans ? C.green : C.red }}>
              {!hasAnswerKey ? 'Jawapan direkodkan' : sel === q.ans ? '🎉 Betul! +10 XP' : '😞 Salah. Cuba lagi!'}
            </div>
            {hasAnswerKey && sel !== q.ans && (
              <div style={{ fontSize:12, color:C.textMuted, marginTop:2, fontWeight:600 }}>
                Jawapan: {q.opts[q.ans]}
              </div>
            )}
            {submitError && (
              <div style={{ fontSize:12, color:C.red, marginTop:6, fontWeight:700 }}>{submitError}</div>
            )}
          </div>
          <GlowButton onClick={next} disabled={submitting}>
            {submitting ? 'Menghantar...' : qi >= total - 1 ? 'Lihat Keputusan 🏆' : 'Seterusnya →'}
          </GlowButton>
        </div>
      )}
    </div>
  );
};

const SHome = ({ go, openLesson, displayName }) => {
  const statsState = useStudentStats();
  const continueState = useContinueLesson();
  const leaderboardState = useClassroomLeaderboard(displayName);
  const stats = statsState.data;
  const continueLesson = continueState.data;
  const leaderboard = leaderboardState.data || LEADERBOARD_BASE;
  return (
  <div style={{ flex:1, overflowY:'auto', padding:'14px 16px 10px' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:600 }}>{getGreeting()},</div>
        <div style={{ fontSize:22, fontWeight:800, color:C.text }}>{firstName(displayName)} 👋</div>
      </div>
      <Avatar name={displayName} size={46} />
    </div>

    <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
      {statsState.loading ? (
        [86, 78, 92].map((w, i) => <Skeleton key={i} width={w} height={42} radius={99} />)
      ) : (
        <>
          <StatPill icon="🔥" value={String(stats.streak)} label="HARI"  color={C.orange} />
          <StatPill icon="⚡" value={stats.xp.toLocaleString()} label="XP"    color={C.gold}   />
          <StatPill icon="❤️" value={stats.hearts} label="NYAWA" color={C.red}    />
        </>
      )}
    </div>

    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontWeight:800, fontSize:12, color:C.accPale, textTransform:'uppercase', letterSpacing:0.6 }}>
          🎯 Misi Hari Ini
        </div>
        <div style={{ fontSize:12, color:C.textMuted, fontWeight:700 }}>7 / 10</div>
      </div>
      <ProgressBar value={70} height={10} />
      <div style={{ fontSize:11, color:C.textMuted, marginTop:6, fontWeight:600 }}>
        3 pelajaran lagi untuk bonus XP 🎁
      </div>
    </Card>

    {continueState.loading ? (
      <Card style={{ marginBottom:14 }}>
        <Skeleton width={118} height={10} radius={5} style={{ marginBottom:12 }} />
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Skeleton width={46} height={46} radius={13} />
          <div style={{ flex:1 }}>
            <Skeleton width="78%" height={14} radius={7} style={{ marginBottom:8 }} />
            <Skeleton width="54%" height={12} radius={6} style={{ marginBottom:10 }} />
            <Skeleton width="100%" height={6} radius={999} />
          </div>
          <Skeleton width={30} height={30} radius={9} />
        </div>
      </Card>
    ) : (
      <Card style={{ marginBottom:14 }} onClick={() => openLesson(continueLesson)}>
        <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>
          Teruskan Belajar
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:46, height:46, borderRadius:13, flexShrink:0,
            background:'linear-gradient(135deg,var(--c-acc-lo),var(--c-acc))',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
          }}>📐</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{continueLesson.title}</div>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>{continueLesson.topic}</div>
            <ProgressBar value={continueLesson.progress} height={6} />
          </div>
          <div style={{
            width:30, height:30, borderRadius:9, background:C.accDim,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:C.accHi, fontSize:18, fontWeight:800,
          }}>›</div>
        </div>
      </Card>
    )}

    <SectionLabel>Subjek / Subjects</SectionLabel>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
      {SUBJECTS.map(s => (
        <Card key={s.id} style={{ padding:12 }} onClick={() => go('learn')}>
          <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
          <div style={{ fontWeight:800, fontSize:13, color:C.text, marginBottom:6 }}>{s.name}</div>
          <ProgressBar value={s.progress} color={s.color} height={5} />
          <div style={{ fontSize:10, color:C.textMuted, marginTop:3, fontWeight:600 }}>{s.progress}% siap</div>
        </Card>
      ))}
    </div>

    <SectionLabel>🏆 Ranking Kelas</SectionLabel>
    <Card>
      {leaderboard.map((item, i) => {
        const label = item.me ? (firstName(displayName) + ' (Kamu)') : item.name;
        return (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10,
            padding: item.me ? '7px 8px' : '7px 0',
            borderBottom: i < leaderboard.length - 1 ? `1px solid ${C.border}` : 'none',
            background: item.me ? C.accDim : 'transparent',
            borderRadius: item.me ? 8 : 0,
          }}>
            <span style={{ width:18, fontWeight:800, fontSize:13, color:C.textFaint, textAlign:'center' }}>{item.rank}</span>
            <Avatar name={item.me ? displayName : item.name} size={28} />
            <div style={{ flex:1, fontWeight: item.me ? 800 : 700, fontSize:13, color: item.me ? C.accPale : C.text }}>
              {label}
            </div>
            <div style={{ fontWeight:800, fontSize:12, color:C.gold }}>
              {item.medal ? item.medal + ' ' : ''}{item.xp.toLocaleString()} XP
            </div>
          </div>
        );
      })}
    </Card>
    <div style={{ height:8 }} />
  </div>
);
};

const SUBJECT_QUERY = {
  math:'Mathematics', bio:'Biology', physics:'Physics',
  chem:'Chemistry',   hist:'Sejarah', geo:'Geography',
};

const useSyllabusNodes = (subjectId) => {
  return useAsync(async () => {
    const subject = SUBJECT_QUERY[subjectId];
    if (!subject) return SKILL_NODES;
    const { syllabus } = await window.tusyenApi.syllabus(subject, 4);
    const items = syllabus || [];
    if (!items.length) return SKILL_NODES;
    // Map syllabus rows to skill tree nodes. First two done, third current, rest locked.
    return items.slice(0, 6).map((it, i) => ({
      id: it.id,
      label: it.topic || `Topik ${i + 1}`,
      sub: it.subtopic || it.topic || '',
      done:   i < 2,
      cur:    i === 2,
      locked: i > 2,
    }));
  }, [subjectId], SKILL_NODES);
};

const SLearn = ({ go }) => {
  const [active, setActive] = React.useState('math');
  const subj = SUBJECTS.find(s => s.id === active);
  const nodesState = useSyllabusNodes(active);
  const nodes = nodesState.data || SKILL_NODES;
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{
        display:'flex', gap:8, padding:'10px 16px',
        overflowX:'auto', borderBottom:`1px solid ${C.border}`,
        scrollbarWidth:'none', flexShrink:0,
      }}>
        {SUBJECTS.map(s => (
          <div key={s.id} onClick={() => setActive(s.id)} style={{
            background: active === s.id ? `color-mix(in srgb,${s.color} 18%,transparent)` : 'transparent',
            border:`1.5px solid ${active === s.id ? s.color : C.border}`,
            color: active === s.id ? s.color : C.textMuted,
            borderRadius:20, padding:'4px 12px',
            fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', transition:'all .2s',
          }}>{s.icon} {s.name}</div>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'18px 16px 10px' }}>
        <div style={{ fontWeight:800, fontSize:20, color:C.text }}>{subj.name}</div>
        <div style={{ fontSize:13, color:C.textMuted, fontWeight:600, marginBottom:24 }}>
          Tingkatan 4 • {subj.progress}% selesai
        </div>

        {nodes.map((node, i) => (
          <div key={node.id} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
            {i > 0 && (
              <div style={{
                width:2, height:28,
                background: nodes[i-1].done
                  ? 'linear-gradient(var(--c-acc-lo),var(--c-acc))' : C.border,
                boxShadow: nodes[i-1].done ? '0 0 8px var(--c-acc-glow)' : 'none',
              }} />
            )}
            <div onClick={() => !node.locked && go('lesson')} style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              cursor: node.locked ? 'not-allowed' : 'pointer', marginBottom:4,
            }}>
              <div className={node.cur ? 'tv2-pulse' : ''} style={{
                width:72, height:72, borderRadius:'50%',
                background: node.done
                  ? 'linear-gradient(135deg,var(--c-acc-lo),var(--c-acc-hi))'
                  : node.cur ? C.card : C.surface,
                border: node.cur
                  ? `3px solid var(--c-acc)`
                  : node.done ? 'none' : `2px solid ${C.border}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
                boxShadow: node.done
                  ? '0 0 24px var(--c-acc-glow),0 0 48px color-mix(in srgb,var(--c-acc) 15%,transparent)'
                  : 'none',
                transition:'all .3s',
              }}>
                {node.done ? '✓' : node.cur ? '📐' : '🔒'}
              </div>
              <div style={{ fontWeight:800, fontSize:13, color: node.locked ? C.textFaint : C.text, marginTop:6 }}>{node.label}</div>
              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, marginBottom:4 }}>{node.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SProfile = ({ displayName }) => {
  const initials = (displayName || 'AH').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const badgesState = useAchievements();
  const badges = badgesState.data || BADGES;
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'20px 16px 10px' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:20 }}>
        <div style={{
          width:80, height:80, borderRadius:'50%', marginBottom:10,
          background:'linear-gradient(135deg,var(--c-acc-lo),var(--c-acc-hi))',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, fontWeight:800, color:'#fff',
          boxShadow:'0 0 28px var(--c-acc-glow)',
          border:'3px solid color-mix(in srgb,var(--c-acc) 40%,transparent)',
        }}>{initials}</div>
        <div style={{ fontWeight:800, fontSize:20, color:C.text }}>{displayName}</div>
        <div style={{ fontSize:13, color:C.textMuted, fontWeight:600 }}>Tingkatan 4 • Kelas 4A</div>
        <div style={{
          marginTop:8, background:'linear-gradient(90deg,var(--c-acc-lo),var(--c-acc))',
          borderRadius:20, padding:'4px 16px', fontSize:12, fontWeight:800, color:'#fff',
        }}>⚡ Tahap 12 • Pelajar Maju</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[{v:'47',l:'Hari Aktif',i:'📅'},{v:'138',l:'Pelajaran',i:'📚'},{v:'2,450',l:'XP Total',i:'⚡'}].map((s,i) => (
          <Card key={i} style={{ textAlign:'center', padding:12 }}>
            <div style={{ fontSize:20 }}>{s.i}</div>
            <div style={{ fontWeight:800, fontSize:16, color:C.text }}>{s.v}</div>
            <div style={{ fontSize:9, color:C.textMuted, fontWeight:700, textTransform:'uppercase' }}>{s.l}</div>
          </Card>
        ))}
      </div>

      <SectionLabel>🏅 Pencapaian</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {badgesState.loading ? [0,1,2,3].map(i => (
          <Card key={i} style={{ padding:12 }}>
            <Skeleton width={30} height={30} radius={10} style={{ marginBottom:8 }} />
            <Skeleton width="72%" height={12} radius={6} style={{ marginBottom:6 }} />
            <Skeleton width="100%" height={9} radius={5} />
          </Card>
        )) : badges.map((b, i) => (
          <Card key={i} style={{
            padding:12, opacity: b.earned ? 1 : 0.4,
            border: b.earned
              ? `1px solid color-mix(in srgb,var(--c-acc) 35%,transparent)`
              : `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:24, marginBottom:4 }}>{b.icon}</div>
            <div style={{ fontWeight:800, fontSize:12, color:C.text, lineHeight:1.2 }}>{b.name}</div>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, lineHeight:1.3, marginTop:2 }}>{b.desc}</div>
          </Card>
        ))}
      </div>
      <div style={{ height:8 }} />
    </div>
  );
};

const StudentApp = () => {
  const [screen,    setScreen]    = React.useState('home');
  const [showNotif, setShowNotif] = React.useState(false);
  const [selectedLesson, setSelectedLesson] = React.useState(null);
  const unread = STUDENT_NOTIFS.filter(n => n.unread).length;
  const displayName = window.tusyenUser?.fullName || window.tusyenUser?.email || 'Ahmad Hafiz';
  const openLesson = (lesson) => {
    setSelectedLesson(lesson || null);
    setScreen('lesson');
  };

  const nav = [
    { id:'home',    icon:'🏠', label:'Utama'     },
    { id:'learn',   icon:'🗺️', label:'Belajar'   },
    { id:'lesson',  icon:'📝', label:'Pelajaran' },
    { id:'profile', icon:'👤', label:'Profil'    },
  ];
  const titles = { home:'Tusyen', learn:'Pokok Kemahiran', lesson:'Matematik • Bab 3', profile:'Profil Saya' };
  const subs   = { home:'Tingkatan 4', learn:'Pilih topik', lesson:'Geometri & Pengukuran', profile:displayName };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', position:'relative' }}>
      <TopBar
        title={titles[screen]}
        subtitle={subs[screen]}
        right={screen === 'home' && (
          <NotifBell count={unread} onClick={() => setShowNotif(true)} />
        )}
      />
      {screen === 'home'    && <SHome    go={setScreen} openLesson={openLesson} displayName={displayName} />}
      {screen === 'learn'   && <SLearn   go={setScreen} />}
      {screen === 'lesson'  && <SLessonLive  go={setScreen} selectedLesson={selectedLesson} />}
      {screen === 'profile' && <SProfile displayName={displayName} />}
      <BottomNav items={nav} active={screen} onSelect={setScreen} />

      {showNotif && (
        <NotifPanel notifs={STUDENT_NOTIFS} onClose={() => setShowNotif(false)} />
      )}
    </div>
  );
};

window.StudentApp = StudentApp;
