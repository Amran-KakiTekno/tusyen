import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http_parser/http_parser.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'external_video_embed.dart';
import 'whiteboard_screen_recorder.dart';

part 'quiz_support.dart';

const _configuredApiBaseUrl =
    String.fromEnvironment('API_BASE_URL', defaultValue: '/api');

String get apiBaseUrl {
  if (_configuredApiBaseUrl.startsWith('/')) {
    return kIsWeb
        ? _configuredApiBaseUrl
        : 'http://localhost:3000$_configuredApiBaseUrl';
  }
  return _configuredApiBaseUrl;
}

String keycloakRedirectUri() {
  if (!kIsWeb) return 'eduapp://callback';

  final base = Uri.base;
  return Uri(
    scheme: base.scheme,
    host: base.host,
    port: base.hasPort ? base.port : null,
    path: '/keycloak-callback',
  ).toString();
}

Uri classroomWebSocketUri(String classroomId) {
  final path = '/ws/classroom/${Uri.encodeComponent(classroomId)}';
  if (apiBaseUrl.startsWith('/')) {
    final base = Uri.base;
    return Uri(
      scheme: base.scheme == 'https' ? 'wss' : 'ws',
      host: base.host,
      port: base.hasPort ? base.port : null,
      path: path,
    );
  }

  final apiUri = Uri.parse(apiBaseUrl);
  return Uri(
    scheme: apiUri.scheme == 'https' ? 'wss' : 'ws',
    host: apiUri.host,
    port: apiUri.hasPort ? apiUri.port : null,
    path: path,
  );
}

class AppTestKeys {
  static const authSubmit = ValueKey<String>('auth-submit');
  static const signOut = ValueKey<String>('auth-sign-out');

  static const teacherClassNameField =
      ValueKey<String>('teacher-class-name-field');
  static const teacherClassSubjectField =
      ValueKey<String>('teacher-class-subject-field');
  static const teacherClassSubmit = ValueKey<String>('teacher-class-submit');
  static const classroomsCreate = ValueKey<String>('classrooms-create');

  static const postsCreate = ValueKey<String>('posts-create');
  static const postTitleField = ValueKey<String>('post-title-field');
  static const postContentField = ValueKey<String>('post-content-field');
  static const postSubmit = ValueKey<String>('post-submit');
  static const postSave = ValueKey<String>('post-save');

  static const lessonsCreate = ValueKey<String>('lessons-create');
  static const lessonTitleField = ValueKey<String>('lesson-title-field');
  static const lessonSummaryField = ValueKey<String>('lesson-summary-field');
  static const lessonSubmit = ValueKey<String>('lesson-submit');

  static const usersAdd = ValueKey<String>('users-add');
  static const userFullNameField = ValueKey<String>('user-full-name-field');
  static const userEmailField = ValueKey<String>('user-email-field');
  static const userPasswordField = ValueKey<String>('user-password-field');
  static const userSubmit = ValueKey<String>('user-submit');
  static const userDisableConfirm = ValueKey<String>('user-disable-confirm');

  static const adminClassroomsAdd = ValueKey<String>('admin-classrooms-add');
  static const adminClassNameField = ValueKey<String>('admin-class-name-field');
  static const adminClassSubjectField =
      ValueKey<String>('admin-class-subject-field');
  static const adminClassJoinCodeField =
      ValueKey<String>('admin-class-join-code-field');
  static const adminClassDescriptionField =
      ValueKey<String>('admin-class-description-field');
  static const adminClassSubmit = ValueKey<String>('admin-class-submit');

  static const syllabusAdd = ValueKey<String>('syllabus-add');
  static const syllabusSubjectField =
      ValueKey<String>('syllabus-subject-field');
  static const syllabusTopicField = ValueKey<String>('syllabus-topic-field');
  static const syllabusSubtopicField =
      ValueKey<String>('syllabus-subtopic-field');
  static const syllabusSubmit = ValueKey<String>('syllabus-submit');

  static ValueKey<String> demoRole(String role) =>
      ValueKey<String>('demo-role-${_testKeySlug(role)}');
  static ValueKey<String> nav(String label) =>
      ValueKey<String>('nav-${_testKeySlug(label)}');
  static ValueKey<String> postCard(Object? id) =>
      ValueKey<String>('post-card-${_testKeySlug(id)}');
  static ValueKey<String> postEdit(Object? id) =>
      ValueKey<String>('post-edit-${_testKeySlug(id)}');
  static ValueKey<String> postDelete(Object? id) =>
      ValueKey<String>('post-delete-${_testKeySlug(id)}');
  static ValueKey<String> postCommentInput(Object? id) =>
      ValueKey<String>('post-comment-input-${_testKeySlug(id)}');
  static ValueKey<String> postCommentSubmit(Object? id) =>
      ValueKey<String>('post-comment-submit-${_testKeySlug(id)}');
  static ValueKey<String> commentRow(Object? id) =>
      ValueKey<String>('comment-row-${_testKeySlug(id)}');
  static ValueKey<String> commentDelete(Object? id) =>
      ValueKey<String>('comment-delete-${_testKeySlug(id)}');

  static ValueKey<String> lessonCard(Object? id) =>
      ValueKey<String>('lesson-card-${_testKeySlug(id)}');
  static ValueKey<String> lessonEdit(Object? id) =>
      ValueKey<String>('lesson-edit-${_testKeySlug(id)}');
  static ValueKey<String> lessonDelete(Object? id) =>
      ValueKey<String>('lesson-delete-${_testKeySlug(id)}');
  static ValueKey<String> lessonBlockTitle(int index) =>
      ValueKey<String>('lesson-block-title-$index');
  static ValueKey<String> lessonBlockBody(int index) =>
      ValueKey<String>('lesson-block-body-$index');
  static ValueKey<String> lessonQuestionText(int index) =>
      ValueKey<String>('lesson-question-text-$index');
  static ValueKey<String> lessonQuestionType(int index) =>
      ValueKey<String>('lesson-question-type-$index');
  static ValueKey<String> lessonQuestionOptions(int index) =>
      ValueKey<String>('lesson-question-options-$index');
  static ValueKey<String> lessonQuestionAnswer(int index) =>
      ValueKey<String>('lesson-question-answer-$index');
  static ValueKey<String> lessonQuestionExplanation(int index) =>
      ValueKey<String>('lesson-question-explanation-$index');

  static ValueKey<String> userCard(Object? id) =>
      ValueKey<String>('user-card-${_testKeySlug(id)}');
  static ValueKey<String> userEdit(Object? id) =>
      ValueKey<String>('user-edit-${_testKeySlug(id)}');
  static ValueKey<String> userDisable(Object? id) =>
      ValueKey<String>('user-disable-${_testKeySlug(id)}');

  static ValueKey<String> adminClassCard(Object? id) =>
      ValueKey<String>('admin-class-card-${_testKeySlug(id)}');
  static ValueKey<String> adminClassEdit(Object? id) =>
      ValueKey<String>('admin-class-edit-${_testKeySlug(id)}');
  static ValueKey<String> adminClassToggle(Object? id) =>
      ValueKey<String>('admin-class-toggle-${_testKeySlug(id)}');
  static ValueKey<String> syllabusCard(Object? id) =>
      ValueKey<String>('syllabus-card-${_testKeySlug(id)}');
  static ValueKey<String> syllabusEdit(Object? id) =>
      ValueKey<String>('syllabus-edit-${_testKeySlug(id)}');
  static ValueKey<String> syllabusDelete(Object? id) =>
      ValueKey<String>('syllabus-delete-${_testKeySlug(id)}');
}

String _testKeySlug(Object? value) {
  final slug = '$value'
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  return slug.isEmpty ? 'unknown' : slug;
}

void main() {
  runApp(const TusyenApp());
}

class TusyenApp extends StatelessWidget {
  const TusyenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tusyen Online',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      locale: const Locale('en', 'US'),
      supportedLocales: const [Locale('en', 'US')],
      home: const AppRoot(),
    );
  }
}

class AppTheme {
  static const green = Color(0xFF9B6CFF);
  static const greenDark = Color(0xFF6E43F3);
  static const blue = Color(0xFF6BC8FF);
  static const orange = Color(0xFFFFA55B);
  static const yellow = Color(0xFFFFD76A);
  static const coral = Color(0xFFFF7AB6);
  static const red = Color(0xFFFF7092);
  static const deepBlue = Color(0xFFF4EEFF);
  static const ink = Color(0xFFE1D8F9);
  static const muted = Color(0xFFA99CCB);
  static const border = Color(0xFF34294D);
  static const surface = Color(0xFF171126);
  static const background = Color(0xFF0B0815);
  static const mint = Color(0xFF24193B);
  static const skySurface = Color(0xFF1A2441);
  static const cream = Color(0xFF372B1F);
  static const peach = Color(0xFF35213B);
  static const rose = Color(0xFF3A1E35);
  static const shadow = Color(0x73000000);
  static const surfaceRaised = Color(0xFF1F1730);
  static const surfaceElevated = Color(0xFF281E3E);
  static const surfaceSoft = Color(0xFF120D1D);
  static const outlineStrong = Color(0xFF473467);

  static ThemeData get dark {
    final bodyText = GoogleFonts.nunitoTextTheme(ThemeData.dark().textTheme);
    return ThemeData(
      brightness: Brightness.dark,
      useMaterial3: true,
      colorScheme: const ColorScheme.dark(
        primary: green,
        secondary: blue,
        error: red,
        surface: surface,
        onPrimary: Colors.white,
        onSecondary: deepBlue,
        onError: Colors.white,
        onSurface: deepBlue,
      ),
      scaffoldBackgroundColor: background,
      textTheme: bodyText.copyWith(
        headlineLarge: GoogleFonts.baloo2(
            fontSize: 38,
            fontWeight: FontWeight.w800,
            color: deepBlue,
            height: 1.02),
        headlineMedium: GoogleFonts.baloo2(
            fontSize: 27,
            fontWeight: FontWeight.w800,
            color: deepBlue,
            height: 1.04),
        titleLarge: GoogleFonts.nunito(
            fontSize: 20, fontWeight: FontWeight.w900, color: deepBlue),
        titleMedium: GoogleFonts.nunito(
            fontSize: 16, fontWeight: FontWeight.w900, color: deepBlue),
        bodyLarge: GoogleFonts.nunito(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: ink,
            height: 1.45),
        bodyMedium: GoogleFonts.nunito(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: muted,
            height: 1.4),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: deepBlue,
        titleTextStyle: GoogleFonts.baloo2(
            fontSize: 24, fontWeight: FontWeight.w800, color: deepBlue),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceRaised,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle:
            GoogleFonts.nunito(fontWeight: FontWeight.w700, color: muted),
        labelStyle:
            GoogleFonts.nunito(fontWeight: FontWeight.w800, color: muted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border, width: 2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border, width: 2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: green, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: green,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 52),
          elevation: 0,
          textStyle:
              GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: deepBlue,
          minimumSize: const Size(0, 52),
          side: const BorderSide(color: outlineStrong, width: 1.5),
          textStyle:
              GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      toggleButtonsTheme: ToggleButtonsThemeData(
        borderRadius: BorderRadius.circular(18),
        constraints: const BoxConstraints(minHeight: 48, minWidth: 140),
        color: muted,
        selectedColor: deepBlue,
        fillColor: green.withValues(alpha: 0.18),
        borderColor: border,
        selectedBorderColor: green.withValues(alpha: 0.72),
        textStyle:
            GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 15),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: green,
        linearTrackColor: border,
      ),
      dividerColor: border,
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surfaceRaised,
        indicatorColor: green.withValues(alpha: 0.16),
        labelTextStyle: WidgetStatePropertyAll(
          GoogleFonts.nunito(
              fontWeight: FontWeight.w900, fontSize: 12, color: deepBlue),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: surface.withValues(alpha: 0.88),
        indicatorColor: green.withValues(alpha: 0.16),
        selectedIconTheme: const IconThemeData(color: green, size: 24),
        unselectedIconTheme: const IconThemeData(color: muted, size: 22),
        selectedLabelTextStyle:
            GoogleFonts.nunito(fontWeight: FontWeight.w900, color: deepBlue),
        unselectedLabelTextStyle:
            GoogleFonts.nunito(fontWeight: FontWeight.w800, color: muted),
      ),
    );
  }
}

class ApiService {
  ApiService(this._storage)
      : _dio = Dio(BaseOptions(
          baseUrl: apiBaseUrl,
          connectTimeout: const Duration(seconds: 20),
          receiveTimeout: const Duration(seconds: 20),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
        )) {
    _dio.interceptors
        .add(InterceptorsWrapper(onRequest: (options, handler) async {
      final token = _sessionToken ?? await _readStoredToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    }));
  }

  final FlutterSecureStorage _storage;
  final Dio _dio;
  String? _sessionToken;

  void setAuthToken(String? token) {
    _sessionToken = token;
  }

  Future<String?> _readStoredToken() async {
    try {
      return await _storage.read(key: 'token');
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>> get(String path) async {
    final response = await _dio.get(path);
    return _asMap(response.data);
  }

  Future<Map<String, dynamic>> post(
      String path, Map<String, dynamic> body) async {
    final response = await _dio.post(path, data: body);
    return _asMap(response.data);
  }

  Future<Map<String, dynamic>> patch(
      String path, Map<String, dynamic> body) async {
    final response = await _dio.patch(path, data: body);
    return _asMap(response.data);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _dio.delete(path);
    return _asMap(response.data);
  }

  Future<Map<String, dynamic>> uploadBytes({
    required String filename,
    required Uint8List bytes,
    String bucket = 'media',
    String? contentType,
  }) async {
    final response = await _dio.post(
      '/storage/upload',
      data: FormData.fromMap({
        'bucket': bucket,
        'file': MultipartFile.fromBytes(
          bytes,
          filename: filename,
          contentType:
              contentType == null ? null : MediaType.parse(contentType),
        ),
      }),
    );
    return _asMap(response.data);
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return {'data': data};
  }
}

class LocalSession {
  const LocalSession({required this.token, required this.user});

  final String token;
  final AppUser user;
}

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.role,
    required this.fullName,
  });

  final String id;
  final String email;
  final String role;
  final String fullName;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: '${json['id'] ?? json['userId'] ?? ''}',
      email: '${json['email'] ?? ''}',
      role: '${json['role'] ?? 'student'}',
      fullName:
          '${json['fullName'] ?? json['full_name'] ?? json['email'] ?? 'Learner'}',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'role': role,
        'fullName': fullName,
      };
}

class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  static const storage = FlutterSecureStorage();
  late final ApiService api = ApiService(storage);
  LocalSession? session;
  bool loading = true;
  String? startupError;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    try {
      if (await _completeKeycloakCallbackIfNeeded()) {
        if (mounted) setState(() => loading = false);
        return;
      }

      final token = await storage.read(key: 'token');
      final userJson = await storage.read(key: 'user');
      if (token != null && userJson != null) {
        api.setAuthToken(token);
        session = LocalSession(
            token: token, user: AppUser.fromJson(jsonDecode(userJson)));
      }
    } catch (error) {
      api.setAuthToken(null);
      startupError = '$error';
    }
    if (mounted) setState(() => loading = false);
  }

  Future<bool> _completeKeycloakCallbackIfNeeded() async {
    if (!kIsWeb || Uri.base.path != '/keycloak-callback') return false;

    final callbackUri = Uri.base;
    final providerError = callbackUri.queryParameters['error'];
    if (providerError != null) {
      startupError =
          callbackUri.queryParameters['error_description'] ?? providerError;
      return true;
    }

    final code = callbackUri.queryParameters['code'];
    final state = callbackUri.queryParameters['state'];
    if (code == null || state == null) {
      startupError = 'Keycloak callback was missing login data.';
      return true;
    }

    try {
      final result = await api.post('/auth/keycloak/callback', {
        'code': code,
        'state': state,
        'redirectUri': keycloakRedirectUri(),
      });
      session = await _persistSession(result);
      startupError = null;
      SystemNavigator.routeInformationUpdated(location: '/', replace: true);
    } on DioException catch (error) {
      startupError = _errorMessage(error);
      await _clearStoredSession();
    } catch (error) {
      startupError = '$error';
      await _clearStoredSession();
    }

    return true;
  }

  Future<void> _saveSession(Map<String, dynamic> data) async {
    final nextSession = await _persistSession(data);
    if (mounted) setState(() => session = nextSession);
  }

  Future<LocalSession> _persistSession(Map<String, dynamic> data) async {
    final token = '${data['token']}';
    final user =
        AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    api.setAuthToken(token);
    try {
      await storage.write(key: 'token', value: token);
      await storage.write(key: 'user', value: jsonEncode(user.toJson()));
    } catch (_) {
      if (!kIsWeb) rethrow;
    }
    return LocalSession(token: token, user: user);
  }

  Future<void> _logout() async {
    api.setAuthToken(null);
    await _clearStoredSession();
    setState(() => session = null);
  }

  Future<void> _clearStoredSession() async {
    try {
      await storage.delete(key: 'token');
      await storage.delete(key: 'user');
    } catch (_) {
      if (!kIsWeb) rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SplashScreen();
    }

    if (_isPublicQuizJoinRoute()) {
      return PublicQuizJoinPage(api: api);
    }

    if (_isPublicFeaturesRoute()) {
      return PublicFeaturesPage(api: api, onAuthenticated: _saveSession);
    }

    if (session == null) {
      return AuthScreen(
        api: api,
        onAuthenticated: _saveSession,
        initialError: startupError,
      );
    }

    return DashboardScreen(api: api, session: session!, onLogout: _logout);
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppScene(
        child: Center(
          child: AnimatedReveal(
            child: AppCard(
              accent: AppTheme.green,
              child: const Padding(
                padding: EdgeInsets.all(10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    MascotBadge(size: 94),
                    SizedBox(height: 18),
                    Text('Tusyen Online',
                        style: TextStyle(
                            fontSize: 30, fontWeight: FontWeight.w900)),
                    SizedBox(height: 8),
                    Text(
                      'Loading your learning space',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.muted),
                    ),
                    SizedBox(height: 16),
                    CircularProgressIndicator(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen(
      {required this.api,
      required this.onAuthenticated,
      this.initialError,
      super.key});

  final ApiService api;
  final Future<void> Function(Map<String, dynamic>) onAuthenticated;
  final String? initialError;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final formKey = GlobalKey<FormState>();
  final email = TextEditingController();
  final password = TextEditingController();
  final fullName = TextEditingController();
  String role = 'student';
  bool register = false;
  bool submitting = false;
  bool keycloakSubmitting = false;
  String? error;

  @override
  void initState() {
    super.initState();
    error = widget.initialError;
  }

  void useDemoAccount(String selectedRole) {
    setState(() {
      register = false;
      role = selectedRole;
      email.text = '$selectedRole@tusyen.test';
      password.text = 'password123';
      fullName.clear();
      error = null;
    });
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      submitting = true;
      error = null;
    });

    try {
      final result = register
          ? await widget.api.post('/auth/register', {
              'email': email.text.trim(),
              'password': password.text,
              'role': role,
              'fullName': fullName.text.trim(),
            })
          : await widget.api.post('/auth/login', {
              'email': email.text.trim(),
              'password': password.text,
              'deviceId': 'flutter-${DateTime.now().millisecondsSinceEpoch}',
            });
      await widget.onAuthenticated(result);
    } on DioException catch (e) {
      setState(() => error = _errorMessage(e));
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  Future<void> startKeycloakLogin() async {
    if (!kIsWeb) {
      setState(() => error =
          'Keycloak sign-in is currently enabled for the web app. Use email login on this build.');
      return;
    }

    setState(() {
      keycloakSubmitting = true;
      error = null;
    });

    try {
      final result = await widget.api.post('/auth/keycloak/login-url', {
        'redirectUri': keycloakRedirectUri(),
      });
      final url = Uri.parse('${result['url']}');
      final opened = await launchUrl(url, webOnlyWindowName: '_self');
      if (!opened) {
        setState(() => error = 'Could not open Keycloak login.');
      }
    } on DioException catch (e) {
      setState(() => error = _errorMessage(e));
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => keycloakSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppScene(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1160),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final wide = constraints.maxWidth > 860;
                    final form = _AuthPanel(
                      formKey: formKey,
                      register: register,
                      submitting: submitting,
                      keycloakSubmitting: keycloakSubmitting,
                      error: error,
                      email: email,
                      password: password,
                      fullName: fullName,
                      role: role,
                      onRoleChanged: (value) => setState(() => role = value),
                      onModeChanged: (value) => setState(() {
                        register = value;
                        error = null;
                      }),
                      onSubmit: submit,
                      onKeycloakSubmit: startKeycloakLogin,
                      compact: !wide,
                    );
                    final hero = _AuthHero(
                      onDemoRoleSelected: useDemoAccount,
                      onExploreFeatures: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (context) => PublicFeaturesPage(
                              api: widget.api,
                              onAuthenticated: widget.onAuthenticated,
                            ),
                          ),
                        );
                      },
                    );

                    if (!wide) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _MobileAuthHero(
                            onExploreFeatures: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (context) => PublicFeaturesPage(
                                    api: widget.api,
                                    onAuthenticated: widget.onAuthenticated,
                                  ),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 16),
                          ResponsiveRoleStrip(
                            onDemoRoleSelected: useDemoAccount,
                            compact: true,
                          ),
                          const SizedBox(height: 16),
                          form,
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(flex: 6, child: hero),
                        const SizedBox(width: 36),
                        SizedBox(width: 430, child: form),
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
}

class PublicFeaturesPage extends StatelessWidget {
  const PublicFeaturesPage({
    required this.api,
    required this.onAuthenticated,
    super.key,
  });

  final ApiService api;
  final Future<void> Function(Map<String, dynamic>) onAuthenticated;

  Future<void> _openApp(BuildContext context) async {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return;
    }

    if (kIsWeb) {
      final rootUri = Uri.base.replace(path: '/', query: '', fragment: '');
      final opened = await launchUrl(rootUri, webOnlyWindowName: '_self');
      if (opened) return;
    }

    navigator.pushReplacement(
      MaterialPageRoute<void>(
        builder: (context) =>
            AuthScreen(api: api, onAuthenticated: onAuthenticated),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppScene(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1180),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _PublicFeatureTopBar(onOpenApp: () => _openApp(context)),
                    const SizedBox(height: 34),
                    _PublicFeaturesHero(onOpenApp: () => _openApp(context)),
                    const SizedBox(height: 28),
                    const _PublicRoleOverview(),
                    const SizedBox(height: 28),
                    for (final showcase in _publicRoleShowcases) ...[
                      _PublicRoleSection(showcase: showcase),
                      const SizedBox(height: 22),
                    ],
                    const _PublicWorkflowBand(),
                    const SizedBox(height: 28),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PublicFeatureTopBar extends StatelessWidget {
  const _PublicFeatureTopBar({required this.onOpenApp});

  final VoidCallback onOpenApp;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 640;
        final brand = Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const MascotBadge(size: 58),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Tusyen Online',
                    style: Theme.of(context).textTheme.titleLarge),
                Text('Public feature tour',
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ],
        );

        final actions = Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            const StatusPill(label: 'No login needed', color: AppTheme.blue),
            OutlinedButton.icon(
              onPressed: onOpenApp,
              icon: const Icon(Icons.login_rounded),
              label: const Text('Open app'),
            ),
          ],
        );

        if (compact) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              brand,
              const SizedBox(height: 18),
              actions,
            ],
          );
        }

        return Row(
          children: [
            brand,
            const Spacer(),
            actions,
          ],
        );
      },
    );
  }
}

class _PublicFeaturesHero extends StatelessWidget {
  const _PublicFeaturesHero({required this.onOpenApp});

  final VoidCallback onOpenApp;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth > 880;
        final copy = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const StatusPill(
                label: 'Student + Teacher + Parent', color: AppTheme.green),
            const SizedBox(height: 18),
            Text(
              'See how Tusyen works before anyone signs in.',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 16),
            Text(
              'This public page demonstrates the learning loop for students, classroom publishing tools for teachers, and progress visibility for parents. The tour focuses on the active app features and leaves internal platform controls out of view.',
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(color: AppTheme.ink.withValues(alpha: 0.92)),
            ),
            const SizedBox(height: 22),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: const [
                FeatureChip(label: 'Subject paths', color: AppTheme.mint),
                FeatureChip(label: 'Classroom posts', color: AppTheme.rose),
                FeatureChip(label: 'Lesson exercises', color: AppTheme.cream),
                FeatureChip(
                    label: 'Parent progress', color: AppTheme.skySurface),
              ],
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onOpenApp,
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('Open the app'),
            ),
          ],
        );

        final visual = const _PublicJourneyPreview();

        if (!wide) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              copy,
              const SizedBox(height: 24),
              visual,
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(flex: 6, child: copy),
            const SizedBox(width: 34),
            Expanded(flex: 5, child: visual),
          ],
        );
      },
    );
  }
}

class _PublicJourneyPreview extends StatelessWidget {
  const _PublicJourneyPreview();

  @override
  Widget build(BuildContext context) {
    const steps = [
      _PublicJourneyStep(
        icon: Icons.menu_book_rounded,
        title: 'Student chooses a subject',
        detail:
            'Mathematics, Science, English, or Sejarah paths open into topic content and exercises.',
        color: AppTheme.green,
      ),
      _PublicJourneyStep(
        icon: Icons.campaign_rounded,
        title: 'Teacher keeps the class moving',
        detail:
            'Posts, lesson assignments, live quizzes, and whiteboard sessions sit around each classroom.',
        color: AppTheme.blue,
      ),
      _PublicJourneyStep(
        icon: Icons.insights_rounded,
        title: 'Parent follows the growth',
        detail:
            'Linked children show mastery, streaks, quiz XP, and classroom activity in one view.',
        color: AppTheme.coral,
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceRaised,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
            color: AppTheme.outlineStrong.withValues(alpha: 0.86), width: 1.2),
        boxShadow: const [
          BoxShadow(
              color: AppTheme.shadow, blurRadius: 22, offset: Offset(0, 10))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: AppTheme.green.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.route_rounded, color: AppTheme.green),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text('One connected learning loop',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
            ],
          ),
          const SizedBox(height: 18),
          for (int i = 0; i < steps.length; i++) ...[
            _PublicJourneyNode(step: steps[i], isLast: i == steps.length - 1),
          ],
        ],
      ),
    );
  }
}

class _PublicJourneyStep {
  const _PublicJourneyStep({
    required this.icon,
    required this.title,
    required this.detail,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String detail;
  final Color color;
}

class _PublicJourneyNode extends StatelessWidget {
  const _PublicJourneyNode({required this.step, required this.isLast});

  final _PublicJourneyStep step;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: step.color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: step.color.withValues(alpha: 0.3)),
              ),
              child: Icon(step.icon, color: step.color),
            ),
            if (!isLast)
              Container(
                width: 6,
                height: 36,
                decoration: BoxDecoration(
                  color: AppTheme.outlineStrong.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(step.title,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(step.detail,
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PublicRoleOverview extends StatelessWidget {
  const _PublicRoleOverview();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = constraints.maxWidth > 920
            ? (constraints.maxWidth - 28) / 3
            : constraints.maxWidth;
        return Wrap(
          spacing: 14,
          runSpacing: 14,
          children: [
            for (final showcase in _publicRoleShowcases)
              SizedBox(
                width: cardWidth,
                child: _PublicRoleMiniCard(showcase: showcase),
              ),
          ],
        );
      },
    );
  }
}

class _PublicRoleMiniCard extends StatelessWidget {
  const _PublicRoleMiniCard({required this.showcase});

  final _PublicRoleShowcase showcase;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      accent: showcase.color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: showcase.color.withValues(alpha: 0.16),
                child: Icon(showcase.icon, color: showcase.color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(showcase.role,
                    style: Theme.of(context).textTheme.titleLarge),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(showcase.shortPitch,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final chip in showcase.previewChips.take(3))
                StatusPill(label: chip, color: showcase.color),
            ],
          ),
        ],
      ),
    );
  }
}

class _PublicRoleSection extends StatelessWidget {
  const _PublicRoleSection({required this.showcase});

  final _PublicRoleShowcase showcase;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      accent: showcase.color,
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 760;
              final heading = Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: showcase.color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Icon(showcase.icon, color: showcase.color, size: 30),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(showcase.role,
                            style: Theme.of(context).textTheme.headlineMedium),
                        const SizedBox(height: 6),
                        Text(showcase.pitch,
                            style: Theme.of(context).textTheme.bodyLarge),
                      ],
                    ),
                  ),
                ],
              );

              final chips = Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final chip in showcase.previewChips)
                    FeatureChip(label: chip, color: AppTheme.surfaceElevated),
                ],
              );

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    heading,
                    const SizedBox(height: 16),
                    chips,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 6, child: heading),
                  const SizedBox(width: 22),
                  Expanded(flex: 4, child: chips),
                ],
              );
            },
          ),
          const SizedBox(height: 22),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 840;
              final tileWidth =
                  wide ? (constraints.maxWidth - 14) / 2 : constraints.maxWidth;
              return Wrap(
                spacing: 14,
                runSpacing: 14,
                children: [
                  for (final item in showcase.features)
                    SizedBox(
                      width: tileWidth,
                      child: _PublicFeatureTile(
                        item: item,
                        color: showcase.color,
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          _PublicRoleFlow(showcase: showcase),
        ],
      ),
    );
  }
}

class _PublicFeatureTile extends StatelessWidget {
  const _PublicFeatureTile({required this.item, required this.color});

  final _PublicFeatureItem item;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 122),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceSoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
            color: AppTheme.outlineStrong.withValues(alpha: 0.72), width: 1.1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(item.icon, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 5),
                Text(item.description,
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PublicRoleFlow extends StatelessWidget {
  const _PublicRoleFlow({required this.showcase});

  final _PublicRoleShowcase showcase;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: showcase.color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: showcase.color.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(showcase.flowTitle,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth > 760;
              final width =
                  wide ? (constraints.maxWidth - 24) / 3 : constraints.maxWidth;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (int i = 0; i < showcase.flow.length; i++)
                    SizedBox(
                      width: width,
                      child: _PublicFlowStep(
                        index: i + 1,
                        text: showcase.flow[i],
                        color: showcase.color,
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _PublicFlowStep extends StatelessWidget {
  const _PublicFlowStep({
    required this.index,
    required this.text,
    required this.color,
  });

  final int index;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 15,
          backgroundColor: color,
          child: Text('$index',
              style: GoogleFonts.nunito(
                  color: Colors.white, fontWeight: FontWeight.w900)),
        ),
        const SizedBox(width: 10),
        Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
      ],
    );
  }
}

class _PublicWorkflowBand extends StatelessWidget {
  const _PublicWorkflowBand();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.surfaceRaised.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
            color: AppTheme.outlineStrong.withValues(alpha: 0.75), width: 1.2),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth > 860;
          final content = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('How the roles connect',
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 10),
              Text(
                'Teachers publish classroom learning moments, students turn them into practice and progress, and parents get a clear view of what changed.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
          );

          final chips = Wrap(
            spacing: 10,
            runSpacing: 10,
            children: const [
              FeatureChip(label: 'Create classroom'),
              FeatureChip(label: 'Publish post'),
              FeatureChip(label: 'Assign lesson'),
              FeatureChip(label: 'Student attempts'),
              FeatureChip(label: 'Parent monitors'),
            ],
          );

          if (!wide) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                content,
                const SizedBox(height: 18),
                chips,
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(flex: 5, child: content),
              const SizedBox(width: 24),
              Expanded(flex: 5, child: chips),
            ],
          );
        },
      ),
    );
  }
}

