import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:injectable/injectable.dart';

import '../database/app_database.dart';
import '../network/api_client.dart';

@singleton
class SyncService {
  final AppDatabase _database;
  final ApiClient _apiClient;
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  SyncService(this._database, this._apiClient);

  // ============================================
  // Main Sync Entry Point
  // ============================================
  
  Future<SyncResult> performFullSync() async {
    try {
      // Check connectivity
      final connectivity = await Connectivity().checkConnectivity();
      if (connectivity == ConnectivityResult.none) {
        return SyncResult(
          success: false,
          message: 'No internet connection - using offline data',
          pushedCount: 0,
          pulledCount: 0,
        );
      }

      // 1. Push local changes to server
      final pushResult = await _pushLocalChanges();
      
      // 2. Pull server changes to local
      final pullResult = await _pullServerChanges();

      return SyncResult(
        success: true,
        message: 'Sync completed successfully',
        pushedCount: pushResult,
        pulledCount: pullResult,
      );
    } catch (e) {
      return SyncResult(
        success: false,
        message: 'Sync failed: $e',
        pushedCount: 0,
        pulledCount: 0,
      );
    }
  }

  // ============================================
  // Push Local Changes to Server
  // ============================================
  
  Future<int> _pushLocalChanges() async {
    int pushedCount = 0;

    // Get all unsynced records
    final unsyncedProgress = await _database.getUnsyncedProgress();
    
    for (final progress in unsyncedProgress) {
      try {
        // Convert to server format
        final operation = {
          'id': progress.id,
          'type': progress.pendingOperation ?? 'UPDATE',
          'table': 'progress',
          'data': {
            'id': progress.id,
            'lessonId': progress.lessonId,
            'classroomId': progress.classroomId,
            'score': progress.score,
            'timeSpentSeconds': progress.timeSpentSeconds,
            'completionPercentage': progress.completionPercentage,
            'answers': progress.answers != null ? jsonDecode(progress.answers!) : null,
          },
          'timestamp': progress.updatedAt.toIso8601String(),
        };

        // Push to server
        await _apiClient.pushSync([operation], progress.lastSyncAt?.toIso8601String() ?? '');
        
        // Mark as synced locally
        await _database.markProgressAsSynced(progress.id);
        pushedCount++;
      } catch (e) {
        // Keep as unsynced for retry
        print('Failed to sync progress ${progress.id}: $e');
      }
    }

    // Process sync queue
    final queue = await _database.getPendingSyncQueue();
    for (final item in queue) {
      try {
        final data = jsonDecode(item.data);
        await _apiClient.post('/sync/push', data: {
          'operations': [data],
          'lastSyncAt': DateTime.now().toIso8601String(),
        });
        
        await _database.markSyncQueueAsProcessed(item.id);
        pushedCount++;
      } catch (e) {
        print('Failed to process sync queue item ${item.id}: $e');
      }
    }

    return pushedCount;
  }

  // ============================================
  // Pull Server Changes to Local
  // ============================================
  
  Future<int> _pullServerChanges() async {
    int pulledCount = 0;

    // Get last sync timestamps for each table
    final tables = ['progress', 'lessons', 'classrooms', 'posts'];
    
    for (final table in tables) {
      final metadata = await _database.getSyncMetadata(table);
      final lastSyncAt = metadata?.lastSyncAt?.toIso8601String() ?? DateTime(2000).toIso8601String();

      try {
        final response = await _apiClient.pullSync(lastSyncAt, [table]);
        final changes = response.data['changes'] as Map<String, dynamic>?;

        if (changes != null && changes.containsKey(table)) {
          final tableChanges = changes[table] as List;
          
          for (final change in tableChanges) {
            await _applyServerChange(table, change);
            pulledCount++;
          }
        }

        // Update sync metadata
        await _database.updateSyncMetadata(SyncMetadataCompanion(
          tableName: table,
          lastSyncAt: DateTime.now(),
          lastSyncToken: response.data['serverTimestamp'],
          isComplete: true,
        ));
      } catch (e) {
        print('Failed to pull changes for table $table: $e');
      }
    }

    return pulledCount;
  }

