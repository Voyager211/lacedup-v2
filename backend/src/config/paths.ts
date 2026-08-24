import path from 'path';

/**
 * Central filesystem paths.
 *
 * Everything is resolved from __dirname rather than process.cwd(), so the app
 * behaves the same regardless of which directory it is started from, and so a
 * future move of the source tree only has to change the anchors below instead
 * of hunting down cwd-relative strings across the codebase.
 */

// <repo>/backend/src when running from source, <repo>/backend/dist when running
// from the TypeScript build - the compiled tree mirrors the source tree.
export const BACKEND_SRC = path.resolve(__dirname, '..');

// <repo>/backend - the backend package: its own dependencies, config and the
// runtime/user data that deliberately lives outside the source tree.
export const BACKEND_ROOT = path.resolve(BACKEND_SRC, '..');

// <repo> - the two-package root, holding only backend/ and frontend/.
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

/**
 * EJS email templates.
 *
 * All that survives of the view layer, deleted in Phase 5. These are emails,
 * not pages - they are rendered to a string and handed to the mailer, so they
 * have nothing to do with the view engine the app no longer configures.
 */
export const EMAIL_TEMPLATES_DIR = path.join(BACKEND_SRC, 'common', 'email-templates');

/**
 * The compiled React app.
 *
 * Resolved from PROJECT_ROOT rather than BACKEND_SRC so it points at the same
 * place whether the server is running from source (`backend/src`) or from the
 * TypeScript build (`backend/dist`) - the frontend build output does not move
 * with the backend's.
 *
 * Absent in development, where Vite serves the app on :5173 and proxies the
 * API here. The server checks for it rather than assuming it exists.
 */
export const FRONTEND_DIST = path.join(PROJECT_ROOT, 'frontend', 'dist');

// Static assets and user uploads sit at the backend package root, next to the
// source tree rather than inside it: public/uploads holds runtime-generated
// files referenced by URL from the database, so it is data rather than source
// and must not move with the code (or be wiped by a rebuild of dist/).
export const PUBLIC_DIR = path.join(BACKEND_ROOT, 'public');
export const LOGS_DIR = path.join(BACKEND_ROOT, 'logs');

export const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
export const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'products');
export const PROFILE_UPLOADS_DIR = path.join(UPLOADS_DIR, 'profiles');
