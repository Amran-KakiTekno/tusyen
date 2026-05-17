import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  createQaActors,
  expectJson,
  uniqueRunId,
  uploadSmallFile,
  visibleRunSuffix,
} from './support/api';

test.describe('full project feature coverage', () => {
  test('handles the mocked Keycloak OAuth callback in the SPA', async ({ page }) => {
    const user = {
      id: randomUUID(),
      email: `keycloak.${uniqueRunId('kc')}@tusyen.test`,
      role: 'student',
      fullName: 'Keycloak Student',
    };

    await page.route('**/api/auth/keycloak/callback', async (route) => {
      const requestBody = route.request().postDataJSON() as {
        code?: string;
        state?: string;
        redirectUri?: string;
      };
      expect(requestBody.code).toBe('mock-code');
      expect(requestBody.state).toBe('mock-state');
      expect(requestBody.redirectUri).toContain('/keycloak-callback');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          authProvider: 'keycloak',
          user,
        }),
      });
    });

    await page.goto('/keycloak-callback?code=mock-code&state=mock-state');
    await page.waitForFunction(() => localStorage.getItem('tusyen_token') === 'mock-access-token');

    const stored = await page.evaluate(() => ({
      token: localStorage.getItem('tusyen_token'),
      refreshToken: localStorage.getItem('tusyen_refresh_token'),
      user: JSON.parse(localStorage.getItem('tusyen_user') || '{}'),
    }));
    expect(stored.token).toBe('mock-access-token');
    expect(stored.refreshToken).toBe('mock-refresh-token');
    expect(stored.user.email).toBe(user.email);
  });

  test('exercises the main Tusyen feature workflows end to end', async ({ request, page }) => {
    test.setTimeout(180_000);

    const runId = uniqueRunId('full');
    const qa = await createQaActors(request, runId);
    const suffix = visibleRunSuffix(runId);
    const subject = `Matematik KSSM ${suffix}`;
    const secondarySubject = `Sains KSSM ${suffix}`;
    const youtubeUrl = 'https://youtu.be/dQw4w9WgXcQ';

    let classroomId = '';
    let joinCode = '';
    let syllabusId = '';
    let lessonId = '';
    let postId = '';
    let whiteboardSessionId = '';
    let quizSessionId = '';
    let quizParticipantToken = '';

    await test.step('auth, registration, refresh, and Keycloak bootstrap endpoints', async () => {
      const registered = await expectJson<{
        token: string;
        user: { email: string; role: string };
      }>(await request.post('/api/auth/register', {
        data: {
          email: `registered.${runId}@tusyen.test`,
          password: 'password123',
          role: 'student',
          fullName: `Nur Aina Zulkifli ${suffix}`,
        },
      }));
      expect(registered.user.role).toBe('student');
      expect(registered.token).toBeTruthy();

      const refresh = await qa.student.api.postJson<{ token: string }>('/api/auth/refresh', {
        refreshToken: qa.student.refreshToken,
      });
      expect(refresh.token).toBeTruthy();

      const keycloakStatus = await expectJson<{
        enabled: boolean;
        flow: string;
        callbackPath: string;
      }>(await request.get('/api/auth/keycloak/status'));
      expect(keycloakStatus.enabled).toBe(true);
      expect(keycloakStatus.flow).toBe('authorization_code_pkce');

      const loginUrl = await expectJson<{ url: string; state: string }>(
        await request.post('/api/auth/keycloak/login-url', {
          data: { redirectUri: 'http://localhost/keycloak-callback' },
        }),
      );
      expect(loginUrl.url).toContain('/auth/realms/');
      expect(loginUrl.state).toBeTruthy();
    });

    await test.step('admin users, parent links, classrooms, syllabus, lessons, notifications, and health', async () => {
      const users = await qa.admin.api.getJson<{ users: Array<{ id: string }> }>('/api/admin/users', {
        params: { limit: 10 },
      });
      expect(users.users.length).toBeGreaterThan(0);

      const studentDetail = await qa.admin.api.getJson<{ user: { id: string } }>(
        `/api/admin/users/${qa.student.user.id}`,
      );
      expect(studentDetail.user.id).toBe(qa.student.user.id);

      const updatedStudent = await qa.admin.api.patchJson<{ user: { phone_number: string } }>(
        `/api/admin/users/${qa.student.user.id}`,
        { phoneNumber: '+60123456789', isActive: true },
      );
      expect(updatedStudent.user.phone_number).toBe('+60123456789');

      await qa.admin.api.patchJson(`/api/admin/users/${qa.student.user.id}/status`, { isActive: true });

      const link = await qa.admin.api.postJson<{ link: { id: string } }>('/api/admin/parent-links', {
        parentId: qa.parent.user.id,
        studentId: qa.student.user.id,
      });
      expect(link.link.id).toBeTruthy();

      const links = await qa.admin.api.getJson<{ links: Array<{ id: string }> }>('/api/admin/parent-links', {
        params: { parentId: qa.parent.user.id },
      });
      expect(links.links.some((item) => item.id === link.link.id)).toBe(true);

      const adminClass = await qa.admin.api.postJson<{ classroom: { id: string } }>('/api/admin/classrooms', {
        teacherId: qa.teacher.user.id,
        name: `Kelas Sains 4 Bestari ${suffix}`,
        subject: secondarySubject,
        formLevel: 4,
        isPublic: false,
      });
      expect(adminClass.classroom.id).toBeTruthy();

      await qa.admin.api.patchJson(`/api/admin/classrooms/${adminClass.classroom.id}`, {
        name: `Kelas Sains 4 Bestari Tambahan ${suffix}`,
        isPublic: true,
      });
      await qa.admin.api.postJson(`/api/admin/classrooms/${adminClass.classroom.id}/students`, {
        studentId: qa.student.user.id,
      });
      await qa.admin.api.deleteJson(`/api/admin/classrooms/${adminClass.classroom.id}/students/${qa.student.user.id}`);
      await qa.admin.api.deleteJson(`/api/admin/classrooms/${adminClass.classroom.id}`);

      const stats = await qa.admin.api.getJson<{ stats: Record<string, string> }>('/api/admin/stats');
      expect(Number(stats.stats.all_users)).toBeGreaterThan(0);

      const crudSyllabus = await qa.admin.api.postJson<{ item: { id: string } }>('/api/admin/syllabus', {
        subject: secondarySubject,
        formLevel: 4,
        topic: `Respirasi Sel ${suffix}`,
        subtopic: 'Pengenalan',
        orderIndex: 1,
        content: { summary: 'Murid mengenal pasti proses respirasi sel dan keperluan tenaga.' },
      });
      await qa.admin.api.patchJson(`/api/admin/syllabus/${crudSyllabus.item.id}`, {
        subject: secondarySubject,
        formLevel: 4,
        topic: `Respirasi Sel dan Tenaga ${suffix}`,
        subtopic: 'Latihan berstruktur',
        orderIndex: 2,
        content: { summary: 'Latihan dikemaskini untuk mengaitkan respirasi sel dengan penghasilan tenaga.' },
      });

      const adminLesson = await qa.admin.api.postJson<{ lessonId: string }>('/api/admin/lessons', {
        syllabusId: crudSyllabus.item.id,
        title: `Latihan Respirasi Sel ${suffix}`,
        content: { summary: 'Latihan ringkas tentang respirasi sel untuk kelas Sains Tingkatan 4.' },
        difficulty: 'easy',
        estimatedMinutes: 5,
        quizData: {
          questions: [{
            questionText: 'Respirasi sel berlaku dalam sel hidup.',
            questionType: 'true_false',
            correctAnswer: true,
            explanation: 'Betul. Respirasi sel membebaskan tenaga untuk kegunaan sel.',
          }],
        },
      });
      await qa.admin.api.getJson(`/api/admin/lessons/${adminLesson.lessonId}`);
      await qa.admin.api.patchJson(`/api/admin/lessons/${adminLesson.lessonId}`, {
        syllabusId: crudSyllabus.item.id,
        title: `Latihan Respirasi Sel Lanjutan ${suffix}`,
        content: { summary: 'Latihan dikemaskini dengan fokus pada tenaga dan glukosa.' },
        difficulty: 'medium',
        estimatedMinutes: 6,
      });
      await qa.admin.api.deleteJson(`/api/admin/lessons/${adminLesson.lessonId}`);
      await qa.admin.api.deleteJson(`/api/admin/syllabus/${crudSyllabus.item.id}`);

      const notificationHealth = await qa.admin.api.getJson<{ notifications: { enabled: boolean } }>(
        '/api/admin/notifications/health',
      );
      expect(notificationHealth.notifications).toBeTruthy();

      const notificationSmoke = await qa.admin.api.postJson<{ result: unknown }>(
        '/api/admin/notifications/test',
        {
          title: `Makluman Kelas Matematik ${suffix}`,
          message: 'Peringatan ringkas untuk semakan jadual ulang kaji minggu ini.',
        },
      );
      expect(notificationSmoke.result).toBeTruthy();

      const adminHealth = await qa.admin.api.getJson<{ database: string; cache: string }>('/api/admin/health');
      expect(adminHealth.database).toBe('connected');
      expect(adminHealth.cache).toBe('connected');
    });

    await test.step('teacher profile, classroom lifecycle, parent access, and lesson assignment', async () => {
      const profile = await qa.teacher.api.patchJson<{ profile: { headline: string } }>('/api/profile/me', {
        headline: 'Cikgu Matematik KSSM Tingkatan 4',
        bio: 'Membimbing murid membina asas graf linear melalui latihan berfokus dan maklum balas cepat.',
        specialties: ['Matematik KSSM', 'Ulang kaji SPM'],
        credentials: 'Ijazah Pendidikan Matematik',
        yearsExperience: 7,
        location: 'Pulau Pinang',
        links: { website: 'https://example.com' },
      });
      expect(profile.profile.headline).toBe('Cikgu Matematik KSSM Tingkatan 4');

      const publicProfile = await qa.student.api.getJson<{ profile: { id: string } }>(
        `/api/profile/teachers/${qa.teacher.user.id}`,
      );
      expect(publicProfile.profile.id).toBe(qa.teacher.user.id);

      const classroom = await qa.teacher.api.postJson<{
        classroom: { id: string; joinCode: string };
      }>('/api/classroom', {
        name: `Kelas Matematik 4 Cemerlang ${suffix}`,
        description: 'Kelas ulang kaji fungsi linear, graf, dan latihan kuiz mingguan.',
        subject,
        formLevel: 4,
        isPublic: false,
      });
      classroomId = classroom.classroom.id;
      joinCode = classroom.classroom.joinCode;
      expect(classroomId).toBeTruthy();
      expect(joinCode).toBeTruthy();

      await qa.student.api.postJson(`/api/classroom/${classroomId}/join`, { joinCode });

      const teacherClasses = await qa.teacher.api.getJson<{ classrooms: Array<{ id: string }> }>('/api/classroom');
      expect(teacherClasses.classrooms.some((item) => item.id === classroomId)).toBe(true);

      const studentClasses = await qa.student.api.getJson<{ classrooms: Array<{ id: string }> }>('/api/classroom');
      expect(studentClasses.classrooms.some((item) => item.id === classroomId)).toBe(true);

      const parentClasses = await qa.parent.api.getJson<{ classrooms: Array<{ id: string }> }>('/api/classroom');
      expect(parentClasses.classrooms.some((item) => item.id === classroomId)).toBe(true);

      const linkedStudents = await qa.parent.api.getJson<{ students: Array<{ id: string }> }>(
        '/api/auth/linked-students',
      );
      expect(linkedStudents.students.some((item) => item.id === qa.student.user.id)).toBe(true);

      const leaveClass = await qa.teacher.api.postJson<{ classroom: { id: string; joinCode: string } }>(
        '/api/classroom',
        {
          name: `Kumpulan Latihan Graf ${suffix}`,
          subject,
          formLevel: 4,
        },
      );
      await qa.student.api.postJson(`/api/classroom/${leaveClass.classroom.id}/join`, {
        joinCode: leaveClass.classroom.joinCode,
      });
      await qa.student.api.postJson(`/api/classroom/${leaveClass.classroom.id}/leave`);
      await qa.teacher.api.deleteJson(`/api/classroom/${leaveClass.classroom.id}`);

      await qa.teacher.api.patchJson(`/api/classroom/${classroomId}`, {
        description: 'Jadual ulang kaji minggu ini telah dikemaskini untuk latihan graf.',
        isPublic: true,
      });

      const students = await qa.teacher.api.getJson<{ students: Array<{ id: string }> }>(
        `/api/classroom/${classroomId}/students`,
      );
      expect(students.students.some((item) => item.id === qa.student.user.id)).toBe(true);

      const analytics = await qa.teacher.api.getJson<{ totalStudents: number }>(
        `/api/classroom/${classroomId}/analytics`,
      );
      expect(analytics.totalStudents).toBeGreaterThanOrEqual(1);

      const createdSyllabus = await qa.admin.api.postJson<{ item: { id: string } }>('/api/admin/syllabus', {
        subject,
        formLevel: 4,
        topic: `Fungsi Linear ${suffix}`,
        subtopic: 'Kecerunan',
        orderIndex: 10,
        content: { summary: 'Fokus kepada kecerunan, pintasan-y, dan tafsiran graf linear.' },
      });
      syllabusId = createdSyllabus.item.id;

      const visibleSyllabus = await qa.student.api.getJson<{ syllabus: Array<{ id: string }> }>(
        '/api/learning/syllabus',
        { params: { subject, formLevel: 4 } },
      );
      expect(visibleSyllabus.syllabus.some((item) => item.id === syllabusId)).toBe(true);

      const createdLesson = await qa.teacher.api.postJson<{ lessonId: string }>('/api/learning/lessons', {
        syllabusId,
        title: `Latihan Kecerunan Graf ${suffix}`,
        content: {
          summary: 'Pelajar membaca konsep ringkas sebelum menjawab kuiz kecerunan.',
          blocks: [
            { type: 'section', title: 'Konsep', body: 'Kecerunan menunjukkan kadar perubahan pada garis lurus.' },
            { type: 'embed', title: 'Video Rujukan', url: youtubeUrl },
          ],
        },
        difficulty: 'easy',
        estimatedMinutes: 8,
        quizData: {
          questions: [
            {
              questionText: 'Nilai manakah ialah kecerunan bagi y = 2x + 1?',
              questionType: 'multiple_choice',
              options: ['2', '1', 'x', 'y'],
              correctAnswer: 0,
              explanation: 'Pekali bagi x ialah nilai kecerunan.',
              points: 2,
            },
          ],
        },
      });
      lessonId = createdLesson.lessonId;

      await qa.teacher.api.getJson('/api/learning/catalog', { params: { subject, formLevel: 4 } });
      await qa.teacher.api.getJson(`/api/learning/authoring/lessons/${lessonId}`);
      await qa.teacher.api.patchJson(`/api/learning/lessons/${lessonId}`, {
        syllabusId,
        title: `Latihan Kecerunan Graf Lanjutan ${suffix}`,
        content: {
          summary: 'Ringkasan dikemaskini dengan contoh pintasan-y.',
          blocks: [
            { type: 'text', title: 'Peringatan', body: 'Semak pekali x untuk mengenal pasti kecerunan.' },
          ],
        },
        difficulty: 'medium',
        estimatedMinutes: 9,
      });

      await qa.teacher.api.postJson(`/api/classroom/${classroomId}/lessons`, {
        lessonId,
        isRequired: true,
      });

      const classroomLessons = await qa.teacher.api.getJson<{ lessons: Array<{ id: string }> }>(
        `/api/classroom/${classroomId}/lessons`,
      );
      expect(classroomLessons.lessons.some((item) => item.id === lessonId)).toBe(true);
    });

    await test.step('student learning, progress, achievements, leaderboard, and parent progress', async () => {
      const assigned = await qa.student.api.getJson<{ lessons: Array<{ id: string; classroom_id: string }> }>(
        '/api/learning/lessons',
        { params: { classroomId } },
      );
      expect(assigned.lessons.some((item) => item.id === lessonId)).toBe(true);

      const detail = await qa.student.api.getJson<{
        lesson: { id: string; content_block_count?: number };
        questions: Array<{ id: string; options: string[] }>;
      }>(`/api/learning/lessons/${lessonId}`, { params: { classroomId } });
      expect(detail.lesson.id).toBe(lessonId);
      expect(detail.questions.length).toBeGreaterThan(0);

      const answers = detail.questions.map((question) => ({
        questionId: question.id,
        answer: Array.isArray(question.options) && question.options.length ? question.options[0] : 'Betul',
      }));

      const submission = await qa.student.api.postJson<{
        result: { isCompleted: boolean; completionPercentage: number };
      }>(`/api/learning/lessons/${lessonId}/submit`, {
        classroomId,
        answers,
        timeSpentSeconds: 42,
        contentReviewed: true,
        contentReviewSeconds: 12,
        contentBlockCount: detail.lesson.content_block_count || 1,
      });
      expect(submission.result.isCompleted).toBe(true);
      expect(submission.result.completionPercentage).toBe(100);

      const progress = await qa.student.api.getJson<{ progress: Array<{ lesson_id: string }> }>(
        `/api/progress/student/${qa.student.user.id}`,
      );
      expect(progress.progress.some((item) => item.lesson_id === lessonId)).toBe(true);

      const stats = await qa.student.api.getJson<{ overall: Record<string, string>; streak: { current: number } }>(
        `/api/progress/student/${qa.student.user.id}/stats`,
      );
      expect(Number(stats.overall.total_lessons_attempted)).toBeGreaterThan(0);

      const teacherProgress = await qa.teacher.api.getJson<{ students: Array<{ student_id: string }> }>(
        `/api/progress/classroom/${classroomId}`,
      );
      expect(teacherProgress.students.some((item) => item.student_id === qa.student.user.id)).toBe(true);

      const leaderboard = await qa.student.api.getJson<{ leaderboard: Array<{ student_id: string }> }>(
        `/api/progress/classroom/${classroomId}/leaderboard`,
      );
      expect(leaderboard.leaderboard.some((item) => item.student_id === qa.student.user.id)).toBe(true);

      await qa.student.api.getJson(`/api/progress/lesson/${lessonId}`);
      await qa.teacher.api.getJson(`/api/progress/lesson/${lessonId}`);
      await qa.parent.api.getJson(`/api/progress/lesson/${lessonId}`);
      await qa.parent.api.getJson(`/api/progress/student/${qa.student.user.id}/stats`);
      await qa.student.api.getJson('/api/progress/me/achievements');
      await qa.student.api.postJson('/api/progress/streak/check');

      const parentLessons = await qa.parent.api.getJson<{ lessons: Array<{ id: string }> }>('/api/learning/lessons');
      expect(parentLessons.lessons.some((item) => item.id === lessonId)).toBe(true);

      const lowScoreSyllabus = await qa.admin.api.postJson<{ item: { id: string } }>('/api/admin/syllabus', {
        subject: secondarySubject,
        formLevel: 4,
        topic: `Amaran Prestasi ${suffix}`,
        subtopic: 'Skor rendah',
        orderIndex: 20,
        content: { summary: 'Item khusus untuk menghasilkan amaran prestasi ibu bapa.' },
      });
      const lowScoreLesson = await qa.teacher.api.postJson<{ lessonId: string }>('/api/learning/lessons', {
        syllabusId: lowScoreSyllabus.item.id,
        title: `Semakan Skor Rendah ${suffix}`,
        content: { summary: 'Latihan ringkas untuk menguji amaran skor rendah.', blocks: [] },
        difficulty: 'easy',
        estimatedMinutes: 4,
        quizData: {
          questions: [{
            questionText: 'Pilih jawapan betul.',
            questionType: 'multiple_choice',
            options: ['Betul', 'Salah'],
            correctAnswer: 0,
            points: 1,
          }],
        },
      });
      await qa.teacher.api.postJson(`/api/classroom/${classroomId}/lessons`, {
        lessonId: lowScoreLesson.lessonId,
        isRequired: true,
      });
      const lowScoreDetail = await qa.student.api.getJson<{
        questions: Array<{ id: string }>;
      }>(`/api/learning/lessons/${lowScoreLesson.lessonId}`, { params: { classroomId } });
      await qa.student.api.postJson(`/api/learning/lessons/${lowScoreLesson.lessonId}/submit`, {
        classroomId,
        answers: [{ questionId: lowScoreDetail.questions[0].id, answer: 'Salah' }],
        contentReviewed: true,
        contentBlockCount: 0,
      });

      const parentAlerts = await qa.parent.api.getJson<{
        alerts: Array<{
          childId?: string;
          severity?: string;
          avgScore7d?: number;
          trendDirection?: string;
        }>;
      }>('/api/auth/parent/alerts');
      expect(Array.isArray(parentAlerts.alerts)).toBe(true);
      expect(parentAlerts.alerts).toContainEqual(expect.objectContaining({
        childId: qa.student.user.id,
        severity: 'high',
        avgScore7d: expect.any(Number),
        trendDirection: expect.any(String),
      }));
    });

    await test.step('classroom feed posts, rich embeds, comments, reactions, and moderation', async () => {
      const createdPost = await qa.teacher.api.postJson<{ post: { id: string; attachments: unknown[] } }>(
        '/api/feed/posts',
        {
          classroomId,
          title: `Makluman Ulang Kaji Graf ${suffix}`,
          content: 'Sila siapkan latihan graf linear sebelum kelas bimbingan seterusnya.',
          postType: 'announcement',
          isPinned: true,
          attachments: [{ type: 'embed', url: youtubeUrl, name: 'Video rujukan graf' }],
        },
      );
      postId = createdPost.post.id;
      expect(postId).toBeTruthy();

      await qa.teacher.api.patchJson(`/api/feed/posts/${postId}`, {
        title: `Makluman Ulang Kaji Graf Dikemaskini ${suffix}`,
        content: 'Latihan tambahan telah ditambah untuk soalan kecerunan.',
      });

      const studentFeed = await qa.student.api.getJson<{ posts: Array<{ id: string }> }>('/api/feed/posts', {
        params: { classroomId },
      });
      expect(studentFeed.posts.some((item) => item.id === postId)).toBe(true);

      await qa.student.api.postJson(`/api/feed/posts/${postId}/reaction`, { reactionType: 'like' });
      const comment = await qa.student.api.postJson<{ comment: { id: string } }>(
        `/api/feed/posts/${postId}/comments`,
        {
          content: 'Saya sudah cuba soalan pertama dan akan semak semula pintasan-y.',
          attachments: [{ type: 'embed', url: youtubeUrl, name: 'Video ulang kaji' }],
        },
      );
      expect(comment.comment.id).toBeTruthy();

      await qa.student.api.patchJson(`/api/feed/comments/${comment.comment.id}`, {
        content: 'Saya sudah betulkan jawapan selepas semak video ulang kaji.',
      });

      const comments = await qa.teacher.api.getJson<{ comments: Array<{ id: string }> }>(
        `/api/feed/posts/${postId}/comments`,
      );
      expect(comments.comments.some((item) => item.id === comment.comment.id)).toBe(true);

      const parentFeed = await qa.parent.api.getJson<{ posts: Array<{ id: string }> }>('/api/feed/posts', {
        params: { classroomId },
      });
      expect(parentFeed.posts.some((item) => item.id === postId)).toBe(true);

      await qa.student.api.deleteJson(`/api/feed/posts/${postId}/reaction`);
      await qa.student.api.deleteJson(`/api/feed/comments/${comment.comment.id}`);

      const disposable = await qa.teacher.api.postJson<{ post: { id: string } }>('/api/feed/posts', {
        classroomId,
        title: `Nota Sementara ${suffix}`,
        content: 'Draf pengumuman yang akan dipadam selepas semakan guru.',
      });
      await qa.teacher.api.deleteJson(`/api/feed/posts/${disposable.post.id}`);
    });

    await test.step('storage upload/download/list/content/delete and sync endpoints', async () => {
      const upload = await uploadSmallFile(qa.teacher.api, {
        name: `nota-graf-${suffix}.txt`,
        mimeType: 'text/plain',
        content: `Nota ringkas kecerunan graf linear ${suffix}`,
      });
      expect(upload.success).toBe(true);
      expect(upload.fileId).toBeTruthy();

      const files = await qa.teacher.api.getJson<{ files: Array<{ id: string }> }>('/api/storage/files');
      expect(files.files.some((item) => item.id === upload.fileId)).toBe(true);

      const content = await qa.teacher.api.get(`/api/storage/files/${upload.fileId}/content`);
      expect(content.ok(), await content.text()).toBeTruthy();

      const download = await qa.teacher.api.postJson<{ downloadUrl: string }>('/api/storage/download-url', {
        fileId: upload.fileId,
      });
      expect(download.downloadUrl).toContain(upload.objectName);

      await qa.teacher.api.deleteJson(`/api/storage/files/${upload.fileId}`);

      const deviceId = `tablet-pelajar-${suffix}`;
      const pushed = await qa.student.api.postJson<{ success: number; failed: number }>('/api/sync/push', {
        deviceId,
        lastSyncAt: null,
        operations: [],
      });
      expect(pushed.failed).toBe(0);

      const pulled = await qa.student.api.postJson<{ changes: Record<string, unknown[]> }>('/api/sync/pull', {
        deviceId,
        lastSyncAt: '1970-01-01T00:00:00.000Z',
        tables: ['progress', 'lessons', 'posts', 'whiteboard_sessions'],
      });
      expect(pulled.changes).toHaveProperty('progress');

      const syncStatus = await qa.student.api.getJson<{ devices: Array<{ device_id: string }> }>('/api/sync/status');
      expect(syncStatus.devices.some((item) => item.device_id === deviceId)).toBe(true);

      await qa.student.api.postJson('/api/sync/resolve', {
        conflictId: randomUUID(),
        resolution: 'server',
        winningValue: { source: 'tablet-pelajar' },
      });
    });

    await test.step('whiteboard sessions, classroom websocket, drawing events, recordings, and replay', async () => {
      const started = await qa.teacher.api.postJson<{ session: { id: string; status: string } }>(
        '/api/whiteboard/session',
        {
          classroomId,
          title: `Papan Putih Graf Linear ${suffix}`,
          description: 'Sesi papan putih untuk membina graf dan menanda pintasan-y.',
        },
      );
      whiteboardSessionId = started.session.id;
      expect(started.session.status).toBe('active');

      const active = await qa.student.api.getJson<{ active: boolean; session: { id: string } }>(
        `/api/whiteboard/session/active/${classroomId}`,
      );
      expect(active.active).toBe(true);
      expect(active.session.id).toBe(whiteboardSessionId);

      const socketMessages = await exerciseClassroomWebSocket(page, classroomId, qa.teacher.token);
      expect(socketMessages).toEqual(expect.arrayContaining(['CONNECTED', 'AUTH_SUCCESS', 'PONG']));

      const joined = await qa.student.api.postJson<{ centrifugoToken: string; channel: string }>(
        `/api/whiteboard/session/${whiteboardSessionId}/join`,
      );
      expect(joined.centrifugoToken).toBeTruthy();
      expect(joined.channel).toBe(`whiteboard:${whiteboardSessionId}`);

      const events = await qa.teacher.api.getJson<{ events: Array<{ event_type: string }> }>(
        `/api/whiteboard/session/${whiteboardSessionId}/events`,
      );
      expect(events.events.some((event) => event.event_type === 'draw')).toBe(true);

      await qa.teacher.api.postJson(`/api/whiteboard/session/${whiteboardSessionId}/end`);

      const recordingUpload = await uploadSmallFile(qa.teacher.api, {
        bucket: 'whiteboard',
        name: `rakaman-graf-${suffix}.webm`,
        mimeType: 'video/webm',
        content: Buffer.from('rakaman papan putih graf linear'),
      });

      const recording = await qa.teacher.api.postJson<{ recording: { fileId: string; url: string } }>(
        `/api/whiteboard/session/${whiteboardSessionId}/recording`,
        {
          fileId: recordingUpload.fileId,
          durationSeconds: 2,
          fileSizeBytes: recordingUpload.size,
        },
      );
      expect(recording.recording.fileId).toBe(recordingUpload.fileId);
      expect(recording.recording.url).toContain('/api/storage/files/');

      const history = await qa.student.api.getJson<{ sessions: Array<{ id: string }> }>(
        `/api/whiteboard/sessions/${classroomId}`,
      );
      expect(history.sessions.some((item) => item.id === whiteboardSessionId)).toBe(true);

      await qa.teacher.api.deleteJson(`/api/whiteboard/session/${whiteboardSessionId}/recording`);
    });

    await test.step('live quiz decks, sessions, joins, quiz websocket, answers, summaries, and cleanup', async () => {
      const deck = await qa.teacher.api.postJson<{ deck: { id: string; question_count?: string } }>(
        '/api/quiz/decks',
        {
          title: `Kuiz Pantas Graf Linear ${suffix}`,
          description: 'Kuiz pantas untuk semak kefahaman kecerunan dan pintasan.',
          subject,
          formLevel: 4,
          questions: [
            {
              questionText: 'Berapakah nilai 2 + 2?',
              questionType: 'multiple_choice',
              options: ['4', '5', '22', '0'],
              correctAnswer: 0,
              explanation: '2 + 2 = 4.',
              points: 1000,
              timeLimitSeconds: 30,
            },
          ],
        },
      );
      expect(deck.deck.id).toBeTruthy();

      const fetchedDeck = await qa.teacher.api.getJson<{ deck: { id: string; questions: unknown[] } }>(
        `/api/quiz/decks/${deck.deck.id}`,
      );
      expect(fetchedDeck.deck.questions.length).toBe(1);

      await qa.teacher.api.patchJson(`/api/quiz/decks/${deck.deck.id}`, {
        title: `Kuiz Pantas Graf Linear Dikemaskini ${suffix}`,
        description: 'Kuiz dikemaskini dengan soalan benar atau palsu.',
        subject,
        formLevel: 4,
        questions: [
          {
            questionText: 'Betul atau salah: 2 + 2 = 4.',
            questionType: 'true_false',
            correctAnswer: true,
            timeLimitSeconds: 30,
          },
        ],
      });

      const session = await qa.teacher.api.postJson<{
        session: { id: string; pin: string };
        snapshot: { session: { status: string } };
      }>('/api/quiz/sessions', {
        classroomId,
        deckId: deck.deck.id,
      });
      quizSessionId = session.session.id;
      expect(session.snapshot.session.status).toBe('lobby');

      const joined = await qa.student.api.postJson<{
        participant: { joinToken: string };
      }>('/api/quiz/join', {
        pin: session.session.pin,
        nickname: 'Nur Iman',
      });
      quizParticipantToken = joined.participant.joinToken;
      expect(quizParticipantToken).toBeTruthy();

      const guestJoinResponse = await request.post('/api/quiz/join', {
        data: { pin: session.session.pin, nickname: `Tetamu ${suffix}` },
      });
      if (process.env.ALLOW_GUEST_QUIZ_JOIN === 'true') {
        const guest = await expectJson<{ participant: { isGuest: boolean } }>(guestJoinResponse);
        expect(guest.participant.isGuest).toBe(true);
      } else {
        expect(
          [401, 403],
          `Guest quiz join should be rejected when ALLOW_GUEST_QUIZ_JOIN is disabled. Response: ${await guestJoinResponse.text()}`,
        ).toContain(guestJoinResponse.status());
      }

      await qa.teacher.api.postJson(`/api/quiz/sessions/${quizSessionId}/start`);

      const paused = await qa.teacher.api.postJson<{
        snapshot: { session: { questionPausedAt: string | null; questionRemainingMs: number | null } };
      }>(`/api/quiz/sessions/${quizSessionId}/timer`, { action: 'pause' });
      expect(paused.snapshot.session.questionPausedAt).toBeTruthy();
      expect(paused.snapshot.session.questionRemainingMs).toBeGreaterThan(0);

      const resumed = await qa.teacher.api.postJson<{
        snapshot: { session: { questionPausedAt: string | null; questionEndsAt: string | null } };
      }>(`/api/quiz/sessions/${quizSessionId}/timer`, { action: 'resume' });
      expect(resumed.snapshot.session.questionPausedAt).toBeNull();
      expect(resumed.snapshot.session.questionEndsAt).toBeTruthy();

      const quizSocketMessages = await exerciseQuizWebSocket(page, quizSessionId, quizParticipantToken);
      expect(quizSocketMessages).toEqual(expect.arrayContaining(['CONNECTED', 'AUTH_SUCCESS', 'QUIZ_STATE', 'PONG']));

      const participantState = await qa.student.api.getJson<{ snapshot: { session: { id: string } } }>(
        `/api/quiz/sessions/${quizSessionId}/state`,
        { params: { participantToken: quizParticipantToken } },
      );
      expect(participantState.snapshot.session.id).toBe(quizSessionId);

      const teacherState = await qa.teacher.api.getJson<{ snapshot: { session: { id: string } } }>(
        `/api/quiz/sessions/${quizSessionId}/state`,
      );
      expect(teacherState.snapshot.session.id).toBe(quizSessionId);

      const answer = await qa.student.api.postJson<{ isCorrect: boolean }>(
        `/api/quiz/sessions/${quizSessionId}/answers`,
        {
          participantToken: quizParticipantToken,
          selectedOptionIndex: 0,
        },
      );
      expect(answer.isCorrect).toBe(true);

      await qa.teacher.api.postJson(`/api/quiz/sessions/${quizSessionId}/advance`);
      await qa.teacher.api.postJson(`/api/quiz/sessions/${quizSessionId}/end`);

      const sessions = await qa.teacher.api.getJson<{ sessions: Array<{ id: string }> }>(
        `/api/quiz/classrooms/${classroomId}/sessions`,
      );
      expect(sessions.sessions.some((item) => item.id === quizSessionId)).toBe(true);

      await qa.student.api.getJson('/api/quiz/me/summary');
      await qa.parent.api.getJson(`/api/quiz/students/${qa.student.user.id}/summary`);

      await qa.teacher.api.deleteJson(`/api/quiz/decks/${deck.deck.id}`);
    });

    await test.step('final admin cache maintenance', async () => {
      const cleared = await qa.admin.api.postJson<{ success: boolean }>('/api/admin/cache/clear');
      expect(cleared.success).toBe(true);
    });
  });
});

