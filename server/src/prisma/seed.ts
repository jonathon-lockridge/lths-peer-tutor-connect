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

const DEMO_STUDENTS = [
  { firstName: "Example", lastName: "Tutor", grade: 11, bio: "This is a demo tutor account to show how the app looks. Real tutors will appear here once students sign up." },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Clear old demo data
  await prisma.user.deleteMany({
    where: { email: { startsWith: "demo" } },
  });

  // Subjects
  console.log("Creating subjects...");
  const subjectMap: Record<string, string> = {};
  for (const s of SUBJECTS) {
    const subject = await prisma.subject.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
    subjectMap[s.name] = subject.id;
  }

  // Demo students
  console.log("Creating demo tutor...");
  const userIds: string[] = [];
  for (let i = 0; i < DEMO_STUDENTS.length; i++) {
    const s = DEMO_STUDENTS[i];
    const user = await prisma.user.upsert({
      where: { email: `demo${i + 1}@ltisdschools.org` },
      update: {},
      create: {
        clerkId: `demo_clerk_${i + 1}`,
        email: `demo${i + 1}@ltisdschools.org`,
        firstName: s.firstName,
        lastName: s.lastName,
        grade: s.grade,
        role: "STUDENT",
        bio: s.bio,
        isTutor: true,
      },
    });
    userIds.push(user.id);
  }

  // Admin user
  await prisma.user.upsert({
    where: { email: "admin@ltisdschools.org" },
    update: {},
    create: {
      clerkId: "admin_clerk_1",
      email: "admin@ltisdschools.org",
      firstName: "Admin",
      lastName: "Counselor",
      grade: 12,
      role: "ADMIN",
      isTutor: false,
    },
  });

  // TutorSubjects
  console.log("Assigning tutor subjects...");
  const tutorAssignments = [
    { userIdx: 0, subjects: ["Algebra 1", "AP Calculus AB", "Biology", "AP English Language"] },
  ];

  for (const assignment of tutorAssignments) {
    for (const subjectName of assignment.subjects) {
      const subjectId = subjectMap[subjectName];
      if (!subjectId) continue;
      await prisma.tutorSubject.upsert({
        where: {
          userId_subjectId: {
            userId: userIds[assignment.userIdx],
            subjectId,
          },
        },
        update: {},
        create: {
          userId: userIds[assignment.userIdx],
          subjectId,
          selfRating: Math.floor(Math.random() * 2) + 4, // 4 or 5
          teacherEndorsed: Math.random() > 0.5,
        },
      });
    }
  }

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
