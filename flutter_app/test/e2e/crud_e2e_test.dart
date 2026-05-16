import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:eduapp/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeApiService api;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    api = _FakeApiService();
  });

  testWidgets('teacher can create, edit, and delete lessons',
      (WidgetTester tester) async {
    await _pumpPage(
      tester,
      LessonsPage(api: api, session: api.teacherSession),
    );

    await _tapKey(tester, AppTestKeys.lessonsCreate);
    await _enterTextKey(tester, AppTestKeys.lessonTitleField, 'E2E Lesson');
    await _enterTextKey(
        tester, AppTestKeys.lessonSummaryField, 'A content-first lesson.');
    await _enterTextKey(tester, AppTestKeys.lessonBlockTitle(0), 'Concept');
    await _enterTextKey(
      tester,
      AppTestKeys.lessonBlockBody(0),
      '## Review first\nThis block gates the exercise.',
    );
    await _enterTextKey(
        tester, AppTestKeys.lessonQuestionText(0), 'What is 2 + 2?');
    await _enterTextKey(tester, AppTestKeys.lessonQuestionOptions(0), '4, 5');
    await _enterTextKey(tester, AppTestKeys.lessonQuestionAnswer(0), '4');
    await _enterTextKey(
        tester, AppTestKeys.lessonQuestionExplanation(0), 'Basic addition.');
    await _tapKey(tester, AppTestKeys.lessonSubmit);

    final created = api.lessonByTitle('E2E Lesson');
    expect(created, isNotNull);
    await _waitForKey(tester, AppTestKeys.lessonCard(created!['id']));

    await _tapKey(tester, AppTestKeys.lessonEdit(created['id']));
    await _enterTextKey(
        tester, AppTestKeys.lessonTitleField, 'E2E Lesson Updated');
    await _tapKey(tester, AppTestKeys.lessonSubmit);

    expect(api.lessonByTitle('E2E Lesson Updated'), isNotNull);
    await _waitForKey(tester, AppTestKeys.lessonCard(created['id']));

    await _tapKey(tester, AppTestKeys.lessonDelete(created['id']));
    expect(api.lessonByTitle('E2E Lesson Updated'), isNull);
  });

  testWidgets('teacher post CRUD and student comment CRUD work',
      (WidgetTester tester) async {
    await _pumpPage(
      tester,
      PostsPage(
        api: api,
        session: api.teacherSession,
        enableRealtime: false,
      ),
    );

    await _tapKey(tester, AppTestKeys.postsCreate);
    await _enterTextKey(tester, AppTestKeys.postTitleField, 'E2E Post');
    await _enterTextKey(
        tester, AppTestKeys.postContentField, 'Teacher announcement.');
    await _tapKey(tester, AppTestKeys.postSubmit);

    final post = api.postByTitle('E2E Post');
    expect(post, isNotNull);
    await _waitForKey(tester, AppTestKeys.postCard(post!['id']));

    await _tapKey(tester, AppTestKeys.postEdit(post['id']));
    await _enterTextKey(tester, AppTestKeys.postTitleField, 'E2E Post Updated');
    await _enterTextKey(
        tester, AppTestKeys.postContentField, 'Updated announcement.');
    await _tapKey(tester, AppTestKeys.postSave);

    expect(api.postByTitle('E2E Post Updated'), isNotNull);

    await _pumpPage(
      tester,
      PostsPage(
        api: api,
        session: api.studentSession,
        enableRealtime: false,
      ),
    );
    await _waitForKey(tester, AppTestKeys.postCard(post['id']));
    await _enterTextKey(
        tester, AppTestKeys.postCommentInput(post['id']), 'Student reply');
    await _tapKey(tester, AppTestKeys.postCommentSubmit(post['id']));

    final comment = api.commentByContent(post['id'], 'Student reply');
    expect(comment, isNotNull);
    await _waitForKey(tester, AppTestKeys.commentRow(comment!['id']));

    await _tapKey(tester, AppTestKeys.commentDelete(comment['id']));
    expect(api.commentByContent(post['id'], 'Student reply'), isNull);

    await _pumpPage(
      tester,
      PostsPage(
        api: api,
        session: api.teacherSession,
        enableRealtime: false,
      ),
    );
    await _tapKey(tester, AppTestKeys.postDelete(post['id']));
    expect(api.postByTitle('E2E Post Updated'), isNull);
  });

  testWidgets('student can review lesson content before submitting exercise',
      (WidgetTester tester) async {
    const lessonId = 'student-lesson-1';
    api.lessons.add({
      'id': lessonId,
      'title': 'Student Content Lesson',
      'content': {
        'summary': 'Read the explanation before the exercise.',
        'blocks': [
          {
            'type': 'section',
            'title': 'Start here',
            'body': 'Read this first before the questions.',
          },
          {
            'type': 'text',
            'title': 'Key idea',
            'body': '# Key idea`n- Content comes before questions',
          },
        ],
      },
      'subject': 'Mathematics',
      'form_level': 4,
      'topic': 'Quadratic Functions',
      'difficulty': 'easy',
      'estimated_minutes': 10,
      'classroom_id': 'classroom-1',
      'classroom_name': 'Form 4 Mathematics',
      'completion_percentage': 0,
      'score': 0,
      'is_active': true,
    });
    api.lessonQuestions[lessonId] = [
      {
        'id': 'question-1',
        'question_text': 'What unlocks the exercise?',
        'question_type': 'multiple_choice',
        'options': ['Reviewing content', 'Skipping content'],
        'correct_answer': '0',
        'explanation': 'The student reviews content first.',
        'order_index': 0,
      }
    ];

    await _pumpPage(
      tester,
      AppLessonExperienceDialog(
        api: api,
        lessonId: lessonId,
        classroomId: 'classroom-1',
      ),
    );

    expect(find.text('Start here'), findsOneWidget);
    expect(find.text('Key idea'), findsWidgets);
    expect(
      find.byWidgetPredicate((widget) =>
          widget is RichText &&
          widget.text.toPlainText().contains('Content comes before questions')),
      findsOneWidget,
    );
    expect(
        find.text(
            'Review the lesson content blocks before starting the exercise.'),
        findsOneWidget);

    await tester.tap(find.text('I reviewed the content'));
    await _settle(tester);
    await tester.tap(find.text('Reviewing content'));
    await _settle(tester);
    await tester.tap(find.text('Submit exercise'));
    await _settle(tester);

    expect(api.lessonSubmissions, hasLength(1));
    expect(api.lessonSubmissions.single['contentReviewed'], isTrue);
    expect(api.lessonSubmissions.single['answers'], [
      {'questionId': 'question-1', 'answer': 'Reviewing content'}
    ]);
  });

  testWidgets('admin can create, edit, and disable users',
      (WidgetTester tester) async {
    await _pumpPage(tester, UsersPage(api: api));

    await _tapKey(tester, AppTestKeys.usersAdd);
    await _enterTextKey(tester, AppTestKeys.userFullNameField, 'E2E Student');
    await _enterTextKey(
        tester, AppTestKeys.userEmailField, 'e2e.student@tusyen.test');
    await _enterTextKey(tester, AppTestKeys.userPasswordField, 'password123');
    await _tapKey(tester, AppTestKeys.userSubmit);

    final user = api.userByEmail('e2e.student@tusyen.test');
    expect(user, isNotNull);
    await _waitForKey(tester, AppTestKeys.userCard(user!['id']));

    await _tapKey(tester, AppTestKeys.userEdit(user['id']));
    await _enterTextKey(
        tester, AppTestKeys.userFullNameField, 'E2E Student Updated');
    await _tapKey(tester, AppTestKeys.userSubmit);
    expect(api.userByEmail('e2e.student@tusyen.test')?['full_name'],
        'E2E Student Updated');

    await _tapKey(tester, AppTestKeys.userDisable(user['id']));
    await _tapKey(tester, AppTestKeys.userDisableConfirm);
    expect(api.userByEmail('e2e.student@tusyen.test')?['is_active'], isFalse);
  });

  testWidgets('admin can create, edit, and disable classrooms',
      (WidgetTester tester) async {
    await _pumpPage(tester, AdminClassroomsPage(api: api));

    await _tapKey(tester, AppTestKeys.adminClassroomsAdd);
    await _enterTextKey(
        tester, AppTestKeys.adminClassNameField, 'E2E Admin Class');
    await _enterTextKey(
        tester, AppTestKeys.adminClassSubjectField, 'Mathematics');
    await _enterTextKey(
        tester, AppTestKeys.adminClassJoinCodeField, 'E2ECLASS');
    await _enterTextKey(
      tester,
      AppTestKeys.adminClassDescriptionField,
      'Admin-created classroom.',
    );
    await _tapKey(tester, AppTestKeys.adminClassSubmit);

    final classroom = api.classroomByName('E2E Admin Class');
    expect(classroom, isNotNull);
    await _waitForKey(tester, AppTestKeys.adminClassCard(classroom!['id']));

    await _tapKey(tester, AppTestKeys.adminClassEdit(classroom['id']));
    await _enterTextKey(
        tester, AppTestKeys.adminClassNameField, 'E2E Admin Class Updated');
    await _tapKey(tester, AppTestKeys.adminClassSubmit);
    expect(api.classroomByName('E2E Admin Class Updated'), isNotNull);

    await _tapKey(tester, AppTestKeys.adminClassToggle(classroom['id']));
    expect(
        api.classroomByName('E2E Admin Class Updated')?['is_active'], isFalse);
  });

  testWidgets('admin can create, edit, and delete syllabus items',
      (WidgetTester tester) async {
    await _pumpPage(tester, SyllabusPage(api: api));

    await _tapKey(tester, AppTestKeys.syllabusAdd);
    await _enterTextKey(
        tester, AppTestKeys.syllabusSubjectField, 'Additional Mathematics');
    await _enterTextKey(
        tester, AppTestKeys.syllabusTopicField, 'E2E Admin Topic');
    await _enterTextKey(
        tester, AppTestKeys.syllabusSubtopicField, 'E2E Admin Subtopic');
    await _tapKey(tester, AppTestKeys.syllabusSubmit);

    final item = api.syllabusByTopic('E2E Admin Topic');
    expect(item, isNotNull);
    await _waitForKey(tester, AppTestKeys.syllabusCard(item!['id']));

    await _tapKey(tester, AppTestKeys.syllabusEdit(item['id']));
    await _enterTextKey(
        tester, AppTestKeys.syllabusTopicField, 'E2E Admin Topic Updated');
    await _tapKey(tester, AppTestKeys.syllabusSubmit);
    expect(api.syllabusByTopic('E2E Admin Topic Updated'), isNotNull);

    await _tapKey(tester, AppTestKeys.syllabusDelete(item['id']));
    expect(api.syllabusByTopic('E2E Admin Topic Updated'), isNull);
  });

  testWidgets('admin can create, edit, and delete lessons',
      (WidgetTester tester) async {
    await _pumpPage(
      tester,
      LessonsPage(api: api, session: api.adminSession),
    );

    await _tapKey(tester, AppTestKeys.lessonsCreate);
    await _enterTextKey(
        tester, AppTestKeys.lessonTitleField, 'E2E Admin Lesson');
    await _enterTextKey(tester, AppTestKeys.lessonSummaryField,
        'Admin authored lesson summary.');
    await _enterTextKey(
        tester, AppTestKeys.lessonBlockTitle(0), 'Admin concept');
    await _enterTextKey(tester, AppTestKeys.lessonBlockBody(0),
        'Admin-created instructional content.');
    await _enterTextKey(
        tester, AppTestKeys.lessonQuestionText(0), 'Admin question?');
    await _enterTextKey(
        tester, AppTestKeys.lessonQuestionOptions(0), 'Yes, No');
    await _enterTextKey(tester, AppTestKeys.lessonQuestionAnswer(0), 'Yes');
    await _enterTextKey(
        tester, AppTestKeys.lessonQuestionExplanation(0), 'Admin answer.');
    await _tapKey(tester, AppTestKeys.lessonSubmit);

    final lesson = api.lessonByTitle('E2E Admin Lesson');
    expect(lesson, isNotNull);
    await _waitForKey(tester, AppTestKeys.lessonCard(lesson!['id']));

    await _tapKey(tester, AppTestKeys.lessonEdit(lesson['id']));
    await _enterTextKey(
        tester, AppTestKeys.lessonTitleField, 'E2E Admin Lesson Updated');
    await _tapKey(tester, AppTestKeys.lessonSubmit);
    expect(api.lessonByTitle('E2E Admin Lesson Updated'), isNotNull);

    await _tapKey(tester, AppTestKeys.lessonDelete(lesson['id']));
    expect(api.lessonByTitle('E2E Admin Lesson Updated'), isNull);
  });
}

