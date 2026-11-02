# Library Management System

A NestJS + Prisma + PostgreSQL API for managing a library's book catalog.

## Tech Stack

- NestJS (Node.js / Express)
- PostgreSQL (hosted on Neon or Supabase)
- Prisma ORM

## Project Structure

```
library-management-system/
├── README.md
└── api/
    ├── .env
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    └── src/
        ├── app.controller.ts
        ├── app.module.ts
        ├── main.ts
        └── prisma/
            ├── prisma.module.ts
            └── prisma.service.ts
```

## Setup

```bash
cd api
npm install
cp .env.example .env        # then paste your hosted Postgres URL into DATABASE_URL
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

The Prisma seed command is configured in `api/package.json`. Useful commands:
`npx prisma studio` opens a GUI to browse the data.
The API listens on port `3000` by default; set `PORT` to use a different port.

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
- **`isbn` is `@unique`** so the same book can't be catalogued twice, which also lets the seed script use `upsert` and be re-run safely.
- **`totalCopies` and `availableCopies`** are tracked separately so later features (borrow requests, bookings) can adjust availability without losing the total.
- **`@@index([genreId])`** on `Book` speeds up filtering books by genre.

### Stretch: Review model

`Review` (`bookId`, `userId`, `rating`, `comment`) connects `User` and `Book`. A composite `@@unique([bookId, userId])` limits each user to one review per book, and `onDelete: Cascade` removes reviews when their book or user is deleted. Rating range (1-5) is validated in the DTO/service layer.

### Stretch: Prisma vs. a document database

The biggest difference was that relationships are declared up front and enforced by the database. In a document store like MongoDB, I could have embedded a genre inside each book on a whim and nothing would complain. In Prisma/Postgres I had to decide ahead of time that a book *belongs to* a genre, and the schema, migrations, and generated types then keep my code and the database in sync. That felt stricter at first, but it catches mistakes (like a missing genre) before they reach the data.
