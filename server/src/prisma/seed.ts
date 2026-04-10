import { PrismaClient, SubjectCategory } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS: { name: string; category: SubjectCategory }[] = [
  // English
  { name: "English I", category: "ENGLISH" },
  { name: "English I Pre-AP", category: "ENGLISH" },
  { name: "English II", category: "ENGLISH" },
  { name: "English II Pre-AP", category: "ENGLISH" },
  { name: "English III", category: "ENGLISH" },
  { name: "AP English Language & Composition", category: "ENGLISH" },
  { name: "English IV", category: "ENGLISH" },
  { name: "AP English Literature & Composition", category: "ENGLISH" },
  // Math
  { name: "Math Models with Applications", category: "MATH" },
  { name: "Algebra I", category: "MATH" },
  { name: "Algebra I Pre-AP", category: "MATH" },
  { name: "Geometry", category: "MATH" },
  { name: "Geometry Pre-AP", category: "MATH" },
  { name: "Algebra II", category: "MATH" },
  { name: "Algebra II (Honors)", category: "MATH" },
  { name: "Precalculus (Honors)", category: "MATH" },
  { name: "AP Precalculus", category: "MATH" },
  { name: "AP Calculus AB", category: "MATH" },
  { name: "AP Calculus BC", category: "MATH" },
  { name: "AP Statistics", category: "MATH" },
  { name: "Statistics & Business Decision Making", category: "MATH" },
  { name: "Financial Mathematics", category: "MATH" },
  // Science
  { name: "Integrated Physics and Chemistry (IPC)", category: "SCIENCE" },
  { name: "Biology", category: "SCIENCE" },
  { name: "Biology Pre-AP", category: "SCIENCE" },
  { name: "Chemistry", category: "SCIENCE" },
  { name: "Chemistry Pre-AP", category: "SCIENCE" },
  { name: "Physics", category: "SCIENCE" },
  { name: "AP Biology", category: "SCIENCE" },
  { name: "AP Chemistry", category: "SCIENCE" },
  { name: "AP Physics 1", category: "SCIENCE" },
  { name: "AP Physics 2", category: "SCIENCE" },
  { name: "AP Physics C: Mechanics", category: "SCIENCE" },
  { name: "AP Physics C: Electricity and Magnetism", category: "SCIENCE" },
  { name: "AP Environmental Science", category: "SCIENCE" },
  { name: "Anatomy & Physiology (Honors)", category: "SCIENCE" },
  { name: "Aquatic Science", category: "SCIENCE" },
  { name: "Astronomy", category: "SCIENCE" },
  { name: "Earth Systems Science", category: "SCIENCE" },
  { name: "Environmental Systems", category: "SCIENCE" },
  { name: "Science Research and Design (S.T.E.M.) (Honors)", category: "SCIENCE" },
  // Social Studies
  { name: "World Geography", category: "HISTORY" },
  { name: "AP Human Geography", category: "HISTORY" },
  { name: "World History", category: "HISTORY" },
  { name: "AP World History", category: "HISTORY" },
  { name: "United States History", category: "HISTORY" },
  { name: "AP United States History", category: "HISTORY" },
  { name: "United States Government", category: "HISTORY" },
  { name: "AP United States Government", category: "HISTORY" },
  { name: "Economics", category: "HISTORY" },
  { name: "Personal Financial Literacy and Economics", category: "HISTORY" },
  { name: "AP Macroeconomics", category: "HISTORY" },
  { name: "AP Microeconomics", category: "HISTORY" },
  { name: "AP European History", category: "HISTORY" },
  { name: "Psychology", category: "HISTORY" },
  { name: "AP Psychology", category: "HISTORY" },
  // World Languages
  { name: "Spanish I", category: "WORLD_LANGUAGE" },
  { name: "Spanish II", category: "WORLD_LANGUAGE" },
  { name: "Spanish II (Honors)", category: "WORLD_LANGUAGE" },
  { name: "Spanish III", category: "WORLD_LANGUAGE" },
  { name: "Spanish III (Honors)", category: "WORLD_LANGUAGE" },
  { name: "Spanish IV", category: "WORLD_LANGUAGE" },
  { name: "AP Spanish Language & Culture", category: "WORLD_LANGUAGE" },
  { name: "AP Spanish Literature & Culture", category: "WORLD_LANGUAGE" },
  { name: "French I", category: "WORLD_LANGUAGE" },
  { name: "French II", category: "WORLD_LANGUAGE" },
  { name: "French II (Honors)", category: "WORLD_LANGUAGE" },
  { name: "French III (Honors)", category: "WORLD_LANGUAGE" },
  { name: "AP French Language & Culture", category: "WORLD_LANGUAGE" },
  { name: "Latin I", category: "WORLD_LANGUAGE" },
  { name: "Latin II", category: "WORLD_LANGUAGE" },
  { name: "Latin III (Honors)", category: "WORLD_LANGUAGE" },
  { name: "AP Latin IV", category: "WORLD_LANGUAGE" },
  { name: "American Sign Language (ASL) I", category: "WORLD_LANGUAGE" },
  { name: "American Sign Language (ASL) II", category: "WORLD_LANGUAGE" },
  { name: "American Sign Language (ASL) III (Honors)", category: "WORLD_LANGUAGE" },
  { name: "German II (Honors)", category: "WORLD_LANGUAGE" },
  // Electives & CTE
  { name: "AP Computer Science Principles", category: "ELECTIVE" },
  { name: "AP Computer Science A", category: "ELECTIVE" },
  { name: "Computer Science III Advanced (Honors)", category: "ELECTIVE" },
  { name: "AP Art History", category: "ELECTIVE" },
  { name: "AP Music Theory", category: "ELECTIVE" },
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