Future<void> _pumpPage(WidgetTester tester, Widget page) async {
  tester.view.physicalSize = const Size(1440, 1100);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      home: Scaffold(
        backgroundColor: AppTheme.background,
        body: SafeArea(child: page),
      ),
    ),
  );
  await _settle(tester);
}

Future<void> _tapKey(WidgetTester tester, Key key) async {
  final finder = find.byKey(key);
  await _waitForFinder(tester, finder);
  await tester.ensureVisible(finder);
  await _settle(tester);
  await tester.tap(finder);
  await _settle(tester);
}

Future<void> _waitForKey(WidgetTester tester, Key key) {
  return _waitForFinder(tester, find.byKey(key));
}

Future<void> _enterTextKey(WidgetTester tester, Key key, String text) async {
  final finder = find.byKey(key);
  await _waitForFinder(tester, finder);
  await tester.ensureVisible(finder);
  await _settle(tester);
  await tester.tap(finder);
  await tester.enterText(finder, text);
  await _settle(tester);
}

Future<void> _waitForFinder(WidgetTester tester, Finder finder) async {
  final end = DateTime.now().add(const Duration(seconds: 8));
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 80));
    if (finder.evaluate().isNotEmpty) return;
  }
  throw TestFailure('Timed out waiting for ${finder.description}');
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 80));
  }
}

