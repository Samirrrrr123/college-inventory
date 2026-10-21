import { Prisma } from '@prisma/client';
import { ApiError } from '../errors.js';
import { FileRepository } from './repository.js';

export const maxFileSize = 5 * 1024 * 1024;
const formats = {
  'image/png': {
    extension: /\.png$/iu,
    signature: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  },
  'image/jpeg': { extension: /\.jpe?g$/iu, signature: Buffer.from([255, 216, 255]) },
  'application/pdf': { extension: /\.pdf$/iu, signature: Buffer.from('%PDF-') },
};

export class FileService {
  constructor(readonly repository: FileRepository) {}

  async list(equipmentId: string, query: Parameters<FileRepository['list']>[1]) {
    await this.requireEquipment(equipmentId);
    const [data, total] = await this.repository.list(equipmentId, query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async download(equipmentId: string, id: string) {
    const file = await this.repository.find(equipmentId, id);
    if (!file) throw new ApiError(404, 'NOT_FOUND', 'File not found');
    return file;
  }

  async upload(
    equipmentId: string,
    actor: { id: string; role: string },
    name: string,
    contentType: string,
    content: unknown,
  ) {
    this.requireStaff(actor.role);
    if (!Buffer.isBuffer(content) || !content.length)
      throw new ApiError(422, 'EMPTY_FILE', 'Choose a file');
    if (content.length > maxFileSize)
      throw new ApiError(413, 'BODY_TOO_LARGE', 'Maximum file size is 5 MB');
    const format = Object.hasOwn(formats, contentType)
      ? formats[contentType as keyof typeof formats]
      : undefined;
    if (
      !format ||
      !format.extension.test(name) ||
      !content.subarray(0, format.signature.length).equals(format.signature)
    )
      throw new ApiError(415, 'INVALID_FILE_TYPE', 'Only PNG, JPG and PDF files are allowed');
    if (
      !name.length ||
      name.length > 160 ||
      /[/\\]/u.test(name) ||
      [...name].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      name !== name.trim()
    )
      throw new ApiError(422, 'INVALID_FILE_NAME', 'Invalid file name');
    await this.requireEquipment(equipmentId);
    try {
      return await this.repository.create(equipmentId, actor.id, name, contentType, content);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
        throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
      throw error;
    }
  }

  async remove(equipmentId: string, id: string, actor: { id: string; role: string }) {
    this.requireStaff(actor.role);
    if (!(await this.repository.remove(equipmentId, id, actor.id)))
      throw new ApiError(404, 'NOT_FOUND', 'File not found');
  }

  private async requireEquipment(id: string) {
    if (!(await this.repository.equipment(id)))
      throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
  }

  private requireStaff(role: string) {
    if (!['technician', 'admin'].includes(role))
      throw new ApiError(403, 'FORBIDDEN', 'Staff access required');
  }
}
