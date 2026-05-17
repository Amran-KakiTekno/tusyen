// Kuiz: deck management, teacher live host, student PIN join.
const { useState, useEffect, useRef, useCallback } = React;
const { useAsync, Card, GlowButton, Skeleton, ErrorRetry, useLanguage } = window;

const QUIZ_NICKNAME_MAX = 24;
const cleanQuizPin = (value = '') => `${value}`.replace(/\D/g, '').slice(0, 6);
const quizDisplayTitle = (value, fallback = 'Dek kuiz') =>
  window.cleanUiTitle ? window.cleanUiTitle(value, fallback) : `${value || fallback}`;
const QUIZ_QUESTION_TYPE_OPTIONS = [
  { value:'multiple_choice', label:'Pilihan jawapan', hint:'Pilih satu jawapan daripada beberapa pilihan.' },
  { value:'true_false', label:'Benar / palsu', hint:'Pilih Benar atau Palsu.' },
  { value:'fill_blank', label:'Isi tempat kosong', hint:'Jawapan pendek dengan teks tepat.' },
  { value:'matching', label:'Padanan pasangan', hint:'Padankan istilah dengan jawapan.' },
  { value:'representation_match', label:'Padanan representasi', hint:'Padankan formula, graf, simbol atau maksud.' },
  { value:'missing_step', label:'Langkah hilang', hint:'Tulis langkah yang tiada dalam penyelesaian.' },
  { value:'step_order', label:'Susun langkah', hint:'Susun langkah mengikut urutan betul.' },
  { value:'numeric', label:'Jawapan nombor', hint:'Masukkan nilai dan unit jika perlu.' },
  { value:'diagram_label', label:'Label rajah', hint:'Padankan label rajah dengan jawapan.' },
  { value:'error_diagnosis', label:'Diagnosis ralat', hint:'Kenal pasti ralat atau miskonsepsi.' },
  { value:'prediction', label:'Ramalan', hint:'Ramalkan hasil berdasarkan situasi.' },
  { value:'code_trace', label:'Jejak kod', hint:'Tentukan output atau aliran kod.' },
  { value:'data_interpret', label:'Tafsir data', hint:'Baca jadual, carta atau data eksperimen.' },
  { value:'scenario', label:'Senario', hint:'Jawab berdasarkan konteks dunia sebenar.' },
];
const QUIZ_QUESTION_TYPE_META = QUIZ_QUESTION_TYPE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});
const CHOICE_QUESTION_TYPES = new Set(['multiple_choice', 'true_false']);
const PAIR_QUESTION_TYPES = new Set(['matching', 'representation_match', 'diagram_label']);
const FREE_TEXT_QUESTION_TYPES = new Set([
  'fill_blank',
  'missing_step',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
]);
const normalizeQuizQuestionType = (value) =>
  QUIZ_QUESTION_TYPE_META[value] ? value : 'multiple_choice';
const quizQuestionTypeLabel = (value) =>
  QUIZ_QUESTION_TYPE_META[normalizeQuizQuestionType(value)]?.label || 'Pilihan jawapan';
const quizQuestionTypeHint = (value) =>
  QUIZ_QUESTION_TYPE_META[normalizeQuizQuestionType(value)]?.hint || '';
const questionTypeUsesOptions = (type) =>
  normalizeQuizQuestionType(type) === 'multiple_choice' ||
  normalizeQuizQuestionType(type) === 'step_order' ||
  PAIR_QUESTION_TYPES.has(normalizeQuizQuestionType(type));
const questionTypeUsesLines = (type) =>
  normalizeQuizQuestionType(type) === 'step_order' ||
  PAIR_QUESTION_TYPES.has(normalizeQuizQuestionType(type));
