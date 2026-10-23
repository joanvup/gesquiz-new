import 'dotenv/config'
import { expect, test } from 'vitest'
import { PrismaClient } from '../../src/generated/prisma/client'
import { createPrismaMariaDbAdapter } from '../lib/prisma-adapter'

test('seed data exists in database', async () => {
  const prisma = new PrismaClient({ adapter: createPrismaMariaDbAdapter() })

  const docente = await prisma.user.findUnique({
    where: { email: 'docente@quizcolegio.test' },
  })
  expect(docente).toBeDefined()
  expect(docente?.role).toBe('TEACHER')

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
  })
  expect(students.length).toBe(3)

  const grupo = await prisma.group.findFirst({
    where: { name: 'Grupo A' },
    include: { members: true },
  })
  expect(grupo).toBeDefined()
  expect(grupo?.members.length).toBe(3)

  await prisma.$disconnect()
})
