import { storeImages } from './image-storage.util';

/** Subset of Multer's file shape that this utility actually uses. */
export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

export interface ProcessedImage {
  url: string;
  filename: string;
}

/**
 * Product images: 800x800, webp.
 *
 * The resize and the destination both moved into image-storage.util, which is
 * what lets the same bytes go to disk locally and to Cloudinary in production.
 * This stays as the name the product controller already imports.
 */
export const processImages = async (files: UploadedFile[]): Promise<ProcessedImage[]> =>
  storeImages(files, 'products', { width: 800, height: 800, format: 'webp' });
