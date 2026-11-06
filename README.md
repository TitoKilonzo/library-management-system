# Library Management System

A NestJS + Prisma + PostgreSQL API for managing a library's book catalog, with JWT authentication and role-based authorization.

## Tech Stack

- NestJS (Node.js / Express)
- PostgreSQL (hosted on Neon or Supabase)
- Prisma ORM
- Passport + JWT, bcrypt, class-validator, @nestjs/throttler

## Project Structure

```
library-management-system/
├── README.md
├── docs/
│   └── postman_collection.json
└── api/
    ├── .env.example
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── prisma/      PrismaService + global PrismaModule
        ├── auth/        register/login, JwtStrategy, JwtAuthGuard, Roles decorator + RolesGuard
        ├── users/       GET /users/profile
        ├── genres/      Genre CRUD
        └── books/       Book CRUD, filtering, search, pagination
```

## Setup

```bash
# 1. Scaffold the Nest app (once), then copy the api/ files from this repo over it
nest new api

# 2. Install dependencies
cd api
npm install

# 3. Configure environment
cp .env.example .env     # set DATABASE_URL and JWT_SECRET

# 4. Migrate and seed
npx prisma migrate dev
npx prisma db seed

# 5. Run
npm run start:dev
```

The password migration preserves existing users by allowing a missing password hash. The seed updates its two development accounts with `SEED_PASSWORD`; other existing users cannot log in until they are given a password through an account recovery process.

> **Prisma version:** these files target Prisma 6 (`url = env("DATABASE_URL")` in the datasource, `new PrismaClient()`). Prisma 7 and later changed how the client connects (driver adapters and a `prisma.config.ts`), so the package manifest pins `prisma` and `@prisma/client` to v6.

Useful commands: `npx prisma studio` opens a GUI to browse the data.

### Seeded accounts (development only)

| Email                    | Role      | Password                                   |
| ------------------------ | --------- | ------------------------------------------ |
| `librarian@library.test` | LIBRARIAN | `Password123!` (or `SEED_PASSWORD` in .env) |
| `patron@library.test`    | PATRON    | `Password123!` (or `SEED_PASSWORD` in .env) |

Public registration only creates `PATRON` accounts, so the seeded librarian is how you get a LIBRARIAN token while developing.

## API Endpoints

Import `docs/postman_collection.json` into Postman. It has a request (with status-code tests) for every endpoint below, and the login requests save tokens into collection variables for you.

| Method | Path              | Access            | Description                                              |
| ------ | ----------------- | ----------------- | -------------------------------------------------------- |
| POST   | `/auth/register`  | Public            | Create a PATRON account; returns `{ accessToken, user }` |
| POST   | `/auth/login`     | Public            | Returns `{ accessToken, user }`. Limited to 5 requests/min per IP |
| GET    | `/users/profile`  | Any logged-in user | The authenticated user's profile (read from `req.user`) |
| GET    | `/genres`         | Public            | List genres with book counts                             |
| GET    | `/genres/:id`     | Public            | One genre                                                |
| POST   | `/genres`         | LIBRARIAN         | Create a genre (`slug` is generated from `name` if omitted) |
| PATCH  | `/genres/:id`     | LIBRARIAN         | Update a genre                                           |
| DELETE | `/genres/:id`     | LIBRARIAN         | Delete a genre (409 if it still has books)               |
| GET    | `/books`          | Public            | List books; see query parameters below                   |
| GET    | `/books/:id`      | Public            | One book, including its genre                            |
| POST   | `/books`          | LIBRARIAN         | Create a book                                            |
| PATCH  | `/books/:id`      | LIBRARIAN         | Update a book                                            |
| DELETE | `/books/:id`      | LIBRARIAN         | Delete a book (its reviews are removed with it)          |

### `GET /books` query parameters

| Param     | Default | Description                                                   |
| --------- | ------- | ------------------------------------------------------------- |
| `genreId` | none    | Only books in this genre                                      |
| `search`  | none    | Case-insensitive match against title or author                |
| `page`    | `1`     | Page number                                                   |
| `limit`   | `10`    | Page size (clamped to 1-100)                                  |

