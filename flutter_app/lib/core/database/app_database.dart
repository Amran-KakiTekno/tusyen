import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:sqlite3_flutter_libs/sqlite3_flutter_libs.dart';

part 'app_database.g.dart';

// ============================================
// Tables for Offline-First Sync
// ============================================

class Users extends Table {
  TextColumn get id => text()();
  TextColumn get email => text()();
  TextColumn get role => text()();
  TextColumn get fullName => text()();
  TextColumn get phoneNumber => text().nullable()();
  TextColumn get dateOfBirth => text().nullable()();
  TextColumn get avatarUrl => text().nullable()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(true))();

  @override
  Set<Column> get primaryKey => {id};
}

class Classrooms extends Table {
  TextColumn get id => text()();
  TextColumn get teacherId => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  TextColumn get subject => text()();
  IntColumn get formLevel => integer()();
  TextColumn get joinCode => text()();
  BoolColumn get isPublic => boolean().withDefault(const Constant(false))();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(true))();

  @override
  Set<Column> get primaryKey => {id};
}

class Lessons extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get content => text()(); // JSON string
  TextColumn get subject => text()();
  IntColumn get formLevel => integer()();
  TextColumn get difficulty => text().withDefault(const Constant('medium'))();
  IntColumn get estimatedMinutes => integer().withDefault(const Constant(15))();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(true))();
  BoolColumn get contentDownloaded => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

class Progress extends Table {
  TextColumn get id => text()();
  TextColumn get studentId => text()();
  TextColumn get lessonId => text()();
  TextColumn get classroomId => text().nullable()();
  RealColumn get score => real().withDefault(const Constant(0.0))();
  IntColumn get timeSpentSeconds => integer().withDefault(const Constant(0))();
  IntColumn get completionPercentage => integer().withDefault(const Constant(0))();
  TextColumn get answers => text().nullable()(); // JSON string
  IntColumn get attempts => integer().withDefault(const Constant(1))();
  BoolColumn get isCompleted => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  TextColumn get pendingOperation => text().nullable()(); // 'INSERT', 'UPDATE'

  @override
  Set<Column> get primaryKey => {id};
}

class StudentNotes extends Table {
  TextColumn get id => text()();
  TextColumn get studentId => text()();
  TextColumn get lessonId => text()();
  TextColumn get content => text()();
  BoolColumn get isBookmark => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  TextColumn get pendingOperation => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get tableName => text()();
  TextColumn get operation => text()(); // INSERT, UPDATE, DELETE
  TextColumn get recordId => text()();
  TextColumn get data => text()(); // JSON payload
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  BoolColumn get isProcessed => boolean().withDefault(const Constant(false))();
}

class ClassroomEnrollments extends Table {
  TextColumn get id => text()();
  TextColumn get studentId => text()();
  TextColumn get classroomId => text()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get joinedAt => dateTime()();
  DateTimeColumn get lastActiveAt => dateTime().nullable()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(true))();

  @override
  Set<Column> get primaryKey => {id};
}

class Posts extends Table {
  TextColumn get id => text()();
  TextColumn get classroomId => text()();
  TextColumn get authorId => text()();
  TextColumn get postType => text().withDefault(const Constant('announcement'))();
  TextColumn get title => text().nullable()();
  TextColumn get content => text()();
  TextColumn get attachments => text().nullable()();
  BoolColumn get isPinned => boolean().withDefault(const Constant(false))();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(true))();

  @override
  Set<Column> get primaryKey => {id}();
}

class SyncMetadata extends Table {
  TextColumn get id => text()();
  TextColumn get tableName => text()();
  TextColumn get lastSyncToken => text().nullable()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  BoolColumn get isComplete => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {tableName};
}

// ============================================
// Database Definition
// ============================================