class _PublicFeatureItem {
  const _PublicFeatureItem({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;
}

class _PublicRoleShowcase {
  const _PublicRoleShowcase({
    required this.role,
    required this.shortPitch,
    required this.pitch,
    required this.flowTitle,
    required this.icon,
    required this.color,
    required this.previewChips,
    required this.features,
    required this.flow,
  });

  final String role;
  final String shortPitch;
  final String pitch;
  final String flowTitle;
  final IconData icon;
  final Color color;
  final List<String> previewChips;
  final List<_PublicFeatureItem> features;
  final List<String> flow;
}

const _publicRoleShowcases = [
  _PublicRoleShowcase(
    role: 'Students',
    shortPitch:
        'Choose subjects, open topic paths, complete exercises, and grow streaks.',
    pitch:
        'Students get the core Duolingo-style journey: subject choice, topic content, classroom context, exercises, live quizzes, posts, and saved progress.',
    flowTitle: 'Student flow',
    icon: Icons.school_rounded,
    color: AppTheme.green,
    previewChips: [
      'Subject choice',
      'Topic content',
      'Exercises',
      'Class posts',
      'Quiz XP',
      'Progress',
    ],
    features: [
      _PublicFeatureItem(
        icon: Icons.account_tree_rounded,
        title: 'Subject and topic paths',
        description:
            'Pick a Form 4 or Form 5 subject, choose a topic, then follow syllabus notes and lesson steps.',
      ),
      _PublicFeatureItem(
        icon: Icons.fact_check_rounded,
        title: 'Interactive exercises',
        description:
            'Attempt multiple choice, true/false, and fill-in-the-blank questions with score and retry support.',
      ),
      _PublicFeatureItem(
        icon: Icons.groups_rounded,
        title: 'Classroom membership',
        description:
            'Join classes with a classroom ID and code, see teacher details, and leave a class when needed.',
      ),
      _PublicFeatureItem(
        icon: Icons.campaign_rounded,
        title: 'Teacher posts',
        description:
            'Read announcements, assignments, pinned updates, and general posts from joined classrooms.',
      ),
      _PublicFeatureItem(
        icon: Icons.favorite_rounded,
        title: 'Engagement',
        description:
            'Like posts, add comments, remove own comments, and open teacher profiles from posts.',
      ),
      _PublicFeatureItem(
        icon: Icons.quiz_rounded,
        title: 'Live quiz rooms',
        description:
            'Join by PIN, answer timed questions, see feedback, earn XP, and follow the leaderboard.',
      ),
      _PublicFeatureItem(
        icon: Icons.emoji_events_rounded,
        title: 'Progress dashboard',
        description:
            'Track attempts, completed lessons, average score, streaks, quiz XP, and subject mastery.',
      ),
      _PublicFeatureItem(
        icon: Icons.history_rounded,
        title: 'Learning history',
        description:
            'Review recent quiz sessions and saved lesson progress by classroom, subject, topic, and score.',
      ),
    ],
    flow: [
      'Choose Mathematics, Science, English, or Sejarah.',
      'Open a topic path and read the lesson content.',
      'Finish exercises, react to class posts, and build progress.',
    ],
  ),
  _PublicRoleShowcase(
    role: 'Teachers',
    shortPitch:
        'Run classrooms, post updates, assign lessons, host quizzes, and show a profile.',
    pitch:
        'Teachers get the tools to make a class feel active: owned classrooms, public profile, posts, lesson assignment, quiz hosting, and whiteboard session management.',
    flowTitle: 'Teacher flow',
    icon: Icons.draw_rounded,
    color: AppTheme.blue,
    previewChips: [
      'Profile',
      'Classrooms',
      'Posts',
      'Lesson assignment',
      'Live quizzes',
      'Whiteboard',
    ],
    features: [
      _PublicFeatureItem(
        icon: Icons.person_rounded,
        title: 'Public teacher profile',
        description:
            'Edit headline, bio, specialties, credentials, experience, and location for students and parents to view.',
      ),
      _PublicFeatureItem(
        icon: Icons.add_business_rounded,
        title: 'Classroom creation',
        description:
            'Create Form 4 or Form 5 classrooms with subject, join code, enrollment count, and latest posts.',
      ),
      _PublicFeatureItem(
        icon: Icons.campaign_rounded,
        title: 'Classroom publishing',
        description:
            'Create announcements, assignments, and general posts, then pin, edit, or delete own posts.',
      ),
      _PublicFeatureItem(
        icon: Icons.forum_rounded,
        title: 'Post engagement',
        description:
            'Like posts, reply in comments, delete own comments, and moderate comments on teacher-owned posts.',
      ),
      _PublicFeatureItem(
        icon: Icons.library_books_rounded,
        title: 'Lesson catalog',
        description:
            'Browse lessons, preview the student experience, and assign selected lessons to owned classrooms.',
      ),
      _PublicFeatureItem(
        icon: Icons.quiz_rounded,
        title: 'Quiz deck hosting',
        description:
            'Create reusable decks, configure questions, start rooms, share PINs, and move through live rounds.',
      ),
      _PublicFeatureItem(
        icon: Icons.leaderboard_rounded,
        title: 'Live leaderboard',
        description:
            'Track participants, rank, score, correct answers, answered count, and guest/student status.',
      ),
      _PublicFeatureItem(
        icon: Icons.edit_note_rounded,
        title: 'Whiteboard sessions',
        description:
            'Start classroom whiteboard sessions with title and description, then inspect active session state.',
      ),
    ],
    flow: [
      'Create a classroom and share the join code.',
      'Assign lessons, publish updates, and host a live quiz.',
      'Use profile, posts, comments, and whiteboard sessions to keep students engaged.',
    ],
  ),
  _PublicRoleShowcase(
    role: 'Parents',
    shortPitch: 'Link children, watch progress, and follow classroom activity.',
    pitch:
        'Parents get a focused oversight space: linked children, progress snapshots, classroom posts, teacher profiles, and engagement on updates.',
    flowTitle: 'Parent flow',
    icon: Icons.family_restroom_rounded,
    color: AppTheme.coral,
    previewChips: [
      'Child linking',
      'Progress',
      'Posts',
      'Teacher profiles',
      'Comments',
      'Quiz XP',
    ],
    features: [
      _PublicFeatureItem(
        icon: Icons.link_rounded,
        title: 'Child linking',
        description:
            'Link a learner account by student UUID and keep each linked child visible from the parent home.',
      ),
      _PublicFeatureItem(
        icon: Icons.child_care_rounded,
        title: 'Children list',
        description:
            'See each child name, email, student ID, and direct access to their progress overview.',
      ),
      _PublicFeatureItem(
        icon: Icons.insights_rounded,
        title: 'Progress overview',
        description:
            'Review attempts, completed lessons, average score, streak, quiz XP, and by-subject mastery.',
      ),
      _PublicFeatureItem(
        icon: Icons.timeline_rounded,
        title: 'Learning activity',
        description:
            'Follow recent quiz sessions and lesson progress with classroom, subject, topic, and score context.',
      ),
      _PublicFeatureItem(
        icon: Icons.campaign_rounded,
        title: 'Classroom feed',
        description:
            'Read posts from active classrooms linked to the child, including pinned notices and assignments.',
      ),
      _PublicFeatureItem(
        icon: Icons.favorite_rounded,
        title: 'Parent engagement',
        description:
            'Like accessible posts, write comments, delete own comments, and open teacher profiles from posts.',
      ),
    ],
    flow: [
      'Link a student account with the child student ID.',
      'Open progress to see mastery, streaks, and quiz history.',
      'Follow posts from the child classroom and engage when needed.',
    ],
  ),
];

class _AuthHero extends StatelessWidget {
  const _AuthHero({
    required this.onDemoRoleSelected,
    required this.onExploreFeatures,
  });

  final ValueChanged<String> onDemoRoleSelected;
  final VoidCallback onExploreFeatures;

  @override
  Widget build(BuildContext context) {
    return AnimatedReveal(
      distance: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              MascotBadge(size: 84),
              SizedBox(width: 16),
              StatusPill(label: 'Form 4 + Form 5', color: AppTheme.blue),
            ],
          ),
          const SizedBox(height: 26),
          Text(
              'Learn the Malaysian syllabus with game energy and classroom structure.',
              style: Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height: 16),
          Text(
            'Tusyen brings together Duolingo-style momentum, teacher-led classrooms, parent visibility, and self-hosted control. The first release focuses on KSSR and KSSM learning paths for Form 4 and Form 5.',
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: AppTheme.ink.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 22),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const FeatureChip(label: 'XP paths', color: AppTheme.cream),
              const FeatureChip(
                  label: 'Parent oversight', color: AppTheme.rose),
              const FeatureChip(
                  label: 'Teacher posts', color: AppTheme.skySurface),
              const FeatureChip(
                  label: 'Whiteboard sessions', color: AppTheme.mint),
              OutlinedButton.icon(
                onPressed: onExploreFeatures,
                icon: const Icon(Icons.auto_awesome_rounded),
                label: const Text('Explore public features'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const IllustratedPathCard(),
          const SizedBox(height: 18),
          ResponsiveRoleStrip(onDemoRoleSelected: onDemoRoleSelected),
        ],
      ),
    );
  }
}

class _MobileAuthHero extends StatelessWidget {
  const _MobileAuthHero({required this.onExploreFeatures});

  final VoidCallback onExploreFeatures;

  @override
  Widget build(BuildContext context) {
    return AnimatedReveal(
      distance: 14,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              MascotBadge(size: 56),
              SizedBox(width: 14),
              StatusPill(label: 'Form 4 + Form 5', color: AppTheme.blue),
            ],
          ),
          const SizedBox(height: 10),
          Text('Tusyen', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(
            'Daily syllabus practice, teacher classrooms, and parent visibility in one place.',
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: AppTheme.ink.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: onExploreFeatures,
            icon: const Icon(Icons.auto_awesome_rounded),
            label: const Text('Public features'),
          ),
        ],
      ),
    );
  }
}

class _AuthPanel extends StatelessWidget {
  const _AuthPanel({
    required this.formKey,
    required this.register,
    required this.submitting,
    required this.keycloakSubmitting,
    required this.email,
    required this.password,
    required this.fullName,
    required this.role,
    required this.onRoleChanged,
    required this.onModeChanged,
    required this.onSubmit,
    required this.onKeycloakSubmit,
    this.error,
    this.compact = false,
  });

  final GlobalKey<FormState> formKey;
  final bool register;
  final bool submitting;
  final bool keycloakSubmitting;
  final TextEditingController email;
  final TextEditingController password;
  final TextEditingController fullName;
  final String role;
  final ValueChanged<String> onRoleChanged;
  final ValueChanged<bool> onModeChanged;
  final VoidCallback onSubmit;
  final VoidCallback onKeycloakSubmit;
  final String? error;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return AnimatedReveal(
      delay: const Duration(milliseconds: 120),
      distance: 22,
      child: AppCard(
        accent: register ? AppTheme.orange : AppTheme.green,
        padding: EdgeInsets.all(compact ? 14 : 18),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(register ? 'Create your role space' : 'Welcome back',
                  style: compact
                      ? Theme.of(context).textTheme.titleLarge
                      : Theme.of(context).textTheme.headlineMedium),
              SizedBox(height: compact ? 4 : 6),
              Text(
                register
                    ? 'Start as a student, teacher, parent, or admin.'
                    : 'Pick up your next lesson, classroom, or admin task.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              SizedBox(height: compact ? 12 : 18),
              ToggleButtons(
                isSelected: [!register, register],
                onPressed: (index) => onModeChanged(index == 1),
                children: const [
                  Padding(
                      padding: EdgeInsets.symmetric(horizontal: 18),
                      child: Text('Login')),
                  Padding(
                      padding: EdgeInsets.symmetric(horizontal: 18),
                      child: Text('Register')),
                ],
              ),
              SizedBox(height: compact ? 14 : 20),
              if (register) ...[
                TextFormField(
                  controller: fullName,
                  decoration: const InputDecoration(labelText: 'Full name'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Enter your name'
                      : null,
                ),
                SizedBox(height: compact ? 10 : 12),
              ],
              TextFormField(
                controller: email,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                validator: (value) => value == null || !value.contains('@')
                    ? 'Enter a valid email'
                    : null,
              ),
              SizedBox(height: compact ? 10 : 12),
              TextFormField(
                controller: password,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true,
                validator: (value) => value == null || value.length < 8
                    ? 'Use at least 8 characters'
                    : null,
              ),
              if (register) ...[
                SizedBox(height: compact ? 10 : 12),
                DropdownButtonFormField<String>(
                  value: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'student', child: Text('Student')),
                    DropdownMenuItem(value: 'teacher', child: Text('Teacher')),
                    DropdownMenuItem(value: 'parent', child: Text('Parent')),
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                  ],
                  onChanged: (value) => onRoleChanged(value ?? 'student'),
                ),
              ],
              SizedBox(height: compact ? 12 : 18),
              if (error != null) ...[
                Text(error!,
                    style: const TextStyle(
                        color: AppTheme.red, fontWeight: FontWeight.w800)),
                SizedBox(height: compact ? 10 : 12),
              ],
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  key: AppTestKeys.authSubmit,
                  onPressed: submitting || keycloakSubmitting ? null : onSubmit,
                  icon: Icon(register
                      ? Icons.rocket_launch_rounded
                      : Icons.play_arrow_rounded),
                  label: Text(submitting
                      ? 'Please wait...'
                      : register
                          ? 'Create account'
                          : 'Start learning'),
                ),
              ),
              if (!register) ...[
                SizedBox(height: compact ? 10 : 12),
                OutlinedButton.icon(
                  onPressed: submitting || keycloakSubmitting
                      ? null
                      : onKeycloakSubmit,
                  icon: const Icon(Icons.verified_user_rounded),
                  label: Text(keycloakSubmitting
                      ? 'Opening Keycloak...'
                      : 'Continue with Keycloak'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen(
      {required this.api,
      required this.session,
      required this.onLogout,
      super.key});

  final ApiService api;
  final LocalSession session;
  final VoidCallback onLogout;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int selected = 0;

  List<NavItem> get nav {
    final role = widget.session.user.role;
    if (role == 'teacher') {
      return const [
        NavItem('Home', Icons.home_rounded),
        NavItem('Profile', Icons.person_rounded),
        NavItem('Classrooms', Icons.groups_rounded),
        NavItem('Lessons', Icons.library_books_rounded),
        NavItem('Quizzes', Icons.quiz_rounded),
        NavItem('Whiteboard', Icons.draw_rounded),
        NavItem('Posts', Icons.campaign_rounded),
      ];
    }
    if (role == 'parent') {
      return const [
        NavItem('Home', Icons.home_rounded),
        NavItem('Children', Icons.family_restroom_rounded),
        NavItem('Learn', Icons.school_rounded),
        NavItem('Classrooms', Icons.groups_rounded),
        NavItem('Posts', Icons.campaign_rounded),
        NavItem('Progress', Icons.insights_rounded),
      ];
    }
    if (role == 'admin') {
      return const [
        NavItem('Home', Icons.home_rounded),
        NavItem('Users', Icons.admin_panel_settings_rounded),
        NavItem('Classrooms', Icons.groups_rounded),
        NavItem('Syllabus', Icons.menu_book_rounded),
        NavItem('Lessons', Icons.library_books_rounded),
        NavItem('System', Icons.monitor_heart_rounded),
      ];
    }
    return const [
      NavItem('Home', Icons.home_rounded),
      NavItem('Learn', Icons.school_rounded),
      NavItem('Classrooms', Icons.groups_rounded),
      NavItem('Quizzes', Icons.quiz_rounded),
      NavItem('Posts', Icons.campaign_rounded),
      NavItem('Progress', Icons.emoji_events_rounded),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final items = nav;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width >= 980;
    final isMobile = width < 640;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AppScene(
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(isMobile ? 10 : 18),
            child: isDesktop
                ? Row(
                    children: [
                      SizedBox(
                        width: 288,
                        child: RoleSidebar(
                          user: widget.session.user,
                          items: items,
                          selected: selected,
                          onSelect: (value) => setState(() => selected = value),
                          onLogout: widget.onLogout,
                        ),
                      ),
                      const SizedBox(width: 18),
                      Expanded(
                        child: AppCard(
                          accent: _roleAccent(widget.session.user.role),
                          padding: EdgeInsets.zero,
                          expandChild: true,
                          child: IndexedStack(
                            sizing: StackFit.expand,
                            index: selected,
                            children: [
                              for (final item in items)
                                RolePage(
                                    label: item.label,
                                    api: widget.api,
                                    session: widget.session),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : Column(
                    children: [
                      DashboardHeader(
                        user: widget.session.user,
                        onLogout: widget.onLogout,
                        compact: isMobile,
                      ),
                      SizedBox(height: isMobile ? 8 : 14),
                      Expanded(
                        child: IndexedStack(
                          sizing: StackFit.expand,
                          index: selected,
                          children: [
                            for (final item in items)
                              RolePage(
                                  label: item.label,
                                  api: widget.api,
                                  session: widget.session),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
      bottomNavigationBar: width < 900
          ? DecoratedBox(
              decoration: const BoxDecoration(color: AppTheme.background),
              child: SafeArea(
                minimum: EdgeInsets.fromLTRB(10, 0, 10, isMobile ? 8 : 12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: NavigationBar(
                    height: isMobile ? 68 : 76,
                    selectedIndex: selected,
                    onDestinationSelected: (value) =>
                        setState(() => selected = value),
                    destinations: [
                      for (final item in items)
                        NavigationDestination(
                            icon: Icon(item.icon),
                            label: _mobileNavLabel(item.label)),
                    ],
                  ),
                ),
              ),
            )
          : null,
    );
  }
}

class AppScene extends StatelessWidget {
  const AppScene({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF080611),
                  Color(0xFF130D24),
                  Color(0xFF1B1232)
                ],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(painter: ScenePainter()),
          ),
        ),
        child,
      ],
    );
  }
}

class ScenePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = AppTheme.deepBlue.withValues(alpha: 0.035)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final blockPaint = Paint()..color = AppTheme.green.withValues(alpha: 0.1);
    final warmPaint = Paint()..color = AppTheme.coral.withValues(alpha: 0.09);
    final coolPaint = Paint()..color = AppTheme.blue.withValues(alpha: 0.07);

    const spacing = 36.0;
    for (double x = -size.height; x < size.width + size.height; x += spacing) {
      canvas.drawLine(
          Offset(x, 0), Offset(x + size.height, size.height), linePaint);
    }

    final blocks = [
      RRect.fromRectAndRadius(
          const Rect.fromLTWH(48, 76, 160, 92), const Radius.circular(28)),
      RRect.fromRectAndRadius(Rect.fromLTWH(size.width - 240, 110, 184, 108),
          const Radius.circular(30)),
      RRect.fromRectAndRadius(
          Rect.fromLTWH(size.width * 0.18, size.height - 160, 180, 84),
          const Radius.circular(28)),
    ];

    canvas.drawRRect(blocks[0], blockPaint);
    canvas.drawRRect(blocks[1], warmPaint);
    canvas.drawRRect(blocks[2], coolPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AnimatedReveal extends StatefulWidget {
  const AnimatedReveal({
    required this.child,
    this.delay = Duration.zero,
    this.distance = 16,
    super.key,
  });

  final Widget child;
  final Duration delay;
  final double distance;

  @override
  State<AnimatedReveal> createState() => _AnimatedRevealState();
}

class _AnimatedRevealState extends State<AnimatedReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 560),
  );
  late final Animation<double> animation =
      CurvedAnimation(parent: controller, curve: Curves.easeOutCubic);
  Timer? revealTimer;

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      controller.forward();
      return;
    }
    revealTimer = Timer(widget.delay, () {
      if (mounted) controller.forward();
    });
  }

  @override
  void dispose() {
    revealTimer?.cancel();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        return Opacity(
          opacity: animation.value,
          child: Transform.translate(
            offset: Offset(0, (1 - animation.value) * widget.distance),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}

class IllustratedPathCard extends StatelessWidget {
  const IllustratedPathCard({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      accent: AppTheme.blue,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('A path, not a pile of links',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  'Students follow a bright skill path, teachers steer classrooms, parents stay close, and admins shape the syllabus from one shared system.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(width: 18),
          const SizedBox(
            width: 130,
            child: _MiniPath(),
          ),
        ],
      ),
    );
  }
}

class _MiniPath extends StatelessWidget {
  const _MiniPath();

  @override
  Widget build(BuildContext context) {
    final nodes = [
      AppTheme.green,
      AppTheme.blue,
      AppTheme.orange,
      AppTheme.yellow
    ];
    return Column(
      children: [
        for (int i = 0; i < nodes.length; i++) ...[
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: nodes[i],
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(
                    color: AppTheme.shadow,
                    blurRadius: 12,
                    offset: Offset(0, 8))
              ],
            ),
            child: Icon(i.isEven ? Icons.star_rounded : Icons.check_rounded,
                color: Colors.white),
          ),
          if (i < nodes.length - 1)
            Container(
              width: 8,
              height: 26,
              decoration: BoxDecoration(
                color: AppTheme.deepBlue.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
        ],
      ],
    );
  }
}

class ResponsiveRoleStrip extends StatelessWidget {
  const ResponsiveRoleStrip({
    required this.onDemoRoleSelected,
    this.compact = false,
    super.key,
  });

  final ValueChanged<String> onDemoRoleSelected;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 330 ? 2 : 1;
          final spacing = 10.0;
          final tileWidth = columns == 1
              ? constraints.maxWidth
              : (constraints.maxWidth - spacing) / columns;
          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            children: [
              RoleTile(
                  role: 'student',
                  title: 'Student',
                  subtitle: 'Demo learner',
                  color: AppTheme.mint,
                  icon: Icons.school_rounded,
                  width: tileWidth,
                  dense: true,
                  onTap: onDemoRoleSelected),
              RoleTile(
                  role: 'teacher',
                  title: 'Teacher',
                  subtitle: 'Demo teacher',
                  color: AppTheme.skySurface,
                  icon: Icons.draw_rounded,
                  width: tileWidth,
                  dense: true,
                  onTap: onDemoRoleSelected),
              RoleTile(
                  role: 'parent',
                  title: 'Parent',
                  subtitle: 'Demo parent',
                  color: AppTheme.rose,
                  icon: Icons.family_restroom_rounded,
                  width: tileWidth,
                  dense: true,
                  onTap: onDemoRoleSelected),
              RoleTile(
                  role: 'admin',
                  title: 'Admin',
                  subtitle: 'Demo admin',
                  color: AppTheme.cream,
                  icon: Icons.admin_panel_settings_rounded,
                  width: tileWidth,
                  dense: true,
                  onTap: onDemoRoleSelected),
            ],
          );
        },
      );
    }

    return Wrap(
      spacing: 14,
      runSpacing: 14,
      children: [
        RoleTile(
            role: 'student',
            title: 'Student',
            subtitle: 'Use demo learner',
            color: AppTheme.mint,
            icon: Icons.school_rounded,
            onTap: onDemoRoleSelected),
        RoleTile(
            role: 'teacher',
            title: 'Teacher',
            subtitle: 'Use demo teacher',
            color: AppTheme.skySurface,
            icon: Icons.draw_rounded,
            onTap: onDemoRoleSelected),
        RoleTile(
            role: 'parent',
            title: 'Parent',
            subtitle: 'Use demo parent',
            color: AppTheme.rose,
            icon: Icons.family_restroom_rounded,
            onTap: onDemoRoleSelected),
        RoleTile(
            role: 'admin',
            title: 'Admin',
            subtitle: 'Use demo admin',
            color: AppTheme.cream,
            icon: Icons.admin_panel_settings_rounded,
            onTap: onDemoRoleSelected),
      ],
    );
  }
}

class RoleTile extends StatelessWidget {
  const RoleTile({
    required this.role,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.icon,
    required this.onTap,
    this.width = 220,
    this.dense = false,
    super.key,
  });

  final String role;
  final String title;
  final String subtitle;
  final Color color;
  final IconData icon;
  final ValueChanged<String> onTap;
  final double width;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: AppTestKeys.demoRole(role),
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => onTap(role),
        child: Container(
          width: width,
          padding: EdgeInsets.all(dense ? 10 : 14),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
                color: AppTheme.outlineStrong.withValues(alpha: 0.6)),
            boxShadow: const [
              BoxShadow(
                  color: AppTheme.shadow, blurRadius: 14, offset: Offset(0, 8))
            ],
          ),
          child: Row(
            children: [
              Container(
                width: dense ? 38 : 44,
                height: dense ? 38 : 44,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceSoft,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: AppTheme.outlineStrong.withValues(alpha: 0.72)),
                ),
                child: Icon(icon, color: AppTheme.deepBlue),
              ),
              SizedBox(width: dense ? 10 : 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    Text(subtitle,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              const Icon(Icons.login_rounded, color: AppTheme.deepBlue),
            ],
          ),
        ),
      ),
    );
  }
}

class DashboardHeader extends StatelessWidget {
  const DashboardHeader({
    required this.user,
    this.onLogout,
    this.showLogout = true,
    this.compact = false,
    super.key,
  });

  final AppUser user;
  final VoidCallback? onLogout;
  final bool showLogout;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return AnimatedReveal(
      distance: 12,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 14 : 22,
          vertical: compact ? 12 : 18,
        ),
        decoration: BoxDecoration(
          color: AppTheme.surface.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(compact ? 20 : 26),
          border: Border.all(
              color: AppTheme.outlineStrong.withValues(alpha: 0.82),
              width: 1.3),
          boxShadow: const [
            BoxShadow(
                color: AppTheme.shadow, blurRadius: 18, offset: Offset(0, 10))
          ],
        ),
        child: Wrap(
          spacing: 16,
          runSpacing: 16,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                MascotBadge(size: compact ? 40 : 52),
                SizedBox(width: compact ? 10 : 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Tusyen ${user.roleLabel}',
                        style: compact
                            ? Theme.of(context).textTheme.titleLarge
                            : Theme.of(context).textTheme.headlineMedium),
                    Text(user.fullName,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ],
            ),
            if (showLogout && onLogout != null)
              compact
                  ? IconButton.filled(
                      tooltip: 'Logout',
                      onPressed: onLogout,
                      icon: const Icon(Icons.logout_rounded),
                    )
                  : FilledButton.icon(
                      onPressed: onLogout,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Logout'),
                    ),
          ],
        ),
      ),
    );
  }
}

class RoleSidebar extends StatelessWidget {
  const RoleSidebar({
    required this.user,
    required this.items,
    required this.selected,
    required this.onSelect,
    required this.onLogout,
    super.key,
  });

  final AppUser user;
  final List<NavItem> items;
  final int selected;
  final ValueChanged<int> onSelect;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return AnimatedReveal(
      child: AppCard(
        accent: _roleAccent(user.role),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(user.roleLabel,
                style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(user.fullName, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 18),
            for (int index = 0; index < items.length; index++)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _SidebarItem(
                  item: items[index],
                  active: index == selected,
                  onTap: () => onSelect(index),
                ),
              ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: AppTestKeys.signOut,
                onPressed: onLogout,
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Sign out'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SidebarItem extends StatelessWidget {
  const _SidebarItem({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final NavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: AppTestKeys.nav(item.label),
      color: active ? AppTheme.surfaceElevated : AppTheme.surfaceRaised,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(item.icon, color: active ? AppTheme.green : AppTheme.muted),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  item.label,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: active ? AppTheme.deepBlue : AppTheme.ink,
                      ),
                ),
              ),
              if (active)
                const Icon(Icons.arrow_forward_rounded, color: AppTheme.green),
            ],
          ),
        ),
      ),
    );
  }
}

String _mobileNavLabel(String label) {
  switch (label) {
    case 'Classrooms':
      return 'Classes';
    case 'Whiteboard':
      return 'Board';
    default:
      return label;
  }
}

Color _roleAccent(String role) {
  switch (role) {
    case 'teacher':
      return AppTheme.blue;
    case 'parent':
      return AppTheme.orange;
    case 'admin':
      return AppTheme.coral;
    default:
      return AppTheme.green;
  }
}

bool _isCompactLayout(BuildContext context) =>
    MediaQuery.sizeOf(context).width < 640;

class RolePage extends StatelessWidget {
  const RolePage(
      {required this.label,
      required this.api,
      required this.session,
      super.key});

  final String label;
  final ApiService api;
  final LocalSession session;

  @override
  Widget build(BuildContext context) {
    if (label == 'Home') return HomePage(api: api, session: session);
    if (label == 'Profile')
      return TeacherProfilePage(api: api, session: session);
    if (label == 'Learn') return LearnPage(api: api, session: session);
    if (label == 'Classrooms' && session.user.role == 'admin') {
      return AdminClassroomsPage(api: api);
    }
    if (label == 'Classrooms')
      return ClassroomsPage(api: api, session: session);
    if (label == 'Progress') return ProgressPage(api: api, session: session);
    if (label == 'Quizzes') return QuizPage(api: api, session: session);
    if (label == 'Children') return ChildrenPage(api: api);
    if (label == 'Whiteboard')
      return WhiteboardPage(api: api, session: session);
    if (label == 'Posts') return PostsPage(api: api, session: session);
    if (label == 'Users') return UsersPage(api: api);
    if (label == 'Syllabus') return SyllabusPage(api: api);
    if (label == 'Lessons') return LessonsPage(api: api, session: session);
    return SystemPage(api: api);
  }
}