class _FakeApiService extends ApiService {
  _FakeApiService() : super(const FlutterSecureStorage()) {
    users.addAll([
      {
        'id': teacherSession.user.id,
        'email': teacherSession.user.email,
        'full_name': teacherSession.user.fullName,
        'role': 'teacher',
        'is_active': true,
      },
      {
        'id': studentSession.user.id,
        'email': studentSession.user.email,
        'full_name': studentSession.user.fullName,
        'role': 'student',
        'is_active': true,
      },
      {
        'id': adminSession.user.id,
        'email': adminSession.user.email,
        'full_name': adminSession.user.fullName,
        'role': 'admin',
        'is_active': true,
      },
    ]);
  }

  final teacherSession = const LocalSession(
    token: 'teacher-token',
    user: AppUser(
      id: 'teacher-1',
      email: 'teacher@tusyen.test',
      role: 'teacher',
      fullName: 'Demo Teacher',
    ),
  );

  final studentSession = const LocalSession(
    token: 'student-token',
    user: AppUser(
      id: 'student-1',
      email: 'student@tusyen.test',
      role: 'student',
      fullName: 'Demo Student',
    ),
  );

  final adminSession = const LocalSession(
    token: 'admin-token',
    user: AppUser(
      id: 'admin-1',
      email: 'admin@tusyen.test',
      role: 'admin',
      fullName: 'Demo Admin',
    ),
  );

