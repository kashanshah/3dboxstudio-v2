import path from 'node:path';

/** The account the tests sign up once and then use throughout. */
export const TEST_USER = {
  name: 'E2E Tester',
  email: 'e2e-tester@e2e.test',
  password: 'e2e-Password-123',
};

/** The signed-in browser session, saved by global.setup.ts. */
export const USER_STATE = path.join(__dirname, '..', '.auth', 'user.json');

/** A signed-in admin session, saved by global.setup.ts (admin sign-in is rate limited). */
export const ADMIN_STATE = path.join(__dirname, '..', '.auth', 'admin.json');