class HomePage extends StatelessWidget {
  const HomePage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  Widget build(BuildContext context) {
    final role = session.user.role;
    final compact = _isCompactLayout(context);
    return PageShell(
      title: 'Hi, ${session.user.fullName}',
      subtitle: role == 'teacher'
          ? 'Your classrooms, sessions, and posts in one place.'
          : role == 'parent'
              ? 'Keep a close eye on your linked learners.'
              : role == 'admin'
                  ? 'Platform health and content control at a glance.'
                  : 'Pick up where you left off.',
      children: [
        if (role == 'student') ...[
          FuturePanel(
            future: api.get('/learning/lessons'),
            builder: (data) {
              final lessons = _asMapList(data['lessons']);
              if (lessons.isEmpty) {
                return const EmptyState(
                    text:
                        'No assigned lessons yet. Ask a teacher to assign lessons to your classroom.');
              }
              return Column(
                children: [
                  for (final lesson in lessons.take(4))
                    DataTile(
                      title: _safeString(lesson['title'], fallback: 'Lesson'),
                      subtitle: _joinNonEmpty([
                        _safeString(lesson['subject']),
                        _formLabel(lesson['form_level']),
                      ]),
                      details: _joinNonEmpty([
                        _safeString(lesson['topic']),
                        _safeString(lesson['classroom_name']),
                      ]),
                      badge: _lessonBadge(lesson),
                      icon: Icons.play_lesson_rounded,
                      accent: _subjectColor(_safeString(lesson['subject'])),
                    ),
                ],
              );
            },
          ),
          SizedBox(height: compact ? 12 : 20),
          FuturePanel(
            future: api.get('/progress/student/${session.user.id}/stats'),
            builder: (data) => ProgressOverview(
              title: 'Your momentum',
              subtitle:
                  'Live stats from your completed and in-progress lessons.',
              data: data,
              accent: AppTheme.green,
              compact: compact,
            ),
          ),
        ] else if (role == 'teacher') ...[
          FuturePanel(
            future: api.get('/classroom'),
            builder: (data) {
              final classrooms = _asMapList(data['classrooms']);
              final totalStudents = classrooms.fold<int>(
                  0, (sum, item) => sum + _asInt(item['student_count']));
              return ResponsiveGrid(
                minWidth: 180,
                children: [
                  StatCard(
                      label: 'Classrooms',
                      value: '${classrooms.length}',
                      color: AppTheme.green,
                      icon: Icons.groups_rounded,
                      surface: AppTheme.mint),
                  StatCard(
                      label: 'Students',
                      value: '$totalStudents',
                      color: AppTheme.blue,
                      icon: Icons.people_alt_rounded,
                      surface: AppTheme.skySurface),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          FuturePanel(
            future: api.get('/quiz/decks'),
            builder: (data) {
              final decks = _asMapList(data['decks']);
              return AppCard(
                accent: AppTheme.yellow,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Quiz room tools',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(
                      '${decks.length} reusable deck${decks.length == 1 ? '' : 's'} ready to host.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    if (decks.isEmpty)
                      const EmptyState(
                          text:
                              'Create your first quiz deck in the Quizzes tab.')
                    else
                      for (final deck in decks.take(3))
                        DataTile(
                          title:
                              _safeString(deck['title'], fallback: 'Quiz deck'),
                          subtitle: _joinNonEmpty([
                            _safeString(deck['subject']),
                            _formLabel(deck['form_level']),
                          ]),
                          details:
                              '${_asInt(deck['question_count'])} questions ready',
                          badge: 'Host',
                          icon: Icons.quiz_rounded,
                          accent: _subjectColor(_safeString(deck['subject'])),
                        ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 20),
          FuturePanel(
            future: api.get('/classroom'),
            builder: (data) {
              final classrooms = _asMapList(data['classrooms']);
              if (classrooms.isEmpty) {
                return const EmptyState(
                    text:
                        'No classrooms yet. Create one and the rest of the teacher workflow will light up.');
              }
              return Column(
                children: [
                  for (final classroom in classrooms.take(4))
                    DataTile(
                      title:
                          _safeString(classroom['name'], fallback: 'Classroom'),
                      subtitle: _joinNonEmpty([
                        _safeString(classroom['subject']),
                        _formLabel(classroom['form_level']),
                      ]),
                      details:
                          'Join code ${_safeString(classroom['join_code'])}',
                      badge: '${_asInt(classroom['student_count'])} students',
                      icon: Icons.groups_rounded,
                      accent: _subjectColor(_safeString(classroom['subject'])),
                    ),
                ],
              );
            },
          ),
        ] else if (role == 'parent') ...[
          FuturePanel(
            future: api.get('/auth/linked-students'),
            builder: (data) {
              final students = _asMapList(data['students']);
              if (students.isEmpty) {
                return const EmptyState(
                    text:
                        'No linked children yet. Link a student account to unlock progress tracking.');
              }
              return Column(
                children: [
                  for (final student in students) ...[
                    DataTile(
                      title: _safeString(student['full_name'],
                          fallback: 'Student'),
                      subtitle: _safeString(student['email']),
                      details: 'Student ID ${_safeString(student['id'])}',
                      badge: 'Linked',
                      icon: Icons.family_restroom_rounded,
                      accent: AppTheme.orange,
                    ),
                    FuturePanel(
                      future:
                          api.get('/progress/student/${student['id']}/stats'),
                      builder: (stats) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProgressOverview(
                          title:
                              '${_safeString(student['full_name'], fallback: 'Student')} progress',
                          subtitle:
                              'Latest live stats for this linked learner.',
                          data: stats,
                          accent: AppTheme.orange,
                        ),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        ] else ...[
          FuturePanel(
            future: api.get('/admin/stats'),
            builder: (data) {
              final stats = _asMap(data['stats']);
              return ResponsiveGrid(
                minWidth: 180,
                children: [
                  StatCard(
                      label: 'Students',
                      value: '${_asInt(stats['total_students'])}',
                      color: AppTheme.green,
                      icon: Icons.school_rounded,
                      surface: AppTheme.mint),
                  StatCard(
                      label: 'Teachers',
                      value: '${_asInt(stats['total_teachers'])}',
                      color: AppTheme.blue,
                      icon: Icons.groups_rounded,
                      surface: AppTheme.skySurface),
                  StatCard(
                      label: 'Classes',
                      value: '${_asInt(stats['active_classrooms'])}',
                      color: AppTheme.orange,
                      icon: Icons.meeting_room_rounded,
                      surface: AppTheme.peach),
                  StatCard(
                      label: 'Today',
                      value: '${_asInt(stats['activities_today'])}',
                      color: AppTheme.coral,
                      icon: Icons.bolt_rounded,
                      surface: AppTheme.rose),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          FuturePanel(
            future: api.get('/admin/syllabus'),
            builder: (data) {
              final items = _asMapList(data['syllabus']);
              if (items.isEmpty) {
                return const EmptyState(
                    text:
                        'No syllabus items yet. Add curriculum content to populate the platform.');
              }
              return Column(
                children: [
                  for (final item in items.take(4))
                    DataTile(
                      title: _safeString(item['topic'], fallback: 'Topic'),
                      subtitle: _joinNonEmpty([
                        _safeString(item['subject']),
                        _formLabel(item['form_level']),
                      ]),
                      details: _safeString(item['subtopic']),
                      badge: 'Curriculum',
                      icon: Icons.menu_book_rounded,
                      accent: _subjectColor(_safeString(item['subject'])),
                    ),
                ],
              );
            },
          ),
        ],
      ],
    );
  }
}

class LearnPage extends StatefulWidget {
  const LearnPage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  State<LearnPage> createState() => _LearnPageState();
}

class _LearnPageState extends State<LearnPage> {
  late Future<Map<String, dynamic>> learningFuture = _loadLearningPath();
  String? selectedSubject;
  String? selectedTopicKey;

  Future<Map<String, dynamic>> _loadLearningPath() async {
    final responses = await Future.wait([
      widget.api.get('/learning/lessons'),
      widget.api.get('/learning/syllabus'),
    ]);
    return {
      'lessons': _asMapList(responses[0]['lessons']),
      'syllabus': _asMapList(responses[1]['syllabus']),
    };
  }

  void _refresh() {
    setState(() {
      learningFuture = _loadLearningPath();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Choose a subject',
      subtitle:
          'Pick a subject, choose a topic, then follow the content and exercises in order.',
      children: [
        FuturePanel(
          future: learningFuture,
          builder: (data) {
            final lessons = _asMapList(data['lessons']);
            final items = _asMapList(data['syllabus']);
            final subjects = _buildLearningSubjects(items, lessons);
            if (subjects.isEmpty) {
              return const EmptyState(
                  text:
                      'No learning content yet. Add syllabus and lessons from the admin area first.');
            }

            final activeSubject =
                subjects.any((item) => item.name == selectedSubject)
                    ? selectedSubject!
                    : subjects.first.name;
            final topics = _buildLearningTopics(activeSubject, items, lessons);
            final fallbackTopicKey = topics.isEmpty ? '' : topics.first.key;
            final activeTopicKey =
                topics.any((item) => item.key == selectedTopicKey)
                    ? selectedTopicKey!
                    : fallbackTopicKey;
            _LearningTopicSummary? activeTopic;
            for (final topic in topics) {
              if (topic.key == activeTopicKey) {
                activeTopic = topic;
                break;
              }
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SubjectChoiceGrid(
                  subjects: subjects,
                  selectedSubject: activeSubject,
                  onSelected: (subject) => setState(() {
                    selectedSubject = subject;
                    selectedTopicKey = null;
                  }),
                ),
                const SizedBox(height: 20),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final wide = constraints.maxWidth >= 860;
                    final path = _TopicPath(
                      topics: topics,
                      selectedKey: activeTopicKey,
                      onSelected: (key) =>
                          setState(() => selectedTopicKey = key),
                    );
                    final content = _TopicContentPanel(
                      topic: activeTopic,
                      api: widget.api,
                      session: widget.session,
                      onCompleted: _refresh,
                    );

                    if (!wide) {
                      return Column(
                        children: [
                          path,
                          const SizedBox(height: 16),
                          content,
                        ],
                      );
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 340, child: path),
                        const SizedBox(width: 18),
                        Expanded(child: content),
                      ],
                    );
                  },
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _LearningSubjectSummary {
  _LearningSubjectSummary({
    required this.name,
    required this.color,
    required this.icon,
    required this.formLabels,
    required this.topicCount,
    required this.lessonCount,
    required this.averageProgress,
  });

  final String name;
  final Color color;
  final IconData icon;
  final List<String> formLabels;
  final int topicCount;
  final int lessonCount;
  final int averageProgress;
}

class _LearningTopicSummary {
  _LearningTopicSummary({
    required this.subject,
    required this.topic,
    required this.color,
  });

  final String subject;
  final String topic;
  final Color color;
  final List<Map<String, dynamic>> syllabusItems = [];
  final List<Map<String, dynamic>> lessons = [];

  String get key => '$subject::$topic';

  int get averageProgress {
    if (lessons.isEmpty) return 0;
    final total = lessons.fold<int>(
        0, (sum, lesson) => sum + _asInt(lesson['completion_percentage']));
    return (total / lessons.length).round();
  }

  int get completedCount {
    return lessons
        .where((lesson) =>
            lesson['is_completed'] == true ||
            _asInt(lesson['completion_percentage']) >= 100)
        .length;
  }

  String get summary {
    for (final item in syllabusItems) {
      final summary = _contentSummary(item);
      if (summary.isNotEmpty) return summary;
    }
    for (final lesson in lessons) {
      final summary = _contentSummary(lesson);
      if (summary.isNotEmpty) return summary;
    }
    return 'Content for this topic is ready.';
  }

  List<String> get subtopics {
    final values = <String>{};
    for (final item in syllabusItems) {
      final subtopic = _safeString(item['subtopic']);
      if (subtopic.isNotEmpty) values.add(subtopic);
    }
    for (final lesson in lessons) {
      final subtopic = _safeString(lesson['subtopic']);
      if (subtopic.isNotEmpty) values.add(subtopic);
    }
    return values.toList();
  }

  List<String> get formLabels {
    final values = <String>{};
    for (final item in [...syllabusItems, ...lessons]) {
      final label = _formLabel(item['form_level']);
      if (label.isNotEmpty) values.add(label);
    }
    return values.toList();
  }
}

List<_LearningSubjectSummary> _buildLearningSubjects(
  List<Map<String, dynamic>> syllabus,
  List<Map<String, dynamic>> lessons,
) {
  final names = <String>{};
  for (final item in syllabus) {
    final subject = _safeString(item['subject']);
    if (subject.isNotEmpty) names.add(subject);
  }
  for (final lesson in lessons) {
    final subject = _safeString(lesson['subject']);
    if (subject.isNotEmpty) names.add(subject);
  }

  final subjects = <_LearningSubjectSummary>[];
  for (final name in names) {
    final subjectSyllabus =
        syllabus.where((item) => _safeString(item['subject']) == name).toList();
    final subjectLessons = lessons
        .where((lesson) => _safeString(lesson['subject']) == name)
        .toList();
    final topicNames = <String>{};
    final formLabels = <String>{};

    for (final item in subjectSyllabus) {
      topicNames.add(_learningTopicName(item));
      final form = _formLabel(item['form_level']);
      if (form.isNotEmpty) formLabels.add(form);
    }
    for (final lesson in subjectLessons) {
      topicNames.add(_learningTopicName(lesson));
      final form = _formLabel(lesson['form_level']);
      if (form.isNotEmpty) formLabels.add(form);
    }

    final averageProgress = subjectLessons.isEmpty
        ? 0
        : (subjectLessons.fold<int>(
                    0,
                    (sum, lesson) =>
                        sum + _asInt(lesson['completion_percentage'])) /
                subjectLessons.length)
            .round();

    subjects.add(_LearningSubjectSummary(
      name: name,
      color: _subjectColor(name),
      icon: _subjectIcon(name),
      formLabels: formLabels.toList(),
      topicCount: topicNames.length,
      lessonCount: subjectLessons.length,
      averageProgress: averageProgress,
    ));
  }

  subjects.sort((a, b) => a.name.compareTo(b.name));
  return subjects;
}

List<_LearningTopicSummary> _buildLearningTopics(
  String subject,
  List<Map<String, dynamic>> syllabus,
  List<Map<String, dynamic>> lessons,
) {
  final byTopic = <String, _LearningTopicSummary>{};

  _LearningTopicSummary ensureTopic(Map<String, dynamic> item) {
    final topic = _learningTopicName(item);
    return byTopic.putIfAbsent(
      topic,
      () => _LearningTopicSummary(
        subject: subject,
        topic: topic,
        color: _subjectColor(subject),
      ),
    );
  }

  final subjectSyllabus = syllabus
      .where((item) => _safeString(item['subject']) == subject)
      .toList()
    ..sort(
        (a, b) => _asInt(a['order_index']).compareTo(_asInt(b['order_index'])));
  for (final item in subjectSyllabus) {
    ensureTopic(item).syllabusItems.add(item);
  }

  final subjectLessons = lessons
      .where((lesson) => _safeString(lesson['subject']) == subject)
      .toList();
  for (final lesson in subjectLessons) {
    ensureTopic(lesson).lessons.add(lesson);
  }

  return byTopic.values.toList();
}

String _learningTopicName(Map<String, dynamic> item) {
  final topic = _safeString(item['topic']);
  if (topic.isNotEmpty) return topic;
  final title = _safeString(item['title']);
  if (title.isNotEmpty) return 'Practice';
  return 'Topic';
}

String _contentSummary(Map<String, dynamic> item) {
  final content = _asMap(item['content']);
  final summary = _safeString(content['summary']);
  if (summary.isNotEmpty) return summary;
  return _safeString(item['summary']);
}

IconData _subjectIcon(String subject) {
  switch (subject.toLowerCase()) {
    case 'mathematics':
      return Icons.calculate_rounded;
    case 'science':
      return Icons.science_rounded;
    case 'english':
      return Icons.edit_note_rounded;
    case 'sejarah':
      return Icons.account_balance_rounded;
    default:
      return Icons.school_rounded;
  }
}

class _SubjectChoiceGrid extends StatelessWidget {
  const _SubjectChoiceGrid({
    required this.subjects,
    required this.selectedSubject,
    required this.onSelected,
  });

  final List<_LearningSubjectSummary> subjects;
  final String selectedSubject;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final count = (constraints.maxWidth / 230).floor().clamp(1, 4);
        const spacing = 14.0;
        final totalSpacing = spacing * (count - 1);
        final width = count == 1
            ? constraints.maxWidth
            : (constraints.maxWidth - totalSpacing) / count;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final subject in subjects)
              SizedBox(
                width: width,
                child: _SubjectChoiceCard(
                  subject: subject,
                  selected: subject.name == selectedSubject,
                  onTap: () => onSelected(subject.name),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SubjectChoiceCard extends StatelessWidget {
  const _SubjectChoiceCard({
    required this.subject,
    required this.selected,
    required this.onTap,
  });

  final _LearningSubjectSummary subject;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? subject.color.withValues(alpha: 0.2)
          : AppTheme.surfaceRaised,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: selected
                  ? subject.color
                  : AppTheme.outlineStrong.withValues(alpha: 0.78),
              width: selected ? 2 : 1.2,
            ),
            boxShadow: const [
              BoxShadow(
                  color: AppTheme.shadow, blurRadius: 18, offset: Offset(0, 9))
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceSoft,
                      borderRadius: BorderRadius.circular(17),
                      border: Border.all(
                          color: subject.color.withValues(alpha: 0.45)),
                    ),
                    child: Icon(subject.icon, color: subject.color, size: 28),
                  ),
                  const Spacer(),
                  StatusPill(
                      label: subject.formLabels.isEmpty
                          ? 'KSSM'
                          : subject.formLabels.join(', '),
                      color: subject.color),
                ],
              ),
              const SizedBox(height: 18),
              Text(subject.name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                '${subject.topicCount} topics | ${subject.lessonCount} exercises',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              LinearProgressIndicator(
                value: subject.averageProgress <= 0
                    ? 0
                    : math.min(1, subject.averageProgress / 100),
                minHeight: 8,
                borderRadius: BorderRadius.circular(999),
                color: subject.color,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopicPath extends StatelessWidget {
  const _TopicPath({
    required this.topics,
    required this.selectedKey,
    required this.onSelected,
  });

  final List<_LearningTopicSummary> topics;
  final String selectedKey;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final compact = _isCompactLayout(context);
    return AppCard(
      accent: topics.isEmpty ? AppTheme.green : topics.first.color,
      padding: EdgeInsets.all(compact ? 14 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Topics', style: Theme.of(context).textTheme.titleLarge),
          SizedBox(height: compact ? 10 : 14),
          if (topics.isEmpty)
            const EmptyState(text: 'No topics for this subject yet.')
          else
            for (int index = 0; index < topics.length; index++)
              _TopicPathNode(
                topic: topics[index],
                index: index,
                selected: topics[index].key == selectedKey,
                isLast: index == topics.length - 1,
                onTap: () => onSelected(topics[index].key),
              ),
        ],
      ),
    );
  }
}

class _TopicPathNode extends StatelessWidget {
  const _TopicPathNode({
    required this.topic,
    required this.index,
    required this.selected,
    required this.isLast,
    required this.onTap,
  });

  final _LearningTopicSummary topic;
  final int index;
  final bool selected;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final compact = _isCompactLayout(context);
    final completed = topic.lessons.isNotEmpty &&
        topic.completedCount == topic.lessons.length;
    final available = topic.lessons.isNotEmpty;
    final icon = completed
        ? Icons.check_rounded
        : available
            ? Icons.play_arrow_rounded
            : Icons.menu_book_rounded;
    final nodeColor = completed ? AppTheme.green : topic.color;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: compact ? 50 : 62,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: compact ? (selected ? 48 : 42) : (selected ? 58 : 50),
                height: compact ? (selected ? 48 : 42) : (selected ? 58 : 50),
                decoration: BoxDecoration(
                  color: nodeColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.surfaceSoft, width: 4),
                  boxShadow: [
                    BoxShadow(
                        color: nodeColor.withValues(alpha: 0.34),
                        blurRadius: 18,
                        offset: const Offset(0, 8))
                  ],
                ),
                child: Icon(
                  icon,
                  color: Colors.white,
                  size: compact ? (selected ? 25 : 22) : (selected ? 30 : 26),
                ),
              ),
              if (!isLast)
                Container(
                  width: 8,
                  height: compact ? 24 : 34,
                  decoration: BoxDecoration(
                    color: AppTheme.outlineStrong.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(
                top: compact ? 0 : (index.isEven ? 2 : 10),
                bottom: isLast ? 0 : (compact ? 8 : 12)),
            child: Material(
              color:
                  selected ? AppTheme.surfaceElevated : AppTheme.surfaceRaised,
              borderRadius: BorderRadius.circular(18),
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: onTap,
                child: Container(
                  padding: EdgeInsets.all(compact ? 12 : 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                        color: selected
                            ? topic.color
                            : AppTheme.outlineStrong.withValues(alpha: 0.72),
                        width: selected ? 1.7 : 1.1),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(topic.topic,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(
                        topic.lessons.isEmpty
                            ? '${topic.syllabusItems.length} content notes'
                            : '${topic.completedCount}/${topic.lessons.length} exercises',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TopicContentPanel extends StatelessWidget {
  const _TopicContentPanel({
    required this.topic,
    required this.api,
    required this.session,
    required this.onCompleted,
  });

  final _LearningTopicSummary? topic;
  final ApiService api;
  final LocalSession session;
  final VoidCallback onCompleted;

  @override
  Widget build(BuildContext context) {
    final current = topic;
    final compact = _isCompactLayout(context);
    if (current == null) {
      return const EmptyState(text: 'Choose a topic to begin.');
    }

    return AppCard(
      accent: current.color,
      padding: EdgeInsets.all(compact ? 14 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(current.topic,
                        style: compact
                            ? Theme.of(context).textTheme.titleLarge
                            : Theme.of(context).textTheme.headlineMedium),
                    SizedBox(height: compact ? 4 : 6),
                    Text(current.summary,
                        style: compact
                            ? Theme.of(context).textTheme.bodyMedium
                            : Theme.of(context).textTheme.bodyLarge),
                  ],
                ),
              ),
              SizedBox(width: compact ? 8 : 12),
              StatusPill(
                  label: '${current.averageProgress}%', color: current.color),
            ],
          ),
          SizedBox(height: compact ? 10 : 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final label in current.formLabels) FeatureChip(label: label),
              for (final subtopic in current.subtopics.take(4))
                FeatureChip(label: subtopic),
              if (current.lessons.isNotEmpty)
                FeatureChip(label: '${current.lessons.length} exercises'),
            ],
          ),
          SizedBox(height: compact ? 12 : 18),
          LinearProgressIndicator(
            value: current.averageProgress <= 0
                ? 0
                : math.min(1, current.averageProgress / 100),
            minHeight: compact ? 8 : 10,
            borderRadius: BorderRadius.circular(999),
            color: current.color,
          ),
          SizedBox(height: compact ? 14 : 22),
          Text('Content', style: Theme.of(context).textTheme.titleLarge),
          SizedBox(height: compact ? 8 : 10),
          if (current.syllabusItems.isEmpty)
            const EmptyState(text: 'No syllabus notes for this topic yet.')
          else
            for (final item in current.syllabusItems)
              _SyllabusContentTile(item: item, color: current.color),
          SizedBox(height: compact ? 8 : 12),
          Text('Exercises', style: Theme.of(context).textTheme.titleLarge),
          SizedBox(height: compact ? 8 : 10),
          if (current.lessons.isEmpty)
            const EmptyState(text: 'No exercises assigned yet.')
          else
            for (int index = 0; index < current.lessons.length; index++)
              _LessonStepTile(
                lesson: current.lessons[index],
                number: index + 1,
                api: api,
                session: session,
                onCompleted: onCompleted,
              ),
        ],
      ),
    );
  }
}

class _SyllabusContentTile extends StatelessWidget {
  const _SyllabusContentTile({required this.item, required this.color});

  final Map<String, dynamic> item;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final subtopic = _safeString(item['subtopic'], fallback: 'Content note');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: AppTheme.outlineStrong.withValues(alpha: 0.74)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.16),
              child: Icon(Icons.auto_stories_rounded, color: color)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subtopic, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(_contentSummary(item),
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LessonStepTile extends StatelessWidget {
  const _LessonStepTile({
    required this.lesson,
    required this.number,
    required this.api,
    required this.session,
    required this.onCompleted,
  });

  final Map<String, dynamic> lesson;
  final int number;
  final ApiService api;
  final LocalSession session;
  final VoidCallback onCompleted;

  @override
  Widget build(BuildContext context) {
    final color = _subjectColor(_safeString(lesson['subject']));
    final completion = _asInt(lesson['completion_percentage']);
    final completed = lesson['is_completed'] == true || completion >= 100;
    final readOnly = session.user.role != 'student';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
            color: completed
                ? AppTheme.green.withValues(alpha: 0.65)
                : AppTheme.outlineStrong.withValues(alpha: 0.74)),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: completed ? AppTheme.green : color,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: color.withValues(alpha: 0.24),
                        blurRadius: 14,
                        offset: const Offset(0, 7))
                  ],
                ),
                child: Center(
                  child: completed
                      ? const Icon(Icons.check_rounded, color: Colors.white)
                      : Text('$number',
                          style: GoogleFonts.nunito(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 18)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_safeString(lesson['title'], fallback: 'Lesson'),
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(_contentSummary(lesson),
                        style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        StatusPill(
                            label: '$completion% complete', color: color),
                        if (_asInt(lesson['score']) > 0)
                          StatusPill(
                              label: 'Score ${_asInt(lesson['score'])}',
                              color: AppTheme.blue),
                        if (_safeString(lesson['difficulty']).isNotEmpty)
                          StatusPill(
                              label: _safeString(lesson['difficulty']),
                              color: AppTheme.orange),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: completion <= 0 ? 0 : math.min(1, completion / 100),
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(999),
                  color: completed ? AppTheme.green : color,
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: () => _openLesson(context),
                icon: Icon(readOnly
                    ? Icons.visibility_rounded
                    : completed
                        ? Icons.refresh_rounded
                        : Icons.play_arrow_rounded),
                label: Text(readOnly
                    ? 'View'
                    : completed
                        ? 'Review'
                        : 'Start'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openLesson(BuildContext context) async {
    final refreshed = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog.fullscreen(
        child: AppLessonExperienceDialog(
          api: api,
          lessonId: _safeString(lesson['id']),
          classroomId: _safeString(lesson['classroom_id']),
          readOnly: session.user.role != 'student',
        ),
      ),
    );

    if (refreshed == true) {
      onCompleted();
    }
  }
}

class ClassroomsPage extends StatefulWidget {
  const ClassroomsPage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  State<ClassroomsPage> createState() => _ClassroomsPageState();
}

class _ClassroomsPageState extends State<ClassroomsPage> {
  late Future<Map<String, dynamic>> future = widget.api.get('/classroom');

  void _refresh() {
    setState(() {
      future = widget.api.get('/classroom');
    });
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.user.role;
    final isTeacher = role == 'teacher' || role == 'admin';
    final isStudent = role == 'student';
    final isParent = role == 'parent';
    return PageShell(
      title: 'Classrooms',
      subtitle: isTeacher
          ? 'Create and manage your classes.'
          : isParent
              ? 'View the classrooms connected to your linked children.'
              : 'Join classes and follow teacher content.',
      trailing: isTeacher
          ? FilledButton.icon(
              key: AppTestKeys.classroomsCreate,
              onPressed: () => _showCreateClassroom(context),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Create class'),
            )
          : isStudent
              ? FilledButton.icon(
                  onPressed: () => _showJoinClassroom(context),
                  icon: const Icon(Icons.login_rounded),
                  label: const Text('Join class'),
                )
              : null,
      children: [
        FuturePanel(
          future: future,
          builder: (data) {
            final classrooms = _asMapList(data['classrooms']);
            if (classrooms.isEmpty)
              return const EmptyState(text: 'No classrooms yet.');
            return Column(
              children: [
                for (final item in classrooms)
                  ClassroomCard(
                    api: widget.api,
                    session: widget.session,
                    classroom: item,
                    isTeacher: isTeacher,
                    onChanged: _refresh,
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _showCreateClassroom(BuildContext context) async {
    final name = TextEditingController();
    final subject = TextEditingController(text: 'Mathematics');
    int formLevel = 4;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Create classroom'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  key: AppTestKeys.teacherClassNameField,
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Name')),
              const SizedBox(height: 12),
              TextField(
                  key: AppTestKeys.teacherClassSubjectField,
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
                    setDialogState(() => formLevel = value ?? 4),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              key: AppTestKeys.teacherClassSubmit,
              onPressed: () async {
                await widget.api.post('/classroom', {
                  'name': name.text,
                  'subject': subject.text,
                  'formLevel': formLevel,
                  'isPublic': false,
                });
                if (mounted) {
                  _refresh();
                  Navigator.pop(context);
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showJoinClassroom(BuildContext context) async {
    final id = TextEditingController();
    final code = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Join classroom'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: id,
                decoration: const InputDecoration(labelText: 'Classroom ID')),
            const SizedBox(height: 12),
            TextField(
                controller: code,
                decoration: const InputDecoration(labelText: 'Join code')),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await widget.api
                  .post('/classroom/${id.text}/join', {'joinCode': code.text});
              if (mounted) {
                _refresh();
                Navigator.pop(context);
              }
            },
            child: const Text('Join'),
          ),
        ],
      ),
    );
  }
}

class ClassroomCard extends StatefulWidget {
  const ClassroomCard({
    required this.api,
    required this.session,
    required this.classroom,
    required this.isTeacher,
    required this.onChanged,
    super.key,
  });

  final ApiService api;
  final LocalSession session;
  final Map<String, dynamic> classroom;
  final bool isTeacher;
  final VoidCallback onChanged;

  @override
  State<ClassroomCard> createState() => _ClassroomCardState();
}

class _ClassroomCardState extends State<ClassroomCard> {
  late Future<Map<String, dynamic>> postsFuture;

  String get classroomId => _safeString(widget.classroom['id']);

  @override
  void initState() {
    super.initState();
    postsFuture = _loadPosts();
  }

  @override
  void didUpdateWidget(covariant ClassroomCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_safeString(oldWidget.classroom['id']) != classroomId) {
      postsFuture = _loadPosts();
    }
  }

  Future<Map<String, dynamic>> _loadPosts({int limit = 2}) {
    return widget.api.get(
        '/feed/posts?classroomId=${Uri.encodeComponent(classroomId)}&limit=$limit');
  }

  @override
  Widget build(BuildContext context) {
    final subject = _safeString(widget.classroom['subject']);
    final accent = _subjectColor(subject);
    final teacherId = _safeString(widget.classroom['teacher_id']);
    final teacherName = _safeString(widget.classroom['teacher_name'],
        fallback: 'Teacher profile');
    final canLeave = widget.session.user.role == 'student';

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: AppCard(
        accent: accent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 14,
              runSpacing: 12,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 54,
                        height: 54,
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceElevated,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Icon(Icons.groups_rounded, color: accent),
                      ),
                      const SizedBox(width: 14),
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _safeString(widget.classroom['name'],
                                  fallback: 'Classroom'),
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            Text(
                              _joinNonEmpty([
                                subject,
                                _formLabel(widget.classroom['form_level'] ??
                                    widget.classroom['formLevel']),
                                widget.isTeacher
                                    ? '${_asInt(widget.classroom['student_count'])} students'
                                    : 'Teacher $teacherName',
                              ]),
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatusPill(
                      label: widget.isTeacher
                          ? _safeString(
                              widget.classroom['join_code'] ??
                                  widget.classroom['joinCode'],
                              fallback: 'Class')
                          : 'Enrolled',
                      color: accent,
                    ),
                    if (_safeString(widget.classroom['student_name'])
                        .isNotEmpty)
                      StatusPill(
                          label: _safeString(widget.classroom['student_name']),
                          color: AppTheme.orange),
                  ],
                ),
              ],
            ),
            if (_safeString(widget.classroom['description']).isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(_safeString(widget.classroom['description']),
                  style: Theme.of(context).textTheme.bodyLarge),
            ],
            const SizedBox(height: 16),
            Text('Latest classroom posts',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            FutureBuilder<Map<String, dynamic>>(
              future: postsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const LinearProgressIndicator(minHeight: 6);
                }
                if (snapshot.hasError) {
                  return Text(_friendlyError(snapshot.error),
                      style: const TextStyle(
                          color: AppTheme.red, fontWeight: FontWeight.w800));
                }

                final posts = _asMapList(snapshot.data?['posts']);
                if (posts.isEmpty) {
                  return Text('No posts in this classroom yet.',
                      style: Theme.of(context).textTheme.bodyMedium);
                }

                return Column(
                  children: [
                    for (final post in posts)
                      _ClassroomPostPreview(post: post, accent: accent),
                  ],
                );
              },
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _showClassroomPosts(context),
                  icon: const Icon(Icons.forum_rounded),
                  label: const Text('Open posts'),
                ),
                if (teacherId.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () => TeacherProfileDialog.show(
                      context,
                      api: widget.api,
                      teacherId: teacherId,
                    ),
                    icon: const Icon(Icons.person_rounded),
                    label: const Text('Teacher'),
                  ),
                if (canLeave)
                  OutlinedButton.icon(
                    onPressed: () => _confirmLeave(context),
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Leave class'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showClassroomPosts(BuildContext context) async {
    Future<Map<String, dynamic>> future = _loadPosts(limit: 30);
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => Dialog(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 780),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _safeString(widget.classroom['name'],
                                fallback: 'Classroom posts'),
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    FuturePanel(
                      future: future,
                      builder: (data) {
                        final posts = _asMapList(data['posts']);
                        if (posts.isEmpty) {
                          return const EmptyState(
                              text: 'No posts in this classroom yet.');
                        }
                        return Column(
                          children: [
                            for (final post in posts)
                              FeedPostCard(
                                api: widget.api,
                                session: widget.session,
                                post: post,
                                editable: false,
                                onEdit: null,
                                onDelete: null,
                                onChanged: () {
                                  setDialogState(
                                      () => future = _loadPosts(limit: 30));
                                  setState(() {
                                    postsFuture = _loadPosts();
                                  });
                                },
                              ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmLeave(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave classroom?'),
        content: Text(
          'You will stop seeing posts and assigned lessons from ${_safeString(widget.classroom['name'], fallback: 'this classroom')}.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await widget.api.post('/classroom/$classroomId/leave', {});
      widget.onChanged();
    } on DioException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    }
  }
}

class _ClassroomPostPreview extends StatelessWidget {
  const _ClassroomPostPreview({required this.post, required this.accent});

  final Map<String, dynamic> post;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: AppTheme.outlineStrong.withValues(alpha: 0.72)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.campaign_rounded, color: accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_safeString(post['title'], fallback: 'Classroom update'),
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(_safeString(post['content']),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 6),
                Text(
                  _joinNonEmpty([
                    '${_asInt(post['like_count'])} likes',
                    '${_asInt(post['comment_count'])} comments',
                  ]),
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppTheme.ink.withValues(alpha: 0.72)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ProgressPage extends StatelessWidget {
  const ProgressPage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  Widget build(BuildContext context) {
    final isParent = session.user.role == 'parent';
    return PageShell(
      title: 'Progress',
      subtitle: 'XP, streaks, completed lessons, and subject mastery.',
      children: [
        if (isParent)
          FuturePanel(
            future: api.get('/auth/linked-students'),
            builder: (data) {
              final students = _asMapList(data['students']);
              if (students.isEmpty) {
                return const EmptyState(
                    text: 'Link a child account first to see progress here.');
              }
              return Column(
                children: [
                  for (final student in students)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(
                        children: [
                          FuturePanel(
                            future: api.get(
                                '/progress/student/${student['id']}/stats'),
                            builder: (stats) => ProgressOverview(
                              title: _safeString(student['full_name'],
                                  fallback: 'Student'),
                              subtitle: _safeString(student['email']),
                              data: stats,
                              accent: AppTheme.orange,
                            ),
                          ),
                          const SizedBox(height: 12),
                          FuturePanel(
                            future:
                                api.get('/progress/student/${student['id']}'),
                            builder: (data) {
                              final progress = _asMapList(data['progress']);
                              if (progress.isEmpty) {
                                return const EmptyState(
                                    text:
                                        'No lesson activity recorded for this child yet.');
                              }
                              return AppCard(
                                accent: AppTheme.orange,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Recent lesson activity',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleLarge),
                                    const SizedBox(height: 12),
                                    for (final item in progress.take(6))
                                      DataTile(
                                        title: _safeString(item['lesson_title'],
                                            fallback: 'Lesson'),
                                        subtitle: _joinNonEmpty([
                                          _safeString(item['subject']),
                                          _safeString(item['classroom_name']),
                                        ]),
                                        details: _joinNonEmpty([
                                          _safeString(item['topic']),
                                          'Score ${_formatNumber(item['score'])}',
                                        ]),
                                        badge:
                                            '${_asInt(item['completion_percentage'])}%',
                                        icon: Icons.insights_rounded,
                                        accent: _subjectColor(
                                            _safeString(item['subject'])),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
          )
        else ...[
          FuturePanel(
            future: api.get('/progress/student/${session.user.id}/stats'),
            builder: (data) => ProgressOverview(
              title: 'Performance snapshot',
              subtitle: 'Your live learning stats from the backend.',
              data: data,
              accent: AppTheme.green,
            ),
          ),
          const SizedBox(height: 18),
          FuturePanel(
            future: api.get('/progress/student/${session.user.id}'),
            builder: (data) {
              final progress = _asMapList(data['progress']);
              if (progress.isEmpty) {
                return const EmptyState(
                    text: 'No lesson progress recorded yet.');
              }
              return Column(
                children: [
                  for (final item in progress)
                    DataTile(
                      title:
                          _safeString(item['lesson_title'], fallback: 'Lesson'),
                      subtitle: _joinNonEmpty([
                        _safeString(item['subject']),
                        _safeString(item['classroom_name']),
                      ]),
                      details: _joinNonEmpty([
                        _safeString(item['topic']),
                        'Score ${_formatNumber(item['score'])}',
                      ]),
                      badge: '${_asInt(item['completion_percentage'])}%',
                      icon: Icons.insights_rounded,
                      accent: _subjectColor(_safeString(item['subject'])),
                    ),
                ],
              );
            },
          ),
        ],
      ],
    );
  }
}

class ChildrenPage extends StatefulWidget {
  const ChildrenPage({required this.api, super.key});

  final ApiService api;

  @override
  State<ChildrenPage> createState() => _ChildrenPageState();
}

class _ChildrenPageState extends State<ChildrenPage> {
  late Future<Map<String, dynamic>> future =
      widget.api.get('/auth/linked-students');

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Children',
      subtitle: 'Link a student account and monitor growth.',
      trailing: FilledButton.icon(
        onPressed: () => _showLinkDialog(context),
        icon: const Icon(Icons.link_rounded),
        label: const Text('Link child'),
      ),
      children: [
        FuturePanel(
          future: future,
          builder: (data) {
            final students = _asMapList(data['students']);
            if (students.isEmpty)
              return const EmptyState(text: 'No linked children yet.');
            return Column(
              children: [
                for (final student in students)
                  DataTile(
                    title:
                        _safeString(student['full_name'], fallback: 'Student'),
                    subtitle: _safeString(student['email']),
                    details: 'Student ID ${_safeString(student['id'])}',
                    badge: 'Linked',
                    icon: Icons.family_restroom_rounded,
                    accent: AppTheme.orange,
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _showLinkDialog(BuildContext context) async {
    final id = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Link student'),
        content: TextField(
            controller: id,
            decoration: const InputDecoration(labelText: 'Student UUID')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                await widget.api
                    .post('/auth/link-parent', {'studentId': id.text.trim()});
                if (mounted) {
                  setState(
                      () => future = widget.api.get('/auth/linked-students'));
                }
                if (context.mounted) Navigator.pop(context);
              } on DioException catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(_errorMessage(error))),
                  );
                }
              } catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$error')),
                  );
                }
              }
            },
            child: const Text('Link'),
          ),
        ],
      ),
    );
  }
}

class WhiteboardPage extends StatefulWidget {
  const WhiteboardPage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  State<WhiteboardPage> createState() => _WhiteboardPageState();
}

class _WhiteboardPageState extends State<WhiteboardPage> {
  int refreshTick = 0;
  bool get canManage =>
      widget.session.user.role == 'teacher' ||
      widget.session.user.role == 'admin';

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Whiteboard',
      subtitle:
          'Run classroom whiteboard sessions, attach recordings, and replay saved sessions.',
      trailing: canManage
          ? FilledButton.icon(
              onPressed: () => _showStartSessionDialog(context),
              icon: const Icon(Icons.draw_rounded),
              label: const Text('Start session'),
            )
          : null,
      children: [
        FuturePanel(
          future: widget.api.get('/classroom'),
          builder: (data) {
            final classrooms = _asMapList(data['classrooms']);
            if (classrooms.isEmpty) {
              return const EmptyState(
                  text:
                      'No classrooms yet. Create a class before starting whiteboard sessions.');
            }
            return Column(
              children: [
                for (final classroom in classrooms)
                  _whiteboardClassroomCard(context, classroom),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _whiteboardClassroomCard(
      BuildContext context, Map<String, dynamic> classroom) {
    final classroomId = _safeString(classroom['id']);
    final accent = _subjectColor(_safeString(classroom['subject']));

    return AppCard(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_safeString(classroom['name'], fallback: 'Classroom'),
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            _joinNonEmpty([
              _safeString(classroom['subject']),
              _formLabel(classroom['form_level']),
              '${_asInt(classroom['student_count'])} students',
            ]),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Text('Active session',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          FuturePanel(
            future: widget.api.get(
                '/whiteboard/session/active/$classroomId?refresh=$refreshTick'),
            builder: (sessionData) {
              if (sessionData['active'] != true) {
                return const Text('No active session right now.',
                    style: TextStyle(
                        fontWeight: FontWeight.w800, color: AppTheme.muted));
              }
              final active = _asMap(sessionData['session']);
              return WhiteboardSessionPanel(
                session: active,
                active: true,
                canManage: canManage,
                onEnd: () => _endWhiteboardSession(active),
                onOpenBoard: () => _openWhiteboardStudio(active),
                onRecordScreen: () => _recordWhiteboardSession(active),
                onAttachRecording: () => _attachWhiteboardRecording(active),
                onRemoveRecording: () => _removeWhiteboardRecording(active),
              );
            },
          ),
          const SizedBox(height: 16),
          Text('Recent sessions',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          FuturePanel(
            future: widget.api.get(
                '/whiteboard/sessions/$classroomId?limit=5&refresh=$refreshTick'),
            builder: (historyData) {
              final sessions = _asMapList(historyData['sessions'])
                  .where(
                      (session) => _safeString(session['status']) != 'active')
                  .toList();
              if (sessions.isEmpty) {
                return const Text('No ended whiteboard sessions yet.',
                    style: TextStyle(
                        fontWeight: FontWeight.w800, color: AppTheme.muted));
              }

              return Column(
                children: [
                  for (final session in sessions)
                    WhiteboardSessionPanel(
                      session: session,
                      active: false,
                      canManage: canManage,
                      onEnd: () => _endWhiteboardSession(session),
                      onOpenBoard: () => _openWhiteboardStudio(session),
                      onRecordScreen: () => _recordWhiteboardSession(session),
                      onAttachRecording: () =>
                          _attachWhiteboardRecording(session),
                      onRemoveRecording: () =>
                          _removeWhiteboardRecording(session),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _showStartSessionDialog(BuildContext context) async {
    final classroomsData = await widget.api.get('/classroom');
    final classrooms = _asMapList(classroomsData['classrooms']);
    if (classrooms.isEmpty || !context.mounted) return;

    String classroomId = '${classrooms.first['id']}';
    final title = TextEditingController(text: 'Live revision session');
    final description = TextEditingController();

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Start whiteboard session'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: classroomId,
                  items: [
                    for (final classroom in classrooms)
                      DropdownMenuItem(
                        value: '${classroom['id']}',
                        child: Text(_safeString(classroom['name'],
                            fallback: 'Classroom')),
                      ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => classroomId = value ?? classroomId),
                ),
                const SizedBox(height: 12),
                TextField(
                    controller: title,
                    decoration:
                        const InputDecoration(labelText: 'Session title')),
                const SizedBox(height: 12),
                TextField(
                    controller: description,
                    decoration:
                        const InputDecoration(labelText: 'Description')),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                try {
                  await widget.api.post('/whiteboard/session', {
                    'classroomId': classroomId,
                    'title': title.text,
                    'description': description.text,
                  });
                  if (mounted) {
                    setState(() => refreshTick++);
                  }
                  if (context.mounted) Navigator.pop(context);
                } on DioException catch (error) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(_errorMessage(error))),
                  );
                }
              },
              child: const Text('Start'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _endWhiteboardSession(Map<String, dynamic> session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('End whiteboard session?'),
        content: Text(_safeString(session['title'], fallback: 'Live session')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('End session')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await widget.api.post('/whiteboard/session/${session['id']}/end', {});
      if (mounted) setState(() => refreshTick++);
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    }
  }

  Future<void> _openWhiteboardStudio(Map<String, dynamic> session) async {
    await showDialog<void>(
      context: context,
      builder: (context) => WhiteboardStudioDialog(
        api: widget.api,
        session: session,
        token: widget.session.token,
        canManage: canManage && _safeString(session['status']) == 'active',
        onRecordScreen: () => _recordWhiteboardSession(session),
      ),
    );
    if (mounted) setState(() => refreshTick++);
  }

  Future<void> _attachWhiteboardRecording(Map<String, dynamic> session) async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['mp4', 'webm', 'mov'],
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;

    final file = picked.files.single;
    final bytes = file.bytes;
    if (bytes == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to read this recording file.')),
      );
      return;
    }

    try {
      final uploaded = await widget.api.uploadBytes(
        filename: file.name,
        bytes: bytes,
        bucket: 'whiteboard',
        contentType: _videoMimeFromFilename(file.name),
      );
      await widget.api.post('/whiteboard/session/${session['id']}/recording', {
        'fileId': _safeString(uploaded['fileId'],
            fallback: _safeString(uploaded['id'])),
        'objectName': _safeString(uploaded['objectName']),
        'fileSizeBytes': _asInt(uploaded['size']),
      });

      if (mounted) {
        setState(() => refreshTick++);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recording attached.')),
        );
      }
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    }
  }

  Future<void> _recordWhiteboardSession(Map<String, dynamic> session) async {
    final recording = await recordWhiteboardScreen(
      context,
      title: _safeString(session['title'], fallback: 'Whiteboard session'),
    );
    if (recording == null) return;

    try {
      final uploaded = await widget.api.uploadBytes(
        filename: recording.filename,
        bytes: recording.bytes,
        bucket: 'whiteboard',
        contentType: recording.mimeType,
      );

      await widget.api.post('/whiteboard/session/${session['id']}/recording', {
        'fileId': _safeString(uploaded['fileId'],
            fallback: _safeString(uploaded['id'])),
        'objectName': _safeString(uploaded['objectName']),
        'durationSeconds': recording.durationSeconds,
        'fileSizeBytes': recording.bytes.length,
      });

      if (mounted) {
        setState(() => refreshTick++);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recording saved.')),
        );
      }
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    }
  }

  Future<void> _removeWhiteboardRecording(Map<String, dynamic> session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove recording?'),
        content: Text(_safeString(session['title'], fallback: 'Session')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await widget.api.delete('/whiteboard/session/${session['id']}/recording');
      if (mounted) {
        setState(() => refreshTick++);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recording removed.')),
        );
      }
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    }
  }

  String _videoMimeFromFilename(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return 'video/webm';
  }
}

class WhiteboardSessionPanel extends StatelessWidget {
  const WhiteboardSessionPanel({
    required this.session,
    required this.active,
    required this.canManage,
    required this.onEnd,
    required this.onOpenBoard,
    required this.onAttachRecording,
    required this.onRecordScreen,
    required this.onRemoveRecording,
    super.key,
  });

  final Map<String, dynamic> session;
  final bool active;
  final bool canManage;
  final VoidCallback onEnd;
  final VoidCallback onOpenBoard;
  final VoidCallback onAttachRecording;
  final VoidCallback onRecordScreen;
  final VoidCallback onRemoveRecording;

  @override
  Widget build(BuildContext context) {
    final recordingUrl = _safeString(session['recording_url']);
    final recordingName = _safeString(session['recording_name'],
        fallback: 'Whiteboard recording');
    final recordingMime = _safeString(session['recording_mime_type']);
    final recordingStatus = _safeString(session['recording_status'],
        fallback: recordingUrl.isEmpty ? 'none' : 'ready');
    final duration = _asInt(session['duration_seconds']);
    final recordingSize = _asInt(session['recording_size_bytes']);
    final legacySize = _asInt(session['file_size_bytes']);
    final sizeBytes = recordingSize > 0 ? recordingSize : legacySize;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated.withValues(alpha: 0.64),
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: AppTheme.outlineStrong.withValues(alpha: 0.72)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: (active ? AppTheme.orange : AppTheme.blue)
                      .withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  active
                      ? Icons.broadcast_on_home_rounded
                      : Icons.video_library_rounded,
                  color: active ? AppTheme.orange : AppTheme.blue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_safeString(session['title'], fallback: 'Session'),
                        style: Theme.of(context).textTheme.titleMedium),
                    Text(
                      _joinNonEmpty([
                        'Teacher ${_safeString(session['teacher_name'])}',
                        _whiteboardSessionTime(session),
                        duration > 0 ? _formatSeconds(duration) : '',
                        sizeBytes > 0 ? _formatBytes(sizeBytes) : '',
                      ]),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (_safeString(session['description']).isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(_safeString(session['description']),
                          style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ],
                ),
              ),
              StatusPill(
                  label: active ? 'Live' : _safeString(session['status']),
                  color: active ? AppTheme.orange : AppTheme.blue),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FeatureChip(
                  label:
                      'Recording ${recordingStatus == 'none' ? 'not saved' : recordingStatus}'),
              if (active) const FeatureChip(label: 'Replay events captured'),
            ],
          ),
          if (recordingUrl.isNotEmpty) ...[
            const SizedBox(height: 12),
            MediaAttachmentGrid(
              compact: true,
              attachments: [
                {
                  'type': recordingMime.startsWith('video/') ? 'video' : 'file',
                  'url': recordingUrl,
                  'name': recordingName,
                  'mimeType': recordingMime,
                  'size': sizeBytes,
                }
              ],
            ),
          ] else if (_safeString(session['recording_path']).isNotEmpty) ...[
            const SizedBox(height: 10),
            FeatureChip(label: 'Recording metadata saved'),
          ],
          if (canManage) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: onOpenBoard,
                  icon: const Icon(Icons.dashboard_customize_rounded),
                  label: Text(active ? 'Open board' : 'Replay board'),
                ),
                if (active && supportsWhiteboardScreenRecording)
                  FilledButton.icon(
                    onPressed: onRecordScreen,
                    icon: const Icon(Icons.video_camera_front_rounded),
                    label: const Text('Record screen'),
                  ),
                OutlinedButton.icon(
                  onPressed: onAttachRecording,
                  icon: const Icon(Icons.upload_file_rounded),
                  label: Text(recordingUrl.isEmpty
                      ? 'Attach recording'
                      : 'Replace recording'),
                ),
                if (recordingUrl.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: onRemoveRecording,
                    icon: const Icon(Icons.delete_outline_rounded),
                    label: const Text('Remove recording'),
                  ),
                if (active)
                  OutlinedButton.icon(
                    onPressed: onEnd,
                    icon: const Icon(Icons.stop_circle_rounded),
                    label: const Text('End session'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class WhiteboardStudioDialog extends StatefulWidget {
  const WhiteboardStudioDialog({
    required this.api,
    required this.session,
    required this.token,
    required this.canManage,
    required this.onRecordScreen,
    super.key,
  });

  final ApiService api;
  final Map<String, dynamic> session;
  final String token;
  final bool canManage;
  final VoidCallback onRecordScreen;

  @override
  State<WhiteboardStudioDialog> createState() => _WhiteboardStudioDialogState();
}

class _WhiteboardStudioDialogState extends State<WhiteboardStudioDialog> {
  final List<_WhiteboardStroke> _strokes = [];
  final List<Offset> _draftPoints = [];
  WebSocketChannel? _channel;
  Timer? _pingTimer;
  bool _loading = true;
  bool _connected = false;
  String? _error;
  Color _penColor = Colors.white;
  double _penWidth = 4;
  bool _eraser = false;

  @override
  void initState() {
    super.initState();
    _loadReplay();
    _connectRealtime();
  }

  Future<void> _loadReplay() async {
    try {
      final data = await widget.api
          .get('/whiteboard/session/${widget.session['id']}/events');
      final events = _asMapList(data['events']);
      final replayed = <_WhiteboardStroke>[];
      for (final event in events) {
        if (_safeString(event['event_type']) == 'clear') {
          replayed.clear();
        }
        if (_safeString(event['event_type']) == 'draw') {
          replayed.addAll(
              _decodeWhiteboardStrokes(_asMap(event['payload'])['strokes']));
        }
      }
      if (!mounted) return;
      setState(() {
        _strokes
          ..clear()
          ..addAll(replayed);
        _loading = false;
      });
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _errorMessage(error);
        _loading = false;
      });
    }
  }

  void _connectRealtime() {
    final classroomId = _safeString(widget.session['classroom_id']);
    if (classroomId.isEmpty) return;

    try {
      final channel =
          WebSocketChannel.connect(classroomWebSocketUri(classroomId));
      _channel = channel;
      channel.sink.add(jsonEncode({
        'type': 'AUTH',
        'token': widget.token,
      }));
      channel.stream.listen(
        _handleRealtimeMessage,
        onError: (_) {
          if (mounted) setState(() => _connected = false);
        },
        onDone: () {
          if (mounted) setState(() => _connected = false);
        },
      );
      _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
        _channel?.sink.add(jsonEncode({'type': 'PING'}));
      });
    } catch (_) {
      if (mounted) setState(() => _connected = false);
    }
  }

  void _handleRealtimeMessage(dynamic message) {
    final payload = _decodeRealtimeMessage(message);
    final type = _safeString(payload['type']);
    if (type == 'AUTH_SUCCESS') {
      if (mounted) setState(() => _connected = true);
      return;
    }
    if (type == 'WHITEBOARD_DRAW') {
      final strokes = _decodeWhiteboardStrokes(payload['strokes']);
      if (strokes.isEmpty || !mounted) return;
      setState(() => _strokes.addAll(strokes));
      return;
    }
    if (type == 'WHITEBOARD_CLEAR') {
      if (mounted) setState(_strokes.clear);
      return;
    }
    if (type == 'ERROR') {
      if (mounted) setState(() => _error = _safeString(payload['message']));
    }
  }

  Map<String, dynamic> _decodeRealtimeMessage(dynamic message) {
    try {
      if (message is String) return _asMap(jsonDecode(message));
      if (message is List<int>) return _asMap(jsonDecode(utf8.decode(message)));
    } catch (_) {
      return {};
    }
    return {};
  }

  void _beginStroke(Offset position, Size size) {
    if (!widget.canManage) return;
    _draftPoints
      ..clear()
      ..add(_normalizePoint(position, size));
    setState(() {});
  }

  void _appendStroke(Offset position, Size size) {
    if (!widget.canManage || _draftPoints.isEmpty) return;
    final point = _normalizePoint(position, size);
    if ((_draftPoints.last - point).distance < 0.002) return;
    setState(() => _draftPoints.add(point));
  }

  void _finishStroke() {
    if (!widget.canManage || _draftPoints.length < 2) {
      _draftPoints.clear();
      setState(() {});
      return;
    }

    final stroke = _WhiteboardStroke(
      points: List<Offset>.from(_draftPoints),
      color: _eraser ? AppTheme.surfaceSoft : _penColor,
      width: _eraser ? _penWidth * 3 : _penWidth,
      eraser: _eraser,
    );
    setState(() {
      _draftPoints.clear();
      _strokes.add(stroke);
    });
    _channel?.sink.add(jsonEncode({
      'type': 'WHITEBOARD_DRAW',
      'strokes': [stroke.toJson()],
    }));
  }

  void _clearBoard() {
    if (!widget.canManage) return;
    setState(_strokes.clear);
    _channel?.sink.add(jsonEncode({'type': 'WHITEBOARD_CLEAR'}));
  }

  Offset _normalizePoint(Offset point, Size size) {
    return Offset(
      (point.dx / size.width).clamp(0, 1).toDouble(),
      (point.dy / size.height).clamp(0, 1).toDouble(),
    );
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    _channel?.sink.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLive = _safeString(widget.session['status']) == 'active';
    final draftStroke = _draftPoints.length < 2
        ? null
        : _WhiteboardStroke(
            points: List<Offset>.from(_draftPoints),
            color: _eraser ? AppTheme.surfaceSoft : _penColor,
            width: _eraser ? _penWidth * 3 : _penWidth,
            eraser: _eraser,
          );

    return Dialog(
      insetPadding: const EdgeInsets.all(18),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1120, maxHeight: 760),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _safeString(widget.session['title'],
                              fallback: 'Whiteboard'),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            StatusPill(
                              label: isLive
                                  ? (_connected ? 'Live' : 'Connecting')
                                  : 'Replay',
                              color: isLive ? AppTheme.orange : AppTheme.blue,
                            ),
                            FeatureChip(
                                label: widget.canManage
                                    ? 'Teacher tools'
                                    : 'View only'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (widget.canManage && supportsWhiteboardScreenRecording)
                    OutlinedButton.icon(
                      onPressed: widget.onRecordScreen,
                      icon: const Icon(Icons.video_camera_front_rounded),
                      label: const Text('Record'),
                    ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Close',
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: AppTheme.red)),
              ],
              if (widget.canManage) ...[
                const SizedBox(height: 12),
                _WhiteboardToolbar(
                  penColor: _penColor,
                  penWidth: _penWidth,
                  eraser: _eraser,
                  onColorChanged: (color) => setState(() {
                    _penColor = color;
                    _eraser = false;
                  }),
                  onWidthChanged: (width) => setState(() => _penWidth = width),
                  onEraserChanged: (enabled) =>
                      setState(() => _eraser = enabled),
                  onClear: _clearBoard,
                ),
              ],
              const SizedBox(height: 12),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: ColoredBox(
                    color: AppTheme.surfaceSoft,
                    child: _loading
                        ? const Center(child: CircularProgressIndicator())
                        : LayoutBuilder(
                            builder: (context, constraints) {
                              final size = Size(
                                constraints.maxWidth,
                                constraints.maxHeight,
                              );
                              return GestureDetector(
                                onPanStart: widget.canManage
                                    ? (details) => _beginStroke(
                                        details.localPosition, size)
                                    : null,
                                onPanUpdate: widget.canManage
                                    ? (details) => _appendStroke(
                                        details.localPosition, size)
                                    : null,
                                onPanEnd: widget.canManage
                                    ? (_) => _finishStroke()
                                    : null,
                                child: CustomPaint(
                                  painter: _WhiteboardPainter(
                                    strokes: draftStroke == null
                                        ? _strokes
                                        : [..._strokes, draftStroke],
                                  ),
                                  child: const SizedBox.expand(),
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WhiteboardToolbar extends StatelessWidget {
  const _WhiteboardToolbar({
    required this.penColor,
    required this.penWidth,
    required this.eraser,
    required this.onColorChanged,
    required this.onWidthChanged,
    required this.onEraserChanged,
    required this.onClear,
  });

  final Color penColor;
  final double penWidth;
  final bool eraser;
  final ValueChanged<Color> onColorChanged;
  final ValueChanged<double> onWidthChanged;
  final ValueChanged<bool> onEraserChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    const colors = [
      Colors.white,
      AppTheme.yellow,
      AppTheme.green,
      AppTheme.blue,
      AppTheme.coral,
    ];

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final color in colors)
          Tooltip(
            message: 'Pen color',
            child: InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: () => onColorChanged(color),
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color,
                  border: Border.all(
                    color: penColor == color && !eraser
                        ? AppTheme.deepBlue
                        : AppTheme.outlineStrong,
                    width: penColor == color && !eraser ? 3 : 1,
                  ),
                ),
              ),
            ),
          ),
        SizedBox(
          width: 180,
          child: Slider(
            min: 2,
            max: 12,
            divisions: 5,
            value: penWidth,
            label: penWidth.round().toString(),
            onChanged: onWidthChanged,
          ),
        ),
        FilterChip(
          selected: eraser,
          label: const Text('Eraser'),
          avatar: const Icon(Icons.cleaning_services_rounded, size: 18),
          onSelected: onEraserChanged,
        ),
        OutlinedButton.icon(
          onPressed: onClear,
          icon: const Icon(Icons.delete_sweep_rounded),
          label: const Text('Clear'),
        ),
      ],
    );
  }
}

class _WhiteboardPainter extends CustomPainter {
  const _WhiteboardPainter({required this.strokes});

  final List<_WhiteboardStroke> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in strokes) {
      if (stroke.points.length < 2) continue;
      final paint = Paint()
        ..color = stroke.color
        ..strokeWidth = stroke.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      final path = Path()
        ..moveTo(stroke.points.first.dx * size.width,
            stroke.points.first.dy * size.height);
      for (final point in stroke.points.skip(1)) {
        path.lineTo(point.dx * size.width, point.dy * size.height);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _WhiteboardPainter oldDelegate) =>
      oldDelegate.strokes != strokes;
}

class _WhiteboardStroke {
  const _WhiteboardStroke({
    required this.points,
    required this.color,
    required this.width,
    this.eraser = false,
  });

  final List<Offset> points;
  final Color color;
  final double width;
  final bool eraser;

  Map<String, dynamic> toJson() {
    return {
      'points': [
        for (final point in points) [point.dx, point.dy]
      ],
      'color': '#${color.value.toRadixString(16).padLeft(8, '0')}',
      'width': width,
      'eraser': eraser,
    };
  }

  factory _WhiteboardStroke.fromJson(Map<String, dynamic> json) {
    final points = <Offset>[];
    final rawPoints = json['points'];
    if (rawPoints is List) {
      for (final point in rawPoints) {
        if (point is List && point.length >= 2) {
          points.add(Offset(_asDouble(point[0]), _asDouble(point[1])));
        }
      }
    }
    return _WhiteboardStroke(
      points: points,
      color: _colorFromHex(_safeString(json['color']), AppTheme.deepBlue),
      width: math.max(_asDouble(json['width']), 1),
      eraser: json['eraser'] == true,
    );
  }
}

List<_WhiteboardStroke> _decodeWhiteboardStrokes(dynamic value) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is Map) _WhiteboardStroke.fromJson(_asMap(item))
  ];
}

Color _colorFromHex(String value, Color fallback) {
  final clean = value.replaceAll('#', '').trim();
  if (clean.length != 8) return fallback;
  final parsed = int.tryParse(clean, radix: 16);
  return parsed == null ? fallback : Color(parsed);
}

class PostsPage extends StatefulWidget {
  const PostsPage({
    required this.api,
    required this.session,
    this.enableRealtime = true,
    super.key,
  });

  final ApiService api;
  final LocalSession session;
  final bool enableRealtime;

  @override
  State<PostsPage> createState() => _PostsPageState();
}

class _PostsPageState extends State<PostsPage> {
  late Future<Map<String, dynamic>> future = _loadFeed();
  final Map<String, WebSocketChannel> _feedSockets = {};
  final Map<String, Timer> _feedSocketRetryTimers = {};
  Timer? _realtimeRefreshTimer;

  bool get canCreate =>
      widget.session.user.role == 'teacher' ||
      widget.session.user.role == 'admin';
  void _refresh() {
    setState(() {
      future = _loadFeed();
    });
  }

  Future<Map<String, dynamic>> _loadFeed() async {
    final data = await widget.api.get('/feed/posts');
    final classroomIds = <String>{
      for (final post in _asMapList(data['posts']))
        if (_safeString(post['classroom_id']).isNotEmpty)
          _safeString(post['classroom_id']),
    };

    try {
      final classroomsData = await widget.api.get('/classroom');
      classroomIds.addAll([
        for (final classroom in _asMapList(classroomsData['classrooms']))
          if (_safeString(classroom['id']).isNotEmpty)
            _safeString(classroom['id']),
      ]);
    } catch (_) {
      // The feed still works if classroom discovery fails; existing posts
      // provide enough IDs for live updates in visible classrooms.
    }

    if (widget.enableRealtime) {
      _syncFeedSockets(classroomIds);
    }
    return data;
  }

  void _syncFeedSockets(Set<String> classroomIds) {
    final wanted = classroomIds.where((id) => id.trim().isNotEmpty).toSet();

    for (final classroomId in _feedSockets.keys.toList()) {
      if (!wanted.contains(classroomId)) {
        _feedSocketRetryTimers.remove(classroomId)?.cancel();
        _feedSockets.remove(classroomId)?.sink.close();
      }
    }

    for (final classroomId in wanted) {
      if (!_feedSockets.containsKey(classroomId)) {
        _connectFeedSocket(classroomId);
      }
    }
  }

  void _connectFeedSocket(String classroomId) {
    try {
      final channel =
          WebSocketChannel.connect(classroomWebSocketUri(classroomId));
      _feedSockets[classroomId] = channel;
      channel.sink.add(jsonEncode({
        'type': 'AUTH',
        'token': widget.session.token,
      }));
      channel.stream.listen(
        _handleRealtimeMessage,
        onError: (_) => _scheduleFeedSocketReconnect(classroomId, channel),
        onDone: () => _scheduleFeedSocketReconnect(classroomId, channel),
      );
    } catch (_) {
      _scheduleFeedSocketReconnect(classroomId, null);
    }
  }

  void _scheduleFeedSocketReconnect(
      String classroomId, WebSocketChannel? channel) {
    if (!mounted) return;
    if (channel != null && _feedSockets[classroomId] != channel) return;

    _feedSockets.remove(classroomId);
    _feedSocketRetryTimers.remove(classroomId)?.cancel();
    _feedSocketRetryTimers[classroomId] = Timer(const Duration(seconds: 5), () {
      if (!mounted || _feedSockets.containsKey(classroomId)) return;
      _connectFeedSocket(classroomId);
    });
  }

  void _handleRealtimeMessage(dynamic message) {
    final payload = _decodeRealtimeMessage(message);
    final type = _safeString(payload['type']);
    const refreshEvents = {
      'NEW_POST',
      'POST_UPDATED',
      'POST_DELETED',
      'NEW_POST_COMMENT',
      'POST_COMMENT_UPDATED',
      'POST_COMMENT_DELETED',
      'POST_REACTION',
    };
    if (refreshEvents.contains(type)) {
      _scheduleRealtimeRefresh();
    }
  }

  Map<String, dynamic> _decodeRealtimeMessage(dynamic message) {
    try {
      if (message is String) return _asMap(jsonDecode(message));
      if (message is List<int>) return _asMap(jsonDecode(utf8.decode(message)));
    } catch (_) {
      return {};
    }
    return {};
  }

  void _scheduleRealtimeRefresh() {
    if (_realtimeRefreshTimer?.isActive == true) return;
    _realtimeRefreshTimer = Timer(const Duration(milliseconds: 600), () {
      if (mounted) _refresh();
    });
  }

  @override
  void dispose() {
    _realtimeRefreshTimer?.cancel();
    for (final timer in _feedSocketRetryTimers.values) {
      timer.cancel();
    }
    for (final channel in _feedSockets.values) {
      channel.sink.close();
    }
    super.dispose();
  }

  Future<Map<String, dynamic>?> _pickMediaAttachment(
      BuildContext context) async {
    return pickMediaAttachment(context, widget.api);
  }

  Future<Map<String, dynamic>?> _promptGifAttachment(
      BuildContext context) async {
    return promptGifAttachment(context);
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Posts',
      subtitle: 'Teacher announcements and classroom engagement feed.',
      trailing: canCreate
          ? FilledButton.icon(
              key: AppTestKeys.postsCreate,
              onPressed: () => _showCreatePostDialog(context),
              icon: const Icon(Icons.campaign_rounded),
              label: const Text('Create post'),
            )
          : null,
      children: [
        FuturePanel(
          future: future,
          builder: (data) {
            final posts = _asMapList(data['posts']);
            if (posts.isEmpty) {
              return const EmptyState(text: 'No classroom posts yet.');
            }
            return Column(
              children: [
                for (final post in posts)
                  FeedPostCard(
                    api: widget.api,
                    session: widget.session,
                    post: post,
                    editable: widget.session.user.role == 'admin' ||
                        _safeString(post['author_id']) ==
                            widget.session.user.id,
                    onEdit: () => _showEditPostDialog(context, post),
                    onDelete: () => _deletePost(post),
                    onChanged: _refresh,
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _showCreatePostDialog(BuildContext context) async {
    final classroomsData = await widget.api.get('/classroom');
    final classrooms = _asMapList(classroomsData['classrooms']);
    if (classrooms.isEmpty || !context.mounted) return;

    String classroomId = '${classrooms.first['id']}';
    String postType = 'announcement';
    bool isPinned = false;
    final title = TextEditingController();
    final content = TextEditingController();
    final attachments = <Map<String, dynamic>>[];

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Create post'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: classroomId,
                  items: [
                    for (final classroom in classrooms)
                      DropdownMenuItem(
                        value: '${classroom['id']}',
                        child: Text(_safeString(classroom['name'],
                            fallback: 'Classroom')),
                      ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => classroomId = value ?? classroomId),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: postType,
                  items: const [
                    DropdownMenuItem(
                        value: 'announcement', child: Text('Announcement')),
                    DropdownMenuItem(
                        value: 'assignment', child: Text('Assignment')),
                    DropdownMenuItem(value: 'general', child: Text('General')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => postType = value ?? postType),
                ),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.postTitleField,
                    controller: title,
                    decoration: const InputDecoration(labelText: 'Title')),
                const SizedBox(height: 12),
                TextField(
                  key: AppTestKeys.postContentField,
                  controller: content,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'Content'),
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  value: isPinned,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Pin this post'),
                  onChanged: (value) =>
                      setDialogState(() => isPinned = value ?? false),
                ),
                const SizedBox(height: 12),
                AttachmentDraftList(
                  attachments: attachments,
                  onRemove: (index) =>
                      setDialogState(() => attachments.removeAt(index)),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () async {
                        final attachment = await _pickMediaAttachment(context);
                        if (attachment != null) {
                          setDialogState(() => attachments.add(attachment));
                        }
                      },
                      icon: const Icon(Icons.attach_file_rounded),
                      label: const Text('Attach media'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final attachment = await _promptGifAttachment(context);
                        if (attachment != null) {
                          setDialogState(() => attachments.add(attachment));
                        }
                      },
                      icon: const Icon(Icons.gif_box_rounded),
                      label: const Text('Add GIF URL'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              key: AppTestKeys.postSubmit,
              onPressed: () async {
                await widget.api.post('/feed/posts', {
                  'classroomId': classroomId,
                  'title': title.text,
                  'content': content.text,
                  'postType': postType,
                  'isPinned': isPinned,
                  'attachments': attachments,
                });
                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Publish'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showEditPostDialog(
      BuildContext context, Map<String, dynamic> post) async {
    String postType = _safeString(post['post_type'], fallback: 'announcement');
    bool isPinned = post['is_pinned'] == true;
    final title = TextEditingController(text: _safeString(post['title']));
    final content = TextEditingController(text: _safeString(post['content']));
    final attachments = _attachmentList(post['attachments']);

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Edit post'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: postType,
                  items: const [
                    DropdownMenuItem(
                        value: 'announcement', child: Text('Announcement')),
                    DropdownMenuItem(
                        value: 'assignment', child: Text('Assignment')),
                    DropdownMenuItem(value: 'general', child: Text('General')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => postType = value ?? postType),
                ),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.postTitleField,
                    controller: title,
                    decoration: const InputDecoration(labelText: 'Title')),
                const SizedBox(height: 12),
                TextField(
                  key: AppTestKeys.postContentField,
                  controller: content,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'Content'),
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  value: isPinned,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Pin this post'),
                  onChanged: (value) =>
                      setDialogState(() => isPinned = value ?? false),
                ),
                const SizedBox(height: 12),
                AttachmentDraftList(
                  attachments: attachments,
                  onRemove: (index) =>
                      setDialogState(() => attachments.removeAt(index)),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () async {
                        final attachment = await _pickMediaAttachment(context);
                        if (attachment != null) {
                          setDialogState(() => attachments.add(attachment));
                        }
                      },
                      icon: const Icon(Icons.attach_file_rounded),
                      label: const Text('Attach media'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final attachment = await _promptGifAttachment(context);
                        if (attachment != null) {
                          setDialogState(() => attachments.add(attachment));
                        }
                      },
                      icon: const Icon(Icons.gif_box_rounded),
                      label: const Text('Add GIF URL'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              key: AppTestKeys.postSave,
              onPressed: () async {
                await widget.api.patch('/feed/posts/${post['id']}', {
                  'title': title.text,
                  'content': content.text,
                  'postType': postType,
                  'isPinned': isPinned,
                  'attachments': attachments,
                });
                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deletePost(Map<String, dynamic> post) async {
    await widget.api.delete('/feed/posts/${post['id']}');
    if (mounted) _refresh();
  }
}

class UsersPage extends StatefulWidget {
  const UsersPage({required this.api, super.key});

  final ApiService api;

  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  String roleFilter = 'all';
  String statusFilter = 'active';
  late Future<Map<String, dynamic>> future = _load();

  Future<Map<String, dynamic>> _load() async {
    final params = <String>['limit=200'];
    if (roleFilter != 'all') params.add('role=$roleFilter');
    if (statusFilter != 'all') {
      params.add('isActive=${statusFilter == 'active'}');
    }
    final users = await widget.api.get('/admin/users?${params.join('&')}');
    final links = await widget.api.get('/admin/parent-links');
    return {
      'users': _asMapList(users['users']),
      'links': _asMapList(links['links']),
    };
  }

  void _refresh() {
    setState(() {
      future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Users',
      subtitle: 'Create and manage students, teachers, parents, and admins.',
      trailing: FilledButton.icon(
        key: AppTestKeys.usersAdd,
        onPressed: () => _showUserDialog(context),
        icon: const Icon(Icons.person_add_rounded),
        label: const Text('Add user'),
      ),
      children: [
        FilterChips(
          value: statusFilter,
          options: const [
            FilterOption(value: 'active', label: 'Active'),
            FilterOption(value: 'all', label: 'All'),
            FilterOption(value: 'disabled', label: 'Disabled'),
          ],
          onChanged: (value) {
            setState(() {
              statusFilter = value;
              future = _load();
            });
          },
        ),
        const SizedBox(height: 12),
        FilterChips(
          value: roleFilter,
          options: const [
            FilterOption(value: 'all', label: 'All roles'),
            FilterOption(value: 'student', label: 'Students'),
            FilterOption(value: 'teacher', label: 'Teachers'),
            FilterOption(value: 'parent', label: 'Parents'),
            FilterOption(value: 'admin', label: 'Admins'),
          ],
          onChanged: (value) {
            setState(() {
              roleFilter = value;
              future = _load();
            });
          },
        ),
        const SizedBox(height: 18),
        FuturePanel(
          future: future,
          builder: (data) {
            final users = _asMapList(data['users']);
            final links = _asMapList(data['links']);
            if (users.isEmpty) return const EmptyState(text: 'No users yet.');
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final user in users)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: AppCard(
                      key: AppTestKeys.userCard(user['id']),
                      accent: _roleAccent(
                          _safeString(user['role'], fallback: 'student')),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_safeString(user['full_name'], fallback: 'User'),
                              style: Theme.of(context).textTheme.titleLarge),
                          const SizedBox(height: 6),
                          Text(
                            _joinNonEmpty([
                              _safeString(user['email']),
                              _safeString(user['role']),
                              user['is_active'] == true ? 'Active' : 'Disabled',
                            ]),
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              StatusPill(
                                label: user['is_active'] == true
                                    ? 'Active'
                                    : 'Disabled',
                                color: user['is_active'] == true
                                    ? AppTheme.green
                                    : AppTheme.red,
                              ),
                              OutlinedButton.icon(
                                key: AppTestKeys.userDisable(user['id']),
                                onPressed: () => user['is_active'] == true
                                    ? _deleteUser(context, user)
                                    : _setUserActive(user, true),
                                icon: Icon(user['is_active'] == true
                                    ? Icons.block_rounded
                                    : Icons.check_circle_rounded),
                                label: Text(user['is_active'] == true
                                    ? 'Disable'
                                    : 'Enable'),
                              ),
                              OutlinedButton.icon(
                                key: AppTestKeys.userEdit(user['id']),
                                onPressed: () =>
                                    _showUserDialog(context, existing: user),
                                icon: const Icon(Icons.edit_rounded),
                                label: const Text('Edit'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                SectionHeader(title: 'Parent links', action: '${links.length}'),
                const SizedBox(height: 12),
                AppCard(
                  accent: AppTheme.orange,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FilledButton.icon(
                        onPressed: () => _showParentLinkDialog(context),
                        icon: const Icon(Icons.link_rounded),
                        label: const Text('Link parent to student'),
                      ),
                      const SizedBox(height: 14),
                      if (links.isEmpty)
                        Text('No parent-child links yet.',
                            style: Theme.of(context).textTheme.bodyMedium)
                      else
                        for (final link in links)
                          DataTile(
                            title: _safeString(link['parent_name'],
                                fallback: 'Parent'),
                            subtitle:
                                'Parent of ${_safeString(link['student_name'], fallback: 'Student')}',
                            details: _joinNonEmpty([
                              _safeString(link['parent_email']),
                              _safeString(link['student_email']),
                            ]),
                            badge: 'Linked',
                            icon: Icons.family_restroom_rounded,
                            accent: AppTheme.orange,
                            trailing: IconButton(
                              tooltip: 'Remove link',
                              onPressed: () => _deleteParentLink(link),
                              icon: const Icon(Icons.link_off_rounded),
                            ),
                          ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _showUserDialog(BuildContext context,
      {Map<String, dynamic>? existing}) async {
    final email = TextEditingController(text: _safeString(existing?['email']));
    final password = TextEditingController();
    final fullName =
        TextEditingController(text: _safeString(existing?['full_name']));
    final phone =
        TextEditingController(text: _safeString(existing?['phone_number']));
    final dob =
        TextEditingController(text: _safeString(existing?['date_of_birth']));
    var role = _safeString(existing?['role'], fallback: 'student');
    var isActive = existing?['is_active'] != false;

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Add user' : 'Edit user'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    key: AppTestKeys.userFullNameField,
                    controller: fullName,
                    decoration: const InputDecoration(labelText: 'Full name')),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.userEmailField,
                    controller: email,
                    decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                TextField(
                  key: AppTestKeys.userPasswordField,
                  controller: password,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText:
                        existing == null ? 'Password' : 'New password optional',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'student', child: Text('Student')),
                    DropdownMenuItem(value: 'teacher', child: Text('Teacher')),
                    DropdownMenuItem(value: 'parent', child: Text('Parent')),
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => role = value ?? role),
                ),
                const SizedBox(height: 12),
                TextField(
                    controller: phone,
                    decoration:
                        const InputDecoration(labelText: 'Phone optional')),
                const SizedBox(height: 12),
                TextField(
                    controller: dob,
                    decoration:
                        const InputDecoration(labelText: 'Date of birth')),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: isActive,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active account'),
                  onChanged: (value) => setDialogState(() => isActive = value),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              key: AppTestKeys.userSubmit,
              onPressed: () async {
                final payload = {
                  'email': email.text,
                  'fullName': fullName.text,
                  'role': role,
                  'phoneNumber': phone.text,
                  'dateOfBirth': dob.text,
                  'isActive': isActive,
                };

                if (existing == null) {
                  payload['password'] = password.text;
                  await widget.api.post('/admin/users', payload);
                } else {
                  if (password.text.trim().isNotEmpty) {
                    payload['password'] = password.text;
                  }
                  await widget.api
                      .patch('/admin/users/${existing['id']}', payload);
                }

                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: Text(existing == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _setUserActive(Map<String, dynamic> user, bool isActive) async {
    await widget.api.patch('/admin/users/${user['id']}/status', {
      'isActive': isActive,
    });
    if (mounted) _refresh();
  }

  Future<void> _deleteUser(
      BuildContext context, Map<String, dynamic> user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disable user?'),
        content: Text(
            '${_safeString(user['full_name'], fallback: 'This user')} will no longer be able to log in.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              key: AppTestKeys.userDisableConfirm,
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Disable')),
        ],
      ),
    );

    if (confirmed != true) return;
    await widget.api.delete('/admin/users/${user['id']}');
    if (mounted) _refresh();
  }

  Future<void> _showParentLinkDialog(BuildContext context) async {
    final parentsData =
        await widget.api.get('/admin/users?role=parent&limit=200');
    final studentsData =
        await widget.api.get('/admin/users?role=student&limit=200');
    final parents = _asMapList(parentsData['users']);
    final students = _asMapList(studentsData['users']);
    if (parents.isEmpty || students.isEmpty || !context.mounted) return;

    var parentId = _safeString(parents.first['id']);
    var studentId = _safeString(students.first['id']);

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Link parent to student'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: parentId,
                decoration: const InputDecoration(labelText: 'Parent'),
                items: [
                  for (final parent in parents)
                    DropdownMenuItem(
                      value: _safeString(parent['id']),
                      child: Text(
                          _safeString(parent['full_name'], fallback: 'Parent')),
                    ),
                ],
                onChanged: (value) =>
                    setDialogState(() => parentId = value ?? parentId),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: studentId,
                decoration: const InputDecoration(labelText: 'Student'),
                items: [
                  for (final student in students)
                    DropdownMenuItem(
                      value: _safeString(student['id']),
                      child: Text(_safeString(student['full_name'],
                          fallback: 'Student')),
                    ),
                ],
                onChanged: (value) =>
                    setDialogState(() => studentId = value ?? studentId),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                await widget.api.post('/admin/parent-links', {
                  'parentId': parentId,
                  'studentId': studentId,
                });
                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Link'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteParentLink(Map<String, dynamic> link) async {
    await widget.api.delete('/admin/parent-links/${link['id']}');
    if (mounted) _refresh();
  }
}

class AdminClassroomsPage extends StatefulWidget {
  const AdminClassroomsPage({required this.api, super.key});

  final ApiService api;

  @override
  State<AdminClassroomsPage> createState() => _AdminClassroomsPageState();
}

class _AdminClassroomsPageState extends State<AdminClassroomsPage> {
  String statusFilter = 'active';
  late Future<Map<String, dynamic>> future = _load();

  Future<Map<String, dynamic>> _load() {
    final query =
        statusFilter == 'all' ? '' : '?isActive=${statusFilter == 'active'}';
    return widget.api.get('/admin/classrooms$query');
  }

  void _refresh() {
    setState(() {
      future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Classrooms',
      subtitle:
          'Admin control for classes, teacher ownership, and enrollments.',
      trailing: FilledButton.icon(
        key: AppTestKeys.adminClassroomsAdd,
        onPressed: () => _showClassroomDialog(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add class'),
      ),
      children: [
        FilterChips(
          value: statusFilter,
          options: const [
            FilterOption(value: 'active', label: 'Active'),
            FilterOption(value: 'all', label: 'All'),
            FilterOption(value: 'disabled', label: 'Disabled'),
          ],
          onChanged: (value) {
            setState(() {
              statusFilter = value;
              future = _load();
            });
          },
        ),
        const SizedBox(height: 18),
        FuturePanel(
          future: future,
          builder: (data) {
            final classrooms = _asMapList(data['classrooms']);
            if (classrooms.isEmpty) {
              return const EmptyState(text: 'No classrooms yet.');
            }

            return Column(
              children: [
                for (final classroom in classrooms)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: AppCard(
                      key: AppTestKeys.adminClassCard(classroom['id']),
                      accent: _subjectColor(_safeString(classroom['subject'])),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                _safeString(classroom['name'],
                                    fallback: 'Classroom'),
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              StatusPill(
                                label: classroom['is_active'] == true
                                    ? 'Active'
                                    : 'Disabled',
                                color: classroom['is_active'] == true
                                    ? AppTheme.green
                                    : AppTheme.red,
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _joinNonEmpty([
                              _safeString(classroom['subject']),
                              _formLabel(classroom['form_level']),
                              'Teacher ${_safeString(classroom['teacher_name'])}',
                              'Code ${_safeString(classroom['join_code'])}',
                            ]),
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          if (_safeString(classroom['description'])
                              .isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(_safeString(classroom['description']),
                                style: Theme.of(context).textTheme.bodyLarge),
                          ],
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              StatusPill(
                                  label:
                                      '${_asInt(classroom['student_count'])} students',
                                  color: AppTheme.blue),
                              StatusPill(
                                  label:
                                      '${_asInt(classroom['lesson_count'])} lessons',
                                  color: AppTheme.orange),
                              StatusPill(
                                  label:
                                      '${_asInt(classroom['post_count'])} posts',
                                  color: AppTheme.coral),
                              OutlinedButton.icon(
                                key:
                                    AppTestKeys.adminClassEdit(classroom['id']),
                                onPressed: () => _showClassroomDialog(context,
                                    existing: classroom),
                                icon: const Icon(Icons.edit_rounded),
                                label: const Text('Edit'),
                              ),
                              OutlinedButton.icon(
                                onPressed: () =>
                                    _showStudentsDialog(context, classroom),
                                icon: const Icon(Icons.group_add_rounded),
                                label: const Text('Students'),
                              ),
                              OutlinedButton.icon(
                                key: AppTestKeys.adminClassToggle(
                                    classroom['id']),
                                onPressed: () => _toggleClassroom(classroom),
                                icon: Icon(classroom['is_active'] == true
                                    ? Icons.block_rounded
                                    : Icons.check_circle_rounded),
                                label: Text(classroom['is_active'] == true
                                    ? 'Disable'
                                    : 'Enable'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _showClassroomDialog(BuildContext context,
      {Map<String, dynamic>? existing}) async {
    final teachersData =
        await widget.api.get('/admin/users?role=teacher&limit=200');
    final teachers = _asMapList(teachersData['users'])
        .where((teacher) => teacher['is_active'] == true)
        .toList();

    if (teachers.isEmpty || !context.mounted) return;

    var teacherId = _safeString(existing?['teacher_id'],
        fallback: _safeString(teachers.first['id']));
    final name = TextEditingController(text: _safeString(existing?['name']));
    final description =
        TextEditingController(text: _safeString(existing?['description']));
    final subject = TextEditingController(
        text: _safeString(existing?['subject'], fallback: 'Mathematics'));
    final joinCode =
        TextEditingController(text: _safeString(existing?['join_code']));
    var formLevel = _asInt(existing?['form_level']) == 5 ? 5 : 4;
    var isPublic = existing?['is_public'] == true;
    var isActive = existing?['is_active'] != false;

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Add classroom' : 'Edit classroom'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: teacherId,
                  decoration: const InputDecoration(labelText: 'Teacher'),
                  items: [
                    for (final teacher in teachers)
                      DropdownMenuItem(
                        value: _safeString(teacher['id']),
                        child: Text(_safeString(teacher['full_name'],
                            fallback: 'Teacher')),
                      ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => teacherId = value ?? teacherId),
                ),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.adminClassNameField,
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Class name')),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.adminClassSubjectField,
                    controller: subject,
                    decoration: const InputDecoration(labelText: 'Subject')),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  isExpanded: true,
                  value: formLevel,
                  decoration: const InputDecoration(labelText: 'Form'),
                  items: const [
                    DropdownMenuItem(value: 4, child: Text('Form 4')),
                    DropdownMenuItem(value: 5, child: Text('Form 5')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => formLevel = value ?? formLevel),
                ),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.adminClassJoinCodeField,
                    controller: joinCode,
                    decoration:
                        const InputDecoration(labelText: 'Join code optional')),
                const SizedBox(height: 12),
                TextField(
                  key: AppTestKeys.adminClassDescriptionField,
                  controller: description,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                SwitchListTile(
                  value: isPublic,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Public classroom'),
                  onChanged: (value) => setDialogState(() => isPublic = value),
                ),
                SwitchListTile(
                  value: isActive,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active classroom'),
                  onChanged: (value) => setDialogState(() => isActive = value),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              key: AppTestKeys.adminClassSubmit,
              onPressed: () async {
                final payload = {
                  'teacherId': teacherId,
                  'name': name.text,
                  'description': description.text,
                  'subject': subject.text,
                  'formLevel': formLevel,
                  'joinCode': joinCode.text,
                  'isPublic': isPublic,
                  'isActive': isActive,
                };

                if (existing == null) {
                  await widget.api.post('/admin/classrooms', payload);
                } else {
                  await widget.api
                      .patch('/admin/classrooms/${existing['id']}', payload);
                }

                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: Text(existing == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showStudentsDialog(
      BuildContext context, Map<String, dynamic> classroom) async {
    Future<Map<String, dynamic>> studentsFuture =
        widget.api.get('/classroom/${classroom['id']}/students');

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => Dialog(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _safeString(classroom['name'],
                              fallback: 'Classroom students'),
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () async {
                      await _addStudentToClassroom(context, classroom);
                      setDialogState(() {
                        studentsFuture = widget.api
                            .get('/classroom/${classroom['id']}/students');
                      });
                      _refresh();
                    },
                    icon: const Icon(Icons.person_add_rounded),
                    label: const Text('Add student'),
                  ),
                  const SizedBox(height: 14),
                  FuturePanel(
                    future: studentsFuture,
                    builder: (data) {
                      final students = _asMapList(data['students']);
                      if (students.isEmpty) {
                        return const EmptyState(
                            text: 'No students enrolled in this classroom.');
                      }

                      return Column(
                        children: [
                          for (final student in students)
                            DataTile(
                              title: _safeString(student['full_name'],
                                  fallback: 'Student'),
                              subtitle: _safeString(student['email']),
                              details:
                                  '${_asInt(student['completed_lessons'])} completed lessons',
                              badge: 'Enrolled',
                              icon: Icons.school_rounded,
                              accent: AppTheme.green,
                              trailing: IconButton(
                                tooltip: 'Remove student',
                                onPressed: () async {
                                  await widget.api.delete(
                                      '/admin/classrooms/${classroom['id']}/students/${student['id']}');
                                  setDialogState(() {
                                    studentsFuture = widget.api.get(
                                        '/classroom/${classroom['id']}/students');
                                  });
                                  _refresh();
                                },
                                icon: const Icon(Icons.person_remove_rounded),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _addStudentToClassroom(
      BuildContext context, Map<String, dynamic> classroom) async {
    final studentsData =
        await widget.api.get('/admin/users?role=student&limit=200');
    final students = _asMapList(studentsData['users'])
        .where((student) => student['is_active'] == true)
        .toList();
    if (students.isEmpty || !context.mounted) return;

    var studentId = _safeString(students.first['id']);

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add student'),
          content: DropdownButtonFormField<String>(
            value: studentId,
            decoration: const InputDecoration(labelText: 'Student'),
            items: [
              for (final student in students)
                DropdownMenuItem(
                  value: _safeString(student['id']),
                  child: Text(
                      _safeString(student['full_name'], fallback: 'Student')),
                ),
            ],
            onChanged: (value) =>
                setDialogState(() => studentId = value ?? studentId),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                await widget.api.post(
                    '/admin/classrooms/${classroom['id']}/students',
                    {'studentId': studentId});
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleClassroom(Map<String, dynamic> classroom) async {
    await widget.api.patch('/admin/classrooms/${classroom['id']}', {
      'isActive': !(classroom['is_active'] == true),
    });
    if (mounted) _refresh();
  }
}

class SyllabusPage extends StatefulWidget {
  const SyllabusPage({required this.api, super.key});

  final ApiService api;

  @override
  State<SyllabusPage> createState() => _SyllabusPageState();
}

class _SyllabusPageState extends State<SyllabusPage> {
  late Future<Map<String, dynamic>> future = widget.api.get('/admin/syllabus');

  void _refresh() {
    setState(() {
      future = widget.api.get('/admin/syllabus');
    });
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Syllabus',
      subtitle: 'Global Form 4 and Form 5 content controlled by admins.',
      trailing: FilledButton.icon(
        key: AppTestKeys.syllabusAdd,
        onPressed: () => _showCreateSyllabus(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add item'),
      ),
      children: [
        FuturePanel(
          future: future,
          builder: (data) {
            final items = _asMapList(data['syllabus']);
            if (items.isEmpty)
              return const EmptyState(text: 'No syllabus items yet.');
            return Column(
              children: [
                for (final item in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: AppCard(
                      key: AppTestKeys.syllabusCard(item['id']),
                      accent: _subjectColor(_safeString(item['subject'])),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_safeString(item['topic'], fallback: 'Topic'),
                              style: Theme.of(context).textTheme.titleLarge),
                          const SizedBox(height: 6),
                          Text(
                            _joinNonEmpty([
                              _safeString(item['subject']),
                              _formLabel(item['form_level']),
                              _safeString(item['subtopic']),
                            ]),
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton.icon(
                                key: AppTestKeys.syllabusEdit(item['id']),
                                onPressed: () => _showCreateSyllabus(context,
                                    existing: item),
                                icon: const Icon(Icons.edit_rounded),
                                label: const Text('Edit'),
                              ),
                              OutlinedButton.icon(
                                key: AppTestKeys.syllabusDelete(item['id']),
                                onPressed: () async {
                                  await widget.api
                                      .delete('/admin/syllabus/${item['id']}');
                                  if (mounted) _refresh();
                                },
                                icon: const Icon(Icons.delete_outline_rounded),
                                label: const Text('Delete'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _showCreateSyllabus(BuildContext context,
      {Map<String, dynamic>? existing}) async {
    final subject = TextEditingController(
        text: _safeString(existing?['subject'], fallback: 'Mathematics'));
    final topic = TextEditingController(text: _safeString(existing?['topic']));
    final subtopic =
        TextEditingController(text: _safeString(existing?['subtopic']));
    int formLevel = _asInt(existing?['form_level']) == 5 ? 5 : 4;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
              existing == null ? 'Add syllabus item' : 'Edit syllabus item'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    key: AppTestKeys.syllabusSubjectField,
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
                      setDialogState(() => formLevel = value ?? 4),
                ),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.syllabusTopicField,
                    controller: topic,
                    decoration: const InputDecoration(labelText: 'Topic')),
                const SizedBox(height: 12),
                TextField(
                    key: AppTestKeys.syllabusSubtopicField,
                    controller: subtopic,
                    decoration: const InputDecoration(labelText: 'Subtopic')),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel')),
            FilledButton(
              key: AppTestKeys.syllabusSubmit,
              onPressed: () async {
                final payload = {
                  'subject': subject.text,
                  'formLevel': formLevel,
                  'topic': topic.text,
                  'subtopic': subtopic.text,
                  'orderIndex': _asInt(existing?['order_index']),
                  'content': {'summary': 'Created from Flutter web'},
                };
                if (existing == null) {
                  await widget.api.post('/admin/syllabus', payload);
                } else {
                  await widget.api
                      .patch('/admin/syllabus/${existing['id']}', payload);
                }
                if (mounted) {
                  _refresh();
                  Navigator.pop(context);
                }
              },
              child: Text(existing == null ? 'Add' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }
}

class LessonsPage extends StatefulWidget {
  const LessonsPage({required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  State<LessonsPage> createState() => _LessonsPageState();
}

class _LessonsPageState extends State<LessonsPage> {
  late Future<Map<String, dynamic>> future = _loadLessons();

  bool get isAdmin => widget.session.user.role == 'admin';
  bool get isTeacher => widget.session.user.role == 'teacher';
  bool get canAuthor => isAdmin || isTeacher;
  String get _lessonCollectionPath =>
      isAdmin ? '/admin/lessons' : '/learning/lessons';

  Future<Map<String, dynamic>> _loadLessons() {
    return widget.api.get(isAdmin ? '/admin/lessons' : '/learning/catalog');
  }

  void _refresh() {
    setState(() {
      future = _loadLessons();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Lessons',
      subtitle: isAdmin
          ? 'Create, edit, assign, and remove interactive lessons.'
          : 'Create your own lessons, preview the catalog, and assign content to your classrooms.',
      trailing: canAuthor
          ? FilledButton.icon(
              key: AppTestKeys.lessonsCreate,
              onPressed: () => _showLessonDialog(context),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Create lesson'),
            )
          : null,
      children: [
        FuturePanel(
          future: future,
          builder: (data) {
            final lessons = _asMapList(data['lessons']);
            if (lessons.isEmpty) {
              return const EmptyState(text: 'No lessons available yet.');
            }
            return Column(
              children: [
                for (final lesson in lessons)
                  Builder(builder: (context) {
                    final canEdit = _canEditLesson(lesson);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: AppCard(
                        key: AppTestKeys.lessonCard(lesson['id']),
                        accent: _subjectColor(_safeString(lesson['subject'])),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                _safeString(lesson['title'],
                                    fallback: 'Lesson'),
                                style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 6),
                            Text(
                              _joinNonEmpty([
                                _safeString(lesson['subject']),
                                _formLabel(lesson['form_level']),
                                _safeString(lesson['topic']),
                              ]),
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _safeString(_asMap(lesson['content'])['summary'],
                                  fallback: 'No summary yet.'),
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                StatusPill(
                                    label:
                                        '${_asInt(lesson['question_count'])} questions',
                                    color: AppTheme.blue),
                                if (isAdmin)
                                  StatusPill(
                                      label:
                                          '${_asInt(lesson['assigned_classrooms'])} classrooms',
                                      color: AppTheme.orange),
                                if (isTeacher && canEdit)
                                  const StatusPill(
                                      label: 'Your lesson',
                                      color: AppTheme.green),
                                OutlinedButton.icon(
                                  onPressed: () =>
                                      _showLessonPreview(context, lesson),
                                  icon: const Icon(Icons.visibility_rounded),
                                  label: const Text('Preview'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: () =>
                                      _showAssignDialog(context, lesson),
                                  icon: const Icon(
                                      Icons.assignment_turned_in_rounded),
                                  label: const Text('Assign'),
                                ),
                                if (canEdit)
                                  OutlinedButton.icon(
                                    key: AppTestKeys.lessonEdit(lesson['id']),
                                    onPressed: () => _showLessonDialog(context,
                                        existing: lesson),
                                    icon: const Icon(Icons.edit_rounded),
                                    label: const Text('Edit'),
                                  ),
                                if (canEdit)
                                  OutlinedButton.icon(
                                    key: AppTestKeys.lessonDelete(lesson['id']),
                                    onPressed: () => _deleteLesson(lesson),
                                    icon: const Icon(
                                        Icons.delete_outline_rounded),
                                    label: const Text('Delete'),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            );
          },
        ),
      ],
    );
  }

  bool _canEditLesson(Map<String, dynamic> lesson) {
    if (isAdmin) return true;
    return isTeacher &&
        _safeString(lesson['created_by']) == widget.session.user.id;
  }

  Future<void> _deleteLesson(Map<String, dynamic> lesson) async {
    await widget.api.delete('$_lessonCollectionPath/${lesson['id']}');
    if (mounted) _refresh();
  }

  Future<void> _showLessonPreview(
      BuildContext context, Map<String, dynamic> lesson) async {
    await showDialog<void>(
      context: context,
      builder: (context) => Dialog.fullscreen(
        child: AppLessonExperienceDialog(
          api: widget.api,
          lessonId: _safeString(lesson['id']),
          classroomId: _safeString(lesson['classroom_id']),
          readOnly: true,
        ),
      ),
    );
  }

  Future<void> _showAssignDialog(
      BuildContext context, Map<String, dynamic> lesson) async {
    final classroomsData = await widget.api.get('/classroom');
    final classrooms = _asMapList(classroomsData['classrooms']);
    if (classrooms.isEmpty || !context.mounted) return;

    String classroomId = _safeString(classrooms.first['id']);
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
              'Assign ${_safeString(lesson['title'], fallback: 'lesson')}'),
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
                await widget.api.post('/classroom/$classroomId/lessons', {
                  'lessonId': lesson['id'],
                  'isRequired': true,
                });
                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Assign'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showLessonDialog(BuildContext context,
      {Map<String, dynamic>? existing}) async {
    final syllabusData = await widget.api
        .get(isAdmin ? '/admin/syllabus' : '/learning/syllabus');
    final syllabusItems = _asMapList(syllabusData['syllabus']);
    if (syllabusItems.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Add syllabus content before lessons.')),
        );
      }
      return;
    }

    final detail = existing == null
        ? null
        : await widget.api.get(isAdmin
            ? '/admin/lessons/${existing['id']}'
            : '/learning/authoring/lessons/${existing['id']}');
    final lesson =
        detail == null ? <String, dynamic>{} : _asMap(detail['lesson']);
    final existingQuestions = detail == null
        ? const <Map<String, dynamic>>[]
        : _asMapList(detail['questions']);

    final rawSyllabusId = _safeString(lesson['syllabus_id'],
        fallback: syllabusItems.isNotEmpty
            ? _safeString(syllabusItems.first['id'])
            : '');
    String syllabusId =
        syllabusItems.any((item) => _safeString(item['id']) == rawSyllabusId)
            ? rawSyllabusId
            : _safeString(syllabusItems.first['id']);
    String difficulty = _safeString(lesson['difficulty'], fallback: 'medium');
    int estimatedMinutes = _asInt(lesson['estimated_minutes']) == 0
        ? 15
        : _asInt(lesson['estimated_minutes']);
    final title = TextEditingController(text: _safeString(lesson['title']));
    final summary = TextEditingController(
        text: _safeString(_asMap(lesson['content'])['summary']));
    final contentBlocks =
        LessonContentBlockDraft.fromContent(_asMap(lesson['content']));
    final questions = existingQuestions.isEmpty
        ? [AppLessonQuestionDraft()]
        : existingQuestions
            .map((q) => AppLessonQuestionDraft.fromLesson(q))
            .toList();

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Create lesson' : 'Edit lesson'),
          content: SizedBox(
            width: 620,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value: syllabusId.isEmpty && syllabusItems.isNotEmpty
                        ? _safeString(syllabusItems.first['id'])
                        : syllabusId,
                    items: [
                      for (final item in syllabusItems)
                        DropdownMenuItem(
                          value: _safeString(item['id']),
                          child: Text(_joinNonEmpty([
                            _safeString(item['subject']),
                            _formLabel(item['form_level']),
                            _safeString(item['topic']),
                          ])),
                        ),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => syllabusId = value ?? syllabusId),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                      key: AppTestKeys.lessonTitleField,
                      controller: title,
                      decoration:
                          const InputDecoration(labelText: 'Lesson title')),
                  const SizedBox(height: 12),
                  TextField(
                    key: AppTestKeys.lessonSummaryField,
                    controller: summary,
                    minLines: 2,
                    maxLines: 4,
                    decoration:
                        const InputDecoration(labelText: 'Lesson summary'),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: Text('Content sections',
                            style: Theme.of(context).textTheme.titleMedium),
                      ),
                      StatusPill(
                          label: '${contentBlocks.length} blocks',
                          color: AppTheme.green),
                    ],
                  ),
                  const SizedBox(height: 10),
                  for (int index = 0; index < contentBlocks.length; index++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: LessonContentBlockEditor(
                        block: contentBlocks[index],
                        index: index,
                        onUploadMedia: () async {
                          final attachment =
                              await pickMediaAttachment(context, widget.api);
                          if (attachment != null) {
                            setDialogState(() => contentBlocks[index]
                                .applyAttachment(attachment));
                          }
                        },
                        onRemove: () =>
                            setDialogState(() => contentBlocks.removeAt(index)),
                        onChanged: () => setDialogState(() {}),
                      ),
                    ),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => setDialogState(() => contentBlocks
                            .add(LessonContentBlockDraft.section())),
                        icon: const Icon(Icons.view_agenda_rounded),
                        label: const Text('Add section'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => setDialogState(() =>
                            contentBlocks.add(LessonContentBlockDraft.text())),
                        icon: const Icon(Icons.notes_rounded),
                        label: const Text('Add text'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () async {
                          final attachment =
                              await pickMediaAttachment(context, widget.api);
                          if (attachment != null) {
                            setDialogState(() => contentBlocks.add(
                                LessonContentBlockDraft.fromAttachment(
                                    attachment)));
                          }
                        },
                        icon: const Icon(Icons.perm_media_rounded),
                        label: const Text('Upload media'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => setDialogState(() =>
                            contentBlocks.add(LessonContentBlockDraft.embed())),
                        icon: const Icon(Icons.link_rounded),
                        label: const Text('Add embed'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value: difficulty,
                    items: const [
                      DropdownMenuItem(value: 'easy', child: Text('Easy')),
                      DropdownMenuItem(value: 'medium', child: Text('Medium')),
                      DropdownMenuItem(value: 'hard', child: Text('Hard')),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => difficulty = value ?? difficulty),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    isExpanded: true,
                    value: estimatedMinutes,
                    items: const [
                      DropdownMenuItem(value: 10, child: Text('10 minutes')),
                      DropdownMenuItem(value: 15, child: Text('15 minutes')),
                      DropdownMenuItem(value: 20, child: Text('20 minutes')),
                      DropdownMenuItem(value: 25, child: Text('25 minutes')),
                    ],
                    onChanged: (value) => setDialogState(
                        () => estimatedMinutes = value ?? estimatedMinutes),
                  ),
                  const SizedBox(height: 18),
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
                            TextFormField(
                              key: AppTestKeys.lessonQuestionText(index),
                              initialValue: questions[index].text,
                              decoration: const InputDecoration(
                                  labelText: 'Question text'),
                              onChanged: (value) =>
                                  questions[index].text = value,
                            ),
                            const SizedBox(height: 10),
                            DropdownButtonFormField<String>(
                              key: AppTestKeys.lessonQuestionType(index),
                              isExpanded: true,
                              value: questions[index].type,
                              items: [
                                for (final type in lessonExerciseTypeOptions)
                                  DropdownMenuItem(
                                    value: type,
                                    child: Text(_questionTypeLabel(type)),
                                  ),
                              ],
                              onChanged: (value) => setDialogState(() =>
                                  questions[index].type =
                                      value ?? questions[index].type),
                            ),
                            const SizedBox(height: 10),
                            if (_questionTypeUsesOptions(
                                questions[index].type)) ...[
                              TextFormField(
                                key: AppTestKeys.lessonQuestionOptions(index),
                                initialValue: questions[index].optionsText,
                                minLines: _questionTypeUsesLines(
                                        questions[index].type)
                                    ? 3
                                    : 1,
                                maxLines: _questionTypeUsesLines(
                                        questions[index].type)
                                    ? 5
                                    : 1,
                                decoration: InputDecoration(
                                    labelText: _questionOptionsLabel(
                                        questions[index].type)),
                                onChanged: (value) =>
                                    questions[index].optionsText = value,
                              ),
                              const SizedBox(height: 10),
                            ],
                            const SizedBox(height: 10),
                            TextFormField(
                              key: AppTestKeys.lessonQuestionAnswer(index),
                              initialValue: questions[index].correctAnswer,
                              minLines:
                                  _questionTypeUsesLines(questions[index].type)
                                      ? 2
                                      : 1,
                              maxLines:
                                  _questionTypeUsesLines(questions[index].type)
                                      ? 5
                                      : 1,
                              decoration: InputDecoration(
                                  labelText: _questionAnswerLabel(
                                      questions[index].type)),
                              onChanged: (value) =>
                                  questions[index].correctAnswer = value,
                            ),
                            const SizedBox(height: 10),
                            TextFormField(
                              key: AppTestKeys.lessonQuestionExplanation(index),
                              initialValue: questions[index].explanation,
                              decoration: const InputDecoration(
                                  labelText: 'Explanation'),
                              onChanged: (value) =>
                                  questions[index].explanation = value,
                            ),
                          ],
                        ),
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: () => setDialogState(
                        () => questions.add(AppLessonQuestionDraft())),
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
              key: AppTestKeys.lessonSubmit,
              onPressed: () async {
                final payload = {
                  'syllabusId': syllabusId,
                  'title': title.text,
                  'difficulty': difficulty,
                  'estimatedMinutes': estimatedMinutes,
                  'content': {
                    'summary': summary.text,
                    'blocks': [
                      for (final block in contentBlocks)
                        if (block.hasContent) block.toPayload(),
                    ],
                  },
                  'quizData': {
                    'questions': [
                      for (final question in questions
                          .where((item) => item.text.trim().isNotEmpty))
                        question.toPayload(),
                    ],
                  },
                };

                if (existing == null) {
                  await widget.api.post(_lessonCollectionPath, payload);
                } else {
                  await widget.api.patch(
                      '$_lessonCollectionPath/${existing['id']}', payload);
                }
                if (mounted) _refresh();
                if (context.mounted) Navigator.pop(context);
              },
              child: Text(existing == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }
}

class LessonAssignmentCard extends StatelessWidget {
  const LessonAssignmentCard({
    required this.lesson,
    required this.api,
    required this.onCompleted,
    super.key,
  });

  final Map<String, dynamic> lesson;
  final ApiService api;
  final VoidCallback onCompleted;

  @override
  Widget build(BuildContext context) {
    final accent = _subjectColor(_safeString(lesson['subject']));
    final compact = _isCompactLayout(context);
    final content = _asMap(lesson['content']);
    final completion = _asInt(lesson['completion_percentage']);
    final score = _asInt(lesson['score']);
    final isCompleted = lesson['is_completed'] == true;

    return Padding(
      padding: EdgeInsets.only(bottom: compact ? 8 : 12),
      child: AppCard(
        accent: accent,
        padding: EdgeInsets.all(compact ? 14 : 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_safeString(lesson['title'], fallback: 'Lesson'),
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 6),
                      Text(
                        _joinNonEmpty([
                          _safeString(lesson['subject']),
                          _formLabel(lesson['form_level']),
                          _safeString(lesson['classroom_name']),
                        ]),
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                if (_safeString(lesson['difficulty']).isNotEmpty)
                  StatusPill(
                      label: _safeString(lesson['difficulty']), color: accent),
              ],
            ),
            SizedBox(height: compact ? 8 : 10),
            Text(
              _safeString(content['summary'],
                  fallback: 'This lesson is ready to start.'),
              style: compact
                  ? Theme.of(context).textTheme.bodyMedium
                  : Theme.of(context).textTheme.bodyLarge,
            ),
            SizedBox(height: compact ? 10 : 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                StatusPill(label: '$completion% complete', color: accent),
                StatusPill(label: 'Score $score', color: AppTheme.blue),
                StatusPill(
                  label: isCompleted ? 'Completed' : 'Active',
                  color: isCompleted ? AppTheme.green : AppTheme.orange,
                ),
                if (_safeString(lesson['topic']).isNotEmpty)
                  FeatureChip(label: _safeString(lesson['topic'])),
              ],
            ),
            SizedBox(height: compact ? 12 : 16),
            LinearProgressIndicator(
              value: completion <= 0 ? 0 : math.min(1, completion / 100),
              minHeight: 8,
              borderRadius: BorderRadius.circular(999),
              color: accent,
            ),
            SizedBox(height: compact ? 12 : 16),
            FilledButton.icon(
              onPressed: () => _openLesson(context),
              icon: Icon(isCompleted
                  ? Icons.refresh_rounded
                  : Icons.play_arrow_rounded),
              label: Text(isCompleted ? 'Review and retry' : 'Start exercise'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openLesson(BuildContext context) async {
    final refreshed = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog.fullscreen(
        child: AppLessonExperienceDialog(
          api: api,
          lessonId: _safeString(lesson['id']),
          classroomId: _safeString(lesson['classroom_id']),
        ),
      ),
    );

    if (refreshed == true) {
      onCompleted();
    }
  }
}

class LessonContentBlockEditor extends StatelessWidget {
  const LessonContentBlockEditor({
    required this.block,
    required this.index,
    required this.onUploadMedia,
    required this.onRemove,
    required this.onChanged,
    super.key,
  });

  final LessonContentBlockDraft block;
  final int index;
  final Future<void> Function() onUploadMedia;
  final VoidCallback onRemove;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final isMedia =
        block.type == 'image' || block.type == 'video' || block.type == 'gif';
    final embedInfo =
        block.type == 'embed' ? externalVideoInfo(block.url) : null;
    return AppCard(
      accent: _lessonBlockColor(block.type),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Block ${index + 1}',
                    style: Theme.of(context).textTheme.titleMedium),
              ),
              IconButton(
                tooltip: 'Remove block',
                onPressed: onRemove,
                icon: const Icon(Icons.delete_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: block.type,
            items: const [
              DropdownMenuItem(value: 'section', child: Text('Section')),
              DropdownMenuItem(value: 'text', child: Text('Text / Markdown')),
              DropdownMenuItem(value: 'image', child: Text('Image')),
              DropdownMenuItem(value: 'video', child: Text('Video')),
              DropdownMenuItem(value: 'gif', child: Text('GIF')),
              DropdownMenuItem(value: 'embed', child: Text('Embedded URL')),
            ],
            onChanged: (value) {
              block.type = value ?? block.type;
              onChanged();
            },
          ),
          const SizedBox(height: 10),
          TextFormField(
            key: AppTestKeys.lessonBlockTitle(index),
            initialValue: block.title,
            decoration: InputDecoration(
              labelText: block.type == 'section' ? 'Section title' : 'Title',
            ),
            onChanged: (value) => block.title = value,
          ),
          const SizedBox(height: 10),
          if (block.type == 'text' || block.type == 'section')
            TextFormField(
              key: AppTestKeys.lessonBlockBody(index),
              initialValue: block.body,
              minLines: block.type == 'section' ? 2 : 4,
              maxLines: 8,
              decoration: const InputDecoration(
                  labelText: 'Content body (basic markdown supported)'),
              onChanged: (value) => block.body = value,
            )
          else
            TextFormField(
              initialValue: block.url,
              decoration: InputDecoration(
                labelText: block.type == 'embed'
                    ? 'YouTube, Vimeo, or Loom URL'
                    : 'Media URL',
              ),
              onChanged: (value) => block.url = value,
            ),
          if (block.type == 'embed' && block.url.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            embedInfo == null
                ? const Text(
                    'Use a supported YouTube, Vimeo, or Loom video URL.',
                    style: TextStyle(
                        color: AppTheme.red, fontWeight: FontWeight.w800),
                  )
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FeatureChip(label: embedInfo.providerName),
                      FeatureChip(label: embedInfo.videoId),
                    ],
                  ),
          ],
          if (isMedia) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: onUploadMedia,
              icon: const Icon(Icons.upload_file_rounded),
              label: const Text('Upload / replace media'),
            ),
          ],
          if (block.url.isNotEmpty) ...[
            const SizedBox(height: 10),
            MediaAttachmentGrid(
              attachments: [
                {
                  'type': block.type,
                  'url': block.url,
                  'name': block.title,
                }
              ],
              compact: true,
            ),
          ],
        ],
      ),
    );
  }
}

class LessonContentBlockCard extends StatelessWidget {
  const LessonContentBlockCard({
    required this.block,
    required this.index,
    required this.accent,
    super.key,
  });

  final Map<String, dynamic> block;
  final int index;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final type = _safeString(block['type'], fallback: 'text');
    final title = _safeString(block['title'],
        fallback: type == 'section' ? 'Section ${index + 1}' : 'Content');
    final body =
        _safeString(block['body'], fallback: _safeString(block['text']));
    final url =
        _safeString(block['url'], fallback: _safeString(block['embedUrl']));

    return AppCard(
      accent: _lessonBlockColor(type),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor:
                    _lessonBlockColor(type).withValues(alpha: 0.16),
                child: Icon(_lessonBlockIcon(type),
                    color: _lessonBlockColor(type)),
              ),
              const SizedBox(width: 12),
              Expanded(
                  child: Text(title,
                      style: Theme.of(context).textTheme.titleLarge)),
              StatusPill(label: _labelForLessonBlockType(type), color: accent),
            ],
          ),
          if (body.isNotEmpty) ...[
            const SizedBox(height: 14),
            SimpleMarkdownText(body),
          ],
          if (url.isNotEmpty) ...[
            const SizedBox(height: 14),
            if (type == 'embed')
              EmbeddedMediaCard(url: url, title: title)
            else
              MediaAttachmentGrid(
                attachments: [
                  {
                    'type': type,
                    'url': url,
                    'name': title,
                  }
                ],
              ),
          ],
        ],
      ),
    );
  }
}

class EmbeddedMediaCard extends StatelessWidget {
  const EmbeddedMediaCard({required this.url, required this.title, super.key});

  final String url;
  final String title;

  @override
  Widget build(BuildContext context) {
    final info = externalVideoInfo(url);
    final provider = info?.providerName ?? _providerFromUrl(url);
    if (info != null) {
      return ExternalVideoEmbed(url: url, title: title);
    }
    final uri = Uri.tryParse(url);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceSoft,
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: AppTheme.outlineStrong.withValues(alpha: 0.65)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppTheme.blue.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.play_circle_rounded, color: AppTheme.blue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                Text(provider.isEmpty ? url : provider,
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
          OutlinedButton.icon(
            onPressed: uri == null ? null : () => launchUrl(uri),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('Open'),
          ),
        ],
      ),
    );
  }
}

class SimpleMarkdownText extends StatelessWidget {
  const SimpleMarkdownText(this.text, {super.key});

  final String text;
  static final _unorderedListPattern = RegExp(r'^[-*]\s+(.+)$');
  static final _orderedListPattern = RegExp(r'^(\d+)\.\s+(.+)$');

  @override
  Widget build(BuildContext context) {
    final blocks = _markdownBlocks(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: blocks.isEmpty ? [const SizedBox.shrink()] : blocks,
    );
  }

  List<Widget> _markdownBlocks(BuildContext context) {
    final lines =
        _normalizeDisplayText(text).replaceAll('\r\n', '\n').split('\n');
    final blocks = <Widget>[];
    final paragraph = <String>[];
    var index = 0;

    void addBlock(Widget child, {double bottom = 8}) {
      blocks.add(Padding(
        padding: EdgeInsets.only(bottom: bottom),
        child: child,
      ));
    }

    void flushParagraph() {
      if (paragraph.isEmpty) return;
      addBlock(_richLine(context, paragraph.join(' ')));
      paragraph.clear();
    }

    while (index < lines.length) {
      final line = lines[index].trimRight();
      final trimmed = line.trim();

      if (trimmed.isEmpty) {
        flushParagraph();
        index++;
        continue;
      }

      if (trimmed.startsWith('```')) {
        flushParagraph();
        final codeLines = <String>[];
        index++;
        while (index < lines.length && !lines[index].trim().startsWith('```')) {
          codeLines.add(lines[index]);
          index++;
        }
        if (index < lines.length) index++;
        addBlock(_codeBlock(context, codeLines.join('\n')), bottom: 12);
        continue;
      }

      if (_isTableStart(lines, index)) {
        flushParagraph();
        final tableLines = <String>[];
        while (index < lines.length &&
            lines[index].trim().isNotEmpty &&
            lines[index].contains('|')) {
          tableLines.add(lines[index]);
          index++;
        }
        addBlock(_tableBlock(context, tableLines), bottom: 12);
        continue;
      }

      if (trimmed.startsWith('### ')) {
        flushParagraph();
        addBlock(_richLine(context, trimmed.substring(4),
            style: Theme.of(context).textTheme.titleMedium));
        index++;
        continue;
      }

      if (trimmed.startsWith('## ')) {
        flushParagraph();
        addBlock(_richLine(context, trimmed.substring(3),
            style: Theme.of(context).textTheme.titleLarge));
        index++;
        continue;
      }

      if (trimmed.startsWith('# ')) {
        flushParagraph();
        addBlock(_richLine(context, trimmed.substring(2),
            style: Theme.of(context).textTheme.headlineMedium));
        index++;
        continue;
      }

      if (_unorderedListPattern.hasMatch(trimmed)) {
        flushParagraph();
        final items = <String>[];
        while (index < lines.length) {
          final match = _unorderedListPattern.firstMatch(lines[index].trim());
          if (match == null) break;
          items.add(match.group(1) ?? '');
          index++;
        }
        addBlock(_listBlock(context, items), bottom: 10);
        continue;
      }

      if (_orderedListPattern.hasMatch(trimmed)) {
        flushParagraph();
        final items = <String>[];
        while (index < lines.length) {
          final match = _orderedListPattern.firstMatch(lines[index].trim());
          if (match == null) break;
          items.add(match.group(2) ?? '');
          index++;
        }
        addBlock(_listBlock(context, items, ordered: true), bottom: 10);
        continue;
      }

      if (trimmed.startsWith('>')) {
        flushParagraph();
        final quoteLines = <String>[];
        while (index < lines.length && lines[index].trim().startsWith('>')) {
          quoteLines
              .add(lines[index].trim().replaceFirst(RegExp(r'^>\s?'), ''));
          index++;
        }
        addBlock(_quoteBlock(context, quoteLines.join(' ')), bottom: 12);
        continue;
      }

      paragraph.add(trimmed);
      index++;
    }

    flushParagraph();
    return blocks;
  }

  Widget _richLine(BuildContext context, String line, {TextStyle? style}) {
    final baseStyle = style ?? Theme.of(context).textTheme.bodyLarge;
    return RichText(
      text: TextSpan(
        style: baseStyle,
        children: _inlineSpans(line, baseStyle),
      ),
    );
  }

  Widget _listBlock(BuildContext context, List<String> items,
      {bool ordered = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < items.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: ordered ? 28 : 20,
                  child: Text(
                    ordered ? '${i + 1}.' : '-',
                    style: Theme.of(context)
                        .textTheme
                        .bodyLarge
                        ?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                Expanded(child: _richLine(context, items[i])),
              ],
            ),
          ),
      ],
    );
  }

  Widget _quoteBlock(BuildContext context, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceSoft,
        border: Border(
          left: BorderSide(
            color: AppTheme.blue.withValues(alpha: 0.72),
            width: 3,
          ),
        ),
      ),
      child: _richLine(context, value),
    );
  }

  Widget _codeBlock(BuildContext context, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.outlineStrong),
      ),
      child: Text(
        value,
        style: const TextStyle(
          color: AppTheme.deepBlue,
          fontFamily: 'monospace',
          fontSize: 13,
          height: 1.45,
        ),
      ),
    );
  }

  Widget _tableBlock(BuildContext context, List<String> lines) {
    final rows = lines
        .where((line) => !_isTableDivider(line))
        .map(_splitTableRow)
        .where((row) => row.isNotEmpty)
        .toList();
    if (rows.isEmpty) return const SizedBox.shrink();

    final columnCount = rows.map((row) => row.length).fold<int>(0, math.max);
    final normalizedRows = [
      for (final row in rows)
        [
          ...row,
          for (var i = row.length; i < columnCount; i++) '',
        ],
    ];

    return Table(
      border: TableBorder.all(color: AppTheme.outlineStrong),
      defaultVerticalAlignment: TableCellVerticalAlignment.middle,
      columnWidths: {
        for (var index = 0; index < columnCount; index++)
          index: const FlexColumnWidth(),
      },
      children: [
        for (var rowIndex = 0; rowIndex < normalizedRows.length; rowIndex++)
          TableRow(
            decoration: BoxDecoration(
              color:
                  rowIndex == 0 ? AppTheme.surfaceElevated : Colors.transparent,
            ),
            children: [
              for (final cell in normalizedRows[rowIndex])
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: _richLine(
                    context,
                    cell,
                    style: rowIndex == 0
                        ? Theme.of(context)
                            .textTheme
                            .bodyLarge
                            ?.copyWith(fontWeight: FontWeight.w900)
                        : Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
            ],
          ),
      ],
    );
  }

  List<TextSpan> _inlineSpans(String input, TextStyle? baseStyle) {
    final spans = <TextSpan>[];
    var index = 0;

    void addPlain(String value) {
      if (value.isNotEmpty) spans.add(TextSpan(text: value));
    }

    while (index < input.length) {
      if (input.startsWith('**', index) || input.startsWith('__', index)) {
        final marker = input.substring(index, index + 2);
        final end = input.indexOf(marker, index + 2);
        if (end > index) {
          spans.add(TextSpan(
            text: input.substring(index + 2, end),
            style: baseStyle?.copyWith(fontWeight: FontWeight.w900),
          ));
          index = end + 2;
          continue;
        }
      }

      if (input[index] == '`') {
        final end = input.indexOf('`', index + 1);
        if (end > index) {
          spans.add(TextSpan(
            text: input.substring(index + 1, end),
            style: baseStyle?.copyWith(
              fontFamily: 'monospace',
              backgroundColor: AppTheme.surfaceElevated,
              color: AppTheme.yellow,
            ),
          ));
          index = end + 1;
          continue;
        }
      }

      if (input[index] == '[') {
        final labelEnd = input.indexOf(']', index + 1);
        final urlStart = labelEnd + 1;
        if (labelEnd > index &&
            urlStart < input.length &&
            input[urlStart] == '(') {
          final urlEnd = input.indexOf(')', urlStart + 1);
          if (urlEnd > urlStart) {
            spans.add(TextSpan(
              text: input.substring(index + 1, labelEnd),
              style: baseStyle?.copyWith(
                color: AppTheme.blue,
                decoration: TextDecoration.underline,
              ),
            ));
            index = urlEnd + 1;
            continue;
          }
        }
      }

      if (input[index] == '*' && !input.startsWith('**', index)) {
        final end = input.indexOf('*', index + 1);
        if (end > index) {
          spans.add(TextSpan(
            text: input.substring(index + 1, end),
            style: baseStyle?.copyWith(fontStyle: FontStyle.italic),
          ));
          index = end + 1;
          continue;
        }
      }

      final next = _nextInlineMarker(input, index + 1);
      addPlain(input.substring(index, next));
      index = next;
    }

    return spans;
  }

  int _nextInlineMarker(String input, int start) {
    final candidates = <int>[
      input.indexOf('**', start),
      input.indexOf('__', start),
      input.indexOf('`', start),
      input.indexOf('*', start),
      input.indexOf('[', start),
    ].where((index) => index >= 0).toList();
    if (candidates.isEmpty) return input.length;
    return candidates.reduce(math.min);
  }

  bool _isTableStart(List<String> lines, int index) {
    if (index + 1 >= lines.length) return false;
    return lines[index].contains('|') && _isTableDivider(lines[index + 1]);
  }

  bool _isTableDivider(String line) {
    final trimmed = line.trim();
    return trimmed.contains('|') &&
        trimmed.contains('-') &&
        RegExp(r'^[\s|:-]+$').hasMatch(trimmed);
  }

  List<String> _splitTableRow(String line) {
    var value = line.trim();
    if (value.startsWith('|')) value = value.substring(1);
    if (value.endsWith('|')) value = value.substring(0, value.length - 1);
    return value.split('|').map((cell) => cell.trim()).toList();
  }

  Widget _markdownLine(BuildContext context, String rawLine) {
    final line = rawLine.trimRight();
    if (line.trim().isEmpty) return const SizedBox(height: 4);
    if (line.startsWith('### ')) {
      return Text(line.substring(4),
          style: Theme.of(context).textTheme.titleMedium);
    }
    if (line.startsWith('## ')) {
      return Text(line.substring(3),
          style: Theme.of(context).textTheme.titleLarge);
    }
    if (line.startsWith('# ')) {
      return Text(line.substring(2),
          style: Theme.of(context).textTheme.headlineMedium);
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(fontWeight: FontWeight.w900)),
          Expanded(
              child: Text(line.substring(2),
                  style: Theme.of(context).textTheme.bodyLarge)),
        ],
      );
    }
    return Text(line, style: Theme.of(context).textTheme.bodyLarge);
  }
}

class AppLessonExperienceDialog extends StatefulWidget {
  const AppLessonExperienceDialog({
    required this.api,
    required this.lessonId,
    this.classroomId = '',
    this.readOnly = false,
    super.key,
  });

  final ApiService api;
  final String lessonId;
  final String classroomId;
  final bool readOnly;

  @override
  State<AppLessonExperienceDialog> createState() =>
      _AppLessonExperienceDialogState();
}

class _AppLessonExperienceDialogState extends State<AppLessonExperienceDialog> {
  late Future<Map<String, dynamic>> future = _loadLesson();
  final Map<String, dynamic> answers = {};
  final DateTime startedAt = DateTime.now();
  bool submitting = false;
  bool contentReviewed = false;

  Future<Map<String, dynamic>> _loadLesson() {
    final query = widget.classroomId.trim().isEmpty
        ? ''
        : '?classroomId=${Uri.encodeComponent(widget.classroomId)}';
    return widget.api.get('/learning/lessons/${widget.lessonId}$query');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(widget.readOnly ? 'Lesson preview' : 'Lesson exercise'),
        actions: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: AppCard(
                  child: Text(
                    _friendlyError(snapshot.error),
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(color: AppTheme.red),
                  ),
                ),
              ),
            );
          }

          final data = snapshot.data ?? {};
          final lesson = _asMap(data['lesson']);
          final questions = _asMapList(data['questions']);
          final progress = _asMap(data['progress']);
          final content = _asMap(lesson['content']);
          final contentBlocks = lessonContentBlocks(content);
          final accent = _subjectColor(_safeString(lesson['subject']));
          final progressContentReviewed =
              _safeString(progress['content_reviewed_at']).isNotEmpty &&
                  _asInt(progress['content_block_count']) >=
                      contentBlocks.length;
          final exerciseUnlocked = widget.readOnly ||
              contentBlocks.isEmpty ||
              contentReviewed ||
              progressContentReviewed;

          return ListView(
            padding: const EdgeInsets.all(22),
            children: [
              AppCard(
                accent: accent,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_safeString(lesson['title'], fallback: 'Lesson'),
                        style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 8),
                    Text(
                      _joinNonEmpty([
                        _safeString(lesson['subject']),
                        _formLabel(lesson['form_level']),
                        _safeString(lesson['classroom_name']),
                      ]),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _safeString(content['summary'],
                          fallback:
                              'No summary available for this lesson yet.'),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        if (_safeString(lesson['difficulty']).isNotEmpty)
                          StatusPill(
                              label: _safeString(lesson['difficulty']),
                              color: accent),
                        if (_asInt(lesson['estimated_minutes']) > 0)
                          StatusPill(
                              label:
                                  '${_asInt(lesson['estimated_minutes'])} min',
                              color: AppTheme.blue),
                        StatusPill(
                            label: '${questions.length} questions',
                            color: AppTheme.orange),
                        if (_safeString(lesson['topic']).isNotEmpty)
                          FeatureChip(label: _safeString(lesson['topic'])),
                        if (_safeString(lesson['subtopic']).isNotEmpty)
                          FeatureChip(label: _safeString(lesson['subtopic'])),
                      ],
                    ),
                    if (progress.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          StatusPill(
                              label: 'Last score ${_asInt(progress['score'])}',
                              color: AppTheme.green),
                          StatusPill(
                              label: 'Attempts ${_asInt(progress['attempts'])}',
                              color: AppTheme.coral),
                          StatusPill(
                            label: progress['is_completed'] == true
                                ? 'Completed'
                                : 'In progress',
                            color: progress['is_completed'] == true
                                ? AppTheme.green
                                : AppTheme.orange,
                          ),
                          if (progressContentReviewed &&
                              contentBlocks.isNotEmpty)
                            StatusPill(
                                label: 'Content reviewed',
                                color: AppTheme.blue),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (contentBlocks.isNotEmpty) ...[
                for (int index = 0; index < contentBlocks.length; index++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: LessonContentBlockCard(
                      block: contentBlocks[index],
                      index: index,
                      accent: accent,
                    ),
                  ),
                if (!widget.readOnly)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: exerciseUnlocked
                        ? AppCard(
                            accent: AppTheme.green,
                            child: Row(
                              children: [
                                const Icon(Icons.lock_open_rounded,
                                    color: AppTheme.green),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text('Exercise section unlocked',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium),
                                ),
                              ],
                            ),
                          )
                        : FilledButton.icon(
                            onPressed: () =>
                                setState(() => contentReviewed = true),
                            icon: const Icon(Icons.visibility_rounded),
                            label: const Text('I reviewed the content'),
                          ),
                  ),
              ],
              if (questions.isEmpty)
                const EmptyState(
                    text: 'This lesson does not have any exercises yet.')
              else if (!exerciseUnlocked)
                const EmptyState(
                    text:
                        'Review the lesson content blocks before starting the exercise.')
              else
                for (int index = 0; index < questions.length; index++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _LessonQuestionCard(
                      index: index,
                      question: questions[index],
                      readOnly: widget.readOnly,
                      currentAnswer:
                          answers[_safeString(questions[index]['id'])],
                      onChanged: (value) => setState(() =>
                          answers[_safeString(questions[index]['id'])] = value),
                    ),
                  ),
              if (!widget.readOnly &&
                  questions.isNotEmpty &&
                  exerciseUnlocked) ...[
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: submitting
                      ? null
                      : () => _submit(
                            questions,
                            contentBlocks.length,
                            progressContentReviewed,
                          ),
                  icon: submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_circle_rounded),
                  label: Text(submitting ? 'Submitting...' : 'Submit exercise'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _submit(List<Map<String, dynamic>> questions,
      int contentBlockCount, bool alreadyReviewedContent) async {
    setState(() => submitting = true);
    try {
      final timeSpentSeconds = DateTime.now().difference(startedAt).inSeconds;
      final response =
          await widget.api.post('/learning/lessons/${widget.lessonId}/submit', {
        'classroomId': widget.classroomId,
        'answers': [
          for (final question in questions)
            if (answers.containsKey(_safeString(question['id'])))
              {
                'questionId': _safeString(question['id']),
                'answer': answers[_safeString(question['id'])],
              },
        ],
        'timeSpentSeconds': timeSpentSeconds,
        'contentReviewed':
            contentBlockCount == 0 || contentReviewed || alreadyReviewedContent,
        'contentBlockCount': contentBlockCount,
        'contentReviewSeconds': timeSpentSeconds,
      });

      final result = _asMap(response['result']);
      if (!mounted) return;

      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Exercise complete'),
          content: AppCard(
            accent: AppTheme.green,
            backgroundColor: Colors.transparent,
            padding: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Score ${_asInt(result['score'])}',
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 8),
                  Text(
                    '${_asInt(result['correctAnswers'])} of ${_asInt(result['totalQuestions'])} answers correct',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _asInt(result['isCompleted']) == 1 ||
                            result['isCompleted'] == true
                        ? 'Nice work. This lesson is marked complete.'
                        : 'Some questions are still unanswered, but your progress has been saved.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      );

      if (mounted) Navigator.pop(context, true);
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    } finally {
      if (mounted) {
        setState(() => submitting = false);
      }
    }
  }
}

class _LessonQuestionCard extends StatelessWidget {
  const _LessonQuestionCard({
    required this.index,
    required this.question,
    required this.readOnly,
    required this.currentAnswer,
    required this.onChanged,
  });

  final int index;
  final Map<String, dynamic> question;
  final bool readOnly;
  final dynamic currentAnswer;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    final type =
        _safeString(question['question_type'], fallback: 'multiple_choice');
    final options = _choiceOptions(question);
    final explanation = _safeString(question['explanation']);

    return AppCard(
      accent: AppTheme.blue,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('Question ${index + 1}',
                  style: Theme.of(context).textTheme.titleMedium),
              StatusPill(label: _questionTypeLabel(type), color: AppTheme.blue),
            ],
          ),
          const SizedBox(height: 10),
          Text(
              _safeString(question['question_text'],
                  fallback: 'Untitled question'),
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 14),
          _answerControl(context, type, options),
          if (explanation.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(explanation, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }

  Widget _answerControl(
      BuildContext context, String type, List<String> options) {
    if (_pairExerciseTypes.contains(type)) {
      return _PairMatchExercise(
        pairs: _questionPairs(question),
        readOnly: readOnly,
        currentAnswer: _asStringMap(currentAnswer),
        onChanged: onChanged,
      );
    }

    if (type == 'step_order') {
      return _StepOrderExercise(
        steps: _stepOptions(question),
        readOnly: readOnly,
        currentAnswer: _asStringList(currentAnswer),
        onChanged: onChanged,
      );
    }

    if (type == 'numeric' || _freeTextExerciseTypes.contains(type)) {
      return TextFormField(
        initialValue: _safeString(currentAnswer),
        readOnly: readOnly,
        keyboardType: type == 'numeric'
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.text,
        minLines: type == 'numeric' || type == 'fill_blank' ? 1 : 3,
        maxLines: type == 'numeric' || type == 'fill_blank' ? 1 : 5,
        onChanged: onChanged,
        decoration: const InputDecoration(labelText: 'Your answer'),
      );
    }

    if (options.isEmpty) {
      return TextFormField(
        initialValue: _safeString(currentAnswer),
        readOnly: readOnly,
        onChanged: onChanged,
        decoration: const InputDecoration(labelText: 'Your answer'),
      );
    }

    return Column(
      children: [
        for (final option in options)
          RadioListTile<String>(
            value: option,
            groupValue: _safeString(currentAnswer),
            onChanged: readOnly ? null : onChanged,
            title: Text(option),
            contentPadding: EdgeInsets.zero,
          ),
      ],
    );
  }

  static List<String> _choiceOptions(Map<String, dynamic> question) {
    final raw = question['options'];
    if (raw is List) {
      final values = raw
          .map((item) {
            if (item is Map) {
              return _safeString(item['label'] ??
                  item['text'] ??
                  item['value'] ??
                  item['answer'] ??
                  item['step']);
            }
            return _safeString(item);
          })
          .where((item) => item.isNotEmpty)
          .toList();
      if (values.isNotEmpty) return values;
    }

    if (_safeString(question['question_type']) == 'true_false') {
      return const ['True', 'False'];
    }

    return const [];
  }
}

class _QuestionPair {
  const _QuestionPair({required this.prompt, required this.answer});

  final String prompt;
  final String answer;
}

class _PairMatchExercise extends StatelessWidget {
  const _PairMatchExercise({
    required this.pairs,
    required this.readOnly,
    required this.currentAnswer,
    required this.onChanged,
  });

  final List<_QuestionPair> pairs;
  final bool readOnly;
  final Map<String, String> currentAnswer;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    if (pairs.isEmpty) {
      return TextFormField(
        readOnly: readOnly,
        initialValue: jsonEncode(currentAnswer),
        onChanged: onChanged,
        decoration: const InputDecoration(labelText: 'Your answer'),
      );
    }

    final choices = pairs.map((pair) => pair.answer).toSet().toList().reversed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final pair in pairs)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(pair.prompt,
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: choices.contains(currentAnswer[pair.prompt])
                      ? currentAnswer[pair.prompt]
                      : null,
                  items: [
                    for (final choice in choices)
                      DropdownMenuItem(value: choice, child: Text(choice)),
                  ],
                  onChanged: readOnly
                      ? null
                      : (value) {
                          final next = Map<String, String>.from(currentAnswer);
                          if (value == null) {
                            next.remove(pair.prompt);
                          } else {
                            next[pair.prompt] = value;
                          }
                          onChanged(next);
                        },
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _StepOrderExercise extends StatelessWidget {
  const _StepOrderExercise({
    required this.steps,
    required this.readOnly,
    required this.currentAnswer,
    required this.onChanged,
  });

  final List<String> steps;
  final bool readOnly;
  final List<String> currentAnswer;
  final ValueChanged<dynamic> onChanged;

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) {
      return TextFormField(
        readOnly: readOnly,
        initialValue: currentAnswer.join('\n'),
        minLines: 3,
        maxLines: 5,
        onChanged: onChanged,
        decoration: const InputDecoration(labelText: 'Your answer'),
      );
    }

    final selected = currentAnswer
        .where((item) => steps.contains(item))
        .toList(growable: false);
    final available = _practiceOrder(steps)
        .where((step) => !selected.contains(step))
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (int index = 0; index < selected.length; index++)
              InputChip(
                label: Text('${index + 1}. ${selected[index]}'),
                onDeleted: readOnly
                    ? null
                    : () {
                        final next = List<String>.from(selected)
                          ..removeAt(index);
                        onChanged(next);
                      },
              ),
          ],
        ),
        if (selected.isNotEmpty) const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final step in available)
              ActionChip(
                label: Text(step),
                onPressed:
                    readOnly ? null : () => onChanged([...selected, step]),
              ),
          ],
        ),
        if (selected.isNotEmpty && !readOnly) ...[
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () => onChanged(<String>[]),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Clear order'),
          ),
        ],
      ],
    );
  }
}

const lessonExerciseTypeOptions = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'matching',
  'representation_match',
  'missing_step',
  'step_order',
  'numeric',
  'diagram_label',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
];

const _pairExerciseTypes = {
  'matching',
  'representation_match',
  'diagram_label',
};

const _freeTextExerciseTypes = {
  'fill_blank',
  'missing_step',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
};

bool _questionTypeUsesOptions(String type) =>
    type == 'multiple_choice' ||
    type == 'true_false' ||
    type == 'step_order' ||
    _pairExerciseTypes.contains(type);

bool _questionTypeUsesLines(String type) =>
    type == 'step_order' || _pairExerciseTypes.contains(type);

String _questionOptionsLabel(String type) {
  if (_pairExerciseTypes.contains(type)) return 'Pairs';
  if (type == 'step_order') return 'Steps';
  return 'Options';
}

String _questionAnswerLabel(String type) {
  if (type == 'numeric') return 'Correct value';
  if (type == 'step_order') return 'Correct order';
  if (_pairExerciseTypes.contains(type)) return 'Correct pairs';
  return 'Correct answer';
}

String _questionTypeLabel(String type) {
  switch (type) {
    case 'true_false':
      return 'True / False';
    case 'fill_blank':
      return 'Fill blank';
    case 'matching':
      return 'Matching pairs';
    case 'representation_match':
      return 'Representation match';
    case 'missing_step':
      return 'Missing step';
    case 'step_order':
      return 'Step ordering';
    case 'numeric':
      return 'Numeric answer';
    case 'diagram_label':
      return 'Diagram labeling';
    case 'error_diagnosis':
      return 'Error diagnosis';
    case 'prediction':
      return 'Prediction';
    case 'code_trace':
      return 'Code trace';
    case 'data_interpret':
      return 'Data interpretation';
    case 'scenario':
      return 'Scenario';
    default:
      return 'Multiple choice';
  }
}

Map<String, String> _asStringMap(dynamic value) {
  if (value is Map) {
    return value.map(
        (key, mapValue) => MapEntry(_safeString(key), _safeString(mapValue)))
      ..removeWhere((key, mapValue) => key.isEmpty || mapValue.isEmpty);
  }
  return {};
}

List<String> _stepOptions(Map<String, dynamic> question) {
  final raw = question['options'];
  if (raw is List) {
    return raw
        .map((item) {
          if (item is Map) {
            return _safeString(
                item['step'] ?? item['text'] ?? item['label'] ?? item['value']);
          }
          return _safeString(item);
        })
        .where((item) => item.isNotEmpty)
        .toList();
  }

  return _asStringList(raw);
}

List<String> _practiceOrder(List<String> steps) {
  if (steps.length < 2) return steps;
  return steps.reversed.toList();
}

List<_QuestionPair> _questionPairs(Map<String, dynamic> question) {
  return _pairsFromValue(question['options']);
}

List<_QuestionPair> _pairsFromValue(dynamic value) {
  if (value is List) {
    return [
      for (final item in value) ..._pairsFromValue(item),
    ];
  }

  if (value is Map) {
    if (value['pairs'] is List) return _pairsFromValue(value['pairs']);
    final prompt = _safeString(
        value['prompt'] ?? value['left'] ?? value['label'] ?? value['term']);
    final answer = _safeString(
        value['answer'] ?? value['right'] ?? value['value'] ?? value['match']);
    if (prompt.isNotEmpty || answer.isNotEmpty) {
      return prompt.isNotEmpty && answer.isNotEmpty
          ? [_QuestionPair(prompt: prompt, answer: answer)]
          : const [];
    }

    return [
      for (final entry in value.entries)
        if (_safeString(entry.key).isNotEmpty &&
            _safeString(entry.value).isNotEmpty)
          _QuestionPair(
              prompt: _safeString(entry.key), answer: _safeString(entry.value)),
    ];
  }

  return _safeString(value)
      .split(RegExp(r'\r?\n|;'))
      .map(_pairFromLine)
      .whereType<_QuestionPair>()
      .toList();
}

_QuestionPair? _pairFromLine(String line) {
  final match = RegExp(r'\s*(?:=|->|:)\s*').firstMatch(line);
  if (match == null) return null;
  final prompt = line.substring(0, match.start).trim();
  final answer = line.substring(match.end).trim();
  if (prompt.isEmpty || answer.isEmpty) return null;
  return _QuestionPair(prompt: prompt, answer: answer);
}

dynamic _correctAnswerPayload(String type, String answerText, dynamic options) {
  final answer = answerText.trim();

  if (_pairExerciseTypes.contains(type)) {
    if (answer.isNotEmpty) {
      final pairs = _pairsFromValue(answer);
      if (pairs.isNotEmpty) {
        return {
          for (final pair in pairs) pair.prompt: pair.answer,
        };
      }
    }
    return {
      for (final pair in _pairsFromValue(options)) pair.prompt: pair.answer,
    };
  }

  if (type == 'step_order') {
    final steps =
        answer.isEmpty ? _asStringList(options) : _asStringList(answer);
    return steps;
  }

  return answer;
}

class AppLessonQuestionDraft {
  AppLessonQuestionDraft({
    this.text = '',
    this.type = 'multiple_choice',
    this.optionsText = '',
    this.correctAnswer = '',
    this.explanation = '',
  });

  String text;
  String type;
  String optionsText;
  String correctAnswer;
  String explanation;

  factory AppLessonQuestionDraft.fromLesson(Map<String, dynamic> question) {
    final rawOptions = question['options'];
    final type =
        _safeString(question['question_type'], fallback: 'multiple_choice');
    final options = _optionsTextForQuestionType(type, rawOptions);

    return AppLessonQuestionDraft(
      text: _safeString(question['question_text']),
      type: type,
      optionsText: options,
      correctAnswer: _answerText(question['correct_answer']),
      explanation: _safeString(question['explanation']),
    );
  }

  Map<String, dynamic> toPayload() {
    final options = _optionList(type, optionsText);

    return {
      'text': text.trim(),
      'questionText': text.trim(),
      'type': type,
      'questionType': type,
      'options': options,
      'correctAnswer': _correctAnswerPayload(type, correctAnswer, options),
      'explanation': explanation.trim().isEmpty ? null : explanation.trim(),
      'points': 1,
    };
  }

  static dynamic _optionList(String type, String optionsText) {
    if (!_questionTypeUsesOptions(type) || type == 'true_false') {
      return type == 'true_false' ? const ['True', 'False'] : const [];
    }

    if (_pairExerciseTypes.contains(type)) {
      return [
        for (final pair in _pairsFromValue(optionsText))
          {'prompt': pair.prompt, 'answer': pair.answer},
      ];
    }

    final options = type == 'step_order'
        ? _asStringList(optionsText)
        : optionsText
            .split(',')
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList();

    return options;
  }

  static String _optionsTextForQuestionType(String type, dynamic rawOptions) {
    if (_pairExerciseTypes.contains(type)) {
      return _pairsFromValue(rawOptions)
          .map((pair) => '${pair.prompt} = ${pair.answer}')
          .join('\n');
    }

    if (type == 'step_order') {
      return _asStringList(rawOptions).join('\n');
    }

    if (rawOptions is List) {
      return rawOptions
          .map((item) {
            if (item is Map) {
              return _safeString(item['label'] ??
                  item['text'] ??
                  item['value'] ??
                  item['answer'] ??
                  item['step']);
            }
            return _safeString(item);
          })
          .where((item) => item.isNotEmpty)
          .join(', ');
    }

    return _safeString(rawOptions);
  }
}

class SystemPage extends StatelessWidget {
  const SystemPage({required this.api, super.key});

  final ApiService api;

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'System',
      subtitle: 'Self-hosted services status.',
      children: [
        FuturePanel(
            future: api.get('/health'),
            builder: (data) => _SystemHealthCards(data: data)),
        const SizedBox(height: 22),
        FuturePanel(
            future: api.get('/admin/stats'),
            builder: (data) => _SystemStatsCards(stats: _asMap(data['stats']))),
      ],
    );
  }
}

class _SystemHealthCards extends StatelessWidget {
  const _SystemHealthCards({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final status = _safeString(data['status'], fallback: 'unknown');
    final database = _safeString(data['database'], fallback: 'unknown');
    final redis = _safeString(data['redis'], fallback: 'unknown');
    final checkedAt = _safeString(data['timestamp']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SystemSectionTitle(
          title: 'Service health',
          subtitle: checkedAt.isEmpty ? 'Current backend status.' : checkedAt,
        ),
        const SizedBox(height: 12),
        ResponsiveGrid(
          minWidth: 170,
          children: [
            StatCard(
                label: 'API',
                value: status,
                color: _statusColor(status),
                icon: Icons.api_rounded,
                surface: AppTheme.mint),
            StatCard(
                label: 'Database',
                value: database,
                color: _statusColor(database),
                icon: Icons.storage_rounded,
                surface: AppTheme.skySurface),
            StatCard(
                label: 'Redis',
                value: redis,
                color: _statusColor(redis),
                icon: Icons.memory_rounded,
                surface: AppTheme.peach),
          ],
        ),
      ],
    );
  }
}

class _SystemStatsCards extends StatelessWidget {
  const _SystemStatsCards({required this.stats});

  final Map<String, dynamic> stats;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SystemSectionTitle(
          title: 'Platform totals',
          subtitle: 'Active users, learning content, and recent activity.',
        ),
        const SizedBox(height: 12),
        ResponsiveGrid(
          minWidth: 170,
          children: [
            StatCard(
                label: 'Active users',
                value: '${_asInt(stats['active_users'])}',
                color: AppTheme.green,
                icon: Icons.verified_user_rounded,
                surface: AppTheme.mint),
            StatCard(
                label: 'Inactive',
                value: '${_asInt(stats['inactive_users'])}',
                color: AppTheme.muted,
                icon: Icons.block_rounded,
                surface: AppTheme.surfaceElevated),
            StatCard(
                label: 'Students',
                value: '${_asInt(stats['total_students'])}',
                color: AppTheme.blue,
                icon: Icons.school_rounded,
                surface: AppTheme.skySurface),
            StatCard(
                label: 'Teachers',
                value: '${_asInt(stats['total_teachers'])}',
                color: AppTheme.orange,
                icon: Icons.groups_rounded,
                surface: AppTheme.peach),
            StatCard(
                label: 'Parents',
                value: '${_asInt(stats['total_parents'])}',
                color: AppTheme.coral,
                icon: Icons.family_restroom_rounded,
                surface: AppTheme.rose),
            StatCard(
                label: 'Classes',
                value: '${_asInt(stats['active_classrooms'])}',
                color: AppTheme.blue,
                icon: Icons.meeting_room_rounded,
                surface: AppTheme.skySurface),
            StatCard(
                label: 'Lessons',
                value: '${_asInt(stats['total_lessons'])}',
                color: AppTheme.yellow,
                icon: Icons.menu_book_rounded,
                surface: AppTheme.cream),
            StatCard(
                label: 'Today',
                value: '${_asInt(stats['activities_today'])}',
                color: AppTheme.coral,
                icon: Icons.bolt_rounded,
                surface: AppTheme.rose),
          ],
        ),
      ],
    );
  }
}

class _SystemSectionTitle extends StatelessWidget {
  const _SystemSectionTitle({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

Color _statusColor(String status) {
  final normalized = status.toLowerCase();
  if (normalized == 'healthy' || normalized == 'connected') {
    return AppTheme.blue;
  }
  if (normalized == 'degraded' || normalized == 'warning') {
    return AppTheme.orange;
  }
  return AppTheme.red;
}

class PageShell extends StatelessWidget {
  const PageShell(
      {required this.title,
      required this.subtitle,
      required this.children,
      this.trailing,
      super.key});

  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final compact = _isCompactLayout(context);
    return ListView(
      padding: EdgeInsets.fromLTRB(
        compact ? 4 : 22,
        compact ? 2 : 22,
        compact ? 4 : 22,
        compact ? 88 : 22,
      ),
      children: [
        Container(
          padding: EdgeInsets.all(compact ? 16 : 24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF171027), Color(0xFF23183B)],
            ),
            borderRadius: BorderRadius.circular(compact ? 20 : 28),
            border: Border.all(color: AppTheme.outlineStrong, width: 1.2),
            boxShadow: const [
              BoxShadow(
                  color: AppTheme.shadow, blurRadius: 22, offset: Offset(0, 10))
            ],
          ),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 16,
            runSpacing: 16,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: compact
                            ? Theme.of(context).textTheme.headlineMedium
                            : Theme.of(context).textTheme.headlineLarge),
                    SizedBox(height: compact ? 4 : 6),
                    Text(subtitle,
                        style: (compact
                                ? Theme.of(context).textTheme.bodyMedium
                                : Theme.of(context).textTheme.bodyLarge)
                            ?.copyWith(
                                color: AppTheme.ink.withValues(alpha: 0.78))),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
        SizedBox(height: compact ? 12 : 24),
        ...children,
      ],
    );
  }
}

class FuturePanel extends StatelessWidget {
  const FuturePanel({required this.future, required this.builder, super.key});

  final Future<Map<String, dynamic>> future;
  final Widget Function(Map<String, dynamic>) builder;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const AppCard(
              child: Center(child: CircularProgressIndicator()));
        }
        if (snapshot.hasError) {
          return AppCard(
              child: Text(_friendlyError(snapshot.error),
                  style: const TextStyle(color: AppTheme.red)));
        }
        return builder(snapshot.data ?? {});
      },
    );
  }
}

class StatGrid extends StatelessWidget {
  const StatGrid({super.key});

  @override
  Widget build(BuildContext context) {
    return const ResponsiveGrid(
      minWidth: 180,
      children: [
        StatCard(
            label: 'Daily XP',
            value: '120',
            color: AppTheme.yellow,
            icon: Icons.bolt_rounded,
            surface: AppTheme.cream),
        StatCard(
            label: 'Streak',
            value: '7',
            color: AppTheme.orange,
            icon: Icons.local_fire_department_rounded,
            surface: AppTheme.peach),
        StatCard(
            label: 'Lessons',
            value: '18',
            color: AppTheme.green,
            icon: Icons.check_circle_rounded,
            surface: AppTheme.mint),
        StatCard(
            label: 'Rank',
            value: 'Gold',
            color: AppTheme.blue,
            icon: Icons.emoji_events_rounded,
            surface: AppTheme.skySurface),
      ],
    );
  }
}

class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid(
      {required this.children, this.minWidth = 240, super.key});

  final List<Widget> children;
  final double minWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final count = (constraints.maxWidth / minWidth).floor().clamp(1, 4);
        final compact = _isCompactLayout(context);
        final spacing = compact ? 10.0 : 14.0;
        final totalSpacing = spacing * (count - 1);
        final itemWidth = count == 1
            ? constraints.maxWidth
            : (constraints.maxWidth - totalSpacing) / count;
        final itemHeight = count == 1 && compact ? 112.0 : itemWidth / 1.45;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children)
              SizedBox(
                width: itemWidth,
                height: itemHeight,
                child: child,
              ),
          ],
        );
      },
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    required this.surface,
    super.key,
  });

  final String label;
  final String value;
  final Color color;
  final IconData icon;
  final Color surface;

  @override
  Widget build(BuildContext context) {
    final compact = _isCompactLayout(context);
    return AppCard(
      accent: color,
      backgroundColor: surface,
      padding: EdgeInsets.all(compact ? 12 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: compact ? 42 : 48,
                height: compact ? 42 : 48,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceSoft,
                  borderRadius: BorderRadius.circular(compact ? 14 : 16),
                  border: Border.all(
                      color: AppTheme.outlineStrong.withValues(alpha: 0.62)),
                ),
                child: Icon(icon, color: color, size: compact ? 24 : 28),
              ),
              const Spacer(),
              StatusPill(label: label, color: color),
            ],
          ),
          const Spacer(),
          Text(value, style: Theme.of(context).textTheme.headlineMedium),
        ],
      ),
    );
  }
}

class LessonContentBlockDraft {
  LessonContentBlockDraft({
    required this.type,
    this.title = '',
    this.body = '',
    this.url = '',
    this.fileId = '',
    this.mimeType = '',
    this.provider = '',
  });

  String type;
  String title;
  String body;
  String url;
  String fileId;
  String mimeType;
  String provider;

  bool get hasContent =>
      title.trim().isNotEmpty ||
      body.trim().isNotEmpty ||
      url.trim().isNotEmpty ||
      fileId.trim().isNotEmpty;

  factory LessonContentBlockDraft.section() => LessonContentBlockDraft(
        type: 'section',
        title: 'New section',
      );

  factory LessonContentBlockDraft.text() =>
      LessonContentBlockDraft(type: 'text', title: 'Explanation');

  factory LessonContentBlockDraft.embed() =>
      LessonContentBlockDraft(type: 'embed', title: 'Embedded media');

  factory LessonContentBlockDraft.fromAttachment(
      Map<String, dynamic> attachment) {
    return LessonContentBlockDraft(
      type: _attachmentType(attachment),
      title: _safeString(attachment['name'],
          fallback: _attachmentTypeLabel(attachment)),
      url: _safeString(attachment['url']),
      fileId: _safeString(attachment['fileId']),
      mimeType: _safeString(attachment['mimeType']),
      provider: _safeString(attachment['provider']),
    );
  }

  factory LessonContentBlockDraft.fromJson(Map<String, dynamic> json) {
    return LessonContentBlockDraft(
      type: _safeString(json['type'], fallback: 'text'),
      title: _safeString(json['title']),
      body: _safeString(json['body'], fallback: _safeString(json['text'])),
      url: _safeString(json['url'], fallback: _safeString(json['embedUrl'])),
      fileId: _safeString(json['fileId']),
      mimeType: _safeString(json['mimeType']),
      provider: _safeString(json['provider']),
    );
  }

  static List<LessonContentBlockDraft> fromContent(
      Map<String, dynamic> content) {
    final blocks = _asMapList(content['blocks'])
        .map((item) => LessonContentBlockDraft.fromJson(item))
        .toList();
    if (blocks.isNotEmpty) return blocks;

    final summary = _safeString(content['summary']);
    if (summary.isEmpty) return [LessonContentBlockDraft.text()];
    return [
      LessonContentBlockDraft(
        type: 'text',
        title: 'Overview',
        body: summary,
      )
    ];
  }

  void applyAttachment(Map<String, dynamic> attachment) {
    type = _attachmentType(attachment);
    title = _safeString(attachment['name'], fallback: title);
    url = _safeString(attachment['url']);
    fileId = _safeString(attachment['fileId']);
    mimeType = _safeString(attachment['mimeType']);
    provider = _safeString(attachment['provider']);
  }

  Map<String, dynamic> toPayload() {
    final embedInfo = type == 'embed' ? externalVideoInfo(url) : null;
    return {
      'type': type,
      'title': title,
      'body': body,
      'url': embedInfo?.originalUri.toString() ?? url,
      if (embedInfo != null) 'embedUrl': embedInfo.embedUri.toString(),
      'fileId': fileId,
      'mimeType': embedInfo != null ? 'text/html' : mimeType,
      'provider': embedInfo?.provider ?? provider,
      if (embedInfo != null) 'providerName': embedInfo.providerName,
      if (embedInfo != null) 'providerVideoId': embedInfo.videoId,
      if (embedInfo?.thumbnailUri != null)
        'thumbnailUrl': embedInfo!.thumbnailUri.toString(),
    };
  }
}

class LessonCard extends StatelessWidget {
  const LessonCard(
      {required this.subject,
      required this.form,
      required this.progress,
      required this.color,
      super.key});

  final String subject;
  final String form;
  final double progress;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      accent: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                  backgroundColor: color.withValues(alpha: 0.15),
                  child: Icon(Icons.school_rounded, color: color)),
              const Spacer(),
              StatusPill(label: '${(progress * 100).round()}%', color: color),
            ],
          ),
          const Spacer(),
          Text(subject, style: Theme.of(context).textTheme.titleLarge),
          Text(form, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 10),
          LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              borderRadius: BorderRadius.circular(99),
              color: color),
        ],
      ),
    );
  }
}

class SkillPathCard extends StatelessWidget {
  const SkillPathCard({required this.track, super.key});

  final SyllabusTrack track;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: AppCard(
        accent: track.color,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                    backgroundColor: track.color.withValues(alpha: 0.16),
                    child: Icon(track.icon, color: track.color)),
                const SizedBox(width: 12),
                Expanded(
                    child: Text(track.title,
                        style: Theme.of(context).textTheme.titleLarge)),
                StatusPill(label: track.form, color: track.color),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final skill in track.skills) FeatureChip(label: skill),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    this.accent,
    this.backgroundColor,
    this.padding = const EdgeInsets.all(18),
    this.expandChild = false,
    super.key,
  });

  final Widget child;
  final Color? accent;
  final Color? backgroundColor;
  final EdgeInsetsGeometry padding;
  final bool expandChild;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? AppTheme.surfaceRaised,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
            color: AppTheme.outlineStrong.withValues(alpha: 0.8), width: 1.2),
        boxShadow: const [
          BoxShadow(
              color: AppTheme.shadow, blurRadius: 22, offset: Offset(0, 10))
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Column(
          mainAxisSize: expandChild ? MainAxisSize.max : MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (accent != null)
              Container(
                height: 8,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [accent!, accent!.withValues(alpha: 0.52)],
                  ),
                ),
              ),
            if (expandChild)
              Expanded(child: Padding(padding: padding, child: child))
            else
              Padding(padding: padding, child: child),
          ],
        ),
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({required this.title, required this.action, super.key});

  final String title;
  final String action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child:
                Text(title, style: Theme.of(context).textTheme.headlineMedium)),
        StatusPill(label: action, color: AppTheme.blue),
      ],
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({required this.label, required this.color, super.key});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label,
          style: GoogleFonts.nunito(
              color: color, fontWeight: FontWeight.w900, fontSize: 12)),
    );
  }
}

class FilterOption {
  const FilterOption({required this.value, required this.label});

  final String value;
  final String label;
}

class FilterChips extends StatelessWidget {
  const FilterChips({
    required this.value,
    required this.options,
    required this.onChanged,
    super.key,
  });

  final String value;
  final List<FilterOption> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final option in options)
          ChoiceChip(
            label: Text(option.label),
            selected: value == option.value,
            onSelected: (_) => onChanged(option.value),
          ),
      ],
    );
  }
}

class FeatureChip extends StatelessWidget {
  const FeatureChip(
      {required this.label, this.color = AppTheme.surfaceElevated, super.key});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color,
        border: Border.all(
            color: AppTheme.outlineStrong.withValues(alpha: 0.86), width: 1.2),
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
              color: AppTheme.shadow, blurRadius: 12, offset: Offset(0, 6))
        ],
      ),
      child: Text(label,
          style: GoogleFonts.nunito(
              fontWeight: FontWeight.w900, color: AppTheme.deepBlue)),
    );
  }
}

class DataTile extends StatelessWidget {
  const DataTile({
    required this.title,
    required this.subtitle,
    required this.badge,
    this.details = '',
    this.icon = Icons.star_rounded,
    this.accent = AppTheme.blue,
    this.trailing,
    super.key,
  });

  final String title;
  final String subtitle;
  final String badge;
  final String details;
  final IconData icon;
  final Color accent;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final compact = _isCompactLayout(context);
    return Padding(
      padding: EdgeInsets.only(bottom: compact ? 8 : 12),
      child: AppCard(
        accent: accent,
        padding: EdgeInsets.all(compact ? 12 : 18),
        child: Row(
          children: [
            Container(
              width: compact ? 42 : 54,
              height: compact ? 42 : 54,
              decoration: BoxDecoration(
                color: AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(compact ? 14 : 18),
              ),
              child: Icon(icon, color: accent, size: compact ? 22 : 24),
            ),
            SizedBox(width: compact ? 10 : 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                  if (details.trim().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(details,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ],
              ),
            ),
            if (trailing != null)
              trailing!
            else if (badge.isNotEmpty)
              StatusPill(label: badge, color: accent),
          ],
        ),
      ),
    );
  }
}

class ProgressOverview extends StatelessWidget {
  const ProgressOverview({
    required this.title,
    required this.subtitle,
    required this.data,
    this.accent = AppTheme.green,
    this.compact = false,
    super.key,
  });

  final String title;
  final String subtitle;
  final Map<String, dynamic> data;
  final Color accent;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final overall = _asMap(data['overall']);
    final bySubject = _asMapList(data['bySubject']);
    final streak = _asMap(data['streak']);
    final quiz = _asMap(data['quiz']);
    final recentSessions = _asMapList(quiz['recentSessions']);

    return AppCard(
      accent: accent,
      padding: EdgeInsets.all(compact ? 14 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          SizedBox(height: compact ? 4 : 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          SizedBox(height: compact ? 12 : 18),
          ResponsiveGrid(
            minWidth: 170,
            children: [
              StatCard(
                label: 'Attempted',
                value: '${_asInt(overall['total_lessons_attempted'])}',
                color: AppTheme.blue,
                icon: Icons.play_circle_fill_rounded,
                surface: AppTheme.skySurface,
              ),
              StatCard(
                label: 'Completed',
                value: '${_asInt(overall['lessons_completed'])}',
                color: AppTheme.green,
                icon: Icons.check_circle_rounded,
                surface: AppTheme.mint,
              ),
              StatCard(
                label: 'Avg score',
                value: _formatNumber(overall['average_score']),
                color: AppTheme.orange,
                icon: Icons.analytics_rounded,
                surface: AppTheme.peach,
              ),
              StatCard(
                label: 'Streak',
                value: '${_asInt(streak['current'])}',
                color: AppTheme.coral,
                icon: Icons.local_fire_department_rounded,
                surface: AppTheme.rose,
              ),
              StatCard(
                label: 'Quiz XP',
                value: '${_asInt(quiz['quizXpTotal'])}',
                color: AppTheme.yellow,
                icon: Icons.emoji_events_rounded,
                surface: AppTheme.cream,
              ),
            ],
          ),
          if (bySubject.isNotEmpty) ...[
            SizedBox(height: compact ? 12 : 18),
            Text('By subject', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: compact ? 8 : 12),
            for (final item in bySubject)
              DataTile(
                title: _safeString(item['subject'], fallback: 'Subject'),
                subtitle: 'Average score ${_formatNumber(item['avg_score'])}',
                details: 'Completion ${_formatNumber(item['avg_completion'])}%',
                badge: '${_asInt(item['lessons_count'])} lessons',
                icon: Icons.menu_book_rounded,
                accent: _subjectColor(_safeString(item['subject'])),
              ),
          ],
          if (recentSessions.isNotEmpty) ...[
            SizedBox(height: compact ? 12 : 18),
            Text('Recent quiz sessions',
                style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: compact ? 8 : 12),
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
                icon: Icons.quiz_rounded,
                accent: AppTheme.yellow,
              ),
          ],
        ],
      ),
    );
  }
}

class AttachmentDraftList extends StatelessWidget {
  const AttachmentDraftList({
    required this.attachments,
    required this.onRemove,
    this.compact = false,
    super.key,
  });

  final List<Map<String, dynamic>> attachments;
  final ValueChanged<int> onRemove;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (attachments.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (int i = 0; i < attachments.length; i++)
          InputChip(
            avatar: Icon(_attachmentIcon(attachments[i]), size: 18),
            label: Text(
              _safeString(attachments[i]['name'],
                  fallback: _attachmentTypeLabel(attachments[i])),
            ),
            onDeleted: () => onRemove(i),
            visualDensity:
                compact ? VisualDensity.compact : VisualDensity.standard,
          ),
      ],
    );
  }
}

class MediaAttachmentGrid extends StatelessWidget {
  const MediaAttachmentGrid({
    required this.attachments,
    this.compact = false,
    super.key,
  });

  final List<Map<String, dynamic>> attachments;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (attachments.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: EdgeInsets.only(top: compact ? 8 : 12),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final attachment in attachments)
            SizedBox(
              width: _attachmentType(attachment) == 'embed'
                  ? (compact ? 260 : 420)
                  : (compact ? 180 : 260),
              child: MediaAttachmentTile(
                attachment: attachment,
                compact: compact,
              ),
            ),
        ],
      ),
    );
  }
}

