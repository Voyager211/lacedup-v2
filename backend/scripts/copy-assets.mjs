/**
 * Copies the non-TypeScript files the server reads at runtime into dist/.
 *
 * `tsc` emits only what it compiles, so anything the code opens with fs rather
 * than imports is absent from a build. config/paths.ts resolves those from the
 * directory the running code is in - backend/src under tsx, backend/dist after
 * a build - which is what keeps both modes working, but it does mean the build
 * has to put them there.
 *
 * Today that is one EJS email template. Its absence degrades rather than
 * crashes - send-otp.util.ts falls back to inline HTML and logs a warning - so
 * this is exactly the kind of thing that reaches production unnoticed and sends
 * every customer an unstyled OTP.
 *
 * Node's own fs, no dependency, and cp with recursive works the same on Windows
 * and Linux - this runs both on a developer's machine and on the deploy host.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const DIST = path.join(here, '..', 'dist');

/** Paths relative to src/, copied to the same place under dist/. */
const ASSETS = ['common/email-templates'];

if (!fs.existsSync(DIST)) {
  console.error('dist/ does not exist - run tsc first.');
  process.exit(1);
}

let copied = 0;

for (const asset of ASSETS) {
  const from = path.join(SRC, asset);
  const to = path.join(DIST, asset);

  if (!fs.existsSync(from)) {
    console.error(`Missing asset: src/${asset}`);
    process.exit(1);
  }

  fs.cpSync(from, to, { recursive: true });

  const count = fs.readdirSync(from, { recursive: true }).length;
  copied += count;
  console.log(`  src/${asset} -> dist/${asset} (${count})`);
}

console.log(`Copied ${copied} runtime asset(s) into dist/.`);
