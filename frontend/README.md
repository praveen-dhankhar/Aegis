# Aegis Control Plane Frontend

React 18 + TypeScript dashboard for the Aegis distributed rate limiter.

## Local Development

```bash
npm ci
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and expects the backend at `VITE_API_BASE_URL`, defaulting to `http://localhost:8080`.

## Validation

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run e2e
```

## Production Container

The production Docker image builds the app with Node, runs typecheck and tests, then serves the Vite output with Nginx. In the root Compose stack, the dashboard is exposed at `http://localhost:8081` and proxies `/api`, `/admin`, and `/actuator` to the Spring Boot service.

## Authentication

The admin key is held in React memory only and validated through `GET /admin/auth/validate`. Do not commit real keys to this directory.