  int _counter = 10;
  final users = <Map<String, dynamic>>[];
  final lessons = <Map<String, dynamic>>[];
  final lessonQuestions = <String, List<Map<String, dynamic>>>{};
  final lessonSubmissions = <Map<String, dynamic>>[];
  final posts = <Map<String, dynamic>>[];
  final comments = <String, List<Map<String, dynamic>>>{};

  final syllabus = <Map<String, dynamic>>[
    {
      'id': 'syllabus-1',
      'subject': 'Mathematics',
      'form_level': 4,
      'topic': 'Quadratic Functions',
      'subtopic': 'Roots and graphs',
      'order_index': 1,
      'content': {'summary': 'Quadratic foundations'},
    }
  ];

  final classrooms = <Map<String, dynamic>>[
    {
      'id': 'classroom-1',
      'teacher_id': 'teacher-1',
      'teacher_name': 'Demo Teacher',
      'name': 'Form 4 Mathematics',
      'description': 'Seed classroom',
      'subject': 'Mathematics',
      'form_level': 4,
      'join_code': 'FORM4MATH',
      'is_public': false,
      'is_active': true,
      'student_count': 1,
      'lesson_count': 0,
      'post_count': 0,
    },
  ];

  Map<String, dynamic>? lessonByTitle(String title) =>
      _findActive(lessons, 'title', title);
  Map<String, dynamic>? postByTitle(String title) =>
      _findActive(posts, 'title', title);
  Map<String, dynamic>? userByEmail(String email) =>
      _find(users, 'email', email);
  Map<String, dynamic>? classroomByName(String name) =>
      _find(classrooms, 'name', name);
  Map<String, dynamic>? syllabusByTopic(String topic) =>
      _findActive(syllabus, 'topic', topic);

