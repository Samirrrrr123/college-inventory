import type { PrismaClient } from '@prisma/client';

export async function seedCatalog(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    const categories = [];
    for (const name of ['Ноутбуки', 'Проекторы', 'Мониторы'])
      categories.push(
        await tx.category.upsert({ where: { name }, create: { name }, update: {} }),
      );
    const rooms = [];
    for (let index = 1; index <= 3; index++) {
      const building = 'Учебный корпус (демо)';
      const number = `30${index}`;
      rooms.push(
        await tx.room.upsert({
          where: { building_number: { building, number } },
          create: { building, number, name: `Учебная аудитория ${number}`, floor: 3 },
          update: {},
        }),
      );
    }
    for (let index = 1; index <= 36; index++) {
      const inventoryNumber = `DEMO-${String(index).padStart(4, '0')}`;
      await tx.equipment.upsert({
        where: { inventoryNumber },
        update: {},
        create: {
          inventoryNumber,
          name: `${['Демо ноутбук', 'Демо проектор', 'Демо монитор'][(index - 1) % 3]} ${String(index).padStart(2, '0')}`,
          serialNumber: `DEMO-SN-${index}`,
          description: 'Учебные демонстрационные данные',
          categoryId: categories[(index - 1) % 3].id,
          roomId: rooms[(index - 1) % 3].id,
          status: index === 35 ? 'repair' : index === 36 ? 'written_off' : 'available',
        },
      });
    }
  });
}
