import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Development-only credentials for the two seeded accounts.
// Override with SEED_PASSWORD in .env; never reuse these in production.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

const genres = [
  { name: 'Fiction', slug: 'fiction' },
  { name: 'Science Fiction', slug: 'science-fiction' },
  { name: 'Technology', slug: 'technology' },
  { name: 'History', slug: 'history' },
  { name: 'Biography', slug: 'biography' },
];

type SeedBook = {
  title: string;
  author: string;
  isbn: string;
  totalCopies: number;
  genreSlug: string;
};

const books: SeedBook[] = [
  // Fiction
  { title: 'Things Fall Apart', author: 'Chinua Achebe', isbn: '9780385474542', totalCopies: 4, genreSlug: 'fiction' },
  { title: 'Weep Not, Child', author: 'Ngũgĩ wa Thiong’o', isbn: '9780435908300', totalCopies: 3, genreSlug: 'fiction' },
  { title: 'Half of a Yellow Sun', author: 'Chimamanda Ngozi Adichie', isbn: '9781400095209', totalCopies: 3, genreSlug: 'fiction' },
  { title: 'The River Between', author: 'Ngũgĩ wa Thiong’o', isbn: '9780435905484', totalCopies: 2, genreSlug: 'fiction' },
  // Science Fiction
  { title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', totalCopies: 5, genreSlug: 'science-fiction' },
  { title: 'Neuromancer', author: 'William Gibson', isbn: '9780441569595', totalCopies: 2, genreSlug: 'science-fiction' },
  { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', isbn: '9780441478125', totalCopies: 3, genreSlug: 'science-fiction' },
  { title: 'Foundation', author: 'Isaac Asimov', isbn: '9780553293357', totalCopies: 4, genreSlug: 'science-fiction' },
  // Technology
  { title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', totalCopies: 3, genreSlug: 'technology' },
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt & David Thomas', isbn: '9780135957059', totalCopies: 3, genreSlug: 'technology' },
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', isbn: '9781449373320', totalCopies: 2, genreSlug: 'technology' },
  { title: 'You Don’t Know JS Yet', author: 'Kyle Simpson', isbn: '9781091210099', totalCopies: 2, genreSlug: 'technology' },
  // History
  { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', isbn: '9780062316110', totalCopies: 4, genreSlug: 'history' },
  { title: 'Guns, Germs, and Steel', author: 'Jared Diamond', isbn: '9780393317558', totalCopies: 2, genreSlug: 'history' },
  { title: 'A History of Kenya', author: 'Robert M. Maxon', isbn: '9780000000011', totalCopies: 2, genreSlug: 'history' },
  // Biography
  { title: 'Long Walk to Freedom', author: 'Nelson Mandela', isbn: '9780316548182', totalCopies: 3, genreSlug: 'biography' },
  { title: 'Unbowed', author: 'Wangari Maathai', isbn: '9781400044597', totalCopies: 3, genreSlug: 'biography' },
  { title: 'Born a Crime', author: 'Trevor Noah', isbn: '9780399588174', totalCopies: 4, genreSlug: 'biography' },
];

async function main() {
  // Genres (upsert keeps the seed idempotent: safe to run more than once)
  const genreIdBySlug = new Map<string, number>();
  for (const g of genres) {
    const genre = await prisma.genre.upsert({
      where: { slug: g.slug },
      update: { name: g.name },
      create: g,
    });
    genreIdBySlug.set(g.slug, genre.id);
  }

  // Books
  for (const b of books) {
    const genreId = genreIdBySlug.get(b.genreSlug);
    if (!genreId) throw new Error(`Unknown genre slug: ${b.genreSlug}`);

    await prisma.book.upsert({
      where: { isbn: b.isbn },
      update: {},
      create: {
        title: b.title,
        author: b.author,
        isbn: b.isbn,
        totalCopies: b.totalCopies,
        availableCopies: b.totalCopies,
        genreId,
      },
    });
  }

  // Users (one of each role). Public registration only creates PATRONs,
  // so the seeded librarian is how you get a LIBRARIAN token in development.
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const librarian = await prisma.user.upsert({
    where: { email: 'librarian@library.test' },
    update: {},
    create: {
      email: 'librarian@library.test',
      name: 'Lydia Librarian',
      password: passwordHash,
      role: Role.LIBRARIAN,
    },
  });
  const patron = await prisma.user.upsert({
    where: { email: 'patron@library.test' },
    update: {},
    create: {
      email: 'patron@library.test',
      name: 'Peter Patron',
      password: passwordHash,
      role: Role.PATRON,
    },
  });

  // Stretch: a couple of sample reviews
  const dune = await prisma.book.findUnique({ where: { isbn: '9780441013593' } });
  const clean = await prisma.book.findUnique({ where: { isbn: '9780132350884' } });
  if (dune && clean) {
    await prisma.review.upsert({
      where: { bookId_userId: { bookId: dune.id, userId: patron.id } },
      update: {},
      create: { bookId: dune.id, userId: patron.id, rating: 5, comment: 'A masterpiece of world-building.' },
    });
    await prisma.review.upsert({
      where: { bookId_userId: { bookId: clean.id, userId: librarian.id } },
      update: {},
      create: { bookId: clean.id, userId: librarian.id, rating: 4, comment: 'Practical advice for everyday code.' },
    });
  }

  const [genreCount, bookCount] = await Promise.all([prisma.genre.count(), prisma.book.count()]);
  console.log(`Seed complete: ${genreCount} genres, ${bookCount} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