async function exerciseClassroomWebSocket(page: any, classroomId: string, token: string) {
  await page.goto('/');
  return page.evaluate(
    ({ classroomId: targetClassroomId, token: authToken }) => new Promise<string[]>((resolve, reject) => {
      const origin = window.location.origin.replace(/^http/, 'ws');
      const ws = new WebSocket(`${origin}/ws/classroom/${targetClassroomId}`);
      const messages: string[] = [];
      const timer = window.setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out waiting for classroom websocket. Messages: ${messages.join(', ')}`));
      }, 10_000);

      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error(`Classroom websocket error. Messages: ${messages.join(', ')}`));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        messages.push(data.type);

        if (data.type === 'CONNECTED') {
          ws.send(JSON.stringify({ type: 'AUTH', token: authToken }));
        }

        if (data.type === 'AUTH_SUCCESS') {
          ws.send(JSON.stringify({
            type: 'WHITEBOARD_DRAW',
            strokes: [{ color: '#8B5CF6', width: 3, points: [[0.1, 0.1], [0.4, 0.4]] }],
          }));
          ws.send(JSON.stringify({ type: 'PING' }));
        }

        if (data.type === 'PONG') {
          window.clearTimeout(timer);
          ws.close();
          resolve(messages);
        }
      };
    }),
    { classroomId, token },
  );
}

async function exerciseQuizWebSocket(page: any, sessionId: string, participantToken: string) {
  await page.goto('/');
  return page.evaluate(
    ({ sessionId: targetSessionId, participantToken: joinToken }) => new Promise<string[]>((resolve, reject) => {
      const origin = window.location.origin.replace(/^http/, 'ws');
      const ws = new WebSocket(`${origin}/ws/quiz/${targetSessionId}`);
      const messages: string[] = [];
      let sawState = false;
      let sawPong = false;
      const timer = window.setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out waiting for quiz websocket. Messages: ${messages.join(', ')}`));
      }, 10_000);
      const maybeResolve = () => {
        if (!sawState || !sawPong) return;
        window.clearTimeout(timer);
        ws.close();
        resolve(messages);
      };

      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error(`Quiz websocket error. Messages: ${messages.join(', ')}`));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data));
        messages.push(data.type);

        if (data.type === 'CONNECTED') {
          ws.send(JSON.stringify({ type: 'AUTH', participantToken: joinToken }));
        }

        if (data.type === 'AUTH_SUCCESS') {
          ws.send(JSON.stringify({ type: 'PING' }));
        }

        if (data.type === 'QUIZ_STATE') {
          sawState = true;
          maybeResolve();
        }

        if (data.type === 'PONG') {
          sawPong = true;
          maybeResolve();
        }
      };
    }),
    { sessionId, participantToken },
  );
}
