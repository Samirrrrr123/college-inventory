import ExcelJS from 'exceljs';
import { ApiError } from '../errors.js';
import { CatalogRepository } from '../catalog/repository.js';
import { equipmentQuery } from '../catalog/schemas.js';
import { z } from 'zod';

export const exportQuery = equipmentQuery.omit({ page: true, pageSize: true }).extend({
  language: z.enum(['ru', 'en']).default('ru'),
});
const limit = 5000;
const labels = {
  ru: [
    'Инвентарный номер',
    'Оборудование',
    'Категория',
    'Аудитория',
    'Корпус',
    'Статус',
    'Серийный номер',
    'Описание',
  ],
  en: [
    'Inventory number',
    'Equipment',
    'Category',
    'Room',
    'Building',
    'Status',
    'Serial number',
    'Description',
  ],
};
const statuses = {
  ru: { available: 'Доступно', issued: 'Выдано', repair: 'В ремонте', written_off: 'Списано' },
  en: {
    available: 'Available',
    issued: 'On loan',
    repair: 'Maintenance',
    written_off: 'Written off',
  },
};

export class ReportService {
  constructor(readonly repository: CatalogRepository) {}

  async equipment(query: z.infer<typeof exportQuery>, role: string) {
    if (!['technician', 'admin'].includes(role))
      throw new ApiError(403, 'FORBIDDEN', 'Staff access required');
    const rows = await this.repository.exportEquipment(query, limit);
    if (rows.length > limit)
      throw new ApiError(422, 'EXPORT_LIMIT', 'Use filters to export at most 5000 items');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'College Inventory';
    const sheet = workbook.addWorksheet(
      query.language === 'ru' ? 'Оборудование' : 'Equipment',
    );
    sheet.columns = labels[query.language].map((header, index) => ({
      header,
      width: [24, 38, 24, 18, 24, 20, 24, 60][index],
    }));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = 'A1:H1';
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF355E4C' },
    };
    for (const item of rows) {
      sheet.addRow([
        item.inventoryNumber,
        item.name,
        item.category.name,
        item.room.number,
        item.room.building,
        statuses[query.language][item.status],
        item.serialNumber ?? '',
        item.description,
      ]);
    }
    sheet.eachRow((row) => {
      row.alignment = { vertical: 'top', wrapText: true };
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