@DriftDatabase(tables: [
  Users,
  Classrooms,
  Lessons,
  Progress,
  StudentNotes,
  SyncQueue,
  ClassroomEnrollments,
  Posts,
  SyncMetadata,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) async {
      await m.createAll();
    },
    onUpgrade: (Migrator m, int from, int to) async {
      // Handle migrations here
    },
  );

  // ============================================
  // User Queries
  // ============================================
  
  Future<User?> getCurrentUser() async {
    final query = select(users)
      ..where((u) => u.isActive.equals(true))
      ..limit(1);
    return query.getSingleOrNull();
  }

  Future<void> insertOrUpdateUser(UsersCompanion user) async {
    await into(users).insertOnConflictUpdate(user);
  }

  // ============================================
  // Classroom Queries
  // ============================================
  
  Future<List<Classroom>> getClassroomsForUser(String userId, String role) {
    switch (role) {
      case 'teacher':
        return (select(classrooms)
          ..where((c) => c.teacherId.equals(userId) & c.isActive.equals(true))
          ..orderBy([(c) => OrderingTerm.desc(c.createdAt)]))
          .get();
      
      case 'student':
        return customSelect(
          '''
          SELECT c.* FROM classrooms c
          INNER JOIN classroom_enrollments ce ON ce.classroom_id = c.id
          WHERE ce.student_id = ? AND ce.is_active = 1 AND c.is_active = 1
          ORDER BY ce.joined_at DESC
          ''',
          variables: [Variable.withString(userId)],
        ).map((row) => Classroom.fromData(row.data, db)).get();
      
      default:
        return select(classrooms).get();
    }
  }

  Future<void> insertOrUpdateClassroom(ClassroomsCompanion classroom) async {
    await into(classrooms).insertOnConflictUpdate(classroom);
  }

  // ============================================
  // Lesson Queries
  // ============================================
  
  Future<List<Lesson>> getLessonsForClassroom(String classroomId) {
    return customSelect(
      '''
      SELECT l.* FROM lessons l
      INNER JOIN classroom_lessons cl ON cl.lesson_id = l.id
      WHERE cl.classroom_id = ? AND l.is_active = 1
      ORDER BY l.created_at DESC
      ''',
      variables: [Variable.withString(classroomId)],
    ).map((row) => Lesson.fromData(row.data, db)).get();
  }

  Future<void> insertOrUpdateLesson(LessonsCompanion lesson) async {
    await into(lessons).insertOnConflictUpdate(lesson);
  }

  Future<Lesson?> getLessonById(String lessonId) {
    return (select(lessons)
      ..where((l) => l.id.equals(lessonId)))
      .getSingleOrNull();
  }

  // ============================================
  // Progress Queries
  // ============================================
  
  Future<List<ProgressData>> getProgressForStudent(String studentId) {
    return (select(progress)
      ..where((p) => p.studentId.equals(studentId))
      ..orderBy([(p) => OrderingTerm.desc(p.updatedAt)]))
      .get();
  }

  Future<ProgressData?> getProgressForLesson(String studentId, String lessonId) {
    return (select(progress)
      ..where((p) => p.studentId.equals(studentId) & p.lessonId.equals(lessonId))
      ..limit(1))
      .getSingleOrNull();
  }

  Future<void> insertOrUpdateProgress(ProgressCompanion progressData) async {
    await into(progress).insertOnConflictUpdate(progressData);
  }

  Future<List<ProgressData>> getUnsyncedProgress() {
    return (select(progress)
      ..where((p) => p.isSynced.equals(false)))
      .get();
  }

  Future<void> markProgressAsSynced(String id) async {
    await update(progress)
      ..where((p) => p.id.equals(id))
      ..write(ProgressCompanion(
        isSynced: const Value(true),
        lastSyncAt: Value(DateTime.now()),
      ));
  }

  // ============================================
  // Sync Queue Queries
  // ============================================
  
  Future<void> addToSyncQueue(SyncQueueCompanion entry) async {
    await into(syncQueue).insert(entry);
  }

  Future<List<SyncQueueData>> getPendingSyncQueue() {
    return (select(syncQueue)
      ..where((s) => s.isProcessed.equals(false))
      ..orderBy([(s) => OrderingTerm.asc(s.createdAt)]))
      .get();
  }

  Future<void> markSyncQueueAsProcessed(int id) async {
    await update(syncQueue)
      ..where((s) => s.id.equals(id))
      ..write(SyncQueueCompanion(isProcessed: const Value(true)));
  }

  Future<void> clearSyncQueue() async {
    await delete(syncQueue).go();
  }

  // ============================================
  // Sync Metadata Queries
  // ============================================
  
  Future<SyncMetadatum?> getSyncMetadata(String tableName) {
    return (select(syncMetadata)
      ..where((s) => s.tableName.equals(tableName))
      ..limit(1))
      .getSingleOrNull();
  }

  Future<void> updateSyncMetadata(SyncMetadataCompanion metadata) async {
    await into(syncMetadata).insertOnConflictUpdate(metadata);
  }
}

// ============================================
// Database Connection
// ============================================

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'eduapp.sqlite'));

    if (Platform.isAndroid) {
      await applyWorkaroundToOpenSqlite3OnOldAndroidVersions();
    }

    final cachebase = (await getTemporaryDirectory()).path;
    sqlite3.tempDirectory = cachebase;

    return NativeDatabase.createInBackground(file);
  });
}