const questionOptionsLabel = (type) => {
  const normalized = normalizeQuizQuestionType(type);
  if (PAIR_QUESTION_TYPES.has(normalized)) return 'Pasangan';
  if (normalized === 'step_order') return 'Langkah';
  return 'Pilihan jawapan';
};
const questionAnswerLabel = (type) => {
  const normalized = normalizeQuizQuestionType(type);
  if (normalized === 'numeric') return 'Nilai betul';
  if (normalized === 'step_order') return 'Susunan betul';
  if (PAIR_QUESTION_TYPES.has(normalized)) return 'Padanan betul';
  if (normalized === 'true_false') return 'Jawapan betul';
  return 'Jawapan betul';
};
const quizJoinErrorMessage = (message = '') => {
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

function buildQuizWsUrl(sessionId) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/quiz/${sessionId}`;
}

function readAccessToken() {
  return localStorage.getItem('tusyen_token') || '';
}

function useQuizSocket(sessionId, { participantToken, onMessage, enabled = true }) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const shouldReconnect = useRef(false);
  const [status, setStatus] = useState(enabled ? 'connecting' : 'idle');
  const [lastError, setLastError] = useState('');

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    shouldReconnect.current = true;
    clearTimeout(reconnectTimer.current);
    setStatus((current) => current === 'connected' ? 'connected' : 'connecting');

    const socket = new WebSocket(buildQuizWsUrl(sessionId));
    ws.current = socket;

    socket.onopen = () => {
      setStatus('authenticating');
      setLastError('');
      const token = readAccessToken();
      socket.send(JSON.stringify(
        participantToken
          ? { type: 'AUTH', participantToken }
          : { type: 'AUTH', token }
      ));
    };

    socket.onmessage = (event) => {
      let message = null;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === 'AUTH_SUCCESS') {
        setStatus('connected');
        setLastError('');
      } else if (message.type === 'ERROR') {
        setStatus('error');
        setLastError(message.message || 'Sambungan kuiz bermasalah.');
      }

      onMessage(message);
    };

    socket.onerror = () => {
      setLastError('Sambungan kuiz terganggu.');
      socket.close();
    };

    socket.onclose = () => {
      if (ws.current === socket) ws.current = null;
      if (!shouldReconnect.current || !enabled) {
        setStatus('idle');
        return;
      }
      setStatus('reconnecting');
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, [sessionId, participantToken, onMessage, enabled]);

  useEffect(() => {
    connect();
    return () => {
      shouldReconnect.current = false;
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected: status === 'connected', status, lastError, send };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function optionText(option, index) {
  if (option && typeof option === 'object') {
    return `${option.text ?? option.label ?? option.value ?? option.answer ?? `Pilihan ${index + 1}`}`;
  }
  return `${option ?? `Pilihan ${index + 1}`}`;
}

function cleanAnswerText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return `${value}`.trim();
}

function stringListFromValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          return cleanAnswerText(item.step ?? item.text ?? item.label ?? item.value ?? item.answer ?? '');
        }
        return cleanAnswerText(item);
      })
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    const raw = value.order ?? value.answers ?? value.value;
    if (Array.isArray(raw)) return stringListFromValue(raw);
  }

  return `${value ?? ''}`
    .split(/\r?\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pairFromLine(line) {
  const text = `${line ?? ''}`.trim();
  if (!text) return null;
  const match = text.match(/^(.*?)\s*(?:=|->|:)\s*(.*?)$/);
  if (!match) return null;
  const prompt = match[1].trim();
  const answer = match[2].trim();
  return prompt && answer ? { prompt, answer } : null;
}

function answerPairsFromValue(value) {
  if (Array.isArray(value)) {
    return value.flatMap(answerPairsFromValue);
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.pairs)) return answerPairsFromValue(value.pairs);

    const prompt = cleanAnswerText(value.prompt ?? value.left ?? value.label ?? value.term);
    const answer = cleanAnswerText(value.answer ?? value.right ?? value.value ?? value.match);
    if (prompt || answer) return prompt && answer ? [{ prompt, answer }] : [];

    return Object.entries(value)
      .map(([key, val]) => ({ prompt: cleanAnswerText(key), answer: cleanAnswerText(val) }))
      .filter((pair) => pair.prompt && pair.answer);
  }

  return `${value ?? ''}`
    .split(/\r?\n|;/)
    .map(pairFromLine)
    .filter(Boolean);
}

function pairsToObject(pairs) {
  return pairs.reduce((acc, pair) => {
    if (pair.prompt && pair.answer) acc[pair.prompt] = pair.answer;
    return acc;
  }, {});
}

function answerTextFromValue(value) {
  if (Array.isArray(value)) return stringListFromValue(value).join('\n');
  if (value && typeof value === 'object') {
    if (value.optionIndex !== undefined || value.option_index !== undefined) {
      return `${value.optionIndex ?? value.option_index}`;
    }
    if (value.value !== undefined) {
      return [value.value, value.unit].map(cleanAnswerText).filter(Boolean).join(' ');
    }
    return answerPairsFromValue(value)
      .map((pair) => `${pair.prompt} = ${pair.answer}`)
      .join('\n');
  }
  return cleanAnswerText(value);
}

function correctOptionIndex(question) {
  const raw = question?.correctAnswer ?? question?.correct_answer;
  if (Number.isInteger(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const index = raw.optionIndex ?? raw.option_index ?? raw.index;
    return Number.isInteger(Number(index)) ? Number(index) : null;
  }
  return null;
}

function normalizeLiveOption(option, index) {
  const raw = option && typeof option === 'object' ? option : {};
  const text = optionText(option, index);
  return {
    text,
    prompt: cleanAnswerText(raw.prompt ?? raw.left ?? raw.term ?? raw.label ?? text),
    answer: cleanAnswerText(raw.answer ?? raw.right ?? raw.value ?? raw.match ?? text),
    step: cleanAnswerText(raw.step ?? raw.text ?? raw.label ?? raw.value ?? text),
    isCorrect: Boolean(raw.isCorrect ?? raw.is_correct),
    raw: option,
  };
}

function normalizeLiveQuestion(question) {
  if (!question) return null;
  const correctIndex = correctOptionIndex(question);
  const type = normalizeQuizQuestionType(question.questionType || question.question_type || question.type);
  const rawOptions = asArray(question.options);
  const options = (type === 'true_false' && rawOptions.length === 0 ? ['True', 'False'] : rawOptions)
    .map((option, index) => {
      const normalized = normalizeLiveOption(option, index);
      return {
        ...normalized,
        isCorrect: normalized.isCorrect || correctIndex === index,
      };
    });
  return {
    id: question.id,
    text: question.questionText || question.question_text || question.text || 'Soalan',
    type,
    timeLimitSeconds: Number(question.timeLimitSeconds ?? question.time_limit_seconds) || 20,
    points: Number(question.points) || 1000,
    options,
  };
}

function dateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function sessionValue(session, camel, snake) {
  return session?.[camel] ?? session?.[snake] ?? null;
}

function computeTimeLeftSeconds(session, question) {
  if (!session || session.status !== 'active') return 0;
  const remainingMs = Number(sessionValue(session, 'questionRemainingMs', 'question_remaining_ms'));
  if (sessionValue(session, 'questionPausedAt', 'question_paused_at')) {
    return Math.max(0, Math.ceil((Number.isFinite(remainingMs) ? remainingMs : 0) / 1000));
  }
  const endsAt = dateMs(sessionValue(session, 'questionEndsAt', 'question_ends_at'));
  if (!endsAt) return Number(question?.timeLimitSeconds) || 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function snapshotToState(snapshot, fallbackSession = {}) {
  const session = snapshot?.session || fallbackSession || {};
  const question = normalizeLiveQuestion(snapshot?.currentQuestion);
  const status = session.status || fallbackSession.status || 'lobby';
  const timeLeft = computeTimeLeftSeconds(session, question);
  const totalTime = Math.max(Number(question?.timeLimitSeconds) || 20, timeLeft || 0);

  return {
    phase: status === 'ended' || status === 'cancelled'
      ? 'ended'
      : status === 'active'
        ? 'question'
        : 'lobby',
    session,
    deck: snapshot?.deck || null,
    question,
    leaderboard: asArray(snapshot?.leaderboard),
    results: snapshot?.results || null,
    participant: snapshot?.participant || null,
    timeLeft,
    totalTime,
    paused: Boolean(sessionValue(session, 'questionPausedAt', 'question_paused_at')),
    answer: null,
  };
}

function TimerBar({ seconds, total, paused }) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const pct = Math.max(0, Math.min(100, (seconds / safeTotal) * 100));
  const color = paused ? '#f5a623' : pct > 50 ? 'var(--c-accent)' : pct > 20 ? '#f5a623' : '#e53935';
  return (
    <div style={{ background:'var(--c-bdr)', borderRadius:99, height:10, overflow:'hidden', margin:'8px 0' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, transition:'width .4s linear' }} />
    </div>
  );
}

function LiveConnectionBanner({ status, lastError }) {
  if (status === 'connected') return null;
  const text =
    status === 'reconnecting' ? 'Sambungan langsung terputus. Cuba sambung semula...' :
    status === 'authenticating' ? 'Mengesahkan sambungan kuiz...' :
    status === 'error' ? (lastError || 'Sambungan kuiz bermasalah.') :
    'Menyambung ke sesi langsung...';

  return (
    <div style={{
      background:'rgba(245,158,11,.14)',
      border:'1px solid rgba(245,158,11,.45)',
      color:'#b45309',
      borderRadius:12,
      padding:'9px 12px',
      fontSize:12,
      fontWeight:900,
      marginBottom:12,
    }}>
      {text}
    </div>
  );
}

function QuizStateBadge({ phase }) {
  const { t } = useLanguage();
  const meta = {
    lobby: { label:t('Lobi', 'Lobby'), bg:'rgba(245,166,35,.14)', border:'rgba(245,166,35,.42)', color:'#f5a623' },
    question: { label:t('Sedang berjalan', 'In progress'), bg:'rgba(34,197,94,.12)', border:'rgba(34,197,94,.34)', color:'#22c55e' },
    ended: { label:t('Keputusan', 'Results'), bg:'rgba(139,92,246,.13)', border:'rgba(139,92,246,.36)', color:'var(--c-accent)' },
  }[phase] || { label:t('Kuiz', 'Quiz'), bg:'var(--c-card)', border:'var(--c-bdr)', color:'var(--c-text2)' };
  return (
    <span style={{
      display:'inline-flex',
      alignItems:'center',
      minHeight:28,
      padding:'0 10px',
      borderRadius:999,
      background:meta.bg,
      border:`1px solid ${meta.border}`,
      color:meta.color,
      fontSize:11,
      fontWeight:900,
      whiteSpace:'nowrap',
    }}>{meta.label}</span>
  );
}

function QuizConfirmModal({ open, title, message, confirmLabel, busy, onConfirm, onCancel }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position:'fixed',
        inset:0,
        zIndex:1600,
        background:'rgba(0,0,0,.62)',
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:18,
      }}
      onClick={(event) => event.target === event.currentTarget && !busy && onCancel?.()}
    >
      <div style={{
        width:'100%',
        maxWidth:400,
        background:'var(--c-surface)',
        border:'1px solid rgba(229,57,53,.38)',
        borderRadius:16,
        padding:18,
        boxShadow:'0 22px 54px rgba(0,0,0,.38)',
      }}>
        <div style={{ fontWeight:900, fontSize:17, color:'#e53935', marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:13, color:'var(--c-text2)', fontWeight:800, lineHeight:1.45, marginBottom:14 }}>{message}</div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              minHeight:44,
              background:'var(--c-card)',
              border:'1px solid var(--c-bdr)',
              borderRadius:12,
              padding:'0 14px',
              color:'var(--c-text2)',
              fontWeight:900,
              cursor:busy ? 'not-allowed' : 'pointer',
            }}
          >{t('Batal', 'Cancel')}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              minHeight:44,
              background:'rgba(229,57,53,.14)',
              border:'1px solid rgba(229,57,53,.38)',
              borderRadius:12,
              padding:'0 16px',
              color:'#e53935',
              fontWeight:900,
              cursor:busy ? 'not-allowed' : 'pointer',
              opacity:busy ? .6 : 1,
            }}
          >{busy ? t('Memadam...', 'Deleting...') : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function QuizDeckOverflowMenu({ deck, onDelete, disabled }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const title = deck?.title || t('dek kuiz', 'quiz deck');
  return (
    <div style={{ position:'relative', display:'inline-flex', flexShrink:0 }} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('Tindakan lanjut untuk', 'More actions for')} ${title}`}
        title={t('Tindakan lanjut', 'More actions')}
        style={{
          width:44,
          height:44,
          background:'var(--c-card)',
          border:'1px solid var(--c-bdr)',
          borderRadius:8,
          color:'var(--c-text2)',
          cursor:'pointer',
          fontSize:18,
          fontWeight:900,
        }}
      >...</button>
      {open && (
        <div
          role="menu"
          style={{
            position:'absolute',
            top:48,
            right:0,
            zIndex:420,
            minWidth:188,
            padding:6,
            background:'var(--c-surface)',
            border:'1px solid var(--c-bdr)',
            borderRadius:12,
            boxShadow:'0 16px 38px rgba(0,0,0,.32)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete(deck);
            }}
            style={{
              width:'100%',
              minHeight:44,
              display:'flex',
              alignItems:'center',
              background:'transparent',
              border:'none',
              borderRadius:9,
              padding:'9px 10px',
              textAlign:'left',
              color:'#e53935',
              fontWeight:900,
              fontSize:13,
              cursor:disabled ? 'not-allowed' : 'pointer',
              opacity:disabled ? .55 : 1,
            }}
          >
            {t('Padam dek', 'Delete deck')}
          </button>
        </div>
      )}
    </div>
  );
}

function QuizQuestionOverflowMenu({ onDelete, disabled }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative', display:'inline-flex', flexShrink:0 }} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Tindakan lanjut soalan', 'More question actions')}
        title={t('Tindakan lanjut', 'More actions')}
        style={{
          width:44,
          height:44,
          background:'var(--c-card)',
          border:'1px solid var(--c-bdr)',
          borderRadius:8,
          color:'var(--c-text2)',
          cursor:'pointer',
          fontSize:18,
          fontWeight:900,
        }}
      >...</button>
      {open && (
        <div
          role="menu"
          style={{
            position:'absolute',
            top:48,
            right:0,
            zIndex:420,
            minWidth:168,
            padding:6,
            background:'var(--c-surface)',
            border:'1px solid var(--c-bdr)',
            borderRadius:12,
            boxShadow:'0 16px 38px rgba(0,0,0,.32)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete?.();
            }}
            style={{
              width:'100%',
              minHeight:44,
              display:'flex',
              alignItems:'center',
              background:'transparent',
              border:'none',
              borderRadius:9,
              padding:'9px 10px',
              textAlign:'left',
              color:'#e53935',
              fontWeight:900,
              fontSize:13,
              cursor:disabled ? 'not-allowed' : 'pointer',
              opacity:disabled ? .55 : 1,
            }}
          >
            {t('Buang soalan', 'Remove question')}
          </button>
        </div>
      )}
    </div>
  );
}

const TILE_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b'];
const TILE_SHAPES = ['A', 'B', 'C', 'D', 'E', 'F'];

