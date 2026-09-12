/**
 * Moves the images that predate Cloudinary into it, and repoints the database.
 *
 * Run once, after CLOUDINARY_URL is set and before Render is allowed to restart
 * with images anyone cares about. Until it runs, old rows still hold
 * '/uploads/...' paths - which the app serves happily from disk in development,
 * and which 404 on Render as soon as the instance that held them is replaced.
 *
 *   cd backend
 *   node scripts/migrate-images-to-cloudinary.mjs --dry-run   # report only
 *   node scripts/migrate-images-to-cloudinary.mjs
 *
 * Safe to run more than once. Values that are already Cloudinary URLs are
 * skipped, and each file keeps its existing basename as its public id, so a
 * second pass re-points at what the first pass uploaded rather than making a
 * duplicate. Files missing from disk are reported and left alone rather than
 * blanking a field that at least documents what used to be there.
 */
/**
 * First, and deliberately.
 *
 * ES imports are hoisted and evaluated in source order before any of the code
 * below runs, and the Cloudinary SDK reads CLOUDINARY_URL as it initialises.
 * Loaded any later than this, the SDK has already decided it has no
 * credentials, and `cloudinary.config({ secure: true })` does not send it back
 * to the environment to look again - every upload then fails with "Must supply
 * api_key" despite the variable being set. The backend avoids this by importing
 * config/env before anything else; the same rule applies here.
 */
import 'dotenv/config';

import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT_FOLDER = process.env.CLOUDINARY_FOLDER || 'lacedup';
const PUBLIC_DIR = path.resolve(import.meta.dirname, '..', 'public');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Run this from backend/ with a .env in place.');
  process.exit(1);
}

if (!DRY_RUN && !process.env.CLOUDINARY_URL) {
  console.error('CLOUDINARY_URL is not set. Nothing to migrate to.');
  process.exit(1);
}

cloudinary.config({ secure: true });

/**
 * Every field holding an image, as (collection, field, isArray).
 *
 * Written against the collections directly rather than importing the Mongoose
 * models: the models are TypeScript and this is a one-off script that should
 * not need the build to be current to run.
 */
const FIELDS = [
  ['products', 'mainImage', false],
  ['products', 'subImages', true],
  ['brands', 'image', false],
  ['categories', 'image', false],
  ['reviews', 'images', true],
  ['users', 'profilePhoto', false]
];

const isCloudinary = (value) => typeof value === 'string' && value.includes('res.cloudinary.com');

/**
 * The folder a stored value belongs in.
 *
 * Profile photos are the exception: they stored a bare filename rather than a
 * '/uploads/...' path, so there is no folder in the value to read.
 */
const folderFor = (value, field) => {
  if (field === 'profilePhoto' && !value.startsWith('/')) return 'profiles';
  const match = /^\/uploads\/([a-z]+)\//.exec(value);
  return match?.[1] ?? null;
};

const diskPathFor = (value, folder) =>
  value.startsWith('/uploads/')
    ? path.join(PUBLIC_DIR, value.replace(/^\//, ''))
    : path.join(PUBLIC_DIR, 'uploads', folder, value);

const stats = { uploaded: 0, skipped: 0, missing: [], failed: [] };

/** Uploads one file and returns its delivery URL, or null if it could not be. */
const migrateValue = async (value, field) => {
  if (!value || isCloudinary(value)) {
    stats.skipped += 1;
    return null;
  }

  const folder = folderFor(value, field);
  if (!folder) {
    stats.failed.push(`${value} (no folder could be derived)`);
    return null;
  }

  const file = diskPathFor(value, folder);
  if (!fs.existsSync(file)) {
    stats.missing.push(value);
    return null;
  }

  // The basename becomes the public id, so re-running finds what the last run
  // uploaded instead of creating a second copy.
  const name = path.basename(file, path.extname(file));
  const publicId = `${ROOT_FOLDER}/${folder}/${name}`;

  if (DRY_RUN) {
    console.log(`  would upload ${value} -> ${publicId}`);
    stats.uploaded += 1;
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(file, {
      public_id: publicId,
      resource_type: 'image',
      overwrite: true
    });

    stats.uploaded += 1;
    return result.secure_url;
  } catch (error) {
    stats.failed.push(`${value} (${error.message})`);
    return null;
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  for (const [collectionName, field, isArray] of FIELDS) {
    const collection = db.collection(collectionName);
    const documents = await collection.find({ [field]: { $exists: true, $ne: null } }).toArray();

    console.log(`\n${collectionName}.${field} - ${documents.length} document(s)`);

    for (const document of documents) {
      const current = document[field];

      if (isArray) {
        if (!Array.isArray(current) || current.length === 0) continue;

        const migrated = [];
        let changed = false;

        for (const value of current) {
          const url = await migrateValue(value, field);
          migrated.push(url ?? value);
          if (url) changed = true;
        }

        if (changed && !DRY_RUN) {
          await collection.updateOne({ _id: document._id }, { $set: { [field]: migrated } });
        }
        continue;
      }

      const url = await migrateValue(current, field);
      if (url && !DRY_RUN) {
        await collection.updateOne({ _id: document._id }, { $set: { [field]: url } });
      }
    }
  }

  await mongoose.disconnect();

  console.log(`\n${DRY_RUN ? 'Would upload' : 'Uploaded'}: ${stats.uploaded}`);
  console.log(`Already migrated, skipped: ${stats.skipped}`);

  if (stats.missing.length) {
    console.log(`\nNot on disk, left as they are (${stats.missing.length}):`);
    for (const value of stats.missing) console.log(`  ${value}`);
  }

  if (stats.failed.length) {
    console.log(`\nFailed (${stats.failed.length}):`);
    for (const value of stats.failed) console.log(`  ${value}`);
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
