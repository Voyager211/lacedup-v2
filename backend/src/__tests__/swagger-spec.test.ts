import { swaggerSpec } from '../config/swagger';

/**
 * The spec is assembled by globbing the route files, and a glob that matches
 * nothing still produces a valid-looking document - an empty one. These assert
 * the spec has content, and that every `security` block names a scheme that
 * actually exists.
 */
type Operation = { security?: Array<Record<string, string[]>>; tags?: string[] };

const spec = swaggerSpec as {
  paths: Record<string, Record<string, Operation>>;
  components: { securitySchemes: Record<string, { name?: string }> };
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(([method]) => METHODS.includes(method))
    .map(([method, operation]) => ({ path, method, operation }))
);

describe('swagger spec', () => {
  it('documents the API surface', () => {
    expect(Object.keys(spec.paths).length).toBeGreaterThan(100);
    expect(operations.length).toBeGreaterThan(100);
  });

  it('carries the JWT cookie schemes, not the old session cookie', () => {
    expect(Object.keys(spec.components.securitySchemes).sort()).toEqual(['adminCookie', 'userCookie']);
    expect(spec.components.securitySchemes.userCookie?.name).toBe('user_at');
    expect(spec.components.securitySchemes.adminCookie?.name).toBe('admin_at');
  });

  it('never names a security scheme that is not defined', () => {
    const defined = Object.keys(spec.components.securitySchemes);
    const unknown = operations.flatMap(({ path, method, operation }) =>
      (operation.security ?? []).flatMap((requirement) =>
        Object.keys(requirement)
          .filter((scheme) => !defined.includes(scheme))
          .map((scheme) => `${method.toUpperCase()} ${path} -> ${scheme}`)
      )
    );

    expect(unknown).toEqual([]);
  });

  it('guards admin paths with the admin cookie', () => {
    const wrong = operations
      .filter(({ path, operation }) => path.startsWith('/admin') && operation.security)
      .filter(({ operation }) => !operation.security!.some((requirement) => 'adminCookie' in requirement))
      .map(({ path, method }) => `${method.toUpperCase()} ${path}`);

    expect(wrong).toEqual([]);
  });
});
