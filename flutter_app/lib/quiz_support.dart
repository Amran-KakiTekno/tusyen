part of 'main.dart';

bool _isPublicQuizJoinRoute() {
  final segments = Uri.base.pathSegments;
  return segments.length >= 2 && segments[0] == 'quiz' && segments[1] == 'join';
}

bool _isPublicFeaturesRoute() {
  final segments = Uri.base.pathSegments;
  return segments.isNotEmpty &&
      (segments[0] == 'features' || segments[0] == 'public-features');
}

DateTime? _asDateTime(dynamic value) {
  if (value is DateTime) return value;
  return DateTime.tryParse('${value ?? ''}');
}

List<String> _stringList(dynamic value) {
  if (value is! List) return const [];
  return value.map((item) => '${item ?? ''}').toList();
}

class LessonQuestionDraft {
  LessonQuestionDraft({
    this.text = '',
    this.type = 'multiple_choice',
    this.optionsText = 'Option 1, Option 2',
    this.correctAnswer = '0',
    this.explanation = '',
    this.points = 1,
  });

  String text;
  String type;
  String optionsText;
  String correctAnswer;
  String explanation;
  int points;

  factory LessonQuestionDraft.fromLesson(Map<String, dynamic> question) {
    final options = _stringList(question['options']).join(', ');
    final correct = question['correct_answer'];
    final answer =
        correct is Map ? '${correct['optionIndex'] ?? 0}' : '${correct ?? 0}';
    return LessonQuestionDraft(
      text: _safeString(question['question_text']),
      type: _safeString(question['question_type'], fallback: 'multiple_choice'),
      optionsText: options.isEmpty ? 'Option 1, Option 2' : options,
      correctAnswer: answer,
      explanation: _safeString(question['explanation']),
      points: _asInt(question['points']) == 0 ? 1 : _asInt(question['points']),
    );
  }

  Map<String, dynamic> toPayload() {
    final options = optionsText
        .split(',')
        .map((option) => option.trim())
        .where((option) => option.isNotEmpty)
        .toList();

    return {
      'text': text,
      'questionText': text,
      'type': type,
      'questionType': type,
      'options': type == 'true_false' ? ['True', 'False'] : options,
      'correctAnswer': type == 'true_false'
          ? _normalizeBooleanAnswer(correctAnswer)
          : (int.tryParse(correctAnswer.trim()) ?? correctAnswer.trim()),
      'explanation': explanation,
      'points': points,
      'timeLimitSeconds': 20,
    };
  }
}

class QuizQuestionDraft {
  QuizQuestionDraft({
    this.questionText = '',
    this.questionType = 'multiple_choice',
    this.optionsText = 'Option 1, Option 2',
    this.correctAnswer = '0',
    this.explanation = '',
    this.points = 1000,
    this.timeLimitSeconds = 20,
  });

  String questionText;
  String questionType;
  String optionsText;
  String correctAnswer;
  String explanation;
  int points;
  int timeLimitSeconds;

  factory QuizQuestionDraft.fromDeck(Map<String, dynamic> question) {
    final options = _stringList(question['options']).join(', ');
    final correct = _asMap(question['correct_answer']);
    return QuizQuestionDraft(
      questionText:
          _safeString(question['question_text'] ?? question['questionText']),
      questionType: _safeString(
          question['question_type'] ?? question['questionType'],
          fallback: 'multiple_choice'),
      optionsText: options.isEmpty ? 'Option 1, Option 2' : options,
      correctAnswer: '${correct['optionIndex'] ?? 0}',
      explanation: _safeString(question['explanation']),
      points:
          _asInt(question['points']) == 0 ? 1000 : _asInt(question['points']),
      timeLimitSeconds: _asInt(question['time_limit_seconds']) == 0
          ? 20
          : _asInt(question['time_limit_seconds']),
    );
  }

  Map<String, dynamic> toPayload() {
    final options = optionsText
        .split(',')
        .map((option) => option.trim())
        .where((option) => option.isNotEmpty)
        .toList();

    return {
      'questionText': questionText,
      'questionType': questionType,
      'options': questionType == 'true_false' ? ['True', 'False'] : options,
      'correctAnswer': questionType == 'true_false'
          ? _normalizeBooleanAnswer(correctAnswer)
          : (int.tryParse(correctAnswer.trim()) ?? correctAnswer.trim()),
      'explanation': explanation,
      'points': points,
      'timeLimitSeconds': timeLimitSeconds,
    };
  }
}