  Map<String, dynamic>? commentByContent(Object? postId, String content) {
    return _find(comments['$postId'] ?? [], 'content', content);
  }

  @override
  Future<Map<String, dynamic>> get(String path) async {
    final uri = Uri.parse(path);
    if (uri.path == '/learning/syllabus' || uri.path == '/admin/syllabus') {
      return {'syllabus': syllabus.where(_isActive).toList()};
    }
    if (uri.path == '/learning/lessons' ||
        uri.path == '/learning/catalog' ||
        uri.path == '/admin/lessons') {
      return {'lessons': lessons.where(_isActive).toList()};
    }
    if (uri.pathSegments.length == 3 &&
        uri.pathSegments[0] == 'learning' &&
        uri.pathSegments[1] == 'lessons') {
      final id = uri.pathSegments.last;
      return {
        'lesson': lessons.firstWhere((item) => item['id'] == id),
        'questions': lessonQuestions[id] ?? [],
        'progress': null,
      };
    }
    if (uri.path.startsWith('/learning/authoring/lessons/') ||
        uri.path.startsWith('/admin/lessons/')) {
      final id = uri.pathSegments.last;
      return {
        'lesson': lessons.firstWhere((item) => item['id'] == id),
        'questions': lessonQuestions[id] ?? [],
      };
    }
    if (uri.path == '/classroom') {
      return {'classrooms': classrooms.where(_isActive).toList()};
    }
    if (uri.path == '/feed/posts') {
      final classroomId = uri.queryParameters['classroomId'];
      return {
        'posts': posts.where((post) {
          return _isActive(post) &&
              (classroomId == null || post['classroom_id'] == classroomId);
        }).toList()
      };
    }
    if (uri.pathSegments.length == 4 &&
        uri.pathSegments[0] == 'feed' &&
        uri.pathSegments[1] == 'posts' &&
        uri.pathSegments[3] == 'comments') {
      return {'comments': comments[uri.pathSegments[2]] ?? []};
    }
    if (uri.path == '/admin/users') {
      final role = uri.queryParameters['role'];
      final active = uri.queryParameters['isActive'];
      return {
        'users': users.where((user) {
          return (role == null || user['role'] == role) &&
              (active == null || '${user['is_active']}' == active);
        }).toList()
      };
    }
    if (uri.path == '/admin/parent-links') return {'links': []};
    if (uri.path == '/admin/classrooms') {
      final active = uri.queryParameters['isActive'];
      return {
        'classrooms': classrooms.where((classroom) {
          return active == null || '${classroom['is_active']}' == active;
        }).toList()
      };
    }
    return {};
  }