function AnswerTile({ index, text, selected, correct, revealed, onClick, disabled }) {
  let bg = TILE_COLORS[index % TILE_COLORS.length];
  if (revealed) bg = correct ? '#43a047' : (selected ? '#e53935' : '#555');
  return (
    <button
      onClick={onClick}
      disabled={disabled || revealed}
      style={{
        background:bg,
        color:'#fff',
        border:'none',
        borderRadius:12,
        padding:'14px 16px',
        minHeight:72,
        height:'100%',
        fontSize:15,
        fontWeight:800,
        lineHeight:1.35,
        textAlign:'left',
        cursor:disabled || revealed ? 'default' : 'pointer',
        opacity:disabled && !selected ? .72 : 1,
        display:'flex',
        gap:10,
        alignItems:'flex-start',
      }}
    >
      <span style={{
        display:'inline-flex',
        alignItems:'center',
        justifyContent:'center',
        width:26,
        height:26,
        borderRadius:13,
        background:'rgba(255,255,255,.22)',
        flexShrink:0,
        lineHeight:1,
      }}>{TILE_SHAPES[index % TILE_SHAPES.length]}</span>
      <span style={{ minWidth:0, overflowWrap:'anywhere' }}>{text}</span>
    </button>
  );
}

function livePairsFromQuestion(question) {
  return asArray(question?.options)
    .map((option) => ({
      prompt: cleanAnswerText(option.prompt || option.text),
      answer: cleanAnswerText(option.answer || option.text),
    }))
    .filter((pair) => pair.prompt && pair.answer);
}

function liveStepsFromQuestion(question) {
  return asArray(question?.options)
    .map((option) => cleanAnswerText(option.step || option.text))
    .filter(Boolean);
}

function quizAnswerIsBlank(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return `${value}`.trim().length === 0;
}

function defaultAnswerDraft(question) {
  const type = normalizeQuizQuestionType(question?.type);
  if (PAIR_QUESTION_TYPES.has(type)) return {};
  if (type === 'step_order') return [];
  return '';
}

function answerDraftComplete(question, answer) {
  const type = normalizeQuizQuestionType(question?.type);
  if (PAIR_QUESTION_TYPES.has(type)) {
    const pairs = livePairsFromQuestion(question);
    return pairs.length > 0 && pairs.every((pair) => cleanAnswerText(answer?.[pair.prompt]));
  }
  if (type === 'step_order') {
    return Array.isArray(answer) && answer.length === liveStepsFromQuestion(question).length;
  }
  return !quizAnswerIsBlank(answer);
}

function PairMatchAnswerControl({ question, value, onChange, disabled }) {
  const pairs = livePairsFromQuestion(question);
  const answers = pairs.map((pair) => pair.answer).slice().reverse();
  const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  if (pairs.length === 0) {
    return <div style={{ color:'var(--c-text2)', fontWeight:800, fontSize:13 }}>Pasangan jawapan belum disediakan.</div>;
  }

  return (
    <div style={{ display:'grid', gap:8 }}>
      {pairs.map((pair, index) => (
        <div
          key={`${pair.prompt}-${index}`}
          style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',
            gap:8,
            alignItems:'center',
          }}
        >
          <div style={{
            minHeight:44,
            border:'1px solid var(--c-bdr)',
            borderRadius:10,
            padding:'10px 12px',
            background:'var(--c-card)',
            fontWeight:900,
            overflowWrap:'anywhere',
          }}>
            {pair.prompt}
          </div>
          <select
            value={current[pair.prompt] || ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...current, [pair.prompt]:event.target.value })}
            style={{
              minHeight:44,
              border:'1px solid var(--c-bdr)',
              borderRadius:10,
              padding:'8px 10px',
              background:'var(--c-card)',
              color:'var(--c-text)',
              fontWeight:800,
            }}
          >
            <option value="">Pilih padanan</option>
            {answers.map((answer, answerIndex) => (
              <option key={`${answer}-${answerIndex}`} value={answer}>{answer}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function StepOrderAnswerControl({ question, value, onChange, disabled }) {
  const steps = liveStepsFromQuestion(question);
  const selected = Array.isArray(value) ? value : [];
  const selectedKeys = selected.map((item) => cleanAnswerText(item).toLowerCase());
  const remaining = steps.filter((step) => !selectedKeys.includes(step.toLowerCase()));

  if (steps.length === 0) {
    return <div style={{ color:'var(--c-text2)', fontWeight:800, fontSize:13 }}>Langkah belum disediakan.</div>;
  }

  const addStep = (step) => {
    if (disabled) return;
    onChange([...selected, step]);
  };
  const removeStep = (index) => {
    if (disabled) return;
    onChange(selected.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, minHeight:48, marginBottom:10 }}>
        {selected.length === 0 && (
          <div style={{ color:'var(--c-text3)', fontSize:13, fontWeight:800, padding:'10px 0' }}>
            Pilih langkah mengikut urutan.
          </div>
        )}
        {selected.map((step, index) => (
          <button
            key={`${step}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => removeStep(index)}
            style={{
              border:'1px solid var(--c-accent)',
              borderRadius:10,
              padding:'8px 10px',
              background:'rgba(139,92,246,.16)',
              color:'var(--c-text)',
              fontWeight:900,
              cursor:disabled ? 'default' : 'pointer',
            }}
          >
            {index + 1}. {step}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {remaining.map((step, index) => (
          <button
            key={`${step}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => addStep(step)}
            className="btn-ghost"
            style={{ minHeight:40, fontWeight:900 }}
          >
            {step}
          </button>
        ))}
        {selected.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            style={{
              minHeight:40,
              border:'1px solid var(--c-bdr)',
              borderRadius:10,
              background:'transparent',
              color:'var(--c-text2)',
              fontWeight:900,
              padding:'7px 10px',
              cursor:disabled ? 'default' : 'pointer',
            }}
          >
            Set semula
          </button>
        )}
      </div>
    </div>
  );
}

function TextAnswerControl({ question, value, onChange, disabled }) {
  const type = normalizeQuizQuestionType(question?.type);
  const compact = type === 'numeric' || type === 'fill_blank';
  return (
    <textarea
      value={value || ''}
      disabled={disabled}
      rows={compact ? 1 : 4}
      placeholder={type === 'numeric' ? 'Contoh: 9.8 m/s^2' : 'Tulis jawapan...'}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width:'100%',
        resize:'vertical',
        minHeight:compact ? 44 : 104,
        border:'1px solid var(--c-bdr)',
        borderRadius:10,
        padding:'10px 12px',
        background:'var(--c-card)',
        color:'var(--c-text)',
        fontSize:14,
        fontWeight:800,
        lineHeight:1.4,
      }}
    />
  );
}

function StructuredAnswerActivity({ question, value, onChange, disabled }) {
  const type = normalizeQuizQuestionType(question?.type);
  if (PAIR_QUESTION_TYPES.has(type)) {
    return <PairMatchAnswerControl question={question} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (type === 'step_order') {
    return <StepOrderAnswerControl question={question} value={value} onChange={onChange} disabled={disabled} />;
  }
  return <TextAnswerControl question={question} value={value} onChange={onChange} disabled={disabled} />;
}

function ProjectorPinOverlay({ pin, deckTitle, participantsCount, onClose }) {
  const { t } = useLanguage();
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position:'fixed',
        inset:0,
        zIndex:3000,
        background:'#050505',
        color:'#fff',
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        justifyContent:'center',
        textAlign:'center',
        padding:'5vh 5vw',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position:'absolute',
          top:18,
          right:18,
          background:'#fff',
          color:'#000',
          border:'none',
          borderRadius:10,
          padding:'10px 14px',
          fontWeight:900,
          cursor:'pointer',
        }}
      >
        {t('Tutup', 'Close')}
      </button>
      <div style={{ fontSize:'clamp(28px, 5vw, 64px)', fontWeight:900, marginBottom:'3vh' }}>
        {t('Sertai Kuiz', 'Join Quiz')}
      </div>
      <div style={{
        fontSize:'clamp(96px, 22vw, 260px)',
        lineHeight:.95,
        fontWeight:900,
        letterSpacing:'clamp(8px, 2vw, 28px)',
        color:'#fff',
        textShadow:'0 0 34px rgba(255,255,255,.28)',
      }}>
        {pin}
      </div>
      <div style={{ marginTop:'4vh', fontSize:'clamp(20px, 3vw, 40px)', fontWeight:800, color:'#fef08a' }}>
        {t('PIN sesi', 'Session PIN')}
      </div>
      <div style={{ marginTop:14, fontSize:'clamp(16px, 2vw, 28px)', color:'#d4d4d4', fontWeight:800 }}>
        {deckTitle || t('Kuiz langsung', 'Live quiz')} - {participantsCount || 0} {t('peserta', 'participants')}
      </div>
    </div>
  );
}

