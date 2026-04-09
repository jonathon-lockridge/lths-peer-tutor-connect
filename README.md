# LTHS Peer Tutor Connect

> **"Cavaliers Helping Cavaliers"**

A full-stack web application for Lake Travis High School that matches students who need academic help with peer tutors who can provide it — and automatically tracks volunteer/tutoring hours.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | Clerk (restricted to @ltisdschools.org) |
| State | TanStack Query (React Query) |
| Hosting | Vercel (frontend) + Railway or Render (backend + DB) |

## Project Structure

```
lths-peer-tutor-connect/
├── client/          React frontend
├── server/          Express API + Prisma
├── shared/          Shared TypeScript types
├── .env.example     Environment variable reference
└── README.md
```

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL running locally (or a free Railway/Neon instance)
- A Clerk account (free at clerk.com)

### 1. Clone & install

```bash
git clone <your-repo>
cd lths-peer-tutor-connect
npm install          # installs all workspace dependencies
```

### 2. Set up environment variables

```bash
# Create server env
cp .env.example server/.env
# Fill in DATABASE_URL, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET

# Create client env
cp .env.example client/.env
# Fill in VITE_CLERK_PUBLISHABLE_KEY
```

### 3. Set up the database

```bash
cd server
npx prisma migrate dev --name init   # creates tables
npm run db:seed                       # seeds subjects + demo data
```

### 4. Run the app

```bash
# From the project root — starts both server and client
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Prisma Studio: `npm run db:studio`

## Clerk Configuration

1. Create an app at [clerk.com](https://clerk.com)
2. In **Email & Auth**, restrict sign-ups to `@ltisdschools.org` domain
3. Copy keys to your `.env` files
4. Add a Webhook endpoint pointing to `https://your-domain/api/auth/webhook`
   - Subscribe to: `user.created`, `user.deleted`
   - Copy the Signing Secret to `CLERK_WEBHOOK_SECRET`

## API Routes

| Route | Description |
|---|---|
| `POST /api/auth/webhook` | Clerk webhook (user sync) |
| `POST /api/auth/onboard` | Complete first-login profile |
| `GET /api/auth/me` | Current user |
| `GET /api/users/tutors` | List tutors (filterable) |
| `GET /api/users/:id` | Tutor profile |
| `PATCH /api/users/me` | Update own profile |
| `GET /api/subjects` | List all subjects |
| `POST /api/subjects` | Create subject (admin) |
| `GET /api/tutor-subjects` | My tutor subjects |
| `POST /api/tutor-subjects` | Add a subject |
| `DELETE /api/tutor-subjects/:id` | Remove a subject |
| `GET /api/requests` | List requests |
| `POST /api/requests` | Create a request |
| `PATCH /api/requests/:id/status` | Cancel a request |
| `GET /api/matches` | List matches |
| `POST /api/matches/:id/accept` | Accept a match |
| `POST /api/matches/:id/decline` | Decline a match |
| `GET /api/sessions` | List sessions |
| `POST /api/sessions` | Log a session |
| `POST /api/sessions/:id/confirm` | Confirm a session |
| `GET /api/hours` | Hour summary |
| `GET /api/hours/leaderboard` | Leaderboard |
| `GET /api/hours/export` | Export CSV (admin) |
| `POST /api/reviews` | Submit review |
| `GET /api/reviews/tutor/:id` | Reviews for a tutor |
| `GET /api/admin/stats` | Admin dashboard stats |
| `GET /api/admin/users` | All users (admin) |

## Business Rules

- Students **cannot** tutor themselves
- Session duration: **15–180 minutes**
- Max **5 open requests** per student at a time
- **Both** tutor + tutee must confirm a session within 72 hours for hours to count
- Hour logs are **immutable** once exported by an admin
- Reviews only allowed after a **COMPLETED, fully-confirmed** session

## Deployment

### Frontend → Vercel
1. Connect your repo to Vercel
2. Set `VITE_CLERK_PUBLISHABLE_KEY` in Vercel env
3. Set root directory to `client`

### Backend → Railway
1. Create a new Railway project
2. Add a PostgreSQL plugin
3. Set all env vars from `.env.example`
4. Railway will auto-detect the Node.js server

## School Colors

| Color | Hex |
|---|---|
| Cavalier Red | `#CC0000` |
| Black | `#1A1A1A` |
| White | `#FFFFFF` |