class MediaAttachmentTile extends StatelessWidget {
  const MediaAttachmentTile({
    required this.attachment,
    this.compact = false,
    super.key,
  });

  final Map<String, dynamic> attachment;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final type = _attachmentType(attachment);
    final url = _resolveMediaUrl(_safeString(
      attachment['url'],
      fallback: _safeString(attachment['embedUrl']),
    ));
    final title = _safeString(attachment['name'],
        fallback: _attachmentTypeLabel(attachment));
    final height = compact ? 116.0 : 172.0;

    if (type == 'embed' && url.isNotEmpty && supportsInlineExternalVideo(url)) {
      return ExternalVideoEmbed(url: url, title: title);
    }

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppTheme.surfaceSoft,
        borderRadius: BorderRadius.circular(18),
        border:
            Border.all(color: AppTheme.outlineStrong.withValues(alpha: 0.65)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if ((type == 'image' || type == 'gif') && url.isNotEmpty)
            Image.network(
              url,
              height: height,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) =>
                  _MediaFallback(icon: _attachmentIcon(attachment), type: type),
            )
          else if (type == 'video' && url.isNotEmpty)
            SizedBox(
              height: height,
              child: MediaVideoPlayer(url: url),
            )
          else
            SizedBox(
              height: compact ? 88 : 126,
              child:
                  _MediaFallback(icon: _attachmentIcon(attachment), type: type),
            ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Icon(_attachmentIcon(attachment),
                    color: _attachmentColor(type), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium),
                ),
                if (url.isNotEmpty && type != 'video')
                  IconButton(
                    tooltip: 'Open media',
                    onPressed: () => launchUrl(Uri.parse(url)),
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaFallback extends StatelessWidget {
  const _MediaFallback({required this.icon, required this.type});

  final IconData icon;
  final String type;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      color: AppTheme.surfaceElevated,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: _attachmentColor(type), size: 34),
          const SizedBox(height: 8),
          Text(_labelForAttachmentType(type),
              style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class MediaVideoPlayer extends StatefulWidget {
  const MediaVideoPlayer({required this.url, super.key});

  final String url;

  @override
  State<MediaVideoPlayer> createState() => _MediaVideoPlayerState();
}

class _MediaVideoPlayerState extends State<MediaVideoPlayer> {
  late final VideoPlayerController controller =
      VideoPlayerController.networkUrl(Uri.parse(widget.url));
  late final Future<void> future = controller.initialize();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return const _MediaFallback(icon: Icons.movie_rounded, type: 'video');
        }

        return Stack(
          alignment: Alignment.center,
          children: [
            AspectRatio(
              aspectRatio: controller.value.aspectRatio == 0
                  ? 16 / 9
                  : controller.value.aspectRatio,
              child: VideoPlayer(controller),
            ),
            IconButton.filled(
              onPressed: () {
                setState(() {
                  controller.value.isPlaying
                      ? controller.pause()
                      : controller.play();
                });
              },
              icon: Icon(controller.value.isPlaying
                  ? Icons.pause_rounded
                  : Icons.play_arrow_rounded),
            ),
          ],
        );
      },
    );
  }
}

