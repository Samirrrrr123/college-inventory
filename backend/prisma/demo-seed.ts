import { PrismaClient } from '@prisma/client';
import { seedOperations } from './operations-seed.js';

const db = new PrismaClient();
try {
  const teacher = await db.user.findUniqueOrThrow({
    where: { email: 'teacher@college.test' },
  });
  const technician = await db.user.findUniqueOrThrow({
    where: { email: 'technician@college.test' },
  });
  const created = await seedOperations(db, teacher.id, technician.id);
  console.log(
    created ? 'Demo operations created' : 'Demo operations already exist; no records changed',
  );
} finally {
  await db.$disconnect();
}