  @override
  Future<Map<String, dynamic>> post(
      String path, Map<String, dynamic> body) async {
    if (path == '/learning/lessons') return _createLesson(body);
    if (path == '/admin/lessons') {
      return _createLesson(body, createdBy: adminSession.user.id);
    }
    if (path == '/admin/syllabus') return _createSyllabus(body);
    if (path.startsWith('/learning/lessons/') && path.endsWith('/submit')) {
      lessonSubmissions.add(body);
      return {
        'success': true,
        'result': {
          'score': 100,
          'correctAnswers': 1,
          'totalQuestions': 1,
          'completionPercentage': 100,
          'isCompleted': true,
        },
      };
    }
    if (path == '/feed/posts') return _createPost(body);
    if (path.endsWith('/comments') && path.startsWith('/feed/posts/')) {
      return _createComment(path.split('/')[3], body);
    }
    if (path == '/admin/users') return _createUser(body);
    if (path == '/admin/classrooms') return _createClassroom(body);
    return {'success': true};
  }

  @override
  Future<Map<String, dynamic>> patch(
      String path, Map<String, dynamic> body) async {
    if (path.startsWith('/learning/lessons/')) {
      return _updateLesson(path.split('/').last, body);
    }
    if (path.startsWith('/admin/lessons/')) {
      return _updateLesson(path.split('/').last, body);
    }
    if (path.startsWith('/admin/syllabus/')) {
      return _updateSyllabus(path.split('/').last, body);
    }
    if (path.startsWith('/feed/posts/')) {
      return _updatePost(path.split('/').last, body);
    }
    if (path.startsWith('/admin/users/')) {
      return _updateUser(path.split('/').last, body);
    }
    if (path.startsWith('/admin/classrooms/')) {
      return _updateClassroom(path.split('/').last, body);
    }
    return {'success': true};
  }

  @override
  Future<Map<String, dynamic>> delete(String path) async {
    if (path.startsWith('/learning/lessons/')) {
      _setInactive(lessons, path.split('/').last);
    } else if (path.startsWith('/admin/lessons/')) {
      _setInactive(lessons, path.split('/').last);
    } else if (path.startsWith('/admin/syllabus/')) {
      _setInactive(syllabus, path.split('/').last);
    } else if (path.startsWith('/feed/posts/')) {
      _setInactive(posts, path.split('/').last);
    } else if (path.startsWith('/feed/comments/')) {
      final id = path.split('/').last;
      for (final postComments in comments.values) {
        postComments.removeWhere((comment) => comment['id'] == id);
      }
    } else if (path.startsWith('/admin/users/')) {
      _setInactive(users, path.split('/').last);
    } else if (path.startsWith('/admin/classrooms/')) {
      _setInactive(classrooms, path.split('/').last);
    }
    return {'success': true};
  }

  Map<String, dynamic> _createLesson(Map<String, dynamic> body,
      {String? createdBy}) {
    final id = _nextId('lesson');
    final syllabusItem = syllabus.firstWhere(
      (item) => item['id'] == body['syllabusId'],
      orElse: () => syllabus.first,
    );
    final item = {
      'id': id,
      'syllabus_id': body['syllabusId'] ?? syllabusItem['id'],
      'title': body['title'],
      'content': body['content'],
      'subject': syllabusItem['subject'],
      'form_level': syllabusItem['form_level'],
      'topic': syllabusItem['topic'],
      'difficulty': body['difficulty'] ?? 'medium',
      'estimated_minutes': body['estimatedMinutes'] ?? 15,
      'created_by': createdBy ?? teacherSession.user.id,
      'question_count': _questionsFrom(body).length,
      'is_active': true,
    };
    lessons.add(item);
    lessonQuestions[id] = _questionsFrom(body);
    return {'success': true, 'lessonId': id};
  }

