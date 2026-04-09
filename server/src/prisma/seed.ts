import { PrismaClient, SubjectCategory, Urgency, RequestStatus, MatchStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS: { name: string; category: SubjectCategory }[] = [
  // Math
  { name: "Algebra 1", category: "MATH" },
  { name: "Algebra 2", category: "MATH" },
  { name: "Geometry", category: "MATH" },
  { name: "Pre-Calculus", category: "MATH" },
  { name: "AP Calculus AB", category: "AP" },
  { name: "AP Calculus BC", category: "AP" },
  { name: "AP Statistics", category: "AP" },
  // Science
  { name: "Biology", category: "SCIENCE" },
  { name: "Chemistry", category: "SCIENCE" },
  { name: "Physics", category: "SCIENCE" },
  { name: "AP Biology", category: "AP" },
  { name: "AP Chemistry", category: "AP" },
  { name: "AP Physics 1", category: "AP" },
  { name: "AP Physics 2", category: "AP" },
  { name: "AP Environmental Science", category: "AP" },
  // English
  { name: "English I", category: "ENGLISH" },
  { name: "English II", category: "ENGLISH" },
  { name: "English III", category: "ENGLISH" },
  { name: "English IV", category: "ENGLISH" },
  { name: "AP English Language", category: "AP" },
  { name: "AP English Literature", category: "AP" },
  // History
  { name: "World History", category: "HISTORY" },
  { name: "US History", category: "HISTORY" },
  { name: "Government", category: "HISTORY" },
  { name: "AP US History", category: "AP" },
  { name: "AP World History", category: "AP" },
  { name: "AP Government", category: "AP" },
  // World Language
  { name: "Spanish I", category: "WORLD_LANGUAGE" },
  { name: "Spanish II", category: "WORLD_LANGUAGE" },
  { name: "Spanish III", category: "WORLD_LANGUAGE" },
  { name: "AP Spanish Language", category: "AP" },
  { name: "French I", category: "WORLD_LANGUAGE" },
  { name: "French II", category: "WORLD_LANGUAGE" },
  // Electives
  { name: "Computer Science Principles", category: "ELECTIVE" },
  { name: "AP Computer Science A", category: "AP" },
  { name: "Economics", category: "ELECTIVE" },
  { name: "AP Macroeconomics", category: "AP" },
  { name: "AP Psychology", category: "AP" },
  { name: "Art I", category: "ELECTIVE" },
  { name: "Music Theory", category: "ELECTIVE" },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Remove any leftover demo accounts
  await prisma.user.deleteMany({
    where: { email: { startsWith: "demo" } },
  });

  // Subjects
  console.log("Creating subjects...");
  for (const s of SUBJECTS) {
    await prisma.subject.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
