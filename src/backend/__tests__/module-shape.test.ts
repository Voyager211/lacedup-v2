import fs from 'fs';
import path from 'path';
import { BACKEND_ROOT } from '../config/paths';

/**
 * A module cannot use `export =` and a named export at the same time.
 *
 * TypeScript's own rule (TS2309), but it is not enforced here: `tsc --noEmit`
 * passes, and Vitest passes too because its esbuild transform tolerates the
 * mix. What does not tolerate it is tsx, which `npm run dev` uses - it emits a
 * module that throws `ReferenceError: <name>_module is not defined` on import,
 * taking the whole server down at startup.
 *
 * So this is a defect class that a green test suite and a clean typecheck both
 * report as fine. It has already shipped once: PendingSignup and EmailChange
 * both exported an interface alongside `export =`, and the server would not
 * boot. This test is cheaper than remembering.
 *
 * The fix is always the same - use `export default` instead, as
 * pending-order.model.ts does.
 */

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
    return full.endsWith('.ts') && !full.endsWith('.d.ts') ? [full] : [];
  });

describe('module shape', () => {
  it('never mixes `export =` with a named export', () => {
    const offenders: string[] = [];

    for (const file of walk(BACKEND_ROOT)) {
      const source = fs.readFileSync(file, 'utf8');

      const hasExportAssignment = /^export = /m.test(source);
      if (!hasExportAssignment) continue;

      // `export type` is erased entirely, so it cannot clash at runtime.
      const hasNamedExport = /^export (?!type\b|= )(interface|const|function|class|let|var|async|default)\b/m.test(
        source
      );

      if (hasNamedExport) offenders.push(path.relative(BACKEND_ROOT, file));
    }

    expect(offenders).toEqual([]);
  });

  it('would notice an offending file (control for the assertion above)', () => {
    // Guards the regexes themselves - a rule that silently matches nothing is
    // worse than no rule, because it reads as coverage.
    const sample = ['export interface Thing { a: string }', "export = something;"].join('\n');

    expect(/^export = /m.test(sample)).toBe(true);
    expect(/^export (?!type\b|= )(interface|const|function|class|let|var|async|default)\b/m.test(sample)).toBe(
      true
    );
  });
});
