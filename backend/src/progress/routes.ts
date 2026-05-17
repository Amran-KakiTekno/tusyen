import { FastifyInstance } from 'fastify';
import { db } from '../database';
import { cacheGet, cacheSet, redis } from '../redis';
import { getStudentQuizSummary } from '../quiz/store';

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const uuidPattern = new RegExp(UUID_PATTERN);

interface StudentHeartsRow {
  current_hearts: number;
  max_hearts: number;
}

export async function progressRoutes(fastify: FastifyInstance) {
  // Get student progress (self or parent viewing child)
  fastify.get('/student/:studentId', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { studentId } = request.params as any;
    const { classroomId, subject, limit, offset } = request.query as any;

    // Check authorization
    const hasAccess = await canViewStudentProgress(user, studentId);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Not authorized to view this student\'s progress' });
    }

    const normalizedLimit = Math.min(
      200,
      Math.max(1, Math.floor(Number.isFinite(Number(limit)) ? Number(limit) : 50)),
    );
    const normalizedOffset = Math.max(0, Math.floor(Number.isFinite(Number(offset)) ? Number(offset) : 0));

    const filters = ['p.student_id = $1'];
    const params: any[] = [studentId];

    if (classroomId) {
      filters.push(`p.classroom_id = $${params.length + 1}`);
      params.push(classroomId);
    }

    if (subject) {
      filters.push(`l.subject = $${params.length + 1}`);
      params.push(subject);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*) as total_count
       FROM progress p
       JOIN lessons l ON l.id = p.lesson_id
       ${whereClause}`,
      params,
    );

    let query = `
      SELECT p.*, l.title as lesson_title, l.subject,
             (
               SELECT si.topic
               FROM lesson_syllabus_links lsl
               JOIN syllabus_items si ON si.id = lsl.syllabus_id
               WHERE lsl.lesson_id = l.id
               ORDER BY si.order_index
               LIMIT 1
             ) as topic,
             l.difficulty,
             c.name as classroom_name
      FROM progress p
      JOIN lessons l ON l.id = p.lesson_id
      LEFT JOIN classrooms c ON c.id = p.classroom_id
      ${whereClause}
      ORDER BY p.updated_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}`;

    const result = await db.query(query, [...params, normalizedLimit, normalizedOffset]);
    reply.header('X-Total-Count', String(countResult.rows[0]?.total_count ?? 0));

    return { progress: result.rows };
  });

  // Get overall stats for student
  fastify.get('/student/:studentId/stats', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { studentId } = request.params as any;

    const hasAccess = await canViewStudentProgress(user, studentId);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    // Try cache first
    const cacheKey = `stats:student:${studentId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_lessons_attempted,
        COUNT(CASE WHEN completion_percentage >= 100 THEN 1 END) as lessons_completed,
        AVG(score) as average_score,
        SUM(time_spent_seconds) as total_time_seconds,
        SUM(CASE WHEN updated_at >= date_trunc('week', NOW()) THEN time_spent_seconds ELSE 0 END) as "weekTimeSeconds",
        COUNT(DISTINCT DATE(p.updated_at)) as days_active,
        MAX(p.updated_at) as last_activity
       FROM progress p
       WHERE p.student_id = $1`,
      [studentId]
    );

    const rankResult = await db.query(
      `WITH student_avg AS (
         SELECT classroom_id, student_id, AVG(score) as average_score
         FROM progress
         GROUP BY classroom_id, student_id
       ), ranked AS (
         SELECT
           classroom_id,
           student_id,
           DENSE_RANK() OVER (
             PARTITION BY classroom_id
             ORDER BY average_score DESC NULLS LAST
           ) AS classroom_rank
         FROM student_avg
       )
       SELECT MIN(classroom_rank) as rank
       FROM ranked
       WHERE student_id = $1`,
      [studentId]
    );

    const bySubject = await db.query(
      `SELECT 
        l.subject,
        COUNT(*) as lessons_count,
        AVG(p.score) as avg_score,
        AVG(p.completion_percentage) as avg_completion
       FROM progress p
       JOIN lessons l ON l.id = p.lesson_id
       WHERE p.student_id = $1
       GROUP BY l.subject`,
      [studentId]
    );

    const today = await db.query(
      `SELECT
        COUNT(*) as lessons_attempted,
        COUNT(CASE WHEN completion_percentage >= 100 OR is_completed = true THEN 1 END) as lessons_completed,
        COALESCE(SUM(time_spent_seconds), 0) as time_spent_seconds
       FROM progress p
       WHERE p.student_id = $1
         AND p.updated_at::date = CURRENT_DATE`,
      [studentId]
    );

    const streak = await calculateStreak(studentId);
    const quizSummary = await getStudentQuizSummary(user, studentId).catch(() => ({
      quizXpTotal: 0,
      recentSessions: [],
    }));

    const result = {
      overall: stats.rows[0],
      bySubject: bySubject.rows,
      today: today.rows[0],
      rank: rankResult.rows[0]?.rank ? Number(rankResult.rows[0].rank) : null,
      streak,
      quiz: quizSummary,
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, result, 300);

    return result;
  });

  fastify.get('/student/:studentId/hearts', {
    onRequest: [(fastify as any).authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['studentId'],
        properties: {
          studentId: { type: 'string', pattern: UUID_PATTERN },
        },
      },
      response: {
        200: {
          type: 'object',
          required: ['current', 'max'],
          properties: {
            current: { type: 'integer', minimum: 0 },
            max: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const { studentId } = request.params as any;

    if (!isUuid(studentId)) {
      return reply.code(400).send({ error: 'Invalid student id' });
    }

    const student = await db.query(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'student'
         AND is_active = true`,
      [studentId],
    );

    if ((student.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Student not found' });
    }

    const hasAccess = await canViewStudentProgress(user, studentId);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const hearts = await getOrCreateStudentHearts(studentId);
    if (!hearts) {
      request.log.error({ studentId }, 'Student hearts row could not be loaded');
      return reply.code(500).send({ error: 'Student hearts unavailable' });
    }

    return hearts;
  });

  // Get classroom progress (teacher view)
  fastify.get('/classroom/:classroomId', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { classroomId } = request.params as any;

    // Verify teacher owns this classroom
    const classroom = await db.query(
      'SELECT teacher_id FROM classrooms WHERE id = $1',
      [classroomId]
    );

    if (classroom.rowCount === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    if (classroom.rows[0].teacher_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    // Get progress for all students
    const progress = await db.query(
      `SELECT 
        u.id as student_id,
        u.full_name,
        u.email,
        ce.joined_at,
        COALESCE(scs.total_lessons, 0) as lessons_attempted,
        COALESCE(scs.completed_lessons, 0) as lessons_completed,
        COALESCE(scs.average_score, 0) as average_score,
        COALESCE(scs.last_activity, ce.joined_at) as last_activity,
        COALESCE((
          SELECT ss.streak_count
          FROM student_streaks ss
          WHERE ss.student_id = u.id
            AND ss.activity_date >= CURRENT_DATE - INTERVAL '1 day'
          ORDER BY ss.activity_date DESC
          LIMIT 1
        ), 0)::int as current_streak
       FROM classroom_enrollments ce
       JOIN users u ON u.id = ce.student_id
       LEFT JOIN student_classroom_stats scs
         ON scs.student_id = ce.student_id
        AND scs.classroom_id = ce.classroom_id
       WHERE ce.classroom_id = $1 AND ce.is_active = true
       ORDER BY u.full_name`,
      [classroomId]
    );

    return { students: progress.rows };
  });

  fastify.get('/classroom/:classroomId/leaderboard', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { classroomId } = request.params as any;

    if (!(await canViewClassroom(user, classroomId))) {
      return reply.code(403).send({ error: 'Not authorized to view classroom leaderboard' });
    }

    const cacheKey = `leaderboard:classroom:${classroomId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const result = await db.query(
      `SELECT u.id as student_id,
              u.full_name,
              COALESCE(SUM(xe.amount), 0)::int AS total_xp,
              COUNT(DISTINCT p.lesson_id) FILTER (WHERE p.is_completed)::int AS completed
       FROM classroom_enrollments ce
       JOIN users u ON u.id = ce.student_id
       LEFT JOIN xp_events xe ON xe.user_id = u.id
       LEFT JOIN progress p
         ON p.student_id = u.id
        AND p.classroom_id = ce.classroom_id
       WHERE ce.classroom_id = $1
         AND ce.is_active = true
       GROUP BY u.id, u.full_name
       ORDER BY total_xp DESC, completed DESC, u.full_name ASC
       LIMIT 10`,
      [classroomId]
    );

    const response = {
      leaderboard: result.rows.map((row, index) => ({
        ...row,
        rank: index + 1,
      })),
    };
    await cacheSet(cacheKey, response, 300);

    return response;
  });

  fastify.get('/me/achievements', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;

    if (user.role !== 'student') {
      return reply.code(403).send({ error: 'Only students can view their achievements' });
    }

    const result = await db.query(
      `SELECT a.id,
              a.code,
              a.name,
              a.description,
              a.icon_url as icon,
              ua.earned_at,
              (ua.id IS NOT NULL) AS is_earned
       FROM achievements a
       LEFT JOIN user_achievements ua
         ON ua.achievement_id = a.id
        AND ua.user_id = $1
       ORDER BY a.created_at ASC, a.name ASC`,
      [user.userId]
    );

    return { achievements: result.rows };
  });

  // Get lesson progress details
  fastify.get('/lesson/:lessonId', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { lessonId } = request.params as any;

    // Students see their own, teachers see all in their classrooms
    if (user.role === 'student') {
      const result = await db.query(
        `SELECT p.*, l.title, l.content->>'summary' as content_summary
         FROM progress p
         JOIN lessons l ON l.id = p.lesson_id
         WHERE p.student_id = $1 AND p.lesson_id = $2`,
        [user.userId, lessonId]
      );
      return { progress: result.rows[0] || null };
    }

    if (user.role === 'teacher') {
      if (!(await canTeacherViewLessonProgress(user.userId, lessonId))) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      const result = await db.query(
        `SELECT p.*, u.full_name as student_name
         FROM progress p
         JOIN users u ON u.id = p.student_id
         JOIN classrooms c ON c.id = p.classroom_id
         WHERE p.lesson_id = $1 AND c.teacher_id = $2 AND c.is_active = true
         ORDER BY u.full_name`,
        [lessonId, user.userId]
      );

      return { progress: result.rows };
    }

    if (user.role === 'parent') {
      if (!(await canParentViewLessonProgress(user.userId, lessonId))) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      const result = await db.query(
        `SELECT p.*, u.full_name as student_name
         FROM progress p
         JOIN users u ON u.id = p.student_id
         JOIN parent_student_links psl
           ON psl.student_id = p.student_id
          AND psl.parent_id = $2
          AND psl.is_active = true
         WHERE p.lesson_id = $1
         ORDER BY u.full_name`,
        [lessonId, user.userId]
      );

      return { progress: result.rows };
    }

    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const result = await db.query(
      `SELECT p.*, u.full_name as student_name
       FROM progress p
       JOIN users u ON u.id = p.student_id
       WHERE p.lesson_id = $1
       ORDER BY u.full_name`,
      [lessonId]
    );

    return { progress: result.rows };
  });

  // Update streak (called daily when student completes activity)
  fastify.post('/streak/check', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;

    if (user.role !== 'student') {
      return reply.code(403).send({ error: 'Only for students' });
    }

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `streak:${user.userId}:${today}`;

    // Check if already recorded today
    const alreadyRecorded = await redis.get(cacheKey);
    if (alreadyRecorded) {
      return { streakMaintained: true, alreadyRecorded: true };
    }

    // Record activity
    await redis.setex(cacheKey, 86400, '1');

    // Update streak in database
    await db.query(
      `INSERT INTO student_streaks (student_id, activity_date, streak_count)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (student_id, activity_date) DO NOTHING`,
      [user.userId]
    );

    // Calculate current streak
    const streak = await calculateStreak(user.userId);

    return { streakMaintained: true, currentStreak: streak.current };
  });
}

async function canViewStudentProgress(user: any, studentId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.userId === studentId) return true;
  
  if (user.role === 'parent') {
    const result = await db.query(
      `SELECT id FROM parent_student_links 
       WHERE parent_id = $1 AND student_id = $2 AND is_active = true`,
      [user.userId, studentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  if (user.role === 'teacher') {
    // Check if student is in any of teacher's classrooms
    const result = await db.query(
      `SELECT ce.id FROM classroom_enrollments ce
       JOIN classrooms c ON c.id = ce.classroom_id
       WHERE c.teacher_id = $1 AND ce.student_id = $2 AND ce.is_active = true`,
      [user.userId, studentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  return false;
}

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

async function getOrCreateStudentHearts(studentId: string): Promise<{ current: number; max: number } | null> {
  const result = await db.query<StudentHeartsRow>(
    `WITH inserted AS (
       INSERT INTO student_hearts (student_id)
       VALUES ($1)
       ON CONFLICT (student_id) DO NOTHING
       RETURNING current_hearts, max_hearts
     )
     SELECT current_hearts, max_hearts
     FROM inserted
     UNION ALL
     SELECT current_hearts, max_hearts
     FROM student_hearts
     WHERE student_id = $1
     LIMIT 1`,
    [studentId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const current = Number(row.current_hearts);
  const max = Number(row.max_hearts);
  if (!Number.isFinite(current) || !Number.isFinite(max)) return null;

  const safeMax = Math.max(1, Math.trunc(max));
  return {
    current: Math.max(0, Math.min(safeMax, Math.trunc(current))),
    max: safeMax,
  };
}

async function canViewClassroom(user: any, classroomId: string): Promise<boolean> {
  if (user.role === 'admin') return true;

  if (user.role === 'teacher') {
    const result = await db.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2 AND is_active = true',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  if (user.role === 'student') {
    const result = await db.query(
      'SELECT id FROM classroom_enrollments WHERE classroom_id = $1 AND student_id = $2 AND is_active = true',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  if (user.role === 'parent') {
    const result = await db.query(
      `SELECT ce.id
       FROM parent_student_links psl
       JOIN classroom_enrollments ce
         ON ce.student_id = psl.student_id
        AND ce.is_active = true
       WHERE psl.parent_id = $1
         AND psl.is_active = true
         AND ce.classroom_id = $2
       LIMIT 1`,
      [user.userId, classroomId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  return false;
}

async function canTeacherViewLessonProgress(userId: string, lessonId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1
     FROM classroom_lessons cl
     JOIN classrooms c ON c.id = cl.classroom_id
     WHERE cl.lesson_id = $1
       AND c.teacher_id = $2
       AND c.is_active = true
     LIMIT 1`,
    [lessonId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function canParentViewLessonProgress(userId: string, lessonId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1
     FROM parent_student_links psl
     JOIN classroom_enrollments ce
       ON ce.student_id = psl.student_id
      AND ce.is_active = true
     JOIN classroom_lessons cl ON cl.classroom_id = ce.classroom_id
     JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
     WHERE psl.parent_id = $1
       AND psl.is_active = true
       AND cl.lesson_id = $2
     LIMIT 1`,
    [userId, lessonId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function calculateStreak(studentId: string) {
  // Get all activity dates in last 30 days
  const result = await db.query(
    `SELECT activity_date FROM student_streaks 
     WHERE student_id = $1 
     AND activity_date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY activity_date DESC`,
    [studentId]
  );

  const dates = result.rows.map(r => r.activity_date);
  
  if (dates.length === 0) {
    return { current: 0, longest: 0, lastActive: null };
  }

  // Calculate current streak
  let currentStreak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let lastDate = new Date(dates[0]);
  
  // Check if streak is still active (active today or yesterday)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastActive = new Date(dates[0]);
  lastActive.setHours(0, 0, 0, 0);
  
  const isStreakActive = lastActive.getTime() === today.getTime() || 
                         lastActive.getTime() === yesterday.getTime();

  if (!isStreakActive) {
    return { current: 0, longest: 0, lastActive: dates[0] };
  }

  for (let i = 1; i < dates.length; i++) {
    const currentDate = new Date(dates[i]);
    const expectedDate = new Date(lastDate);
    expectedDate.setDate(expectedDate.getDate() - 1);
    
    if (currentDate.toDateString() === expectedDate.toDateString()) {
      currentStreak++;
      lastDate = currentDate;
    } else {
      break;
    }
  }

  return {
    current: currentStreak,
    longest: currentStreak, // Simplified - could calculate separately
    lastActive: dates[0]
  };
}
