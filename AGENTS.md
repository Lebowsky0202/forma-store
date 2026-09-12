# Project conventions

- Follow PROJECT_PLAN.md and docs/API_CONTRACT.md. Implement real behavior; no TODO, mocks replacing required persistence, dead buttons or fabricated test claims.
- Independent agents are explicitly authorized by the user's supplied Agent.md. Assign nonoverlapping file ownership and coordinate contract changes before editing.
- Frontend in frontend/, backend in backend/, docs in docs/, local tooling in scripts/.
- TypeScript strict; camelCase variables, PascalCase components/types, short cohesive modules. No giant App component or unvalidated request bodies.
- Prices are integer KZT; never trust client totals. Transactional stock decrement and immutable order snapshots.
- Hash passwords; rotate/revoke hashed refresh tokens; check active users and roles server-side. Secrets only in ignored local environment files.
- Server state uses TanStack Query; session/UI state uses Zustand. Central typed API client. Forms use React Hook Form + Zod.
- Accessible semantic HTML, Russian visible copy, explicit loading/error/empty/success states. Responsive controls at 320–1440px.
- Changes must pass typecheck/build and meaningful critical API integration tests against PostgreSQL. Browser checks must verify purchase and admin flows. Record unavailable checks honestly.
- Never overwrite another agent's files without coordination. Owner agent integrates and reviews final result.
- Definition of done: working API and frontend, migrations/seed, auth/catalog/cart/favorites/orders/admin, validated secure requests, relevant tests, Docker configuration, reproducible README and explicit real deployment limitations.