Future<Map<String, dynamic>?> pickMediaAttachment(
    BuildContext context, ApiService api) async {
  try {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'mp4',
        'mov',
        'webm',
        'pdf',
      ],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return null;

    final file = result.files.single;
    final bytes = file.bytes;
    if (bytes == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('This file could not be read.')),
        );
      }
      return null;
    }

    final uploaded = await api.uploadBytes(filename: file.name, bytes: bytes);
    return {
      'type':
          _safeString(uploaded['type'], fallback: _typeFromFilename(file.name)),
      'url': _safeString(uploaded['url']),
      'fileId': _safeString(uploaded['fileId'],
          fallback: _safeString(uploaded['id'])),
      'name': _safeString(uploaded['name'], fallback: file.name),
      'mimeType': _safeString(uploaded['mimeType']),
      'size': _asInt(uploaded['size']),
    };
  } on DioException catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(_errorMessage(error))));
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$error')));
    }
  }
  return null;
}

Future<Map<String, dynamic>?> promptGifAttachment(BuildContext context) async {
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Add GIF or media URL'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(
          labelText: 'Giphy, Tenor, image, or video URL',
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('Add'),
        ),
      ],
    ),
  );
  controller.dispose();

  if (result == null || result.isEmpty) return null;
  final type = _typeFromUrl(result);
  final videoInfo = externalVideoInfo(result);
  return {
    'type': type,
    'url': videoInfo?.originalUri.toString() ?? result,
    if (videoInfo != null) 'embedUrl': videoInfo.embedUri.toString(),
    'name': videoInfo != null
        ? '${videoInfo.providerName} video'
        : type == 'gif'
            ? 'GIF reaction'
            : _labelForAttachmentType(type),
    'provider': videoInfo?.provider ?? _providerFromUrl(result),
    if (videoInfo != null) 'providerName': videoInfo.providerName,
    if (videoInfo != null) 'providerVideoId': videoInfo.videoId,
    if (videoInfo?.thumbnailUri != null)
      'thumbnailUrl': videoInfo!.thumbnailUri.toString(),
  };
}