function ResultsScreen({ live, isTeacher, participantToken, onEnd }) {
  const { t } = useLanguage();
  const results = live.results || {};
  const summary = results.summary || {};
  const questions = asArray(results.questionAccuracy);
  const topPerformers = asArray(results.topPerformers).length ? results.topPerformers : live.leaderboard;
  const participantCount = summary.participantCount ?? live.session?.participantsCount ?? topPerformers.length;
  const questionCount = summary.questionCount ?? questions.length;
  const isStudent = !isTeacher;
  const sessionId = live.session?.id || live.session?.sessionId;
  const joinToken =
    participantToken ||
    live.participant?.joinToken ||
    live.participant?.participantToken ||
    live.participant?.join_token;
  const [reviewItems, setReviewItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!isStudent || !sessionId || !joinToken || !window.tusyenApi?.quizSessionReview) {
      setReviewItems(null);
      return () => { cancelled = true; };
    }
    window.tusyenApi.quizSessionReview(sessionId, joinToken)
      .then(({ review }) => {
        if (!cancelled) setReviewItems(Array.isArray(review) ? review : []);
      })
      .catch(() => {
        if (!cancelled) setReviewItems(null);
      });
    return () => { cancelled = true; };
  }, [sessionId, joinToken, isStudent]);

  return (
    <div style={{ padding:16 }}>
      <div style={{ textAlign:'center', marginBottom:18 }}>
        <div style={{ fontSize:42, marginBottom:6 }}>{t('Tamat', 'Ended')}</div>
        <div style={{ marginBottom:8 }}><QuizStateBadge phase="ended" /></div>
        <div style={{ fontSize:22, fontWeight:900 }}>{t('Keputusan Kuiz', 'Quiz Results')}</div>
        <div style={{ color:'var(--c-text2)', fontSize:13, marginTop:4 }}>
          {live.deck?.title || live.session?.deckTitle || t('Kuiz langsung', 'Live quiz')}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:16 }}>
        {[
          { label:t('Peserta', 'Participants'), value:participantCount },
          { label:t('Soalan', 'Questions'), value:questionCount },
          { label:t('Ketepatan', 'Accuracy'), value:`${summary.averageAccuracy ?? 0}%` },
        ].map((item) => (
          <Card key={item.label} style={{ textAlign:'center', padding:12 }}>
            <div style={{ fontSize:22, fontWeight:900, color:'var(--c-accent)' }}>{item.value}</div>
            <div style={{ fontSize:10, fontWeight:900, color:'var(--c-text3)', textTransform:'uppercase' }}>{item.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom:14 }}>
        <div style={{ fontWeight:900, marginBottom:10 }}>{t('Peserta Teratas', 'Top Participants')}</div>
        {topPerformers.length === 0 ? (
          <div style={{ color:'var(--c-text2)', fontSize:13 }}>{t('Belum ada markah direkodkan.', 'No scores recorded yet.')}</div>
        ) : topPerformers.slice(0, 5).map((p, i) => (
          <div key={p.participantId || p.id || i} style={{
            display:'flex',
            justifyContent:'space-between',
            alignItems:'center',
            padding:'7px 0',
            borderBottom:i < Math.min(topPerformers.length, 5) - 1 ? '1px solid var(--c-bdr)' : 'none',
            fontSize:14,
          }}>
            <span style={{ fontWeight:800 }}>{p.rank || i + 1}. {p.displayName || p.nickname || p.name || t('Peserta', 'Participant')}</span>
            <span style={{ fontWeight:900, color:'var(--c-accent)' }}>{p.totalScore ?? p.score ?? 0} XP</span>
          </div>
        ))}
      </Card>

      <Card style={{ marginBottom:16 }}>
        <div style={{ fontWeight:900, marginBottom:10 }}>{t('Ketepatan Setiap Soalan', 'Accuracy By Question')}</div>
        {questions.length === 0 ? (
          <div style={{ color:'var(--c-text2)', fontSize:13 }}>{t('Ringkasan soalan akan dipaparkan apabila jawapan direkodkan.', 'Question summaries will appear when answers are recorded.')}</div>
        ) : questions.map((q, i) => (
          <div key={q.questionId || i} style={{ marginBottom:i < questions.length - 1 ? 12 : 0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:5 }}>
              <div style={{ fontWeight:800, fontSize:13, color:'var(--c-text)', overflowWrap:'anywhere' }}>
                {i + 1}. {q.questionText || t('Soalan', 'Question')}
              </div>
              <div style={{ color:'var(--c-accent)', fontWeight:900, fontSize:13, flexShrink:0 }}>{q.accuracy ?? 0}%</div>
            </div>
            <div style={{ height:8, borderRadius:99, background:'var(--c-bdr)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.max(0, Math.min(100, Number(q.accuracy) || 0))}%`, background:'var(--c-accent)' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--c-text3)', fontWeight:700, marginTop:4 }}>
              {q.correctCount || 0}/{q.answerCount || 0} {t('betul', 'correct')}
              {q.noAnswerCount ? ` - ${q.noAnswerCount} ${t('tidak menjawab', 'no answer')}` : ''}
            </div>
          </div>
        ))}
      </Card>

      {isStudent && reviewItems && reviewItems.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontWeight:900, marginBottom:12 }}>
            {t('Semakan soalan', 'Question Review')}
          </div>
          {reviewItems.map((item, i) => (
            <div
              key={`${item.orderIndex ?? i}-${item.questionText || i}`}
              style={{
                marginBottom:i < reviewItems.length - 1 ? 12 : 0,
                padding:12,
                borderRadius:10,
                background:item.isCorrect ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)',
                border:`1px solid ${item.isCorrect ? 'rgba(34,197,94,.28)' : 'rgba(239,68,68,.28)'}`,
              }}
            >
              <div style={{ fontWeight:800, fontSize:13, marginBottom:6, overflowWrap:'anywhere' }}>
                {i + 1}. {item.questionText || t('Soalan', 'Question')}
              </div>
              <div style={{ fontSize:12, color:'var(--c-text2)', marginBottom:3 }}>
                {t('Jawapan anda', 'Your answer')}:{' '}
                <span style={{ color:item.isCorrect ? '#4ade80' : '#f87171', fontWeight:800 }}>
                  {item.didAnswer ? (item.selectedAnswer ?? t('Tidak dijawab', 'Not answered')) : t('Tidak dijawab', 'Not answered')}
                </span>
              </div>
              {!item.isCorrect && item.correctAnswer !== null && item.correctAnswer !== undefined && (
                <div style={{ fontSize:12, color:'var(--c-text2)', marginBottom:3 }}>
                  {t('Jawapan betul', 'Correct answer')}:{' '}
                  <span style={{ color:'#4ade80', fontWeight:800 }}>{item.correctAnswer}</span>
                </div>
              )}
              {item.explanation && (
                <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:5, fontStyle:'italic', lineHeight:1.4 }}>
                  {item.explanation}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {isTeacher && (
        <GlowButton onClick={onEnd}>{t('Kembali ke dek', 'Back to decks')}</GlowButton>
      )}
      {!isTeacher && (
        <GlowButton onClick={onEnd}>{t('Selesai', 'Done')}</GlowButton>
      )}
    </div>
  );
}

function QuizLiveSession({ session, initialSnapshot, participantToken, isTeacher, onEnd }) {
  const { t } = useLanguage();
  const [live, setLive] = useState(() => snapshotToState(initialSnapshot, session));
  const [projector, setProjector] = useState(false);
  const [controlBusy, setControlBusy] = useState('');
  const [controlError, setControlError] = useState('');
  const [answerDraft, setAnswerDraft] = useState(() => defaultAnswerDraft(live.question));

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    setLive((previous) => {
      const next = snapshotToState(snapshot, session);
      if (previous.question?.id && previous.question.id === next.question?.id && next.phase === 'question') {
        next.answer = previous.answer;
      }
      return next;
    });
  }, [session]);

  const handleSocketMessage = useCallback((message) => {
    if (message?.snapshot) applySnapshot(message.snapshot);
  }, [applySnapshot]);

  const socket = useQuizSocket(session?.id, {
    participantToken,
    onMessage: handleSocketMessage,
    enabled: Boolean(session?.id),
  });

  useEffect(() => {
    if (initialSnapshot) applySnapshot(initialSnapshot);
  }, [initialSnapshot, applySnapshot]);

  useEffect(() => {
    setAnswerDraft(defaultAnswerDraft(live.question));
  }, [live.question?.id, live.question?.type]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.id) return undefined;
    window.tusyenApi.quizSessionState(session.id, { participantToken })
      .then((data) => { if (!cancelled) applySnapshot(data.snapshot); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session?.id, participantToken, applySnapshot]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLive((current) => {
        if (current.phase !== 'question') return current;
        const timeLeft = computeTimeLeftSeconds(current.session, current.question);
        if (timeLeft === current.timeLeft) return current;
        return { ...current, timeLeft, totalTime:Math.max(current.totalTime, timeLeft) };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pin = live.session?.pin || session?.pin || '';
  const participantsCount = live.session?.participantsCount ?? live.session?.participants_count ?? live.leaderboard.length;

  const submitChoiceAnswer = async (idx) => {
    if (isTeacher || live.answer !== null || live.paused || live.timeLeft <= 0) return;
    setLive((current) => ({ ...current, answer:idx }));
    try {
      const data = await window.tusyenApi.submitQuizAnswer(session.id, { participantToken, selectedOptionIndex:idx });
      if (data.snapshot) applySnapshot(data.snapshot);
    } catch (err) {
      setControlError(err.message || t('Jawapan tidak dapat dihantar.', 'Answer could not be submitted.'));
      setLive((current) => ({ ...current, answer:null }));
    }
  };

  const submitStructuredAnswer = async () => {
    if (isTeacher || live.answer !== null || live.paused || live.timeLeft <= 0) return;
    if (!answerDraftComplete(live.question, answerDraft)) {
      setControlError('Lengkapkan jawapan sebelum hantar.');
      return;
    }
    setControlError('');
    setLive((current) => ({ ...current, answer:answerDraft }));
    try {
      const data = await window.tusyenApi.submitQuizAnswer(session.id, { participantToken, selectedAnswer:answerDraft });
      if (data.snapshot) applySnapshot(data.snapshot);
    } catch (err) {
      setControlError(err.message || 'Jawapan tidak dapat dihantar.');
      setLive((current) => ({ ...current, answer:null }));
    }
  };

  const startQuiz = async () => {
    setControlBusy('start'); setControlError('');
    try {
      const data = await window.tusyenApi.startQuizSession(session.id);
      applySnapshot(data.snapshot);
    } catch (err) {
      setControlError(err.message || t('Tidak dapat memulakan kuiz.', 'Could not start the quiz.'));
    } finally {
      setControlBusy('');
    }
  };

  const advanceQuiz = async () => {
    setControlBusy('advance'); setControlError('');
    try {
      const data = await window.tusyenApi.advanceQuizSession(session.id);
      applySnapshot(data.snapshot);
    } catch (err) {
      setControlError(err.message || t('Tidak dapat pergi ke soalan seterusnya.', 'Could not move to the next question.'));
    } finally {
      setControlBusy('');
    }
  };

  const endQuiz = async () => {
    setControlBusy('end'); setControlError('');
    try {
      const data = await window.tusyenApi.endQuizSession(session.id);
      applySnapshot(data.snapshot);
    } catch (err) {
      setControlError(err.message || t('Tidak dapat menamatkan kuiz.', 'Could not end the quiz.'));
    } finally {
      setControlBusy('');
    }
  };

  const timerControl = async (action, seconds) => {
    setControlBusy(action); setControlError('');
    try {
      const data = await window.tusyenApi.updateQuizTimer(session.id, { action, seconds });
      applySnapshot(data.snapshot);
    } catch (err) {
      setControlError(err.message || t('Tidak dapat mengemas kini pemasa.', 'Could not update the timer.'));
    } finally {
      setControlBusy('');
    }
  };

  if (live.phase === 'lobby') return (
    <div style={{ padding:16 }}>
      <LiveConnectionBanner status={socket.status} lastError={socket.lastError} />
      {projector && (
        <ProjectorPinOverlay
          pin={pin}
          deckTitle={live.deck?.title || live.session?.deckTitle}
          participantsCount={participantsCount}
          onClose={() => setProjector(false)}
        />
      )}
      <div style={{ textAlign:'center', padding:'28px 10px' }}>
        <div style={{ marginBottom:10 }}><QuizStateBadge phase="lobby" /></div>
        <div style={{ fontSize:14, color:'var(--c-text2)', fontWeight:900, marginBottom:8 }}>{t('PIN untuk sertai', 'PIN to join')}</div>
        <div style={{
          display:'inline-block',
          fontSize:'clamp(52px, 14vw, 112px)',
          lineHeight:1,
          fontWeight:900,
          color:'var(--c-accent)',
          letterSpacing:8,
          marginBottom:12,
        }}>
          {pin}
        </div>
        <div style={{ marginBottom:18, color:'var(--c-text3)', fontSize:13, fontWeight:800 }}>
          {participantsCount} {t('peserta dalam lobi', 'participants in lobby')}
        </div>
        {controlError && <div style={{ color:'#e53935', fontSize:13, fontWeight:800, marginBottom:10 }}>{controlError}</div>}
        {isTeacher ? (
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <GlowButton onClick={startQuiz} disabled={controlBusy === 'start'}>
              {controlBusy === 'start' ? t('Memulakan...', 'Starting...') : t('Mulakan Kuiz', 'Start Quiz')}
            </GlowButton>
            <button className="btn-ghost" onClick={() => setProjector(true)} style={{ minHeight:44 }}>
              {t('Paparan PIN', 'PIN Display')}
            </button>
          </div>
        ) : (
          <div style={{ color:'var(--c-text2)', fontWeight:800 }}>{t('Menunggu guru memulakan...', 'Waiting for the teacher to start...')}</div>
        )}
      </div>
    </div>
  );

  if (live.phase === 'question') {
    const question = live.question;
    const teacherCanMove = isTeacher && !controlBusy;
    const isChoiceQuestion = CHOICE_QUESTION_TYPES.has(normalizeQuizQuestionType(question?.type));
    const answerDisabled = isTeacher || live.answer !== null || live.paused || live.timeLeft <= 0;
    const structuredReady = answerDraftComplete(question, answerDraft);
    return (
      <div style={{ padding:16 }}>
        <LiveConnectionBanner status={socket.status} lastError={socket.lastError} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <QuizStateBadge phase="question" />
            <div style={{ fontWeight:900, color:'var(--c-text2)', fontSize:12 }}>
              {t('Soalan', 'Question')} {(live.session?.currentQuestionIndex ?? 0) + 1}
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:900, color:live.paused ? '#f5a623' : 'var(--c-text)' }}>
            {live.paused ? t('Dijeda', 'Paused') : `${live.timeLeft}s`}
          </div>
        </div>
        <TimerBar seconds={live.timeLeft} total={live.totalTime} paused={live.paused} />

        {isTeacher && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'10px 0 14px' }}>
            <button
              onClick={() => timerControl(live.paused ? 'resume' : 'pause')}
              disabled={Boolean(controlBusy)}
              className="btn-ghost"
              style={{ minHeight:44 }}
            >
              {live.paused ? t('Sambung', 'Resume') : t('Jeda', 'Pause')}
            </button>
            <button
              onClick={() => timerControl('add_time', 15)}
              disabled={Boolean(controlBusy)}
              className="btn-ghost"
              style={{ minHeight:44 }}
            >
              +15s
            </button>
            <button
              onClick={advanceQuiz}
              disabled={!teacherCanMove}
              style={{
                background:'var(--c-accent)',
                color:'#fff',
                border:'none',
                borderRadius:10,
                padding:'8px 12px',
                minHeight:44,
                cursor:teacherCanMove ? 'pointer' : 'not-allowed',
                fontWeight:900,
              }}
            >
              {t('Soalan Seterusnya', 'Next Question')}
            </button>
            <button onClick={endQuiz} disabled={Boolean(controlBusy)} className="btn-ghost" style={{ minHeight:44 }}>
              {t('Tamatkan', 'End')}
            </button>
          </div>
        )}

        {controlError && <div style={{ color:'#e53935', fontSize:13, fontWeight:800, marginBottom:10 }}>{controlError}</div>}
        <div style={{ fontSize:20, fontWeight:900, marginBottom:18, lineHeight:1.35, overflowWrap:'anywhere' }}>
          {question?.text || t('Soalan sedang dimuatkan...', 'Question is loading...')}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <QuizStateBadge phase="question" />
          <span style={{ color:'var(--c-text2)', fontSize:12, fontWeight:900 }}>
            {quizQuestionTypeLabel(question?.type)}
          </span>
        </div>

        {isChoiceQuestion ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10, marginBottom:16 }}>
            {asArray(question?.options).map((opt, i) => (
              <AnswerTile
                key={i}
                index={i}
                text={opt.text}
                selected={live.answer === i}
                correct={opt.isCorrect}
                revealed={false}
                onClick={() => submitChoiceAnswer(i)}
                disabled={answerDisabled}
              />
            ))}
          </div>
        ) : (
          <Card style={{ padding:12, marginBottom:16 }}>
            <div style={{ color:'var(--c-text2)', fontSize:12, fontWeight:900, marginBottom:10 }}>
              {quizQuestionTypeHint(question?.type)}
            </div>
            <StructuredAnswerActivity
              question={question}
              value={answerDraft}
              onChange={(value) => { setAnswerDraft(value); setControlError(''); }}
              disabled={answerDisabled}
            />
            {!isTeacher && (
              <button
                onClick={submitStructuredAnswer}
                disabled={answerDisabled || !structuredReady}
                style={{
                  marginTop:12,
                  minHeight:44,
                  border:'none',
                  borderRadius:10,
                  padding:'8px 14px',
                  background:'var(--c-accent)',
                  color:'#fff',
                  fontWeight:900,
                  cursor:answerDisabled || !structuredReady ? 'not-allowed' : 'pointer',
                  opacity:answerDisabled || !structuredReady ? .62 : 1,
                }}
              >
                {live.answer !== null ? 'Jawapan dihantar' : 'Hantar jawapan'}
              </button>
            )}
          </Card>
        )}

        {live.leaderboard.length > 0 && (
          <Card style={{ padding:12 }}>
            <div style={{ fontWeight:900, marginBottom:8 }}>{t('Papan Skor Langsung', 'Live Scoreboard')}</div>
            {live.leaderboard.slice(0, 5).map((p, i) => (
              <div key={p.participantId || p.id || i} style={{
                display:'flex',
                justifyContent:'space-between',
                padding:'5px 0',
                borderBottom:i < Math.min(live.leaderboard.length, 5) - 1 ? '1px solid var(--c-bdr)' : 'none',
                fontSize:14,
              }}>
                <span>{p.rank || i + 1}. {p.displayName || p.nickname || p.name}</span>
                <span style={{ fontWeight:900, color:'var(--c-accent)' }}>{p.totalScore ?? p.score ?? 0} XP</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  if (live.phase === 'ended') {
    return <ResultsScreen live={live} isTeacher={isTeacher} participantToken={participantToken} onEnd={onEnd} />;
  }

  return null;
}

function GuestPinJoin({ onJoined }) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastAutoJoin = useRef('');

  const submitJoin = useCallback(async (pinValue = pin, nicknameValue = nickname) => {
    const cleanPin = cleanQuizPin(pinValue);
    const cleanNickname = `${nicknameValue}`.trim().slice(0, QUIZ_NICKNAME_MAX);
    if (cleanPin.length !== 6) { setError(t('PIN mesti 6 digit.', 'PIN must be 6 digits.')); return; }
    if (!cleanNickname) { setError(t('Nama panggilan diperlukan.', 'Nickname is required.')); return; }
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await window.tusyenApi.joinQuizByPin({ pin:cleanPin, nickname:cleanNickname });
      onJoined(data);
    } catch (err) {
      setError(quizJoinErrorMessage(err.message));
    } finally {
      setBusy(false);
    }
  }, [pin, nickname, busy, onJoined, t]);

  const maybeAutoJoin = useCallback((nextPin, nextNickname) => {
    const key = `${nextPin}:${`${nextNickname}`.trim()}`;
    if (nextPin.length === 6 && `${nextNickname}`.trim() && key !== lastAutoJoin.current && !busy) {
      lastAutoJoin.current = key;
      window.setTimeout(() => submitJoin(nextPin, nextNickname), 0);
    }
  }, [busy, submitJoin]);

  const submit = async (e) => {
    e.preventDefault();
    submitJoin();
  };

  return (
    <div style={{ maxWidth:360, margin:'40px auto', padding:24 }}>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ fontSize:20, fontWeight:900 }}>{t('Sertai Kuiz', 'Join Quiz')}</div>
        <div style={{ color:'var(--c-text2)', fontSize:14 }}>{t('Masukkan PIN 6 digit daripada guru', 'Enter the 6-digit PIN from your teacher')}</div>
      </div>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <label style={{ fontSize:12, color:'var(--c-text2)', fontWeight:900 }}>
          {t('PIN Kuiz (6 digit)', 'Quiz PIN (6 digits)')}
        </label>
        <input
          placeholder="000000"
          value={pin}
          maxLength={6}
          inputMode="numeric"
          aria-label={t('PIN kuiz 6 digit', '6-digit quiz PIN')}
          onChange={e => {
            const next = cleanQuizPin(e.target.value);
            setPin(next);
            setError('');
            maybeAutoJoin(next, nickname);
          }}
          style={{ fontSize:28, textAlign:'center', letterSpacing:8, padding:'12px 0', borderRadius:10, border:'2px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)' }}
          required
        />
        <div style={{ fontSize:11, color:'var(--c-text3)', fontWeight:800, marginTop:-8 }}>
          {pin.length}/6 digit
        </div>
        <label style={{ fontSize:12, color:'var(--c-text2)', fontWeight:900 }}>
          {t('Nama panggilan', 'Nickname')}
        </label>
        <input
          placeholder={t('Nama panggilan', 'Nickname')}
          value={nickname}
          maxLength={QUIZ_NICKNAME_MAX}
          onChange={e => {
            const next = e.target.value.slice(0, QUIZ_NICKNAME_MAX);
            setNickname(next);
            setError('');
            maybeAutoJoin(pin, next);
          }}
          style={{ padding:'10px 14px', borderRadius:10, border:'2px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)', fontSize:15 }}
          required
        />
        <div style={{ fontSize:11, color:'var(--c-text3)', fontWeight:800, textAlign:'right', marginTop:-8 }}>
          {nickname.length}/{QUIZ_NICKNAME_MAX}
        </div>
        {error && <div style={{ color:'#e53935', fontSize:13 }}>{error}</div>}
        <GlowButton type="submit" disabled={busy}>{busy ? t('Menyertai...', 'Joining...') : t('Sertai Sekarang', 'Join Now')}</GlowButton>
      </form>
    </div>
  );
}

