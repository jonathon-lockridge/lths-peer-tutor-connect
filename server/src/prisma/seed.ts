import { PrismaClient, SubjectCategory } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS: { name: string; category: SubjectCategory }[] = [
  // English
  { name: "English I", category: "ENGLISH" },
  { name: "English I Pre-AP", category: "ENGLISH" },
  { name: "English II", category: "ENGLISH" },
  { name: "English II Pre-AP", category: "ENGLISH" },
  { name: "AP English Language & Composition", category: "ENGLISH" },
  { name: "AP English Literature & Composition", category: "ENGLISH" },
  { name: "English IV", category: "ENGLISH" },
  // Math
  { name: "Math Models with Applications", category: "MATH" },
  { name: "Algebra I", category: "MATH" },
  { name: "Algebra I Pre-AP", category: "MATH" },
  { name: "Geometry", category: "MATH" },
  { name: "Geometry Pre-AP", category: "MATH" },
  { name: "Algebra II", category: "MATH" },
  { name: "Algebra II Pre-AP (Honors)", category: "MATH" },
  { name: "Statistics", category: "MATH" },
  { name: "Pre-Calculus", category: "MATH" },
  { name: "Pre-Calculus Pre-AP (Honors)", category: "MATH" },
  { name: "AP Pre-Calculus", category: "MATH" },
  { name: "AP Calculus AB", category: "MATH" },
  { name: "AP Calculus BC", category: "MATH" },
  { name: "AP Statistics", category: "MATH" },
  // Science
  { name: "Biology", category: "SCIENCE" },
  { name: "Biology Pre-AP", category: "SCIENCE" },
  { name: "Chemistry", category: "SCIENCE" },
  { name: "Chemistry Pre-AP", category: "SCIENCE" },
  { name: "Physics", category: "SCIENCE" },
  { name: "AP Biology", category: "SCIENCE" },
  { name: "AP Chemistry", category: "SCIENCE" },
  { name: "AP Physics 1: Algebra-Based", category: "SCIENCE" },
  { name: "AP Physics 2: Algebra-Based", category: "SCIENCE" },
  { name: "AP Physics C: Mechanics", category: "SCIENCE" },
  { name: "AP Physics C: Electricity & Magnetism", category: "SCIENCE" },
  { name: "AP Environmental Science", category: "SCIENCE" },
  { name: "Anatomy & Physiology (Honors)", category: "SCIENCE" },
  { name: "Aquatic Science", category: "SCIENCE" },
  { name: "Earth & Space Science", category: "SCIENCE" },
  { name: "Scientific Research & Design (Honors)", category: "SCIENCE" },
  // Social Studies
  { name: "World Geography", category: "HISTORY" },
  { name: "World Geography Pre-AP", category: "HISTORY" },
  { name: "AP Human Geography", category: "HISTORY" },
  { name: "World History Studies", category: "HISTORY" },
  { name: "World History Studies Pre-AP", category: "HISTORY" },
  { name: "AP World History: Modern", category: "HISTORY" },
  { name: "US History", category: "HISTORY" },
  { name: "US History Pre-AP", category: "HISTORY" },
  { name: "AP US History", category: "HISTORY" },
  { name: "US Government (½ Credit)", category: "HISTORY" },
  { name: "AP US Government & Politics", category: "HISTORY" },
  { name: "Economics (½ Credit)", category: "HISTORY" },
  { name: "AP Macroeconomics", category: "HISTORY" },
  { name: "AP Microeconomics", category: "HISTORY" },
  { name: "AP European History", category: "HISTORY" },
  { name: "Psychology", category: "HISTORY" },
  { name: "AP Psychology", category: "HISTORY" },
  // World Languages
  { name: "Spanish I", category: "WORLD_LANGUAGE" },
  { name: "Spanish II", category: "WORLD_LANGUAGE" },
  { name: "Spanish III", category: "WORLD_LANGUAGE" },
  { name: "Spanish IV", category: "WORLD_LANGUAGE" },
  { name: "AP Spanish Language & Culture", category: "WORLD_LANGUAGE" },
  { name: "AP Spanish Literature & Culture", category: "WORLD_LANGUAGE" },
  { name: "French I", category: "WORLD_LANGUAGE" },
  { name: "French II", category: "WORLD_LANGUAGE" },
  { name: "French III", category: "WORLD_LANGUAGE" },
  { name: "French IV", category: "WORLD_LANGUAGE" },
  { name: "AP French Language & Culture", category: "WORLD_LANGUAGE" },
  { name: "Latin I", category: "WORLD_LANGUAGE" },
  { name: "Latin II", category: "WORLD_LANGUAGE" },
  { name: "Latin III", category: "WORLD_LANGUAGE" },
  { name: "Latin IV", category: "WORLD_LANGUAGE" },
  { name: "AP Latin", category: "WORLD_LANGUAGE" },
  { name: "American Sign Language I", category: "WORLD_LANGUAGE" },
  { name: "American Sign Language II", category: "WORLD_LANGUAGE" },
  { name: "American Sign Language III", category: "WORLD_LANGUAGE" },
  { name: "German II", category: "WORLD_LANGUAGE" },
  // Electives & CTE
  { name: "Introduction to Computer Science", category: "ELECTIVE" },
  { name: "AP Computer Science Principles", category: "ELECTIVE" },
  { name: "AP Computer Science A", category: "ELECTIVE" },
  { name: "Computer Science III", category: "ELECTIVE" },
  { name: "AP Art History", category: "ELECTIVE" },
  { name: "AP Music Theory", category: "ELECTIVE" },
  { name: "Financial Mathematics", category: "ELECTIVE" },
  { name: "Health", category: "ELECTIVE" },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Remove any leftover demo accounts
  await prisma.user.deleteMany({
    where: { email: { startsWith: "demo" } },
  });

  // Remove orphaned subjects (not linked to any tutor, request, or verification)
  console.log("Cleaning up orphaned subjects...");
  await prisma.subject.deleteMany({
    where: {
      tutorSubjects: { none: {} },
      tutoringRequests: { none: {} },
      tutorVerifications: { none: {} },
    },
  });

  // Upsert full LTHS 2026-27 course catalog
  console.log("Creating subjects...");
  for (const s of SUBJECTS) {
    await prisma.subject.upsert({
      where: { name: s.name },
      update: { category: s.category },
      create: s,
    });
  }

  console.log(`✅ Seed complete! ${SUBJECTS.length} subjects loaded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