dynamic _normalizeBooleanAnswer(String value) {
  final normalized = value.trim().toLowerCase();
  if (normalized == 'true' || normalized == '1' || normalized == 'yes')
    return true;
  if (normalized == 'false' || normalized == '0' || normalized == 'no')
    return false;
  return normalized == 'true';
}

class LessonExperienceDialog extends StatefulWidget {
  const LessonExperienceDialog({
    required this.api,
    required this.lessonId,
    required this.classroomId,
    required this.readOnly,
    super.key,
  });

  final ApiService api;
  final String lessonId;
  final String classroomId;
  final bool readOnly;

  @override
  State<LessonExperienceDialog> createState() => _LessonExperienceDialogState();
}

class _LessonExperienceDialogState extends State<LessonExperienceDialog> {
  late Future<Map<String, dynamic>> future = _load();

  Future<Map<String, dynamic>> _load() {
    final classroomQuery = widget.classroomId.isNotEmpty
        ? '?classroomId=${widget.classroomId}'
        : '';
    return widget.api
        .get('/learning/lessons/${widget.lessonId}$classroomQuery');
  }

  @override
  Widget build(BuildContext context) {
    return FuturePanel(
      future: future,
      builder: (data) {
        final lesson = _asMap(data['lesson']);
        final questions = _asMapList(data['questions']);
        final progress = _asMap(data['progress']);

        return AppScene(
          child: SafeArea(
            child: PageShell(
              title: _safeString(lesson['title'], fallback: 'Lesson preview'),
              subtitle: _joinNonEmpty([
                _safeString(lesson['subject']),
                _formLabel(lesson['form_level']),
                _safeString(lesson['topic']),
              ]),
              trailing: TextButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded),
                label: const Text('Close'),
              ),
              children: [
                AppCard(
                  accent: _subjectColor(_safeString(lesson['subject'])),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Summary',
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 8),
                      Text(
                        _safeString(_asMap(lesson['content'])['summary'],
                            fallback: 'No summary available.'),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      if (!widget.readOnly && progress.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        StatusPill(
                            label: 'Resume available', color: AppTheme.green),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (questions.isEmpty)
                  const EmptyState(
                      text:
                          'No quiz questions are attached to this lesson yet.')
                else ...[
                  Text('Questions',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  for (final question in questions)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: DataTile(
                        title: _safeString(question['question_text'],
                            fallback: 'Question'),
                        subtitle: _safeString(question['question_type'],
                            fallback: 'multiple_choice'),
                        details: _stringList(question['options']).join(' | '),
                        badge: '${_asInt(question['points'])} XP',
                        icon: Icons.quiz_rounded,
                        accent: AppTheme.blue,
                      ),
                    ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class PublicQuizJoinPage extends StatefulWidget {
  const PublicQuizJoinPage({required this.api, super.key});

  final ApiService api;

  @override
  State<PublicQuizJoinPage> createState() => _PublicQuizJoinPageState();
}

class _PublicQuizJoinPageState extends State<PublicQuizJoinPage> {
  final pin =
      TextEditingController(text: Uri.base.queryParameters['pin'] ?? '');
  final nickname =
      TextEditingController(text: Uri.base.queryParameters['name'] ?? 'Guest');
  Map<String, dynamic>? liveSnapshot;
  String? participantToken;
  bool hosting = false;
  bool submitting = false;
  String? error;

  @override
  Widget build(BuildContext context) {
    if (liveSnapshot != null && participantToken != null) {
      return QuizLiveSessionView(
        api: widget.api,
        snapshot: liveSnapshot!,
        participantToken: participantToken,
        canManage: hosting,
        onExit: () => setState(() {
          liveSnapshot = null;
          participantToken = null;
          hosting = false;
        }),
        sessionToken: null,
      );
    }

    return Scaffold(
      body: AppScene(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 940),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final wide = constraints.maxWidth > 860;
                    final hero = const _QuizJoinHero();
                    final form = AppCard(
                      accent: AppTheme.orange,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Join a live quiz',
                              style:
                                  Theme.of(context).textTheme.headlineMedium),
                          const SizedBox(height: 8),
                          Text(
                            'Enter the 6-digit PIN from your teacher and jump into the room from any browser.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: pin,
                            decoration:
                                const InputDecoration(labelText: 'Quiz PIN'),
                            keyboardType: TextInputType.number,
                            maxLength: 6,
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: nickname,
                            decoration:
                                const InputDecoration(labelText: 'Nickname'),
                          ),
                          const SizedBox(height: 12),
                          if (error != null) ...[
                            Text(error!,
                                style: const TextStyle(
                                    color: AppTheme.red,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 12),
                          ],
                          FilledButton.icon(
                            onPressed: submitting ? null : _join,
                            icon: const Icon(Icons.play_arrow_rounded),
                            label:
                                Text(submitting ? 'Joining...' : 'Join quiz'),
                          ),
                        ],
                      ),
                    );

                    if (!wide) {
                      return Column(
                        children: [
                          hero,
                          const SizedBox(height: 18),
                          form,
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Expanded(flex: 5, child: _QuizJoinHero()),
                        const SizedBox(width: 28),
                        SizedBox(width: 410, child: form),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _join() async {
    setState(() {
      submitting = true;
      error = null;
    });

    try {
      final result = await widget.api.post('/quiz/join', {
        'pin': pin.text.trim(),
        'nickname': nickname.text.trim(),
      });

      if (!mounted) return;
      setState(() {
        liveSnapshot = _asMap(result['snapshot']);
        participantToken =
            _safeString(_asMap(result['participant'])['joinToken']);
        hosting = false;
      });
    } on DioException catch (e) {
      setState(() => error = _errorMessage(e));
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) {
        setState(() => submitting = false);
      }
    }
  }
}

class _QuizJoinHero extends StatelessWidget {
  const _QuizJoinHero();

  @override
  Widget build(BuildContext context) {
    return AnimatedReveal(
      distance: 14,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              MascotBadge(size: 84),
              SizedBox(width: 16),
              StatusPill(label: 'Live room', color: AppTheme.orange),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Kahoot-style quizzes, classroom controlled, browser ready.',
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 14),
          Text(
            'Teachers can host a room from any classroom, while students or guests join with a PIN and race the clock on each question.',
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: AppTheme.ink.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 20),
          const Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              FeatureChip(label: 'PIN join', color: AppTheme.peach),
              FeatureChip(label: 'Speed scoring', color: AppTheme.mint),
              FeatureChip(
                  label: 'Live leaderboard', color: AppTheme.skySurface),
              FeatureChip(label: 'Quiz XP', color: AppTheme.cream),
            ],
          ),
        ],
      ),
    );
  }
}

class QuizPage extends StatefulWidget {
  const QuizPage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  State<QuizPage> createState() => _QuizPageState();
}

class _QuizPageState extends State<QuizPage> {
  late Future<Map<String, dynamic>> decksFuture = _loadDecks();
  late Future<Map<String, dynamic>> summaryFuture = _loadSummary();
  late Future<Map<String, dynamic>> classroomsFuture = _loadClassrooms();
  Map<String, dynamic>? liveSnapshot;
  String? participantToken;
  bool hostMode = false;
  String? joinError;

  bool get isTeacher =>
      widget.session.user.role == 'teacher' ||
      widget.session.user.role == 'admin';

  Future<Map<String, dynamic>> _loadDecks() => widget.api.get('/quiz/decks');
  Future<Map<String, dynamic>> _loadSummary() {
    if (widget.session.user.role != 'student') {
      return Future.value({
        'summary': {
          'quizXpTotal': 0,
          'recentSessions': [],
        }
      });
    }
    return widget.api.get('/quiz/me/summary');
  }

  Future<Map<String, dynamic>> _loadClassrooms() =>
      widget.api.get('/classroom');

  void _refreshLists() {
    setState(() {
      decksFuture = _loadDecks();
      summaryFuture = _loadSummary();
      classroomsFuture = _loadClassrooms();
    });
  }

  void _openLiveSession(Map<String, dynamic> snapshot,
      {String? token, bool host = false}) {
    setState(() {
      liveSnapshot = snapshot;
      participantToken = token;
      hostMode = host;
      joinError = null;
    });
  }

  void _leaveLiveSession() {
    setState(() {
      liveSnapshot = null;
      participantToken = null;
      hostMode = false;
    });
    _refreshLists();
  }

  @override
  Widget build(BuildContext context) {
    if (liveSnapshot != null) {
      return QuizLiveSessionView(
        api: widget.api,
        sessionToken: widget.session.token,
        snapshot: liveSnapshot!,
        participantToken: participantToken,
        canManage: hostMode,
        onExit: _leaveLiveSession,
      );
    }

    return PageShell(
      title: 'Quizzes',
      subtitle: isTeacher
          ? 'Build reusable quiz decks, launch a classroom room, and steer the live leaderboard.'
          : 'Join a live room by PIN, then race through timed questions for quiz XP.',
      trailing: isTeacher
          ? FilledButton.icon(
              onPressed: () => _showDeckDialog(context),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Create deck'),
            )
          : null,
      children: [
        if (widget.session.user.role == 'student')
          FuturePanel(
            future: summaryFuture,
            builder: (data) =>
                QuizSummaryCard(summary: _asMap(data['summary'])),
          ),
        const SizedBox(height: 14),
        _buildJoinCard(context),
        const SizedBox(height: 14),
        if (isTeacher) ...[
          FuturePanel(
            future: decksFuture,
            builder: (data) {
              final decks = _asMapList(data['decks']);
              if (decks.isEmpty) {
                return const EmptyState(
                    text:
                        'No quiz decks yet. Create one to start a live room.');
              }

              return Column(
                children: [
                  for (final deck in decks) ...[
                    _QuizDeckCard(
                      deck: deck,
                      onEdit: () => _showDeckDialog(context,
                          existingDeckId: _safeString(deck['id'])),
                      onDelete: () async {
                        try {
                          await widget.api.delete('/quiz/decks/${deck['id']}');
                          _refreshLists();
                        } catch (error) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(_friendlyError(error))),
                            );
                          }
                        }
                      },
                      onStart: () => _showStartSessionDialog(context, deck),
                    ),
                    const SizedBox(height: 12),
                  ],
                ],
              );
            },
          ),
        ],
      ],
    );
  }

  Widget _buildJoinCard(BuildContext context) {
    final pin = TextEditingController();
    final nickname = TextEditingController(text: widget.session.user.fullName);
    return AppCard(
      accent: AppTheme.orange,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Join a room', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Use the same screen as your students or join a classroom quiz directly from here.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: 220,
                child: TextField(
                  controller: pin,
                  decoration: const InputDecoration(labelText: 'Quiz PIN'),
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                ),
              ),
              SizedBox(
                width: 220,
                child: TextField(
                  controller: nickname,
                  decoration: const InputDecoration(labelText: 'Nickname'),
                ),
              ),
              FilledButton.icon(
                onPressed: () async {
                  setState(() => joinError = null);
                  try {
                    final result = await widget.api.post('/quiz/join', {
                      'pin': pin.text.trim(),
                      'nickname': nickname.text.trim(),
                    });
                    _openLiveSession(
                      _asMap(result['snapshot']),
                      token: _safeString(
                          _asMap(result['participant'])['joinToken']),
                      host: false,
                    );
                  } on DioException catch (e) {
                    setState(() => joinError = _errorMessage(e));
                  } catch (e) {
                    setState(() => joinError = '$e');
                  }
                },
                icon: const Icon(Icons.login_rounded),
                label: const Text('Join'),
              ),
            ],
          ),
          if (joinError != null) ...[
            const SizedBox(height: 10),
            Text(joinError!,
                style: const TextStyle(
                    color: AppTheme.red, fontWeight: FontWeight.w800)),
          ],
        ],
      ),
    );
  }

  Future<void> _showStartSessionDialog(
      BuildContext context, Map<String, dynamic> deck) async {
    final classroomsData = await classroomsFuture;
    final classrooms = _asMapList(classroomsData['classrooms']);
    if (classrooms.isEmpty || !context.mounted) {
      return;
    }

    String classroomId = _safeString(classrooms.first['id']);
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
              'Start ${_safeString(deck['title'], fallback: 'quiz deck')}'),
          content: DropdownButtonFormField<String>(
            value: classroomId,
            items: [
              for (final classroom in classrooms)
                DropdownMenuItem(
                  value: _safeString(classroom['id']),
                  child: Text(
                      _safeString(classroom['name'], fallback: 'Classroom')),
                ),
            ],
            onChanged: (value) =>
                setDialogState(() => classroomId = value ?? classroomId),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                try {
                  final result = await widget.api.post('/quiz/sessions', {
                    'classroomId': classroomId,
                    'deckId': deck['id'],
                  });
                  if (!context.mounted) return;
                  _openLiveSession(
                    _asMap(result['snapshot']),
                    token: null,
                    host: true,
                  );
                  Navigator.pop(context);
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(_friendlyError(error))),
                    );
                  }
                }
              },
              child: const Text('Start room'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showDeckDialog(BuildContext context,
      {String? existingDeckId}) async {
    final existingDeck = existingDeckId == null
        ? null
        : _asMap((await widget.api.get('/quiz/decks/$existingDeckId'))['deck']);

    final title =
        TextEditingController(text: _safeString(existingDeck?['title']));
    final description =
        TextEditingController(text: _safeString(existingDeck?['description']));
    final subject = TextEditingController(
        text: _safeString(existingDeck?['subject'], fallback: 'Mathematics'));
    int formLevel = _asInt(existingDeck?['form_level']) == 0
        ? 4
        : _asInt(existingDeck?['form_level']);
    final questions = existingDeck == null
        ? [QuizQuestionDraft()]
        : _asMapList(existingDeck['questions'])
            .map(QuizQuestionDraft.fromDeck)
            .toList();

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
              existingDeck == null ? 'Create quiz deck' : 'Edit quiz deck'),
          content: SizedBox(
            width: 720,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                      controller: title,
                      decoration:
                          const InputDecoration(labelText: 'Deck title')),
                  const SizedBox(height: 12),
                  TextField(
                      controller: description,
                      decoration:
                          const InputDecoration(labelText: 'Description')),
                  const SizedBox(height: 12),
                  TextField(
                      controller: subject,
                      decoration: const InputDecoration(labelText: 'Subject')),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    value: formLevel,
                    items: const [
                      DropdownMenuItem(value: 4, child: Text('Form 4')),
                      DropdownMenuItem(value: 5, child: Text('Form 5')),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => formLevel = value ?? formLevel),
                  ),
                  const SizedBox(height: 16),
                  for (int index = 0; index < questions.length; index++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: AppCard(
                        accent: AppTheme.blue,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                    child: Text('Question ${index + 1}',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium)),
                                if (questions.length > 1)
                                  IconButton(
                                    onPressed: () => setDialogState(
                                        () => questions.removeAt(index)),
                                    icon: const Icon(
                                        Icons.delete_outline_rounded),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: TextEditingController(
                                  text: questions[index].questionText),
                              decoration: const InputDecoration(
                                  labelText: 'Question text'),
                              onChanged: (value) =>
                                  questions[index].questionText = value,
                            ),
                            const SizedBox(height: 10),
                            DropdownButtonFormField<String>(
                              value: questions[index].questionType,
                              items: const [
                                DropdownMenuItem(
                                    value: 'multiple_choice',
                                    child: Text('Multiple choice')),
                                DropdownMenuItem(
                                    value: 'true_false',
                                    child: Text('True / False')),
                              ],
                              onChanged: (value) => setDialogState(() =>
                                  questions[index].questionType =
                                      value ?? questions[index].questionType),
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              controller: TextEditingController(
                                  text: questions[index].optionsText),
                              decoration: const InputDecoration(
                                  labelText: 'Options, comma separated'),
                              onChanged: (value) =>
                                  questions[index].optionsText = value,
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              controller: TextEditingController(
                                  text: questions[index].correctAnswer),
                              decoration: const InputDecoration(
                                  labelText: 'Correct answer or option index'),
                              onChanged: (value) =>
                                  questions[index].correctAnswer = value,
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              controller: TextEditingController(
                                  text: questions[index].explanation),
                              decoration: const InputDecoration(
                                  labelText: 'Explanation'),
                              onChanged: (value) =>
                                  questions[index].explanation = value,
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: TextEditingController(
                                        text: '${questions[index].points}'),
                                    decoration: const InputDecoration(
                                        labelText: 'Points'),
                                    keyboardType: TextInputType.number,
                                    onChanged: (value) =>
                                        questions[index].points =
                                            int.tryParse(value) ??
                                                questions[index].points,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextField(
                                    controller: TextEditingController(
                                        text:
                                            '${questions[index].timeLimitSeconds}'),
                                    decoration: const InputDecoration(
                                        labelText: 'Time limit (s)'),
                                    keyboardType: TextInputType.number,
                                    onChanged: (value) => questions[index]
                                            .timeLimitSeconds =
                                        int.tryParse(value) ??
                                            questions[index].timeLimitSeconds,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: () => setDialogState(
                        () => questions.add(QuizQuestionDraft())),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Add question'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                try {
                  final payload = {
                    'id': existingDeck?['id'],
                    'title': title.text.trim(),
                    'description': description.text.trim(),
                    'subject': subject.text.trim(),
                    'formLevel': formLevel,
                    'questions': [
                      for (final question in questions
                          .where((item) => item.questionText.trim().isNotEmpty))
                        question.toPayload(),
                    ],
                  };

                  if (existingDeck == null) {
                    await widget.api.post('/quiz/decks', payload);
                  } else {
                    await widget.api
                        .patch('/quiz/decks/${existingDeck['id']}', payload);
                  }

                  if (context.mounted) {
                    Navigator.pop(context);
                    _refreshLists();
                  }
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(_friendlyError(error))),
                    );
                  }
                }
              },
              child: Text(existingDeck == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuizDeckCard extends StatelessWidget {
  const _QuizDeckCard({
    required this.deck,
    required this.onEdit,
    required this.onStart,
    required this.onDelete,
  });

  final Map<String, dynamic> deck;
  final VoidCallback onEdit;
  final VoidCallback onStart;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      accent: _subjectColor(_safeString(deck['subject'])),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            runSpacing: 10,
            spacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_safeString(deck['title'], fallback: 'Quiz deck'),
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(
                    _joinNonEmpty([
                      _safeString(deck['subject']),
                      _formLabel(deck['form_level']),
                    ]),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  StatusPill(
                      label: '${_asInt(deck['question_count'])} questions',
                      color: AppTheme.blue),
                  StatusPill(
                      label: '${_asInt(deck['session_count'])} sessions',
                      color: AppTheme.orange),
                ],
              ),
            ],
          ),
          if (_safeString(deck['description']).isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(_safeString(deck['description']),
                style: Theme.of(context).textTheme.bodyLarge),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              OutlinedButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_rounded),
                label: const Text('Edit'),
              ),
              OutlinedButton.icon(
                onPressed: onStart,
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Start live room'),
              ),
              OutlinedButton.icon(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Delete'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class QuizSummaryCard extends StatelessWidget {
  const QuizSummaryCard({required this.summary, super.key});

  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final recentSessions = _asMapList(summary['recentSessions']);
    return AppCard(
      accent: AppTheme.yellow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quiz XP', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          ResponsiveGrid(
            minWidth: 180,
            children: [
              StatCard(
                label: 'Quiz XP',
                value: '${_asInt(summary['quizXpTotal'])}',
                color: AppTheme.yellow,
                icon: Icons.bolt_rounded,
                surface: AppTheme.cream,
              ),
              StatCard(
                label: 'Sessions',
                value: '${recentSessions.length}',
                color: AppTheme.orange,
                icon: Icons.live_tv_rounded,
                surface: AppTheme.peach,
              ),
            ],
          ),
          if (recentSessions.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Recent quiz history',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            for (final session in recentSessions)
              DataTile(
                title:
                    _safeString(session['deckTitle'], fallback: 'Quiz session'),
                subtitle: _joinNonEmpty([
                  _safeString(session['classroomName']),
                  _safeString(session['status']),
                ]),
                details: _joinNonEmpty([
                  'Score ${_asInt(session['totalScore'])}',
                  'Correct ${_asInt(session['correctCount'])}',
                  'XP ${_asInt(session['xpAwarded'])}',
                ]),
                badge: _safeString(session['pin'], fallback: 'Quiz'),
                icon: Icons.emoji_events_rounded,
                accent: AppTheme.yellow,
              ),
          ],
        ],
      ),
    );
  }
}

