import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { db } from '../db.js';
import { sendSuccess, sendError } from '../utils/response.util.js';
import { catchAsync } from '../utils/error.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

import sharp from 'sharp';

export const uploadSingle = catchAsync(async (req, res, next) => {
  let file = req.files && req.files.length > 0 ? req.files[0] : req.file;
  if (!file) {
    return sendError(res, 400, 'No file uploaded');
  }

  // Compress image if it's an image
  if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
    try {
      const filePath = file.path;
      const compressedPath = filePath.split('.').slice(0, -1).join('.') + '-compressed.webp';

      await sharp(filePath)
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(compressedPath);

      // Remove original file and update file object
      fs.unlinkSync(filePath);
      file.path = compressedPath;
      file.filename = path.basename(compressedPath);
      file.size = fs.statSync(compressedPath).size;
      file.mimetype = 'image/webp';
    } catch (err) {
      console.error('Sharp compression failed:', err);
      // Continue with original file if compression fails
    }
  }

  // Generate URL for the uploaded file
  const folder = file.destination.replace(/^uploads\/?/, '').replace(/\/$/, '');
  const fileUrl = folder ? `/uploads/${folder}/${file.filename}` : `/uploads/${file.filename}`;

  return sendSuccess(res, 'File uploaded successfully', {
    url: fileUrl,
    filename: file.filename,
    folder: folder,
    size: file.size,
    mimetype: file.mimetype
  });
});

export const uploadMultiple = catchAsync(async (req, res, next) => {
  let filesArray = req.files || [];
  if (filesArray.length === 0) {
    return sendError(res, 400, 'No files uploaded');
  }

  const processedFiles = [];

  for (const file of filesArray) {
    // Compress image if it's an image
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
      try {
        const filePath = file.path;
        const compressedPath = filePath.split('.').slice(0, -1).join('.') + '-compressed.webp';

        await sharp(filePath)
          .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(compressedPath);

        fs.unlinkSync(filePath);
        file.path = compressedPath;
        file.filename = path.basename(compressedPath);
        file.size = fs.statSync(compressedPath).size;
        file.mimetype = 'image/webp';
      } catch (err) {
        console.error('Sharp compression failed for multiple upload:', err);
      }
    }

    const folder = file.destination.replace(/^uploads\/?/, '').replace(/\/$/, '');
    const url = folder ? `/uploads/${folder}/${file.filename}` : `/uploads/${file.filename}`;

    processedFiles.push({
      url: url,
      filename: file.filename,
      folder: folder,
      size: file.size,
      mimetype: file.mimetype
    });
  }

  return sendSuccess(res, `${processedFiles.length} files uploaded successfully`, processedFiles);
});

export const deleteFile = catchAsync(async (req, res, next) => {
  const { folder, filename } = req.params;
  const filePath = folder ? path.join(uploadsDir, folder, filename) : path.join(uploadsDir, filename);
  const fileUrl = folder ? `/uploads/${folder}/${filename}` : `/uploads/${filename}`;

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Check if file exists in filesystem
    if (!fs.existsSync(filePath)) {
      await conn.rollback();
      return sendError(res, 404, 'File not found');
    }

    // 2. Set primary_image to NULL if it matches
    await conn.query(
      `UPDATE products SET primary_image = NULL WHERE primary_image = ?`,
      [fileUrl]
    );

    // 3. Update images JSON array
    // We need to find products that have this file in their images array.
    // Since images is stored as JSON text or array, we might need to fetch and update.
    // A more efficient way in MySQL 8.0 would be JSON_REMOVE, but let's stick to safe fetch-update-save for compatibility/simplicity with potential string storage.

    // Find products potentially containing the filename in images column
    const [productsWithImage] = await conn.query(
      `SELECT id, images FROM products WHERE images LIKE ?`,
      [`%${filename}%`]
    );

    for (const product of productsWithImage) {
      let images = product.images;

      // Parse if string
      if (typeof images === 'string') {
        try {
          images = JSON.parse(images);
        } catch (e) {
          continue; // Skip if invalid JSON
        }
      }

      if (Array.isArray(images)) {
        const newImages = images.filter(img => !img.includes(filename));

        // Only update if changes were made
        if (newImages.length !== images.length) {
          const newImagesJson = JSON.stringify(newImages);
          await conn.query(
            `UPDATE products SET images = ? WHERE id = ?`,
            [newImagesJson, product.id]
          );
        }
      }
    }


    // 3.5 Clear invoice URLs in orders table
    await conn.query(
      'UPDATE orders SET invoice_url = NULL WHERE invoice_url = ?',
      [fileUrl]
    );
    // await conn.query(
    //     'UPDATE orders SET additional_invoice_url = NULL WHERE additional_invoice_url = ?',
    //     [fileUrl]
    // );
    // 4. Delete file from filesystem
    fs.unlinkSync(filePath);

    await conn.commit();

    return sendSuccess(res, 'File deleted successfully');
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});