function StudentQuizTab({ user }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('home');
  const [joinedSession, setJoinedSession] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [nickname, setNickname] = useState(`${user?.fullName || user?.full_name || ''}`.slice(0, QUIZ_NICKNAME_MAX));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastAutoJoin = useRef('');
  const summaryState = useAsync(() => window.tusyenApi.myQuizSummary(), []);
  const summary = summaryState.data?.summary || summaryState.data || {};

  const submitJoin = useCallback(async (pinValue = pinInput, nicknameValue = nickname) => {
    const cleanPin = cleanQuizPin(pinValue);
    const cleanNickname = `${nicknameValue}`.trim().slice(0, QUIZ_NICKNAME_MAX);
    if (cleanPin.length !== 6) { setError(t('PIN mesti 6 digit.', 'PIN must be 6 digits.')); return; }
    if (!cleanNickname) { setError(t('Nama panggilan diperlukan.', 'Nickname is required.')); return; }
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await window.tusyenApi.joinQuizByPin({ pin:cleanPin, nickname:cleanNickname });
      setJoinedSession(data);
      setMode('session');
    } catch (err) {
      setError(quizJoinErrorMessage(err.message));
    } finally {
      setBusy(false);
    }
  }, [pinInput, nickname, busy, t]);

  const maybeAutoJoin = useCallback((nextPin, nextNickname) => {
    const key = `${nextPin}:${`${nextNickname}`.trim()}`;
    if (nextPin.length === 6 && `${nextNickname}`.trim() && key !== lastAutoJoin.current && !busy) {
      lastAutoJoin.current = key;
      window.setTimeout(() => submitJoin(nextPin, nextNickname), 0);
    }
  }, [busy, submitJoin]);

  const joinByPin = async (e) => {
    e.preventDefault();
    submitJoin();
  };

  if (mode === 'session' && joinedSession) {
    const participantToken =
      joinedSession.participantToken ||
      joinedSession.participant?.joinToken ||
      joinedSession.participant?.join_token;

    return (
      <QuizLiveSession
        session={joinedSession.session || joinedSession}
        initialSnapshot={joinedSession.snapshot}
        participantToken={participantToken}
        isTeacher={false}
        onEnd={() => { setMode('home'); setJoinedSession(null); summaryState.refresh(); }}
      />
    );
  }

  return (
    <div style={{ padding:'16px 0' }}>
      {summaryState.loading && <Skeleton lines={2} />}
      {summaryState.data && (
        <Card style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:32 }}>{t('Kuiz', 'Quiz')}</div>
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>{t('Ringkasan Kuiz Saya', 'My Quiz Summary')}</div>
            <div style={{ color:'var(--c-text2)', fontSize:13 }}>
              {summary.recentSessions?.length ?? 0} {t('sesi', 'sessions')} - {summary.quizXpTotal ?? 0} XP {t('diperoleh', 'earned')}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontWeight:800, marginBottom:12 }}>{t('Sertai Kuiz dengan PIN', 'Join Quiz With PIN')}</div>
        <form onSubmit={joinByPin} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <label style={{ fontSize:12, color:'var(--c-text2)', fontWeight:900 }}>
            {t('PIN Kuiz (6 digit)', 'Quiz PIN (6 digits)')}
          </label>
          <input
            placeholder="000000"
            value={pinInput}
            maxLength={6}
            inputMode="numeric"
            aria-label={t('PIN kuiz 6 digit', '6-digit quiz PIN')}
            onChange={e => {
              const next = cleanQuizPin(e.target.value);
              setPinInput(next);
              setError('');
              maybeAutoJoin(next, nickname);
            }}
            style={{ fontSize:22, textAlign:'center', letterSpacing:6, padding:'10px 0', borderRadius:10, border:'2px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)' }}
            required
          />
          <div style={{ fontSize:11, color:'var(--c-text3)', fontWeight:800, marginTop:-6 }}>
            {pinInput.length}/6 digit
          </div>
          <label style={{ fontSize:12, color:'var(--c-text2)', fontWeight:900 }}>
            {t('Nama panggilan', 'Nickname')}
          </label>
          <input
            placeholder={t('Nama panggilan', 'Nickname')}
            value={nickname}
            maxLength={QUIZ_NICKNAME_MAX}
            onChange={e => {
              const next = e.target.value.slice(0, QUIZ_NICKNAME_MAX);
              setNickname(next);
              setError('');
              maybeAutoJoin(pinInput, next);
            }}
            style={{ padding:'8px 12px', borderRadius:10, border:'2px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)', fontSize:14 }}
            required
          />
          <div style={{ fontSize:11, color:'var(--c-text3)', fontWeight:800, textAlign:'right', marginTop:-6 }}>
            {nickname.length}/{QUIZ_NICKNAME_MAX}
          </div>
          {error && <div style={{ color:'#e53935', fontSize:13 }}>{error}</div>}
          <GlowButton type="submit" disabled={busy}>{busy ? t('Menyertai...', 'Joining...') : t('Sertai Kuiz', 'Join Quiz')}</GlowButton>
        </form>
      </Card>

      {summary.recentSessions?.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontWeight:800, marginBottom:8 }}>{t('Sesi Terkini', 'Recent Sessions')}</div>
          {summary.recentSessions.map((s, i) => (
            <div key={s.sessionId || s.id || i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--c-bdr)', fontSize:14 }}>
              <span>{s.deckTitle || t('Kuiz', 'Quiz')}</span>
              <span style={{ color:'var(--c-accent)', fontWeight:800 }}>+{s.xpAwarded ?? s.xpEarned ?? 0} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function editorOptionText(option, index) {
  return optionText(option, index);
}

function editorOptionsTextForType(type, rawOptions) {
  const normalized = normalizeQuizQuestionType(type);
  if (PAIR_QUESTION_TYPES.has(normalized)) {
    return answerPairsFromValue(rawOptions)
      .map((pair) => `${pair.prompt} = ${pair.answer}`)
      .join('\n');
  }
  if (normalized === 'step_order') return stringListFromValue(rawOptions).join('\n');
  if (Array.isArray(rawOptions)) return rawOptions.map(editorOptionText).filter(Boolean).join(', ');
  return cleanAnswerText(rawOptions);
}

function editorChoiceOptions(rawOptions) {
  const options = asArray(rawOptions).map(editorOptionText).filter((option) => option !== 'undefined');
  while (options.length < 4) options.push('');
  return options.slice(0, 6);
}

function editorAnswerTextForType(type, rawAnswer) {
  const normalized = normalizeQuizQuestionType(type);
  if (normalized === 'true_false') {
    if (typeof rawAnswer === 'boolean') return rawAnswer ? 'true' : 'false';
    const index = correctOptionIndex({ correctAnswer:rawAnswer });
    if (index !== null) return index === 0 ? 'true' : 'false';
    const text = cleanAnswerText(rawAnswer).toLowerCase();
    return text === 'false' || text === '0' || text === 'no' ? 'false' : 'true';
  }
  return answerTextFromValue(rawAnswer);
}

function editorQuestionFromDeck(question = {}) {
  const type = normalizeQuizQuestionType(question.type || question.questionType || question.question_type);
  const rawAnswer = question.correctAnswer ?? question.correct_answer ?? '';
  return {
    text: question.text || question.questionText || question.question_text || '',
    type,
    options: editorChoiceOptions(question.options),
    optionsText: editorOptionsTextForType(type, question.options),
    correctIndex: correctOptionIndex(question) ?? 0,
    correctAnswerText: editorAnswerTextForType(type, rawAnswer),
    timeLimitSeconds: Number(question.timeLimitSeconds ?? question.time_limit_seconds) || 20,
  };
}

function createEmptyEditorQuestion() {
  return {
    text:'',
    type:'multiple_choice',
    options:['', '', '', ''],
    optionsText:'',
    correctIndex:0,
    correctAnswerText:'',
    timeLimitSeconds:20,
  };
}

function coerceEditorQuestionType(question, type) {
  const normalized = normalizeQuizQuestionType(type);
  return {
    ...question,
    type:normalized,
    options:editorChoiceOptions(question.options),
    optionsText:question.optionsText || '',
    correctAnswerText:normalized === 'true_false' && !question.correctAnswerText ? 'true' : question.correctAnswerText,
    correctIndex:Number(question.correctIndex) || 0,
  };
}

function correctAnswerPayloadForEditorQuestion(question, options) {
  const type = normalizeQuizQuestionType(question.type);
  const answerText = `${question.correctAnswerText || ''}`.trim();

  if (type === 'multiple_choice') {
    return { optionIndex:Math.max(0, Math.min(Number(question.correctIndex) || 0, options.length - 1)) };
  }
  if (type === 'true_false') {
    const normalized = answerText.toLowerCase();
    return !(normalized === 'false' || normalized === '0' || normalized === 'palsu');
  }
  if (PAIR_QUESTION_TYPES.has(type)) {
    const answerPairs = answerPairsFromValue(answerText);
    return pairsToObject(answerPairs.length ? answerPairs : options);
  }
  if (type === 'step_order') {
    const answerList = stringListFromValue(answerText);
    return answerList.length ? answerList : options;
  }
  return answerText;
}

function normalizeEditorQuestionPayload(question) {
  const questionText = `${question.text || ''}`.trim();
  if (!questionText) return null;

  const type = normalizeQuizQuestionType(question.type);
  let options = [];

  if (type === 'multiple_choice') {
    options = asArray(question.options).map((option) => `${option || ''}`.trim()).filter(Boolean);
    if (options.length < 2) throw new Error('Pilihan jawapan perlukan sekurang-kurangnya dua pilihan.');
  } else if (type === 'true_false') {
    options = ['True', 'False'];
  } else if (PAIR_QUESTION_TYPES.has(type)) {
    options = answerPairsFromValue(question.optionsText);
    if (options.length === 0) throw new Error(`${quizQuestionTypeLabel(type)} perlukan sekurang-kurangnya satu pasangan.`);
  } else if (type === 'step_order') {
    options = stringListFromValue(question.optionsText);
    if (options.length < 2) throw new Error('Susun langkah perlukan sekurang-kurangnya dua langkah.');
  }

  if (
    !CHOICE_QUESTION_TYPES.has(type) &&
    !PAIR_QUESTION_TYPES.has(type) &&
    type !== 'step_order' &&
    `${question.correctAnswerText || ''}`.trim().length === 0
  ) {
    throw new Error(`${quizQuestionTypeLabel(type)} perlukan jawapan betul.`);
  }

  return {
    questionText,
    questionType:type,
    options,
    correctAnswer:correctAnswerPayloadForEditorQuestion(question, options),
    timeLimitSeconds:Number(question.timeLimitSeconds) || 20,
  };
}

const newEditorQuestion = createEmptyEditorQuestion;

function DeckEditorModal({ deck, onSave, onClose }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(deck?.title || '');
  const [subject, setSubject] = useState(deck?.subject || 'Matematik');
  const [formLevel, setFormLevel] = useState(deck?.formLevel || deck?.form_level || 4);
  const [questions, setQuestions] = useState(() => {
    const deckQuestions = asArray(deck?.questions).map(editorQuestionFromDeck);
    return deckQuestions.length ? deckQuestions : [newEditorQuestion()];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [questionDeleteConfirm, setQuestionDeleteConfirm] = useState(null);

  const addQuestion = () => setQuestions(qs => [...qs, newEditorQuestion()]);
  const removeQuestion = (i) => setQuestions(qs => qs.filter((_, idx) => idx !== i));
  const updateQuestion = (i, field, val) => setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, [field]:val } : q));
  const updateQuestionType = (i, type) => setQuestions(qs => qs.map((q, idx) => idx === i ? coerceEditorQuestionType(q, type) : q));
  const updateOption = (qi, oi, val) => setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, options:q.options.map((o, j) => j === oi ? val : o) } : q));
  const confirmRemoveQuestion = () => {
    if (questionDeleteConfirm === null) return;
    removeQuestion(questionDeleteConfirm);
    setQuestionDeleteConfirm(null);
  };

  const save = async () => {
    if (!title.trim()) { setError(t('Tajuk wajib diisi.', 'Deck title is required.')); return; }
    let cleanedQuestions = [];
    try {
      cleanedQuestions = questions
        .map(normalizeEditorQuestionPayload)
        .filter(Boolean);
    } catch (err) {
      setError(err.message || t('Semak semula soalan kuiz.', 'Check the quiz questions again.'));
      return;
    }

    if (cleanedQuestions.length === 0) {
      setError(t('Tambah sekurang-kurangnya satu soalan lengkap.', 'Add at least one complete question.'));
      return;
    }

    setBusy(true); setError('');
    try {
      const payload = {
        title:title.trim(),
        subject:subject.trim() || 'Matematik',
        formLevel:Number(formLevel) || 4,
        questions:cleanedQuestions,
      };
      if (deck?.id) await window.tusyenApi.updateQuizDeck(deck.id, payload);
      else await window.tusyenApi.createQuizDeck(payload);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <QuizConfirmModal
        open={questionDeleteConfirm !== null}
        title={t('Buang soalan?', 'Remove question?')}
        message={t(`Soalan ${Number(questionDeleteConfirm) + 1 || ''} akan dikeluarkan daripada draf dek ini.`, `Question ${Number(questionDeleteConfirm) + 1 || ''} will be removed from this deck draft.`)}
        confirmLabel={t('Buang soalan', 'Remove question')}
        busy={false}
        onCancel={() => setQuestionDeleteConfirm(null)}
        onConfirm={confirmRemoveQuestion}
      />
      <div style={{ background:'var(--c-surface)', borderRadius:16, padding:24, width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontWeight:900, fontSize:18, marginBottom:16 }}>{deck?.id ? t('Sunting dek', 'Edit deck') : t('Dek baharu', 'New deck')}</div>
        <label style={{ display:'block', marginBottom:12 }}>
          <div style={{ fontSize:13, color:'var(--c-text2)', marginBottom:4 }}>{t('Tajuk dek', 'Deck title')}</div>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)', fontSize:15 }} />
        </label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:8, marginBottom:16 }}>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('Subjek', 'Subject')} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)', fontSize:14 }} />
          <select value={formLevel} onChange={e => setFormLevel(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-card)', color:'var(--c-text)', fontSize:14 }}>
            <option value={4}>{t('Tingkatan 4', 'Form 4')}</option>
            <option value={5}>{t('Tingkatan 5', 'Form 5')}</option>
          </select>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} style={{ background:'var(--c-card)', borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ fontWeight:800, fontSize:13 }}>{t(`Soalan ${qi + 1}`, `Question ${qi + 1}`)}</div>
              <QuizQuestionOverflowMenu onDelete={() => setQuestionDeleteConfirm(qi)} />
            </div>
            <input
              placeholder={t('Teks soalan...', 'Question text...')}
              value={q.text}
              onChange={e => updateQuestion(qi, 'text', e.target.value)}
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-surface)', color:'var(--c-text)', marginBottom:8, fontSize:14 }}
            />
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) 110px', gap:8, marginBottom:8 }}>
              <select value={q.type} onChange={e => updateQuestionType(qi, e.target.value)} style={{ minWidth:0, padding:'7px 10px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-surface)', color:'var(--c-text)', fontSize:13 }}>
                {QUIZ_QUESTION_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <input type="number" min="5" max="300" value={q.timeLimitSeconds} onChange={e => updateQuestion(qi, 'timeLimitSeconds', e.target.value)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-surface)', color:'var(--c-text)', fontSize:13 }} />
            </div>
            <div style={{ color:'var(--c-text3)', fontSize:11, fontWeight:800, margin:'-2px 0 9px' }}>
              {quizQuestionTypeHint(q.type)}
            </div>

            {q.type === 'multiple_choice' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:6 }}>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display:'flex', gap:6, alignItems:'center', minWidth:0 }}>
                    <input type="radio" name={`correct-${qi}`} checked={Number(q.correctIndex) === oi} onChange={() => updateQuestion(qi, 'correctIndex', oi)} />
                    <input
                      placeholder={t(`Pilihan ${String.fromCharCode(65 + oi)}`, `Option ${String.fromCharCode(65 + oi)}`)}
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.target.value)}
                      style={{ flex:1, minWidth:0, padding:'6px 8px', borderRadius:6, border:'1px solid var(--c-bdr)', background:TILE_COLORS[oi % TILE_COLORS.length] + '22', color:'var(--c-text)', fontSize:13 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {q.type === 'true_false' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { value:'true', label:t('Benar', 'True') },
                  { value:'false', label:t('Palsu', 'False') },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateQuestion(qi, 'correctAnswerText', item.value)}
                    style={{
                      minHeight:44,
                      border:`1px solid ${q.correctAnswerText === item.value ? 'var(--c-accent)' : 'var(--c-bdr)'}`,
                      borderRadius:10,
                      background:q.correctAnswerText === item.value ? 'rgba(139,92,246,.18)' : 'var(--c-surface)',
                      color:'var(--c-text)',
                      fontWeight:900,
                      cursor:'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {questionTypeUsesOptions(q.type) && q.type !== 'multiple_choice' && (
              <label style={{ display:'block', marginTop:8 }}>
                <div style={{ fontSize:12, color:'var(--c-text2)', fontWeight:900, marginBottom:4 }}>
                  {questionOptionsLabel(q.type)}
                </div>
                <textarea
                  value={q.optionsText || ''}
                  onChange={e => updateQuestion(qi, 'optionsText', e.target.value)}
                  rows={questionTypeUsesLines(q.type) ? 4 : 2}
                  placeholder={PAIR_QUESTION_TYPES.has(q.type) ? 'Istilah = Maksud' : 'Langkah 1\nLangkah 2'}
                  style={{ width:'100%', resize:'vertical', minHeight:90, padding:'7px 10px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-surface)', color:'var(--c-text)', fontSize:13, lineHeight:1.4 }}
                />
              </label>
            )}

            {!CHOICE_QUESTION_TYPES.has(q.type) && (
              <label style={{ display:'block', marginTop:8 }}>
                <div style={{ fontSize:12, color:'var(--c-text2)', fontWeight:900, marginBottom:4 }}>
                  {questionAnswerLabel(q.type)}
                </div>
                <textarea
                  value={q.correctAnswerText || ''}
                  onChange={e => updateQuestion(qi, 'correctAnswerText', e.target.value)}
                  rows={questionTypeUsesLines(q.type) ? 3 : 1}
                  placeholder={
                    PAIR_QUESTION_TYPES.has(q.type)
                      ? t('Kosongkan untuk guna pasangan di atas.', 'Leave blank to use the pairs above.')
                      : q.type === 'step_order'
                        ? t('Kosongkan untuk guna susunan langkah di atas.', 'Leave blank to use the order above.')
                        : t('Jawapan betul', 'Correct answer')
                  }
                  style={{ width:'100%', resize:'vertical', minHeight:questionTypeUsesLines(q.type) ? 78 : 42, padding:'7px 10px', borderRadius:8, border:'1px solid var(--c-bdr)', background:'var(--c-surface)', color:'var(--c-text)', fontSize:13, lineHeight:1.4 }}
                />
              </label>
            )}
          </div>
        ))}

        <button onClick={addQuestion} style={{ width:'100%', padding:10, borderRadius:10, border:'2px dashed var(--c-bdr)', background:'none', color:'var(--c-text2)', cursor:'pointer', marginBottom:16, fontSize:14, fontWeight:800 }}>
          {t('+ Tambah Soalan', '+ Add Question')}
        </button>

        {error && <div style={{ color:'#e53935', marginBottom:10, fontSize:13, fontWeight:800 }}>{error}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) 76px', gap:10 }}>
          <GlowButton onClick={save} disabled={busy}>{busy ? t('Menyimpan...', 'Saving...') : t('Simpan dek', 'Save deck')}</GlowButton>
          <button onClick={onClose} className="btn-ghost" style={{ minWidth:76, padding:'10px 12px', whiteSpace:'nowrap' }}>{t('Batal', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}

function TeacherQuizTab({ classroomId }) {
  const { t } = useLanguage();
  const [editingDeck, setEditingDeck] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [checkingActiveSession, setCheckingActiveSession] = useState(false);
  const [startingDeckId, setStartingDeckId] = useState(null);
  const [duplicatingDeckId, setDuplicatingDeckId] = useState(null);
  const [deleteDeckConfirm, setDeleteDeckConfirm] = useState(null);
  const [deletingDeckId, setDeletingDeckId] = useState(null);
  const [error, setError] = useState('');
  const decks = useAsync(() => window.tusyenApi.quizDecks({ classroomId }), [classroomId]);

  const deckList = decks.data?.decks || decks.data || [];

  const loadActiveSession = useCallback(async () => {
    if (!classroomId) return null;
    const data = await window.tusyenApi.quizClassroomSessions(classroomId);
    const existing = (data.sessions || []).find((session) => ['lobby', 'active'].includes(session.status));
    if (!existing?.id) return null;
    const state = await window.tusyenApi.quizSessionState(existing.id);
    return {
      session: state.snapshot?.session || existing,
      snapshot: state.snapshot,
    };
  }, [classroomId]);

  useEffect(() => {
    let cancelled = false;
    if (!classroomId || activeSession) return undefined;
    setCheckingActiveSession(true);
    loadActiveSession()
      .then((session) => {
        if (!cancelled && session) setActiveSession(session);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingActiveSession(false);
      });
    return () => { cancelled = true; };
  }, [classroomId, activeSession, loadActiveSession]);

  const startSession = async (deckId) => {
    if (!classroomId) { setError(t('Pilih kelas dahulu.', 'Select a class first.')); return; }
    setStartingDeckId(deckId); setError('');
    try {
      const data = await window.tusyenApi.createQuizSession({ classroomId, deckId });
      setActiveSession(data);
    } catch (err) {
      if (`${err.message || ''}`.toLowerCase().includes('already active')) {
        const existing = await loadActiveSession().catch(() => null);
        if (existing) {
          setActiveSession(existing);
          return;
        }
      }
      setError(err.message);
    } finally {
      setStartingDeckId(null);
    }
  };

  const openEditDeck = async (deck) => {
    setError('');
    try {
      const data = await window.tusyenApi.quizDeck(deck.id);
      setEditingDeck(data.deck || deck);
    } catch {
      setEditingDeck(deck);
    }
  };

  const duplicateDeck = async (id) => {
    setDuplicatingDeckId(id); setError('');
    try {
      await window.tusyenApi.duplicateQuizDeck(id);
      decks.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDuplicatingDeckId(null);
    }
  };

  const requestDeleteDeck = (deck) => {
    setDeleteDeckConfirm(deck);
  };

  const deleteDeck = async () => {
    if (!deleteDeckConfirm?.id) return;
    setDeletingDeckId(deleteDeckConfirm.id);
    try {
      await window.tusyenApi.deleteQuizDeck(deleteDeckConfirm.id);
      decks.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingDeckId(null);
      setDeleteDeckConfirm(null);
    }
  };

  if (activeSession) {
    return (
      <QuizLiveSession
        session={activeSession.session || activeSession}
        initialSnapshot={activeSession.snapshot}
        participantToken={null}
        isTeacher={true}
        onEnd={() => { setActiveSession(null); decks.refresh(); }}
      />
    );
  }

  return (
    <div style={{ padding:'16px 0' }}>
      {editingDeck && (
        <DeckEditorModal
          deck={editingDeck === 'new' ? null : editingDeck}
          onSave={() => { setEditingDeck(null); decks.refresh(); }}
          onClose={() => setEditingDeck(null)}
        />
      )}
      <QuizConfirmModal
        open={Boolean(deleteDeckConfirm)}
        title={t('Padam dek kuiz?', 'Delete quiz deck?')}
        message={t(`Dek "${deleteDeckConfirm?.title || 'tanpa tajuk'}" akan dibuang daripada senarai guru.`, `Deck "${deleteDeckConfirm?.title || 'untitled'}" will be removed from the teacher list.`)}
        confirmLabel={t('Padam dek', 'Delete deck')}
        busy={Boolean(deletingDeckId)}
        onCancel={() => setDeleteDeckConfirm(null)}
        onConfirm={deleteDeck}
      />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:10 }}>
        <div style={{ fontWeight:900, fontSize:16 }}>{t('Dek Kuiz', 'Quiz Decks')}</div>
        <GlowButton onClick={() => setEditingDeck('new')} style={{ padding:'6px 14px', fontSize:13 }}>+ {t('Dek baharu', 'New deck')}</GlowButton>
      </div>

      {error && <div style={{ color:'#e53935', fontSize:13, fontWeight:800, marginBottom:10 }}>{error}</div>}
      {checkingActiveSession && <div style={{ color:'var(--c-text2)', fontSize:13, fontWeight:800, marginBottom:10 }}>{t('Memeriksa sesi kuiz aktif...', 'Checking active quiz session...')}</div>}
      {decks.loading && <Skeleton lines={3} />}
      {decks.error && <ErrorRetry message={decks.error.message || decks.error} onRetry={decks.refresh} />}
      {!decks.loading && deckList.length === 0 && (
        <Card>
          <div style={{ color:'var(--c-text2)', textAlign:'center', padding:24, fontWeight:800 }}>
            {t('Tiada dek lagi. Cipta dek pertama anda.', 'No decks yet. Create your first deck.')}
          </div>
        </Card>
      )}

      {deckList.map(deck => {
        const questionCount = deck.questionCount ?? deck.question_count ?? deck.questions?.length ?? 0;
        return (
          <Card key={deck.id} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:900, marginBottom:4, overflowWrap:'anywhere' }}>{quizDisplayTitle(deck.title)}</div>
                <div style={{ color:'var(--c-text3)', fontSize:12, fontWeight:800 }}>
                  {questionCount} {t('soalan', 'questions')}
                  {deck.subject ? ` - ${deck.subject}` : ''}
                  {deck.form_level || deck.formLevel ? ` - T${deck.form_level || deck.formLevel}` : ''}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                <button
                  onClick={() => startSession(deck.id)}
                  disabled={startingDeckId === deck.id}
                  style={{ minHeight:44, background:'var(--c-accent)', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:900 }}>
                  {startingDeckId === deck.id ? '...' : t('Mulakan', 'Start')}
                </button>
                <button onClick={() => duplicateDeck(deck.id)} disabled={duplicatingDeckId === deck.id} title={t('Salin dek', 'Copy deck')} style={{ minHeight:44, background:'var(--c-card)', border:'1px solid var(--c-bdr)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'var(--c-text2)', fontSize:13, fontWeight:900 }}>
                  {duplicatingDeckId === deck.id ? '...' : t('Salin', 'Copy')}
                </button>
                <button onClick={() => openEditDeck(deck)} title={t('Sunting', 'Edit')} style={{ minHeight:44, background:'var(--c-card)', border:'1px solid var(--c-bdr)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'var(--c-text2)', fontSize:13, fontWeight:900 }}>{t('Sunting', 'Edit')}</button>
                <QuizDeckOverflowMenu
                  deck={deck}
                  disabled={deletingDeckId === deck.id}
                  onDelete={requestDeleteDeck}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

window.QuizLiveSession = QuizLiveSession;
window.TeacherQuizTab = TeacherQuizTab;
window.StudentQuizTab = StudentQuizTab;
window.GuestPinJoin = GuestPinJoin;
