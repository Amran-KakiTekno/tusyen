class ApiEndpoints {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  static const String wsUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'ws://localhost:8000',
  );
  
  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String refreshToken = '/auth/refresh';
  static const String keycloakStatus = '/auth/keycloak/status';
  static const String keycloakLoginUrl = '/auth/keycloak/login-url';
  static const String keycloakCallback = '/auth/keycloak/callback';
  static const String linkParent = '/auth/link-parent';
  static const String linkedStudents = '/auth/linked-students';
  
  // Classrooms
  static const String classrooms = '/classroom';
  static String joinClassroom(String id) => '/classroom/$id/join';
  static String leaveClassroom(String id) => '/classroom/$id/leave';
  static String classroomById(String id) => '/classroom/$id';
  static String classroomStudents(String id) => '/classroom/$id/students';
  static String classroomAnalytics(String id) => '/classroom/$id/analytics';
  
  // Lessons
  static const String lessons = '/learning/catalog';
  static String lessonById(String id) => '/learning/lessons/$id';
  static String assignLesson(String classroomId) => '/admin/classrooms/$classroomId/lessons';
  
  // Syllabus
  static const String syllabus = '/admin/syllabus';
  
  // Progress
  static String studentProgress(String studentId) => '/progress/student/$studentId';
  static String studentStats(String studentId) => '/progress/student/$studentId/stats';
  static String classroomProgress(String classroomId) => '/progress/classroom/$classroomId';
  static const String updateProgress = '/sync/push'; // Uses sync endpoint
  static const String checkStreak = '/progress/streak/check';
  
  // Sync
  static const String syncPush = '/sync/push';
  static const String syncPull = '/sync/pull';
  static const String syncStatus = '/sync/status';
  static const String resolveConflict = '/sync/resolve';
  
  // Whiteboard
  static const String whiteboardSessions = '/whiteboard/session';
  static String activeWhiteboard(String classroomId) => '/whiteboard/session/active/$classroomId';
  static String joinWhiteboard(String id) => '/whiteboard/session/$id/join';
  static String endWhiteboard(String id) => '/whiteboard/session/$id/end';
  static String whiteboardEvents(String id) => '/whiteboard/session/$id/events';
  static String uploadRecording(String id) => '/whiteboard/session/$id/recording';
  static String deleteRecording(String id) => '/whiteboard/session/$id/recording';
  static String whiteboardHistory(String classroomId) => '/whiteboard/sessions/$classroomId';
  
  // Storage
  static const String uploadUrl = '/storage/upload-url';
  static const String downloadUrl = '/storage/download-url';
  static const String uploadFile = '/storage/upload';
  static const String listFiles = '/storage/files';
  static String deleteFile(String id) => '/storage/files/$id';
  
  // Admin
  static const String adminUsers = '/admin/users';
  static String adminUserStatus(String id) => '/admin/users/$id/status';
  static const String adminStats = '/admin/stats';
  static const String adminHealth = '/admin/health';
  static const String adminCacheClear = '/admin/cache/clear';
  
  // WebSocket
  static String classroomWs(String classroomId) => '/ws/classroom/$classroomId';
}