  // ============================================
  // Apply Server Change to Local DB
  // ============================================
  
  Future<void> _applyServerChange(String table, dynamic change) async {
    switch (table) {
      case 'progress':
        await _database.insertOrUpdateProgress(ProgressCompanion(
          id: Value(change['id']),
          studentId: Value(change['student_id']),
          lessonId: Value(change['lesson_id']),
          classroomId: Value(change['classroom_id']),
          score: Value((change['score'] as num).toDouble()),
          timeSpentSeconds: Value(change['time_spent_seconds'] ?? 0),
          completionPercentage: Value(change['completion_percentage'] ?? 0),
          answers: Value(change['answers'] != null ? jsonEncode(change['answers']) : null),
          isCompleted: Value(change['completion_percentage'] >= 100),
          isSynced: const Value(true),
          lastSyncAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.parse(change['updated_at'])),
          createdAt: Value(DateTime.parse(change['created_at'])),
        ));
        break;

      case 'lessons':
        await _database.insertOrUpdateLesson(LessonsCompanion(
          id: Value(change['id']),
          title: Value(change['title']),
          content: Value(jsonEncode(change['content'])),
          subject: Value(change['subject']),
          formLevel: Value(change['form_level']),
          difficulty: Value(change['difficulty'] ?? 'medium'),
          estimatedMinutes: Value(change['estimated_minutes'] ?? 15),
          isActive: Value(change['is_active'] ?? true),
          lastSyncAt: Value(DateTime.now()),
          isSynced: const Value(true),
          updatedAt: Value(DateTime.parse(change['updated_at'])),
          createdAt: Value(DateTime.parse(change['created_at'])),
        ));
        break;

      case 'classrooms':
        await _database.insertOrUpdateClassroom(ClassroomsCompanion(
          id: Value(change['id']),
          teacherId: Value(change['teacher_id']),
          name: Value(change['name']),
          description: Value(change['description']),
          subject: Value(change['subject']),
          formLevel: Value(change['form_level']),
          joinCode: Value(change['join_code']),
          isPublic: Value(change['is_public'] ?? false),
          isActive: Value(change['is_active'] ?? true),
          lastSyncAt: Value(DateTime.now()),
          isSynced: const Value(true),
          updatedAt: Value(DateTime.parse(change['updated_at'])),
          createdAt: Value(DateTime.parse(change['created_at'])),
        ));
        break;
    }
  }

  // ============================================
  // Queue Operation for Sync
  // ============================================
  
  Future<void> queueOperation(String table, String operation, Map<String, dynamic> data) async {
    await _database.addToSyncQueue(SyncQueueCompanion(
      tableName: Value(table),
      operation: Value(operation),
      recordId: Value(data['id'] ?? ''),
      data: Value(jsonEncode({
        'table': table,
        'operation': operation,
        'data': data,
        'timestamp': DateTime.now().toIso8601String(),
      })),
    ));
  }

  // ============================================
  // Device ID for Sync Tracking
  // ============================================
  
  Future<String> getDeviceId() async {
    String deviceId;
    try {
      if (Platform.isAndroid) {
        final androidInfo = await _deviceInfo.androidInfo;
        deviceId = androidInfo.id ?? 'unknown';
      } else if (Platform.isIOS) {
        final iosInfo = await _deviceInfo.iosInfo;
        deviceId = iosInfo.identifierForVendor ?? 'unknown';
      } else {
        deviceId = 'unknown';
      }
    } catch (e) {
      deviceId = 'unknown';
    }
    return deviceId;
  }
}

// ============================================
// Result Model
// ============================================

class SyncResult {
  final bool success;
  final String message;
  final int pushedCount;
  final int pulledCount;

  SyncResult({
    required this.success,
    required this.message,
    required this.pushedCount,
    required this.pulledCount,
  });
}

// Platform helper
class Platform {
  static bool get isAndroid => true; // Placeholder
  static bool get isIOS => false; // Placeholder
}
