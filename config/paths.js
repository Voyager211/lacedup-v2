const path = require('path');

/**
 * Central filesystem paths.
 *
 * Everything is resolved from __dirname rather than process.cwd(), so the app
 * behaves the same regardless of which directory it is started from, and so a
 * future move of the source tree only has to change PROJECT_ROOT here instead
 * of hunting down cwd-relative strings across the codebase.
 */
const PROJECT_ROOT = path.resolve(__dirname, '..');

const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const VIEWS_DIR = path.join(PROJECT_ROOT, 'views');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'products');
const PROFILE_UPLOADS_DIR = path.join(UPLOADS_DIR, 'profiles');

module.exports = {
  PROJECT_ROOT,
  PUBLIC_DIR,
  VIEWS_DIR,
  LOGS_DIR,
  UPLOADS_DIR,
  PRODUCT_UPLOADS_DIR,
  PROFILE_UPLOADS_DIR
};
