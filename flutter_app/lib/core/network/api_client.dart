import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_endpoints.dart';
import 'api_interceptors.dart';

@singleton
class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _secureStorage;

  ApiClient(this._secureStorage) {
    _dio = Dio(BaseOptions(
      baseUrl: ApiEndpoints.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add interceptors
    _dio.interceptors.add(AuthInterceptor(_secureStorage));
    _dio.interceptors.add(OfflineInterceptor());
    _dio.interceptors.add(RetryInterceptor(dio: _dio));

    // Logging in debug mode
    if (kDebugMode) {
      _dio.interceptors.add(PrettyDioLogger(
        requestHeader: true,
        requestBody: true,
        responseHeader: true,
        responseBody: true,
        error: true,
        compact: true,
      ));
    }
  }

  Dio get dio => _dio;

  // Auth APIs
  Future<Response> login(String email, String password, String deviceId) async {
    return _dio.post(
      ApiEndpoints.login,
      data: {
        'email': email,
        'password': password,
        'deviceId': deviceId,
      },
    );
  }

  Future<Response> register(Map<String, dynamic> userData) async {
    return _dio.post(
      ApiEndpoints.register,
      data: userData,
    );
  }

  Future<Response> refreshToken(String token) async {
    return _dio.post(
      ApiEndpoints.refreshToken,
      data: {'token': token},
    );
  }

  // Classroom APIs
  Future<Response> getClassrooms() async {
    return _dio.get(ApiEndpoints.classrooms);
  }

  Future<Response> createClassroom(Map<String, dynamic> data) async {
    return _dio.post(ApiEndpoints.classrooms, data: data);
  }

  Future<Response> joinClassroom(String classroomId, String joinCode) async {
    return _dio.post(
      ApiEndpoints.joinClassroom(classroomId),
      data: {'joinCode': joinCode},
    );
  }

  // Lessons APIs
  Future<Response> getLessons({String? classroomId, String? subject}) async {
    return _dio.get(
      ApiEndpoints.lessons,
      queryParameters: {
        if (classroomId != null) 'classroomId': classroomId,
        if (subject != null) 'subject': subject,
      },
    );
  }

  Future<Response> getLessonById(String lessonId) async {
    return _dio.get(ApiEndpoints.lessonById(lessonId));
  }

  // Progress APIs
  Future<Response> getStudentProgress(String studentId) async {
    return _dio.get(ApiEndpoints.studentProgress(studentId));
  }

  Future<Response> updateProgress(Map<String, dynamic> data) async {
    return _dio.post(ApiEndpoints.updateProgress, data: data);
  }

  // Sync APIs
  Future<Response> pushSync(List<Map<String, dynamic>> operations, String lastSyncAt) async {
    return _dio.post(
      ApiEndpoints.syncPush,
      data: {
        'operations': operations,
        'lastSyncAt': lastSyncAt,
      },
    );
  }

  Future<Response> pullSync(String lastSyncAt, List<String> tables) async {
    return _dio.post(
      ApiEndpoints.syncPull,
      data: {
        'lastSyncAt': lastSyncAt,
        'tables': tables,
      },
    );
  }

  // Whiteboard APIs
  Future<Response> startWhiteboardSession(Map<String, dynamic> data) async {
    return _dio.post(ApiEndpoints.whiteboardSessions, data: data);
  }

  Future<Response> getActiveWhiteboard(String classroomId) async {
    return _dio.get(ApiEndpoints.activeWhiteboard(classroomId));
  }

  // Storage APIs
  Future<Response> getUploadUrl(String filename, String contentType) async {
    return _dio.post(
      ApiEndpoints.uploadUrl,
      data: {
        'filename': filename,
        'contentType': contentType,
      },
    );
  }

  // Generic request methods
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return _dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data}) async {
    return _dio.post(path, data: data);
  }

  Future<Response> put(String path, {dynamic data}) async {
    return _dio.put(path, data: data);
  }

  Future<Response> delete(String path) async {
    return _dio.delete(path);
  }
}
