import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom has no layout engine, so it logs "Not implemented" for scrollTo every
 * time React Router's ScrollRestoration runs. Stubbing it keeps the output
 * readable - a wall of expected noise is how a real warning gets missed.
 */
vi.stubGlobal('scrollTo', vi.fn());

afterEach(() => {
  cleanup();
});
