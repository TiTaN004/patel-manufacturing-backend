import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import { createCategory, deleteCategory, deleteImageService, updateCateService, uploadImageService } from "../services/category.service.js";

const TABLE = "categories";

export const getAll = catchAsync(async (req, res, next) => {
  const [countRows] = await db.query(`SELECT COUNT(*) as total FROM ${TABLE}`);
  const totalCount = countRows[0].total;

  const [rows] = await db.query(`SELECT * FROM ${TABLE} ORDER BY path ASC`);
  return sendSuccess(res, "Categories fetched", rows, 1, { total: totalCount });
});

export const create = catchAsync(async (req, res, next) => {
  const { name, parent_id = null } = req.body;

  if (!name || typeof name !== "string") {
    return sendError(res, 400, "Category name is required");
  }

  const result = await createCategory(db, { name, parent_id });

  return sendSuccess(res, "Category created", result);

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   let parent = null;

  //   // 1. Resolve parent
  //   if (parent_id) {
  //     const [parents] = await conn.query(
  //       `SELECT id, level, path FROM ${TABLE} WHERE id = ?`,
  //       [parent_id]
  //     );

  //     if (!parents.length) {
  //       await conn.rollback();
  //           return sendError(res, 404, "Cart item not found");
  //     }

  //     parent = parents[0];
  //   }

  //   // 2. Calculate level
  //   const level = parent ? parent.level + 1 : 0;

  //   const [siblings] = await conn.query(
  //     `SELECT path FROM ${TABLE} WHERE parent_id <=> ? ORDER BY path DESC LIMIT 1`,
  //     [parent_id]
  //   );

  //   let nextSeq = "0001";

  //   if (siblings.length) {
  //     const lastSegment = siblings[0].path.split(".").pop();
  //     nextSeq = String(Number(lastSegment) + 1).padStart(4, "0");
  //   }

  //   const path = parent ? `${parent.path}.${nextSeq}` : nextSeq;

  //   // 5. Insert
  //   const [result] = await conn.query(
  //     `INSERT INTO ${TABLE} (name, parent_id, path, level)
  //      VALUES (?, ?, ?, ?)`,
  //     [name, parent_id, path, level]
  //   );

  //   await conn.commit();

  //   return sendSuccess(res, "Category created", {
  //     id: result.insertId,
  //     path,
  //     level,
  //   });
  // } catch (error) {
  //   await conn.rollback();
  //   throw error;
  // } finally {
  //   conn.release();
  // }
});

export const remove = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const result = await deleteCategory(db, id);

  return sendSuccess(res, "Category deleted", result);

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   // 1. Check if category exists
  //   const [categories] = await conn.query(
  //     `SELECT * FROM ${TABLE} WHERE id = ?`,
  //     [id]
  //   );

  //   console.log(categories);

  //   if (!categories.length) {
  //     await conn.rollback();
  //     return sendError(res, 404, "Category not found");
  //   }

  //   const category = categories[0];

  //   // 2. Delete children
  //   await conn.query(`DELETE FROM ${TABLE} WHERE path LIKE ?`, [
  //     `${category.path}.%`,
  //   ]);

  //   // 3. Delete category
  //   await conn.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

  //   await conn.commit();

  //   return sendSuccess(res, "Category deleted");
  // } catch (error) {
  //   await conn.rollback();
  //   throw error;
  // } finally {
  //   conn.release();
  // }
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public'); // Adjust as per your structure

export const update = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  // const [result] = await db.query(
  //   `UPDATE ${TABLE} SET name = ? WHERE id = ?`,
  //   [name, id]
  // );

  // if (result.affectedRows === 0) {
  //   return sendError(res, 404, "Category not found");
  // }

  const result = await updateCateService(db, { id, name })

  return sendSuccess(res, result.message);
});

export const uploadImage = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // const [categories] = await db.query(
  //   `SELECT id, level, img_url FROM ${TABLE} WHERE id = ?`,
  //   [id]
  // );

  // if (categories.length === 0) {
  //   return sendError(res, 404, "Category not found");
  // }

  // const category = categories[0];

  // if (category.level !== 0) {
  //   return sendError(res, 403, "Only main categories can have images");
  // }

  // if (!req.file) {
  //   return sendError(res, 400, "No image uploaded");
  // }

  // const imgUrl = `/uploads/categories/${req.file.filename}`;

  // // Delete old image if exists
  // if (category.img_url) {
  //   const oldPath = path.join(publicDir, category.img_url);
  //   if (fs.existsSync(oldPath)) {
  //     fs.unlinkSync(oldPath);
  //   }
  // }

  // await db.query(
  //   `UPDATE ${TABLE} SET img_url = ? WHERE id = ?`,
  //   [imgUrl, id]
  // );

  const file = req.file

  const result = await uploadImageService(db, { file, id })

  // return sendSuccess(res, "Category image updated successfully", { url: imgUrl });
  return sendSuccess(res, result.message, { url: result.imgUrl });
});

export const deleteImage = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // const [categories] = await db.query(
  //   `SELECT id, level, img_url FROM ${TABLE} WHERE id = ?`,
  //   [id]
  // );

  // if (categories.length === 0) {
  //   return sendError(res, 404, "Category not found");
  // }

  // const category = categories[0];

  // if (!category.img_url) {
  //   return sendError(res, 404, "No image found for this category");
  // }

  // const filePath = path.join(publicDir, category.img_url);
  // if (fs.existsSync(filePath)) {
  //   fs.unlinkSync(filePath);
  // }

  // await db.query(
  //   `UPDATE ${TABLE} SET img_url = NULL WHERE id = ?`,
  //   [id]
  // );

  const result = await deleteImageService(db, id)

  return sendSuccess(res, result.message);
});
