/** Cookie and JWT lifetime stay in sync via this single source of truth. */
export const AUTH_COOKIE_NAME = 'mdv_token';
export const JWT_EXPIRES_IN = '7d';
export const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