  Map<String, dynamic> _updateLesson(String id, Map<String, dynamic> body) {
    final item = lessons.firstWhere((lesson) => lesson['id'] == id);
    if (body['syllabusId'] != null) {
      final syllabusItem = syllabus.firstWhere(
        (row) => row['id'] == body['syllabusId'],
        orElse: () => syllabus.first,
      );
      item['syllabus_id'] = syllabusItem['id'];
      item['subject'] = syllabusItem['subject'];
      item['form_level'] = syllabusItem['form_level'];
      item['topic'] = syllabusItem['topic'];
    }
    item['title'] = body['title'] ?? item['title'];
    item['content'] = body['content'] ?? item['content'];
    item['question_count'] = _questionsFrom(body).length;
    lessonQuestions[id] = _questionsFrom(body);
    return {'success': true};
  }

  Map<String, dynamic> _createPost(Map<String, dynamic> body) {
    final classroom = classrooms.first;
    final id = _nextId('post');
    final item = {
      'id': id,
      'classroom_id': body['classroomId'],
      'classroom_name': classroom['name'],
      'classroom_subject': classroom['subject'],
      'author_id': teacherSession.user.id,
      'author_name': teacherSession.user.fullName,
      'title': body['title'],
      'content': body['content'],
      'post_type': body['postType'] ?? 'announcement',
      'is_pinned': body['isPinned'] ?? false,
      'attachments': body['attachments'] ?? [],
      'like_count': 0,
      'comment_count': 0,
      'is_active': true,
    };
    posts.add(item);
    return {'success': true, 'post': item};
  }

  Map<String, dynamic> _updatePost(String id, Map<String, dynamic> body) {
    final item = posts.firstWhere((post) => post['id'] == id);
    item['title'] = body['title'] ?? item['title'];
    item['content'] = body['content'] ?? item['content'];
    item['post_type'] = body['postType'] ?? item['post_type'];
    item['is_pinned'] = body['isPinned'] ?? item['is_pinned'];
    item['attachments'] = body['attachments'] ?? item['attachments'];
    return {'success': true, 'post': item};
  }

  Map<String, dynamic> _createComment(
      String postId, Map<String, dynamic> body) {
    final item = {
      'id': _nextId('comment'),
      'post_id': postId,
      'user_id': studentSession.user.id,
      'author_name': studentSession.user.fullName,
      'author_role': 'student',
      'content': body['content'],
      'attachments': body['attachments'] ?? [],
    };
    comments.putIfAbsent(postId, () => []).add(item);
    posts.firstWhere((post) => post['id'] == postId)['comment_count'] =
        comments[postId]!.length;
    return {'success': true, 'comment': item};
  }

  Map<String, dynamic> _createUser(Map<String, dynamic> body) {
    final item = {
      'id': _nextId('user'),
      'email': body['email'],
      'full_name': body['fullName'],
      'role': body['role'] ?? 'student',
      'phone_number': body['phoneNumber'],
      'date_of_birth': body['dateOfBirth'],
      'is_active': body['isActive'] ?? true,
    };
    users.add(item);
    return {'success': true, 'user': item};
  }

  Map<String, dynamic> _updateUser(String id, Map<String, dynamic> body) {
    final item = users.firstWhere((user) => user['id'] == id);
    item['email'] = body['email'] ?? item['email'];
    item['full_name'] = body['fullName'] ?? item['full_name'];
    item['role'] = body['role'] ?? item['role'];
    item['is_active'] = body['isActive'] ?? item['is_active'];
    return {'success': true, 'user': item};
  }

