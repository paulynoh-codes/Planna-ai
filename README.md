# Planna

Social travel planning app. Generate a trip in minutes, save it, share it, and discover itineraries from other travelers.

This repo is a monorepo scoped to Phase 0 + Phase 1 of the PRD: the anonymous planner, AI itinerary generation, auth, save/library, and public/private visibility toggle. Social feed, remix, swaps, and group invites come in later phases.

## Layout

```
apps/
  api/         Express + TypeScript API (JWT auth, MongoDB, Claude Haiku 4.5)
  mobile/      Expo Router app (iOS + Android + Web)
packages/
  shared/      Shared TS types and zod validators
```

## Prerequisites

- Node.js 20+
- npm 10+
- A MongoDB connection string (local `mongod` or MongoDB Atlas free tier)
- An Anthropic API key (`https://console.anthropic.com/`)

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in `apps/api/.env`:

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/planna
JWT_SECRET=replace-me-with-a-long-random-string
ANTHROPIC_API_KEY=sk-ant-...
CLIENT_ORIGIN=http://localhost:19006
```

Fill in `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

When testing on a physical device, replace `localhost` with your machine's LAN IP.

## Run

```bash
npm run dev           # runs api + mobile together
npm run dev:api       # api only
npm run dev:mobile    # expo only
```

- API: `http://localhost:4000` (`GET /healthz` → `{ok: true}`)
- Expo web: `http://localhost:19006`
- Expo Go: scan the QR in the terminal

## Test

```bash
npm test
```

Runs the API test suite (Vitest) with Anthropic mocked.

## Deploy

- **API**: Railway or Render — set `MONGODB_URI`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `CLIENT_ORIGIN`.
- **Web**: `npm run build:web -w apps/mobile` → deploy `apps/mobile/dist` to Vercel. Set `EXPO_PUBLIC_API_URL` to the Railway URL.
- **DB**: MongoDB Atlas free tier.

## Development branch

All work for this feature lives on `claude/travel-planning-prd-cNsD1`.