The response is `{ data: Book[], meta: { total, page, limit, totalPages } }`, ordered by title so pages are stable.

## Auth & Authorization

- **Register / login** issue a signed JWT (`sub` = user id, `role`). Passwords are hashed with bcrypt before saving and are never returned by the API.
- **`JwtStrategy`** verifies the token signature with `JWT_SECRET`; whatever `validate()` returns becomes `req.user`.
- **`JwtAuthGuard`** (`AuthGuard('jwt')`) rejects requests with a missing or invalid token (401).
- **`@Roles(Role.LIBRARIAN)` + `RolesGuard`** compare `req.user.role` to the roles a route requires (403 on mismatch). `JwtAuthGuard` is always listed first in `@UseGuards(...)` because `RolesGuard` depends on the `req.user` it sets.
- Roles are enforced on the backend. Hiding buttons in a frontend is not security, since anyone can call the API directly.
- `main.ts` enables `ValidationPipe({ whitelist: true })`, which validates every body against its DTO and strips undeclared fields (so a client can't sneak in `role: "LIBRARIAN"` when registering), and `enableCors()` so the frontend can call the API.

Error responses use Nest's built-in exceptions: 400 (validation / bad reference), 401 (no or bad token, wrong credentials), 403 (wrong role), 404 (not found), 409 (duplicate ISBN, email or genre; genre still in use), 429 (login rate limit).

## Schema Decisions

**Why `Book` references `Genre` instead of embedding it**

A `Book` stores a `genreId` foreign key with a `@relation` to `Genre`, rather than copying the genre's name (or the whole genre object) into every book row.

- **Single source of truth.** A genre lives in exactly one row. Renaming "Sci-Fi" to "Science Fiction" is one update, instead of hunting through every book that embedded the old name.
- **No duplication or drift.** Embedded copies can quietly disagree ("Sci-Fi" vs "Science Fiction" vs "SciFi"), which breaks filtering and reporting. A reference makes that impossible.
- **Referential integrity.** Postgres enforces the foreign key, so a book can never point at a genre that doesn't exist.
- **Genre is its own entity.** Genres have their own data (`name`, `slug`) and are queried independently, for example listing all genres or finding all books in genre 2 (`GET /books?genreId=2`). The relation supports that without scanning and parsing every book.
- **Cheap, typed joins.** Prisma's generated client lets us write `include: { genre: true }` when we need the genre alongside a book, with full type safety.

Other decisions:

- **`Role` enum (`PATRON`, `LIBRARIAN`)** on `User` restricts roles to valid values at the database level and gives us a TypeScript union type for free. It defaults to `PATRON`, the least-privileged role.
- **`User.password`** stores only a bcrypt hash. The API selects public fields explicitly so the hash never leaves the server.
- **`isbn` is `@unique`** so the same book can't be catalogued twice, which also lets the seed script use `upsert` and be re-run safely.
- **`totalCopies` and `availableCopies`** are tracked separately so later features (borrow requests, bookings) can adjust availability without losing the total. Changing `totalCopies` on update shifts `availableCopies` by the same amount, and is rejected if it would go below the number of copies on loan.
- **`@@index([genreId])`** on `Book` speeds up filtering books by genre.

### Stretch: Review model

`Review` (`bookId`, `userId`, `rating`, `comment`) connects `User` and `Book`. A composite `@@unique([bookId, userId])` limits each user to one review per book, and `onDelete: Cascade` removes reviews when their book or user is deleted. Rating range (1-5) is validated in the DTO/service layer.

### Stretch: Prisma vs. a document database

The biggest difference was that relationships are declared up front and enforced by the database. In a document store like MongoDB, I could have embedded a genre inside each book on a whim and nothing would complain. In Prisma/Postgres I had to decide ahead of time that a book *belongs to* a genre, and the schema, migrations, and generated types then keep my code and the database in sync. That felt stricter at first, but it catches mistakes (like a missing genre) before they reach the data.