class FeedPostCard extends StatefulWidget {
  const FeedPostCard({
    required this.api,
    required this.session,
    required this.post,
    this.editable = false,
    this.onEdit,
    this.onDelete,
    this.onChanged,
    super.key,
  });

  final ApiService api;
  final LocalSession session;
  final Map<String, dynamic> post;
  final bool editable;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onChanged;

  @override
  State<FeedPostCard> createState() => _FeedPostCardState();
}

class _FeedPostCardState extends State<FeedPostCard> {
  late Map<String, dynamic> post;
  late Future<Map<String, dynamic>> commentsFuture;
  final comment = TextEditingController();
  final commentAttachments = <Map<String, dynamic>>[];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    post = Map<String, dynamic>.from(widget.post);
    commentsFuture = _loadComments();
  }

  @override
  void didUpdateWidget(covariant FeedPostCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_safeString(oldWidget.post['id']) != _safeString(widget.post['id'])) {
      post = Map<String, dynamic>.from(widget.post);
      commentsFuture = _loadComments();
    }
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _loadComments() {
    return widget.api.get('/feed/posts/${post['id']}/comments');
  }

  @override
  Widget build(BuildContext context) {
    final isPinned = post['is_pinned'] == true;
    final accent = isPinned
        ? AppTheme.yellow
        : _subjectColor(_safeString(post['classroom_subject']));
    final hasLiked = _safeString(post['my_reaction']) == 'like';
    final teacherId = _safeString(post['author_id']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        key: AppTestKeys.postCard(post['id']),
        accent: accent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  _safeString(post['title'], fallback: 'Classroom update'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                StatusPill(
                  label: _safeString(post['classroom_name'],
                      fallback: 'Classroom'),
                  color: accent,
                ),
                if (isPinned)
                  StatusPill(label: 'Pinned', color: AppTheme.yellow),
              ],
            ),
            const SizedBox(height: 10),
            Text(_safeString(post['content'], fallback: 'No content'),
                style: Theme.of(context).textTheme.bodyLarge),
            MediaAttachmentGrid(
                attachments: _attachmentList(post['attachments'])),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FeatureChip(
                    label:
                        'By ${_safeString(post['author_name'], fallback: 'Teacher')}'),
                FeatureChip(
                    label: _safeString(post['post_type'],
                        fallback: 'announcement')),
                if (_safeString(post['author_headline']).isNotEmpty)
                  FeatureChip(label: _safeString(post['author_headline'])),
                if (_safeString(post['student_name']).isNotEmpty)
                  FeatureChip(label: _safeString(post['student_name'])),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                hasLiked
                    ? FilledButton.icon(
                        onPressed: busy ? null : _toggleLike,
                        icon: const Icon(Icons.favorite_rounded),
                        label: Text('${_asInt(post['like_count'])}'),
                      )
                    : OutlinedButton.icon(
                        onPressed: busy ? null : _toggleLike,
                        icon: const Icon(Icons.favorite_border_rounded),
                        label: Text('${_asInt(post['like_count'])}'),
                      ),
                OutlinedButton.icon(
                  onPressed: null,
                  icon: const Icon(Icons.mode_comment_rounded),
                  label: Text('${_asInt(post['comment_count'])}'),
                ),
                if (teacherId.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () => TeacherProfileDialog.show(
                      context,
                      api: widget.api,
                      teacherId: teacherId,
                    ),
                    icon: const Icon(Icons.person_rounded),
                    label: const Text('Teacher'),
                  ),
                if (widget.editable) ...[
                  OutlinedButton.icon(
                    key: AppTestKeys.postEdit(post['id']),
                    onPressed: widget.onEdit,
                    icon: const Icon(Icons.edit_rounded),
                    label: const Text('Edit'),
                  ),
                  OutlinedButton.icon(
                    key: AppTestKeys.postDelete(post['id']),
                    onPressed: widget.onDelete,
                    icon: const Icon(Icons.delete_outline_rounded),
                    label: const Text('Delete'),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
            FutureBuilder<Map<String, dynamic>>(
              future: commentsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const LinearProgressIndicator(minHeight: 6);
                }
                if (snapshot.hasError) {
                  return Text(_friendlyError(snapshot.error),
                      style: const TextStyle(
                          color: AppTheme.red, fontWeight: FontWeight.w800));
                }

                final comments = _asMapList(snapshot.data?['comments']);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (comments.isEmpty)
                      Text('No comments yet.',
                          style: Theme.of(context).textTheme.bodyMedium)
                    else
                      for (final item in comments)
                        _PostCommentRow(
                          comment: item,
                          canDelete: widget.session.user.role == 'admin' ||
                              _safeString(item['user_id']) ==
                                  widget.session.user.id ||
                              _safeString(post['author_id']) ==
                                  widget.session.user.id,
                          onDelete: () => _deleteComment(item),
                        ),
                    const SizedBox(height: 10),
                    AttachmentDraftList(
                      attachments: commentAttachments,
                      compact: true,
                      onRemove: (index) =>
                          setState(() => commentAttachments.removeAt(index)),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            key: AppTestKeys.postCommentInput(post['id']),
                            controller: comment,
                            minLines: 1,
                            maxLines: 3,
                            decoration: const InputDecoration(
                              labelText: 'Write a comment',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        IconButton.outlined(
                          tooltip: 'Attach media',
                          onPressed: busy
                              ? null
                              : () async {
                                  final attachment = await pickMediaAttachment(
                                      context, widget.api);
                                  if (attachment != null) {
                                    setState(() =>
                                        commentAttachments.add(attachment));
                                  }
                                },
                          icon: const Icon(Icons.attach_file_rounded),
                        ),
                        const SizedBox(width: 8),
                        IconButton.outlined(
                          tooltip: 'Add GIF URL',
                          onPressed: busy
                              ? null
                              : () async {
                                  final attachment =
                                      await promptGifAttachment(context);
                                  if (attachment != null) {
                                    setState(() =>
                                        commentAttachments.add(attachment));
                                  }
                                },
                          icon: const Icon(Icons.gif_box_rounded),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          key: AppTestKeys.postCommentSubmit(post['id']),
                          onPressed: busy ? null : _submitComment,
                          icon: const Icon(Icons.send_rounded),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleLike() async {
    setState(() => busy = true);
    try {
      final data = _safeString(post['my_reaction']) == 'like'
          ? await widget.api.delete('/feed/posts/${post['id']}/reaction')
          : await widget.api.post(
              '/feed/posts/${post['id']}/reaction', {'reactionType': 'like'});
      _applyEngagement(_asMap(data['engagement']));
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _submitComment() async {
    final text = comment.text.trim();
    if (text.isEmpty && commentAttachments.isEmpty) return;

    setState(() => busy = true);
    try {
      await widget.api.post('/feed/posts/${post['id']}/comments', {
        'content': text,
        'attachments': commentAttachments,
      });
      comment.clear();
      setState(() {
        commentAttachments.clear();
        post['comment_count'] = _asInt(post['comment_count']) + 1;
        commentsFuture = _loadComments();
      });
      widget.onChanged?.call();
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _deleteComment(Map<String, dynamic> item) async {
    setState(() => busy = true);
    try {
      await widget.api.delete('/feed/comments/${item['id']}');
      setState(() {
        post['comment_count'] = math.max(0, _asInt(post['comment_count']) - 1);
        commentsFuture = _loadComments();
      });
      widget.onChanged?.call();
    } on DioException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage(error))),
      );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _applyEngagement(Map<String, dynamic> engagement) {
    setState(() {
      post['like_count'] = _asInt(engagement['like_count']);
      post['comment_count'] = _asInt(engagement['comment_count']);
      post['my_reaction'] = engagement['my_reaction'];
    });
    widget.onChanged?.call();
  }
}

class _PostCommentRow extends StatelessWidget {
  const _PostCommentRow({
    required this.comment,
    required this.canDelete,
    required this.onDelete,
  });

  final Map<String, dynamic> comment;
  final bool canDelete;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final role = _safeString(comment['author_role']);
    return Container(
      key: AppTestKeys.commentRow(comment['id']),
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceSoft,
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: AppTheme.outlineStrong.withValues(alpha: 0.58)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: _roleAccent(role).withValues(alpha: 0.18),
            child:
                Icon(Icons.person_rounded, color: _roleAccent(role), size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_safeString(comment['author_name'], fallback: 'User'),
                    style: Theme.of(context).textTheme.titleMedium),
                Text(_safeString(comment['content']),
                    style: Theme.of(context).textTheme.bodyMedium),
                MediaAttachmentGrid(
                    attachments: _attachmentList(comment['attachments']),
                    compact: true),
              ],
            ),
          ),
          if (canDelete)
            IconButton(
              key: AppTestKeys.commentDelete(comment['id']),
              tooltip: 'Delete comment',
              onPressed: onDelete,
              icon: const Icon(Icons.delete_outline_rounded),
            ),
        ],
      ),
    );
  }
}

class TeacherProfileDialog extends StatelessWidget {
  const TeacherProfileDialog({
    required this.api,
    required this.teacherId,
    super.key,
  });

  final ApiService api;
  final String teacherId;

  static Future<void> show(
    BuildContext context, {
    required ApiService api,
    required String teacherId,
  }) {
    return showDialog<void>(
      context: context,
      builder: (context) => TeacherProfileDialog(
        api: api,
        teacherId: teacherId,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Teacher profile',
                        style: Theme.of(context).textTheme.headlineMedium),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FuturePanel(
                future: api.get('/profile/teachers/$teacherId'),
                builder: (data) =>
                    TeacherProfileView(profile: _asMap(data['profile'])),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TeacherProfilePage extends StatefulWidget {
  const TeacherProfilePage(
      {required this.api, required this.session, super.key});

  final ApiService api;
  final LocalSession session;

  @override
  State<TeacherProfilePage> createState() => _TeacherProfilePageState();
}

class _TeacherProfilePageState extends State<TeacherProfilePage> {
  late Future<Map<String, dynamic>> future = widget.api.get('/profile/me');

  void _refresh() {
    setState(() {
      future = widget.api.get('/profile/me');
    });
  }

  @override
  Widget build(BuildContext context) {
    return PageShell(
      title: 'Profile',
      subtitle: 'What students see when they inspect your teacher page.',
      trailing: FilledButton.icon(
        onPressed: () => _showEditProfile(context),
        icon: const Icon(Icons.edit_rounded),
        label: const Text('Edit profile'),
      ),
      children: [
        FuturePanel(
          future: future,
          builder: (data) =>
              TeacherProfileView(profile: _asMap(data['profile'])),
        ),
      ],
    );
  }

  Future<void> _showEditProfile(BuildContext context) async {
    final data = await widget.api.get('/profile/me');
    if (!context.mounted) return;

    final profile = _asMap(data['profile']);
    final headline =
        TextEditingController(text: _safeString(profile['headline']));
    final bio = TextEditingController(text: _safeString(profile['bio']));
    final credentials =
        TextEditingController(text: _safeString(profile['credentials']));
    final location =
        TextEditingController(text: _safeString(profile['location']));
    final years = TextEditingController(
        text: _asInt(profile['years_experience']).toString());
    final specialties = TextEditingController(
        text: _asStringList(profile['specialties']).join(', '));

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit teacher profile'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: headline,
                  decoration: const InputDecoration(labelText: 'Headline')),
              const SizedBox(height: 12),
              TextField(
                controller: bio,
                minLines: 4,
                maxLines: 6,
                decoration: const InputDecoration(labelText: 'Bio'),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: specialties,
                  decoration: const InputDecoration(labelText: 'Specialties')),
              const SizedBox(height: 12),
              TextField(
                  controller: credentials,
                  decoration: const InputDecoration(labelText: 'Credentials')),
              const SizedBox(height: 12),
              TextField(
                  controller: years,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Years experience')),
              const SizedBox(height: 12),
              TextField(
                  controller: location,
                  decoration: const InputDecoration(labelText: 'Location')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              await widget.api.patch('/profile/me', {
                'headline': headline.text,
                'bio': bio.text,
                'specialties': specialties.text
                    .split(',')
                    .map((item) => item.trim())
                    .where((item) => item.isNotEmpty)
                    .toList(),
                'credentials': credentials.text,
                'yearsExperience': int.tryParse(years.text) ?? 0,
                'location': location.text,
              });
              if (mounted) _refresh();
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class TeacherProfileView extends StatelessWidget {
  const TeacherProfileView({required this.profile, super.key});

  final Map<String, dynamic> profile;

  @override
  Widget build(BuildContext context) {
    final subjects = _asStringList(profile['subjects']);
    final specialties = _asStringList(profile['specialties']);
    return AppCard(
      accent: AppTheme.blue,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const MascotBadge(size: 68),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_safeString(profile['full_name'], fallback: 'Teacher'),
                        style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 4),
                    Text(_safeString(profile['headline']),
                        style: Theme.of(context).textTheme.bodyLarge),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(_safeString(profile['bio']),
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 16),
          ResponsiveGrid(
            minWidth: 160,
            children: [
              StatCard(
                label: 'Classes',
                value: '${_asInt(profile['classroom_count'])}',
                color: AppTheme.blue,
                icon: Icons.groups_rounded,
                surface: AppTheme.skySurface,
              ),
              StatCard(
                label: 'Students',
                value: '${_asInt(profile['student_count'])}',
                color: AppTheme.green,
                icon: Icons.school_rounded,
                surface: AppTheme.mint,
              ),
              StatCard(
                label: 'Posts',
                value: '${_asInt(profile['post_count'])}',
                color: AppTheme.orange,
                icon: Icons.campaign_rounded,
                surface: AppTheme.peach,
              ),
              StatCard(
                label: 'Years',
                value: '${_asInt(profile['years_experience'])}',
                color: AppTheme.yellow,
                icon: Icons.workspace_premium_rounded,
                surface: AppTheme.cream,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final subject in subjects) FeatureChip(label: subject),
              for (final item in specialties) FeatureChip(label: item),
              if (_safeString(profile['credentials']).isNotEmpty)
                FeatureChip(label: _safeString(profile['credentials'])),
              if (_safeString(profile['location']).isNotEmpty)
                FeatureChip(label: _safeString(profile['location'])),
            ],
          ),
        ],
      ),
    );
  }
}

class JsonCard extends StatelessWidget {
  const JsonCard({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: SelectableText(
        const JsonEncoder.withIndent('  ').convert(data),
        style: const TextStyle(
            fontFamily: 'monospace', fontWeight: FontWeight.w600),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({required this.text, super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(text,
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: AppTheme.muted)),
        ),
      ),
    );
  }
}

class MascotBadge extends StatelessWidget {
  const MascotBadge({required this.size, super.key});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppTheme.green, AppTheme.greenDark],
        ),
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: const [
          BoxShadow(
              color: AppTheme.shadow, blurRadius: 22, offset: Offset(0, 12))
        ],
      ),
      child: Center(
        child: Text(
          'T',
          style: GoogleFonts.baloo2(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: size * 0.52),
        ),
      ),
    );
  }
}

