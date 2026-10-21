import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { ReportService, exportQuery } from '../src/reports/service.js';
import type { CatalogRepository } from '../src/catalog/repository.js';

const item = {
  inventoryNumber: '0000123',
  name: '=HYPERLINK("https://example.test")',
  category: { name: '+Category' },
  room: { number: '001', building: '@Building' },
  status: 'available',
  serialNumber: '0000456',
  description: '-1+2',
};
function service(rows: unknown[]) {
  const repository = { exportEquipment: vi.fn().mockResolvedValue(rows) };
  return {
    repository,
    reports: new ReportService(repository as unknown as CatalogRepository),
  };
}
async function read(bytes: Buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(bytes).buffer);
  return book.worksheets[0];
}
describe('Equipment workbook', () => {
  it('denies unauthorized roles before reading data', async () => {
    const { reports, repository } = service([]);
    for (const role of ['teacher', 'unknown'])
      await expect(reports.equipment(exportQuery.parse({}), role)).rejects.toMatchObject({
        status: 403,
      });
    expect(repository.exportEquipment).not.toHaveBeenCalled();
  });
  it('preserves leading zeros and writes formula-like input as plain text', async () => {
    const { reports } = service([item]);
    const sheet = await read(await reports.equipment(exportQuery.parse({}), 'technician'));
    expect(sheet.getCell('A2').value).toBe('0000123');
    expect(sheet.getCell('D2').value).toBe('001');
    expect(sheet.getCell('G2').value).toBe('0000456');
    for (const cell of ['B2', 'C2', 'E2', 'H2']) {
      expect(sheet.getCell(cell).type).toBe(ExcelJS.ValueType.String);
      expect(sheet.getCell(cell).formula).toBeUndefined();
    }
    expect(sheet.getCell('B2').value).toBe(item.name);
    expect(sheet.getCell('F2').value).toBe('Доступно');
  });
  it('exports English headings and statuses, with an empty serial number', async () => {
    const { reports } = service([{ ...item, status: 'written_off', serialNumber: null }]);
    const sheet = await read(
      await reports.equipment(exportQuery.parse({ language: 'en' }), 'admin'),
    );
    expect(sheet.name).toBe('Equipment');
    expect(sheet.getCell('A1').value).toBe('Inventory number');
    expect(sheet.getCell('F2').value).toBe('Written off');
    expect(sheet.getCell('G2').text).toBe('');
  });
  it('produces a valid empty workbook and rejects invalid or paginated parameters', async () => {
    const { reports } = service([]);
    const sheet = await read(await reports.equipment(exportQuery.parse({}), 'admin'));
    expect(sheet.rowCount).toBe(1);
    for (const query of [
      { language: 'xx' },
      { page: 2 },
      { pageSize: 7 },
      { status: 'unknown' },
      { roomId: 'invalid' },
    ])
      expect(() => exportQuery.parse(query)).toThrow();
  });
  it('exports exactly 5000 rows and refuses larger results without truncating', async () => {
    const { reports } = service(Array.from({ length: 5000 }, () => item));
    const sheet = await read(await reports.equipment(exportQuery.parse({}), 'admin'));
    expect(sheet.rowCount).toBe(5001);
    const tooMany = service(Array.from({ length: 5001 }, () => item));
    await expect(
      tooMany.reports.equipment(exportQuery.parse({}), 'admin'),
    ).rejects.toMatchObject({ status: 422, code: 'EXPORT_LIMIT' });
  });
});
