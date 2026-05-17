const dotenv = require('dotenv');
const { Client } = require('pg');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  databaseUrlFromParts();

const client = new Client({
  connectionString,
});

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

async function getTeacherId() {
  const result = await client.query(
    'SELECT id FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1',
    ['teacher']
  );
  if (result.rowCount === 0) {
    throw new Error('No teacher user found');
  }
  return result.rows[0].id;
}

async function getLessonIds(subject, formLevel, limit) {
  const result = await client.query(
    'SELECT id FROM lessons WHERE subject = $1 AND form_level = $2 AND is_active = true ORDER BY created_at, id LIMIT $3',
    [subject, formLevel, limit]
  );
  if (result.rows.length < limit) {
    throw new Error(`Expected ${limit} lessons for ${subject} Form ${formLevel}, found ${result.rows.length}`);
  }
  return result.rows.map((row) => row.id);
}

async function getClassroomId(name) {
  const result = await client.query(
    'SELECT id FROM classrooms WHERE name = $1 AND is_active = true LIMIT 1',
    [name]
  );
  if (result.rowCount === 0) {
    const legacyNameMap = {
      'Math Focus': 'Tingkatan 4 Matematik Fokus',
      'Science Lab': 'Tingkatan 4 Sains Eksperimen',
      'English SPM': 'Tingkatan 5 Bahasa Inggeris SPM',
    };

    const legacyName = legacyNameMap[name];
    const legacyResult = legacyName
      ? await client.query(
          'SELECT id FROM classrooms WHERE name = $1 AND is_active = true LIMIT 1',
          [legacyName]
        )
      : { rowCount: 0 };

    if (legacyResult.rowCount === 0) {
      throw new Error(`Classroom not found: ${name}`);
    }
    return legacyResult.rows[0].id;
  }
  return result.rows[0].id;
}

async function assignLessons(classroomId, lessonIds, assignedBy, dueDateOffsetDays = null, required = true) {
  const now = new Date();
  const dueDate = dueDateOffsetDays == null ? null : addDays(now, dueDateOffsetDays);

  for (const lessonId of lessonIds) {
    await client.query(
      `INSERT INTO classroom_lessons (classroom_id, lesson_id, assigned_by, is_required, due_date, assigned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (classroom_id, lesson_id) DO NOTHING`,
      [
        classroomId,
        lessonId,
        assignedBy,
        required,
        dueDate,
      ]
    );
  }
}

async function main() {
  await client.connect();
  try {
    const teacherId = await getTeacherId();

    const mathClassroomId = await getClassroomId('Math Focus');
    const scienceClassroomId = await getClassroomId('Science Lab');
    const englishClassroomId = await getClassroomId('English SPM');

    const mathLessons = await getLessonIds('Matematik', 4, 5);
    const biologyLessons = await getLessonIds('Biology', 4, 5);
    const physicsLessons = await getLessonIds('Physics', 4, 5);

    await assignLessons(mathClassroomId, mathLessons, teacherId, null, true);
    await assignLessons(scienceClassroomId, biologyLessons, teacherId, 7, true);
    await assignLessons(englishClassroomId, physicsLessons, teacherId, 14, true);

    console.log('Seeded classroom lessons for demo classrooms.');
  } catch (error) {
    console.error('Failed to seed classroom lessons.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

function databaseUrlFromParts() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DATABASE_URL or DB_PASSWORD must be set');
  }

  return `postgres://${process.env.DB_USER || 'eduuser'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduapp'}`;
}
