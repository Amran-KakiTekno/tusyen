import { FastifyInstance } from 'fastify';
import { db } from '../database';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/me', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers have profile pages' });
    }

    const profile = await getTeacherProfile(user.userId);
    if (!profile) {
      return reply.code(404).send({ error: 'Teacher profile not found' });
    }

    return { profile };
  });

  fastify.patch('/me', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers can update profiles' });
    }

    const body = request.body as any;
    const specialties = normalizeStringArray(body.specialties);
    const yearsExperience = normalizeInteger(body.yearsExperience ?? body.years_experience);
    const links = normalizeLinks(body.links);

    await db.query(
      `INSERT INTO teacher_profiles
         (teacher_id, headline, bio, specialties, credentials, years_experience, location, links)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (teacher_id)
       DO UPDATE SET headline = EXCLUDED.headline,
                     bio = EXCLUDED.bio,
                     specialties = EXCLUDED.specialties,
                     credentials = EXCLUDED.credentials,
                     years_experience = EXCLUDED.years_experience,
                     location = EXCLUDED.location,
                     links = EXCLUDED.links,
                     updated_at = NOW()`,
      [
        user.userId,
        stringOrNull(body.headline),
        stringOrNull(body.bio),
        specialties,
        stringOrNull(body.credentials),
        yearsExperience,
        stringOrNull(body.location),
        JSON.stringify(links),
      ]
    );

    return { success: true, profile: await getTeacherProfile(user.userId) };
  });

  fastify.get('/teachers/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const profile = await getTeacherProfile(id);

    if (!profile) {
      return reply.code(404).send({ error: 'Teacher profile not found' });
    }

    return { profile };
  });
}

async function getTeacherProfile(teacherId: string) {
  const profileResult = await db.query(
    `SELECT u.id,
            u.full_name,
            u.email,
            u.avatar_url,
            COALESCE(tp.headline, 'KSSR/KSSM classroom teacher') as headline,
            COALESCE(tp.bio, 'Focused on helping students build confidence through short practice loops, classroom guidance, and exam-ready feedback.') as bio,
            COALESCE(tp.specialties, ARRAY[]::TEXT[]) as specialties,
            COALESCE(tp.credentials, '') as credentials,
            COALESCE(tp.years_experience, 0) as years_experience,
            COALESCE(tp.location, '') as location,
            COALESCE(tp.links, '{}'::jsonb) as links,
            COALESCE(tp.updated_at, u.updated_at) as updated_at
     FROM users u
     LEFT JOIN teacher_profiles tp ON tp.teacher_id = u.id
     WHERE u.id = $1 AND u.role = 'teacher' AND u.is_active = true`,
    [teacherId]
  );

  if ((profileResult.rowCount ?? 0) === 0) {
    return null;
  }

  const statsResult = await db.query(
    `SELECT COUNT(DISTINCT c.id)::int as classroom_count,
            COUNT(DISTINCT ce.student_id)::int as student_count,
            COUNT(DISTINCT p.id)::int as post_count,
            COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.subject), NULL), ARRAY[]::TEXT[]) as subjects
     FROM classrooms c
     LEFT JOIN classroom_enrollments ce ON ce.classroom_id = c.id AND ce.is_active = true
     LEFT JOIN posts p ON p.classroom_id = c.id AND p.is_active = true
     WHERE c.teacher_id = $1 AND c.is_active = true`,
    [teacherId]
  );

  return {
    ...profileResult.rows[0],
    ...(statsResult.rows[0] ?? {
      classroom_count: 0,
      student_count: 0,
      post_count: 0,
      subjects: [],
    }),
  };
}

function stringOrNull(value: unknown) {
  const text = `${value ?? ''}`.trim();
  return text.length === 0 ? null : text;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean).slice(0, 12);
  }

  const text = `${value ?? ''}`.trim();
  if (!text) return [];

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeInteger(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function normalizeLinks(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, link]) => [key.trim(), `${link ?? ''}`.trim()])
      .filter(([key, link]) => key && link)
      .slice(0, 8)
  );
}
