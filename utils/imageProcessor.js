const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { PRODUCT_UPLOADS_DIR } = require('../config/paths');

const processImages = async (files) => {
  const processed = [];

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

module.exports = { processImages };
