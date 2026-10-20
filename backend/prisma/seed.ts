import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8 || Buffer.byteLength(password) > 72)
  throw new Error('Set SEED_PASSWORD to a test password of 8–72 bytes');
try {
  const passwordHash = await bcrypt.hash(password, 12);
  for (const code of ['teacher', 'technician', 'admin']) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const names: Record<string, string> = {
      teacher: 'Преподаватель',
      technician: 'Артём',
      admin: 'Самир',
    };
    await db.user.upsert({
      where: { email: `${code}@college.test` },
      create: {
        name: names[code],
        email: `${code}@college.test`,
        passwordHash,
        roleId: role.id,
      },
      update: {},
    });
  }
  console.log('Seed accounts are ready; existing passwords were preserved');
} finally {
  await db.$disconnect();
}
