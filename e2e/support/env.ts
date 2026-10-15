// Ports and the site's configuration for the browser tests: every outside
// service is a local stand-in (services.mjs), so nothing leaves the machine.

export const PORT = Number(process.env.E2E_PORT || 3100);
export const BASE_URL = `http://localhost:${PORT}`;
export const DB_PORT = 5490;
export const S3_PORT = 5491;
export const MAIL_PORT = 5492;
export const ADMIN_PASSWORD = 'e2e-admin-password';

export const siteEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://e2e:e2e@e2e.invalid/e2e',
  NEON_FETCH_ENDPOINT: `http://127.0.0.1:${DB_PORT}/sql`,
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET: 'e2e-bucket',
  AWS_ACCESS_KEY_ID: 'e2e',
  AWS_SECRET_ACCESS_KEY: 'e2e',
  AWS_S3_ENDPOINT: `http://127.0.0.1:${S3_PORT}`,
  AWS_S3_FORCE_PATH_STYLE: 'true',
  // The admin dashboard's AWS cost estimate: answered locally (and refused).
  AWS_ENDPOINT_URL_COST_EXPLORER: `http://127.0.0.1:${S3_PORT}`,
  RESEND_API_KEY: 'e2e',
  RESEND_API_URL: `http://127.0.0.1:${MAIL_PORT}`,
  EMAIL_FROM: '3D Box Studio <hello@e2e.test>',
  ADMIN_EMAIL: 'admin@e2e.test',
  ADMIN_PASSWORD,
  AUTH_APP_URL: BASE_URL,
  SITE_INDEXABLE: 'false',
};
