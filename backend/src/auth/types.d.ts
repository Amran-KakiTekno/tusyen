import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      role: 'student' | 'teacher' | 'parent' | 'admin';
      iat: number;
      authProvider?: string;
    };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: any) => Promise<void>;
    jwt: {
      sign: (payload: Record<string, unknown>, options?: { expiresIn?: string | number }) => string;
      verify: (token: string) => Promise<any>;
    };
  }
}
