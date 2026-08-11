# Frontend

Scaffolded in Phase 4. Target stack:

- **Vite** + **React** + **TypeScript**
- **Redux Toolkit** for state
- **axios** for HTTP (JWT sent via httpOnly cookie, `withCredentials: true`)
- **React Router** for routing
- **Vitest** + **React Testing Library** + **MSW** for unit/component tests
- **Playwright** for E2E

Replaces the 76 EJS templates currently in [`../backend/views`](../backend/views),
which contain ~18,600 lines of inline `<script>` and ~17,300 lines of inline
`<style>` that become components and stylesheets here.

Planned layout:

```
src/frontend/
├── src/
│   ├── app/          store, router, providers
│   ├── features/     one folder per backend module (auth, cart, catalog, ...)
│   ├── components/   shared UI
│   ├── api/          axios client + per-module endpoints
│   └── types/        shared with backend where practical
├── index.html
└── vite.config.ts
```
