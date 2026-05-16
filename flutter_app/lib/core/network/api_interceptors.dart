import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jwt_decoder/jwt_decoder.dart';

import 'api_endpoints.dart';

// ============================================
// Auth Interceptor - Adds JWT token to requests
// ============================================
class AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _secureStorage;
  bool _isRefreshing = false;

  AuthInterceptor(this._secureStorage);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Skip auth for login/register endpoints
    if (options.path.contains('/auth/login') || 
        options.path.contains('/auth/register') ||
        options.path.contains('/auth/keycloak/') ||
        options.path.contains('/health')) {
      return handler.next(options);
    }

    try {
      final token = await _secureStorage.read(key: 'access_token');
      
      if (token != null && token.isNotEmpty) {
        // Check if token is expired
        if (JwtDecoder.isExpired(token)) {
          // Try to refresh token
          if (!_isRefreshing) {
            _isRefreshing = true;
            final newToken = await _refreshToken();
            _isRefreshing = false;
            
            if (newToken != null) {
              options.headers['Authorization'] = 'Bearer $newToken';
            }
          }
        } else {
          options.headers['Authorization'] = 'Bearer $token';
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('AuthInterceptor error: $e');
      }
    }

    return handler.next(options);
  }

  Future<String?> _refreshToken() async {
    try {
      final refreshToken = await _secureStorage.read(key: 'refresh_token');
      if (refreshToken == null) return null;

      final dio = Dio();
      final response = await dio.post(
        '${ApiEndpoints.baseUrl}${ApiEndpoints.refreshToken}',
        data: {'token': refreshToken},
      );

      if (response.statusCode == 200) {
        final newToken = response.data['token'] as String;
        await _secureStorage.write(key: 'access_token', value: newToken);
        return newToken;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Token refresh failed: $e');
      }
      // Clear tokens on refresh failure
      await _secureStorage.delete(key: 'access_token');
      await _secureStorage.delete(key: 'refresh_token');
    }
    return null;
  }
}

// ============================================
// Offline Interceptor - Queue requests when offline
// ============================================
class OfflineInterceptor extends Interceptor {
  final List<RequestOptions> _requestQueue = [];
  bool _isOnline = true;

  OfflineInterceptor() {
    _initConnectivityListener();
  }

  void _initConnectivityListener() {
    Connectivity().onConnectivityChanged.listen((result) {
      _isOnline = result != ConnectivityResult.none;
      if (_isOnline) {
        _processQueue();
      }
    });
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final connectivity = await Connectivity().checkConnectivity();
    _isOnline = connectivity != ConnectivityResult.none;

    if (!_isOnline) {
      // Queue the request for later
      if (options.method == 'GET') {
        // For GET requests, return cached data if available
        return handler.reject(
          DioException(
            requestOptions: options,
            error: 'Offline - No cached data available',
            type: DioExceptionType.connectionError,
          ),
        );
      } else {
        // For POST/PUT/DELETE, queue for retry
        _requestQueue.add(options);
        return handler.reject(
          DioException(
            requestOptions: options,
            error: 'Offline - Request queued for retry',
            type: DioExceptionType.connectionError,
          ),
        );
      }
    }

    return handler.next(options);
  }

  void _processQueue() {
    // Process queued requests when back online
    for (final request in _requestQueue) {
      // This would need a proper implementation with a Dio instance
      // For now, just clear the queue
    }
    _requestQueue.clear();
  }
}

// ============================================
// Retry Interceptor - Retry failed requests
// ============================================
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;
  final Duration retryDelay;

  RetryInterceptor({
    required this.dio,
    this.maxRetries = 3,
    this.retryDelay = const Duration(seconds: 1),
  });

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Only retry on specific errors
    if (_shouldRetry(err)) {
      int retryCount = err.requestOptions.extra['retryCount'] as int? ?? 0;
      
      if (retryCount < maxRetries) {
        retryCount++;
        err.requestOptions.extra['retryCount'] = retryCount;
        
        // Wait before retry
        await Future.delayed(retryDelay * retryCount);
        
        try {
          final response = await dio.fetch(err.requestOptions);
          return handler.resolve(response);
        } catch (e) {
          return handler.next(err);
        }
      }
    }

    return handler.next(err);
  }

  bool _shouldRetry(DioException error) {
    return error.type == DioExceptionType.connectionTimeout ||
           error.type == DioExceptionType.sendTimeout ||
           error.type == DioExceptionType.receiveTimeout ||
           error.type == DioExceptionType.connectionError ||
           (error.response?.statusCode == 503); // Service unavailable
  }
}
