import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { PRODUCT_UPLOADS_DIR } from '../../config/paths';

/** Subset of Multer's file shape that this utility actually uses. */
export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

export interface ProcessedImage {
  url: string;
  filename: string;
}

export const processImages = async (files: UploadedFile[]): Promise<ProcessedImage[]> => {
  const processed: ProcessedImage[] = [];

  // Ensure the destination exists - sharp.toFile does not create directories
  if (!fs.existsSync(PRODUCT_UPLOADS_DIR)) {
    fs.mkdirSync(PRODUCT_UPLOADS_DIR, { recursive: true });
  }

  for (const file of files) {
    const filename = `${Date.now()}-${file.originalname.split('.')[0]}.webp`;
    const outputPath = path.join(PRODUCT_UPLOADS_DIR, filename);

    await sharp(file.buffer)
      .resize(800, 800, { fit: 'cover', position: 'center' })
      .webp()
      .toFile(outputPath);

    processed.push({ url: `/uploads/products/${filename}`, filename });
  }

  return processed;
};
