const path = require('path');

/**
 * Central filesystem paths.
 *
 * Everything is resolved from __dirname rather than process.cwd(), so the app
 * behaves the same regardless of which directory it is started from, and so a
 * future move of the source tree only has to change the two anchors below
 * instead of hunting down cwd-relative strings across the codebase.
 */

// <repo>/src/backend - source that ships with the server
const BACKEND_ROOT = path.resolve(__dirname, '..');

// <repo> - runtime/user data that deliberately lives outside the source tree
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..', '..');

// EJS templates are rendered by the backend, so they live alongside it.
// Removed in Phase 4 when React replaces them.
const VIEWS_DIR = path.join(BACKEND_ROOT, 'views');

// Static assets and user uploads stay at the repo root: public/uploads holds
// runtime-generated files referenced by URL from the database, so it is data
// rather than source and must not move with the code.
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'products');
const PROFILE_UPLOADS_DIR = path.join(UPLOADS_DIR, 'profiles');

module.exports = {
  PROJECT_ROOT,
  BACKEND_ROOT,
  PUBLIC_DIR,
  VIEWS_DIR,
  LOGS_DIR,
  UPLOADS_DIR,
  PRODUCT_UPLOADS_DIR,
  PROFILE_UPLOADS_DIR
};
