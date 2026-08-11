import { promises as fs } from 'fs';
import path from 'path';
import { PUBLIC_DIR } from '../../config/paths';

/**
 * Delete a file from the file system if it exists.
 *
 * @param filePath path relative to the public directory, e.g. '/uploads/products/image.webp'
 * @returns true if the file was deleted or never existed, false on error
 */
export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    // Resolve against PUBLIC_DIR rather than process.cwd(): the previous
    // cwd-relative join silently pointed at the wrong directory whenever the
    // app was started from anywhere but the project root, so cleanup quietly
    // deleted nothing.
    const absolutePath = path.join(PUBLIC_DIR, filePath);

    // Check if file exists before attempting to delete
    await fs.access(absolutePath);

    // Delete the file
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, which is fine
      console.log(`ℹ️ File not found (already deleted): ${filePath}`);
      return true;
    }
    console.error(`❌ Error deleting file ${filePath}:`, (error as Error).message);
    return false;
  }
};

export interface DeleteFilesResult {
  deleted: string[];
  failed: string[];
}

/** Delete multiple files from the file system. */
export const deleteFiles = async (filePaths: string[]): Promise<DeleteFilesResult> => {
  const results: DeleteFilesResult = {
    deleted: [],
    failed: []
  };

  for (const filePath of filePaths) {
    const success = await deleteFile(filePath);
    if (success) {
      results.deleted.push(filePath);
    } else {
      results.failed.push(filePath);
    }
  }

  return results;
};

/**
 * Compare old and new image arrays and return the images that should be deleted.
 *
 * Entries in `newImages` that are base64 data URLs are fresh uploads rather
 * than references to existing files, so they are excluded from the comparison.
 */
export const getImagesToDelete = (oldImages: string[], newImages: string[]): string[] => {
  const newImageUrls = newImages.filter((img) => !img.startsWith('data:'));

  return oldImages.filter((oldImg) => !newImageUrls.includes(oldImg));
};