class NavItem {
  const NavItem(this.label, this.icon);

  final String label;
  final IconData icon;
}

class SyllabusTrack {
  const SyllabusTrack({
    required this.title,
    required this.form,
    required this.skills,
    required this.color,
    required this.icon,
  });

  final String title;
  final String form;
  final List<String> skills;
  final Color color;
  final IconData icon;
}

const kSyllabusTracks = [
  SyllabusTrack(
    title: 'Mathematics',
    form: 'Form 4',
    color: AppTheme.blue,
    icon: Icons.calculate_rounded,
    skills: ['Quadratic Functions', 'Number Bases', 'Graphs', 'Probability'],
  ),
  SyllabusTrack(
    title: 'Science',
    form: 'Form 4',
    color: AppTheme.green,
    icon: Icons.science_rounded,
    skills: ['Safety', 'Genetics', 'Elements', 'Motion'],
  ),
  SyllabusTrack(
    title: 'Sejarah',
    form: 'Form 5',
    color: AppTheme.orange,
    icon: Icons.account_balance_rounded,
    skills: ['Nationalism', 'Federal Constitution', 'Malaysia Formation'],
  ),
  SyllabusTrack(
    title: 'English',
    form: 'Form 5',
    color: AppTheme.yellow,
    icon: Icons.menu_book_rounded,
    skills: ['Reading', 'Writing', 'Speaking', 'Grammar'],
  ),
];

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

