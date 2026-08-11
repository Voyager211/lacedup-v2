const path = require('path');

/**
 * Loads .env from the project root explicitly.
 *
 * `require('dotenv').config()` resolves the .env file relative to
 * process.cwd(), so starting the app from any directory other than the project
 * root silently loaded no variables at all - which surfaced as confusing
 * downstream crashes (e.g. Razorpay throwing "`key_id` is mandatory") rather
 * than an obvious "env not found". Resolving from __dirname makes startup
 * independent of the working directory.
 *
 * Require this once, as early as possible, before anything reads process.env.
 */
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
