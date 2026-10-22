import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed de QuizColegio...");

  await prisma.auditEvent.deleteMany();
  await prisma.attemptAnswer.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.answerOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quizAssignment.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.session.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.user.deleteMany();

  const docentePasswordHash = await bcrypt.hash("Docente123!", 10);
  const docente = await prisma.user.create({
    data: {
      email: "docente@quizcolegio.test",
      passwordHash: docentePasswordHash,
      name: "Laura Docente",
      role: "TEACHER",
    },
  });
  console.log(`Docente creado: ${docente.email}`);

  const grupoA = await prisma.group.create({
    data: {
      name: "Grupo A",
    },
  });
  console.log(`Grupo creado: ${grupoA.name}`);

  const studentPasswordHash = await bcrypt.hash("Estudiante123!", 10);
  const studentData = [
    { email: "estudiante1@quizcolegio.test", name: "Ana Estudiante" },
    { email: "estudiante2@quizcolegio.test", name: "Beto Estudiante" },
    { email: "estudiante3@quizcolegio.test", name: "Carla Estudiante" },
  ];

  for (const s of studentData) {
    const student = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash: studentPasswordHash,
        name: s.name,
        role: "STUDENT",
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: grupoA.id,
        userId: student.id,
      },
    });
    console.log(`Estudiante creado y agregado a Grupo A: ${student.email}`);
  }

  console.log("Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