List<Map<String, dynamic>> _asMapList(dynamic value) {
  if (value is! List) return const [];
  return value.map((item) => _asMap(item)).toList();
}

List<String> _asStringList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => _safeString(item))
        .where((item) => item.isNotEmpty)
        .toList();
  }
  final text = _safeString(value);
  if (text.isEmpty) return const [];
  return text
      .split(RegExp(r'\r?\n|;|,'))
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.round();
  final text = '${value ?? ''}';
  return int.tryParse(text) ?? double.tryParse(text)?.round() ?? 0;
}

double _asDouble(dynamic value) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  return double.tryParse('${value ?? ''}') ?? 0;
}

String _safeString(dynamic value, {String fallback = ''}) {
  final text = '${value ?? ''}'.trim();
  if (text.isEmpty || text == 'null') return fallback;
  return text;
}

String _normalizeDisplayText(String value) {
  return value.replaceAll('`n', '\n').replaceAll(r'\n', '\n');
}

String _joinNonEmpty(Iterable<String> parts) {
  final filtered =
      parts.map((part) => part.trim()).where((part) => part.isNotEmpty);
  return filtered.join(' | ');
}

String _formLabel(dynamic value) {
  final form = _safeString(value);
  return form.isEmpty ? '' : 'Form $form';
}

String _formatNumber(dynamic value) {
  final parsed = _asDouble(value);
  if (parsed == parsed.roundToDouble()) {
    return parsed.round().toString();
  }
  return parsed.toStringAsFixed(1);
}

String _formatSeconds(int seconds) {
  if (seconds <= 0) return '';
  final duration = Duration(seconds: seconds);
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  final secs = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return hours > 0 ? '$hours:$minutes:$secs' : '$minutes:$secs';
}

String _formatBytes(int bytes) {
  if (bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  var size = bytes.toDouble();
  var unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  final display = size >= 10 || unit == 0
      ? size.toStringAsFixed(0)
      : size.toStringAsFixed(1);
  return '$display ${units[unit]}';
}

String _whiteboardSessionTime(Map<String, dynamic> session) {
  final started = _shortDateTime(session['created_at']);
  final ended = _shortDateTime(session['ended_at']);
  if (started.isNotEmpty && ended.isNotEmpty) return '$started to $ended';
  return started.isNotEmpty ? started : ended;
}

String _shortDateTime(dynamic value) {
  final text = _safeString(value);
  if (text.isEmpty) return '';
  final parsed = DateTime.tryParse(text);
  if (parsed == null) return text;
  final local = parsed.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.year}-$month-$day $hour:$minute';
}

String _answerText(dynamic value) {
  if (value is List) {
    return value
        .map((item) => _safeString(item))
        .where((item) => item.isNotEmpty)
        .join('\n');
  }
  if (value is Map) {
    if (value.containsKey('optionIndex'))
      return _safeString(value['optionIndex']);
    if (value.containsKey('value')) {
      return _joinNonEmpty([
        _safeString(value['value']),
        _safeString(value['unit']),
      ]);
    }
    return value.entries
        .map((entry) =>
            '${_safeString(entry.key)} = ${_safeString(entry.value)}')
        .where((item) => item.trim() != '=')
        .join('\n');
  }
  return _safeString(value);
}

String _lessonBadge(Map<String, dynamic> lesson) {
  final completion = _asInt(lesson['completion_percentage']);
  if (completion > 0) return '$completion%';
  final difficulty = _safeString(lesson['difficulty']);
  if (difficulty.isNotEmpty) return difficulty;
  return 'Assigned';
}

List<Map<String, dynamic>> _attachmentList(dynamic value) {
  return _asMapList(value)
      .where((item) =>
          _safeString(item['url']).isNotEmpty ||
          _safeString(item['embedUrl']).isNotEmpty ||
          _safeString(item['fileId']).isNotEmpty)
      .toList();
}

String _attachmentType(Map<String, dynamic> attachment) {
  final type = _safeString(attachment['type']).toLowerCase();
  if (type.isNotEmpty) return type;
  final mime = _safeString(attachment['mimeType']).toLowerCase();
  if (mime.startsWith('image/gif')) return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return _typeFromUrl(_safeString(attachment['url']));
}

String _typeFromFilename(String filename) {
  final lower = filename.toLowerCase();
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp')) {
    return 'image';
  }
  if (lower.endsWith('.mp4') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.webm')) {
    return 'video';
  }
  return 'file';
}

String _typeFromUrl(String url) {
  final lower = url.toLowerCase();
  if (supportsInlineExternalVideo(url)) return 'embed';
  if (lower.contains('giphy.com') ||
      lower.contains('tenor.com') ||
      lower.endsWith('.gif')) {
    return 'gif';
  }
  if (lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp')) {
    return 'image';
  }
  if (lower.endsWith('.mp4') ||
      lower.endsWith('.mov') ||
      lower.endsWith('.webm')) {
    return 'video';
  }
  return 'link';
}

String _resolveMediaUrl(String url) {
  if (url.isEmpty) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  if (kIsWeb) return url;

  final apiUri = Uri.tryParse(apiBaseUrl);
  if (apiUri == null || !apiUri.hasAuthority) return url;
  return '${apiUri.scheme}://${apiUri.authority}$url';
}

String _providerFromUrl(String url) {
  final externalVideoProvider = externalVideoProviderLabel(url);
  if (externalVideoProvider.isNotEmpty) return externalVideoProvider;

  final host = Uri.tryParse(url)?.host.toLowerCase() ?? '';
  if (host.contains('giphy')) return 'Giphy';
  if (host.contains('tenor')) return 'Tenor';
  if (host.contains('youtube') || host.contains('youtu.be')) return 'YouTube';
  if (host.contains('vimeo')) return 'Vimeo';
  if (host.contains('loom')) return 'Loom';
  return host;
}

String _attachmentTypeLabel(Map<String, dynamic> attachment) {
  return _labelForAttachmentType(_attachmentType(attachment));
}

String _labelForAttachmentType(String type) {
  switch (type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'gif':
      return 'GIF';
    case 'embed':
      return 'Embedded media';
    case 'link':
      return 'Link';
    default:
      return 'File';
  }
}

IconData _attachmentIcon(Map<String, dynamic> attachment) {
  final type = _attachmentType(attachment);
  switch (type) {
    case 'image':
      return Icons.image_rounded;
    case 'video':
      return Icons.movie_rounded;
    case 'gif':
      return Icons.gif_box_rounded;
    case 'embed':
      return Icons.play_circle_rounded;
    case 'link':
      return Icons.link_rounded;
    default:
      return Icons.insert_drive_file_rounded;
  }
}

Color _attachmentColor(String type) {
  switch (type) {
    case 'image':
      return AppTheme.green;
    case 'video':
      return AppTheme.blue;
    case 'gif':
      return AppTheme.coral;
    case 'embed':
      return AppTheme.yellow;
    default:
      return AppTheme.orange;
  }
}

List<Map<String, dynamic>> lessonContentBlocks(Map<String, dynamic> content) {
  final blocks = _asMapList(content['blocks']);
  if (blocks.isNotEmpty) return blocks;

  final summary = _safeString(content['summary']);
  if (summary.isEmpty) return const [];
  return [
    {
      'type': 'text',
      'title': 'Overview',
      'body': summary,
    }
  ];
}

Color _lessonBlockColor(String type) {
  switch (type) {
    case 'section':
      return AppTheme.green;
    case 'image':
      return AppTheme.coral;
    case 'video':
      return AppTheme.blue;
    case 'gif':
      return AppTheme.yellow;
    case 'embed':
      return AppTheme.orange;
    default:
      return AppTheme.muted;
  }
}

IconData _lessonBlockIcon(String type) {
  switch (type) {
    case 'section':
      return Icons.view_agenda_rounded;
    case 'image':
      return Icons.image_rounded;
    case 'video':
      return Icons.movie_rounded;
    case 'gif':
      return Icons.gif_box_rounded;
    case 'embed':
      return Icons.play_circle_rounded;
    default:
      return Icons.notes_rounded;
  }
}

String _labelForLessonBlockType(String type) {
  switch (type) {
    case 'section':
      return 'Section';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'gif':
      return 'GIF';
    case 'embed':
      return 'Embed';
    default:
      return 'Text';
  }
}

Color _subjectColor(String subject) {
  switch (subject.toLowerCase()) {
    case 'mathematics':
      return AppTheme.blue;
    case 'science':
      return AppTheme.green;
    case 'english':
      return AppTheme.yellow;
    case 'sejarah':
      return AppTheme.orange;
    default:
      return AppTheme.coral;
  }
}

String _errorMessage(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['error'] != null) return '${data['error']}';
  if (data is Map && data['message'] != null) return '${data['message']}';
  return e.message ?? 'Request failed';
}

String _friendlyError(Object? error) {
  if (error is DioException) return _errorMessage(error);
  return '$error';
}

extension on AppUser {
  String get roleLabel {
    switch (role) {
      case 'teacher':
        return 'Teacher';
      case 'parent':
        return 'Parent';
      case 'admin':
        return 'Admin';
      default:
        return 'Student';
    }
  }
}
