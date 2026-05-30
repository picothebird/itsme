# itsme

Full-stack monorepo baseline for fast product development.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Quality: ESLint, Prettier, Husky, lint-staged, Commitlint, GitHub Actions CI
- Workspace: npm workspaces

## Project structure

```text
.
|- apps/
|  |- frontend/
|  |- backend/
|- .github/workflows/ci.yml
|- .vscode/
|- README.md
```

## Prerequisites

- Node.js 22+
- npm 10+

## Quick start

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
npm run dev
```

## Scripts

- `npm run dev`: run frontend + backend concurrently
- `npm run dev:web`: run frontend only
- `npm run dev:api`: run backend only
- `npm run lint`: run lint in all workspaces
- `npm run typecheck`: run typecheck in all workspaces
- `npm run test`: run tests in all workspaces
- `npm run build`: build all workspaces
- `npm run format`: format repo with Prettier

## Environment variables

### Backend ([apps/backend/.env.example](apps/backend/.env.example))

- `NODE_ENV`
- `PORT`
- `FRONTEND_ORIGIN`

### Frontend ([apps/frontend/.env.example](apps/frontend/.env.example))

- `VITE_API_BASE_URL`

## Existing product docs

- [Product spec](%5B%EC%83%81%EC%84%B8%20%EA%B8%B0%ED%9A%8D%EC%84%9C%5D%20%EC%B0%A8%EC%84%B8%EB%8C%80%20%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20%EC%9E%87%EC%B8%A0%EB%AF%B8.txt)
- [MVP feature spec](%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20MVP_%EA%B8%B0%EB%8A%A5%EB%AA%85%EC%84%B8%EC%84%9C_2026-05-30.md)
- [MVP user flow](%EB%B3%B4%EC%83%81%ED%98%95%20%EB%A6%AC%EC%84%9C%EC%B9%98%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20MVP_%EC%9C%A0%EC%A0%80%ED%94%8C%EB%A1%9C%EC%9A%B0_2026-05-30.md.md)