  Map<String, dynamic> _createClassroom(Map<String, dynamic> body) {
    final teacher = users.firstWhere((user) => user['role'] == 'teacher');
    final item = {
      'id': _nextId('classroom'),
      'teacher_id': body['teacherId'] ?? teacher['id'],
      'teacher_name': teacher['full_name'],
      'name': body['name'],
      'description': body['description'],
      'subject': body['subject'],
      'form_level': body['formLevel'],
      'join_code': body['joinCode'],
      'is_public': body['isPublic'] ?? false,
      'is_active': body['isActive'] ?? true,
      'student_count': 0,
      'lesson_count': 0,
      'post_count': 0,
    };
    classrooms.add(item);
    return {'success': true, 'classroom': item};
  }

  Map<String, dynamic> _updateClassroom(String id, Map<String, dynamic> body) {
    final item = classrooms.firstWhere((classroom) => classroom['id'] == id);
    item['name'] = body['name'] ?? item['name'];
    item['description'] = body['description'] ?? item['description'];
    item['subject'] = body['subject'] ?? item['subject'];
    item['form_level'] = body['formLevel'] ?? item['form_level'];
    item['join_code'] = body['joinCode'] ?? item['join_code'];
    item['is_public'] = body['isPublic'] ?? item['is_public'];
    item['is_active'] = body['isActive'] ?? item['is_active'];
    return {'success': true, 'classroom': item};
  }

  Map<String, dynamic> _createSyllabus(Map<String, dynamic> body) {
    final item = {
      'id': _nextId('syllabus'),
      'subject': body['subject'],
      'form_level': body['formLevel'],
      'topic': body['topic'],
      'subtopic': body['subtopic'],
      'order_index': body['orderIndex'] ?? syllabus.length + 1,
      'content': body['content'] ?? {},
      'is_active': true,
    };
    syllabus.add(item);
    return {'success': true, 'item': item};
  }

  Map<String, dynamic> _updateSyllabus(String id, Map<String, dynamic> body) {
    final item = syllabus.firstWhere((row) => row['id'] == id);
    item['subject'] = body['subject'] ?? item['subject'];
    item['form_level'] = body['formLevel'] ?? item['form_level'];
    item['topic'] = body['topic'] ?? item['topic'];
    item['subtopic'] = body['subtopic'] ?? item['subtopic'];
    item['order_index'] = body['orderIndex'] ?? item['order_index'];
    item['content'] = body['content'] ?? item['content'];
    return {'success': true, 'item': item};
  }

  List<Map<String, dynamic>> _questionsFrom(Map<String, dynamic> body) {
    final raw = body['quizData'] is Map
        ? (body['quizData'] as Map)['questions']
        : const [];
    if (raw is! List) return [];
    return [
      for (var i = 0; i < raw.length; i++)
        {
          'id': _nextId('question'),
          'question_text': raw[i]['questionText'] ?? raw[i]['text'],
          'question_type': raw[i]['questionType'] ?? raw[i]['type'],
          'options': raw[i]['options'],
          'correct_answer': raw[i]['correctAnswer'],
          'explanation': raw[i]['explanation'],
          'order_index': i,
        }
    ];
  }

  Map<String, dynamic>? _find(
          List<Map<String, dynamic>> rows, String field, String value) =>
      rows.cast<Map<String, dynamic>?>().firstWhere(
            (row) => '${row?[field]}' == value,
            orElse: () => null,
          );

  Map<String, dynamic>? _findActive(
          List<Map<String, dynamic>> rows, String field, String value) =>
      rows.cast<Map<String, dynamic>?>().firstWhere(
            (row) => row != null && _isActive(row) && '${row[field]}' == value,
            orElse: () => null,
          );

  void _setInactive(List<Map<String, dynamic>> rows, String id) {
    rows.firstWhere((item) => item['id'] == id)['is_active'] = false;
  }

  bool _isActive(Map<String, dynamic> row) => row['is_active'] != false;

  String _nextId(String prefix) {
    _counter += 1;
    return '$prefix-$_counter';
  }
}