class QuizLiveSessionView extends StatefulWidget {
  const QuizLiveSessionView({
    required this.api,
    required this.sessionToken,
    required this.snapshot,
    required this.canManage,
    required this.onExit,
    this.participantToken,
    super.key,
  });

  final ApiService api;
  final String? sessionToken;
  final Map<String, dynamic> snapshot;
  final String? participantToken;
  final bool canManage;
  final VoidCallback onExit;

  @override
  State<QuizLiveSessionView> createState() => _QuizLiveSessionViewState();
}

class _QuizLiveSessionViewState extends State<QuizLiveSessionView> {
  late Map<String, dynamic> snapshot =
      Map<String, dynamic>.from(widget.snapshot);
  WebSocketChannel? channel;
  StreamSubscription? subscription;
  Timer? ticker;
  DateTime now = DateTime.now();
  int? selectedOption;
  bool submitting = false;
  String? feedback;

  @override
  void initState() {
    super.initState();
    _connect();
    ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => now = DateTime.now());
    });
  }

  @override
  void dispose() {
    ticker?.cancel();
    subscription?.cancel();
    channel?.sink.close();
    super.dispose();
  }

  String get sessionId => _safeString(_asMap(snapshot['session'])['id']);

  Future<void> _connect() async {
    final wsUri = _quizWebSocketUrl(sessionId);
    channel = WebSocketChannel.connect(Uri.parse(wsUri));
    subscription = channel!.stream.listen(
      (event) {
        try {
          final message = event is String
              ? jsonDecode(event) as Map<String, dynamic>
              : _asMap(jsonDecode('${event}'));
          final nextSnapshot = message['snapshot'];
          if (nextSnapshot != null && mounted) {
            setState(() {
              snapshot = _asMap(nextSnapshot);
              selectedOption = null;
              feedback = null;
            });
          }
        } catch (_) {}
      },
      onError: (_) {},
    );

    final authMessage = widget.participantToken != null
        ? {
            'type': 'AUTH',
            'participantToken': widget.participantToken,
          }
        : {
            'type': 'AUTH',
            'token': widget.sessionToken,
          };
    channel!.sink.add(jsonEncode(authMessage));
  }

  @override
  Widget build(BuildContext context) {
    final session = _asMap(snapshot['session']);
    final deck = _asMap(snapshot['deck']);
    final currentQuestion = _asMap(snapshot['currentQuestion']);
    final leaderboard = _asMapList(snapshot['leaderboard']);
    final participant = _asMap(snapshot['participant']);
    final status = _safeString(session['status'], fallback: 'lobby');
    final questionEndsAt = _asDateTime(session['questionEndsAt']);
    final remaining = questionEndsAt == null
        ? 0
        : math.max(0, questionEndsAt.difference(now).inSeconds);
    final options = _stringList(currentQuestion['options']);
    final currentQuestionNumber = _asInt(session['currentQuestionIndex']) + 1;
    final questionCount = _asInt(deck['questionCount']);
    final inQuestion = status == 'active' && currentQuestion.isNotEmpty;
    final isEnded = status == 'ended';

    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        AppCard(
          accent: isEnded
              ? AppTheme.coral
              : (status == 'active' ? AppTheme.green : AppTheme.orange),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 12,
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_safeString(deck['title'], fallback: 'Quiz room'),
                          style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 6),
                      Text(
                        _joinNonEmpty([
                          _safeString(session['classroomName']),
                          _safeString(session['pin']).isEmpty
                              ? ''
                              : 'PIN ${_safeString(session['pin'])}',
                        ]),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ],
                  ),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      StatusPill(
                          label: status.toUpperCase(),
                          color: status == 'active'
                              ? AppTheme.green
                              : AppTheme.orange),
                      StatusPill(
                          label:
                              '${_asInt(session['participantsCount'])} players',
                          color: AppTheme.blue),
                      StatusPill(
                          label:
                              '$currentQuestionNumber / ${questionCount == 0 ? '?' : questionCount}',
                          color: AppTheme.yellow),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  if (widget.canManage && status == 'lobby')
                    FilledButton.icon(
                      onPressed: _start,
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('Start quiz'),
                    ),
                  if (widget.canManage && status == 'active')
                    FilledButton.icon(
                      onPressed: _advance,
                      icon: const Icon(Icons.skip_next_rounded),
                      label: const Text('Next question'),
                    ),
                  if (widget.canManage && status != 'ended')
                    OutlinedButton.icon(
                      onPressed: _end,
                      icon: const Icon(Icons.stop_circle_rounded),
                      label: const Text('End quiz'),
                    ),
                  OutlinedButton.icon(
                    onPressed: widget.onExit,
                    icon: const Icon(Icons.arrow_back_rounded),
                    label: const Text('Back'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (status == 'lobby')
          AppCard(
            accent: AppTheme.orange,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Lobby', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 6),
                Text(
                  'Share the PIN, wait for players to join, then start the room when everyone is ready.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          )
        else if (inQuestion)
          AppCard(
            accent: AppTheme.green,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      _safeString(currentQuestion['questionText'],
                          fallback: 'Question'),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    StatusPill(
                        label: '${remaining}s left', color: AppTheme.red),
                  ],
                ),
                const SizedBox(height: 14),
                for (int index = 0; index < options.length; index++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: FilledButton(
                      onPressed: widget.participantToken == null ||
                              submitting ||
                              selectedOption != null
                          ? null
                          : () => _submitAnswer(index),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        backgroundColor: _optionColor(index),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 14,
                            backgroundColor:
                                Colors.white.withValues(alpha: 0.18),
                            child: Text('${index + 1}',
                                style: const TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w900)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              options[index],
                              style: const TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.w900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (feedback != null) ...[
                  const SizedBox(height: 10),
                  Text(feedback!,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ],
              ],
            ),
          )
        else
          AppCard(
            accent: AppTheme.yellow,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Results', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                if (leaderboard.isEmpty)
                  const EmptyState(text: 'No leaderboard yet.')
                else
                  for (final entry in leaderboard)
                    DataTile(
                      title:
                          _safeString(entry['displayName'], fallback: 'Player'),
                      subtitle: 'Rank ${_asInt(entry['rank'])}',
                      details: _joinNonEmpty([
                        'Score ${_asInt(entry['totalScore'])}',
                        'Correct ${_asInt(entry['correctCount'])}',
                        'Answered ${_asInt(entry['answeredCount'])}',
                      ]),
                      badge: _safeString(entry['isGuest']) == 'true'
                          ? 'Guest'
                          : 'Student',
                      icon: Icons.emoji_events_rounded,
                      accent: AppTheme.yellow,
                    ),
              ],
            ),
          ),
        if (participant.isNotEmpty) ...[
          const SizedBox(height: 14),
          AppCard(
            accent: AppTheme.coral,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your entry',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  _joinNonEmpty([
                    _safeString(participant['displayName'], fallback: 'Player'),
                    'Score ${_asInt(participant['totalScore'])}',
                    'XP ${_asInt(participant['xpAwarded'])}',
                  ]),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Color _optionColor(int index) {
    const colors = [
      AppTheme.green,
      AppTheme.blue,
      AppTheme.orange,
      AppTheme.coral,
    ];
    return colors[index % colors.length];
  }

  Future<void> _submitAnswer(int index) async {
    setState(() {
      submitting = true;
      selectedOption = index;
      feedback = null;
    });

    try {
      final result =
          await widget.api.post('/quiz/sessions/$sessionId/answers', {
        'participantToken': widget.participantToken,
        'selectedOptionIndex': index,
      });

      if (!mounted) return;
      setState(() {
        snapshot = _asMap(result['snapshot']);
        feedback = _asBool(result['isCorrect'])
            ? 'Correct answer locked in.'
            : 'Not quite, but you are still in the game.';
      });
    } on DioException catch (e) {
      setState(() {
        selectedOption = null;
        feedback = _errorMessage(e);
      });
    } finally {
      if (mounted) {
        setState(() => submitting = false);
      }
    }
  }

  Future<void> _start() async {
    try {
      final result =
          await widget.api.post('/quiz/sessions/$sessionId/start', {});
      if (!mounted) return;
      setState(() {
        snapshot = _asMap(result['snapshot']);
        selectedOption = null;
        feedback = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() => feedback = _friendlyError(error));
      }
    }
  }

  Future<void> _advance() async {
    try {
      final result =
          await widget.api.post('/quiz/sessions/$sessionId/advance', {});
      if (!mounted) return;
      setState(() {
        snapshot = _asMap(result['snapshot']);
        selectedOption = null;
        feedback = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() => feedback = _friendlyError(error));
      }
    }
  }

  Future<void> _end() async {
    try {
      final result = await widget.api.post('/quiz/sessions/$sessionId/end', {});
      if (!mounted) return;
      setState(() {
        snapshot = _asMap(result['snapshot']);
      });
    } catch (error) {
      if (mounted) {
        setState(() => feedback = _friendlyError(error));
      }
    }
  }
}

bool _asBool(dynamic value) {
  if (value is bool) return value;
  final text = '${value ?? ''}'.toLowerCase().trim();
  return text == 'true' || text == '1' || text == 'yes';
}

String _quizWebSocketUrl(String sessionId) {
  final base = Uri.base;
  final scheme = base.scheme == 'https' ? 'wss' : 'ws';
  final host = base.host.isEmpty ? 'localhost' : base.host;
  final port = base.hasPort ? ':${base.port}' : '';
  return '$scheme://$host$port/ws/quiz/$sessionId';
}
