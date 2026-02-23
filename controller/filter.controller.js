import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import { createFilterService, removeFilterService, updateFilterService } from "../services/filter.service.js";

const TABLE = "filters";
const TABLE_VALUES = "filter_values";
const TABLE_MAP = "category_filters";

export const getAll = catchAsync(async (req, res, next) => {
  const [countRows] = await db.query(`SELECT COUNT(*) as total FROM ${TABLE}`);
  const totalCount = countRows[0].total;

  // Get all filters
  const [filters] = await db.query(`SELECT * FROM ${TABLE} ORDER BY id DESC`);

  // Get all filter values
  const [filterValues] = await db.query(`SELECT * FROM ${TABLE_VALUES}`);

  // Get all category mappings
  const [categoryMappings] = await db.query(`SELECT * FROM ${TABLE_MAP}`);

  // Combine the data
  const enrichedFilters = filters.map((filter) => {
    return {
      ...filter,
      values: filterValues
        .filter((fv) => fv.filter_id === filter.id)
        .map((fv) => ({
          id: fv.id,
          value: fv.value,
        })),
      categoryIds: categoryMappings
        .filter((cm) => cm.filter_id === filter.id)
        .map((cm) => cm.category_id),
    };
  });

  return sendSuccess(res, "Filters fetched", enrichedFilters, 1, { total: totalCount });
});

export const create = catchAsync(async (req, res, next) => {
  const {
    code,
    name,
    values = [],
    categoryIds = [],
    type = "select",
  } = req.body;

  // if (!name || typeof name !== "string") {
  //   return sendError(res, 400, "filter name is required");
  // }

  // if (!Array.isArray(values)) {
  //   return sendError(res, 400, "values must be an array");
  // }

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   // Insert filter
  //   const [result] = await conn.query(
  //     `INSERT INTO ${TABLE} (name, code, type)
  //      VALUES (?, ?, ?)`,
  //     [name, code, type]
  //   );

  //   const filterId = result.insertId;

  //   // Insert filter values
  //   if (values.length) {
  //     const rows = values.map((v) => [filterId, v]);

  //     await conn.query(
  //       `INSERT INTO ${TABLE_VALUES} (filter_id, value) VALUES ?`,
  //       [rows]
  //     );
  //   }

  //   // Insert category mappings
  //   if (categoryIds.length) {
  //     const rows = categoryIds.map((v) => [v, filterId]);

  //     await conn.query(
  //       `INSERT INTO ${TABLE_MAP} (category_id, filter_id) VALUES ?`,
  //       [rows]
  //     );
  //   }

  //   await conn.commit();

  const result = await createFilterService(db, { name, code, type, values, categoryIds });

  return sendSuccess(res, result.message, { id: result.filterId });
}
);

export const update = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    code,
    name,
    values = [],
    categoryIds = [],
    type = "select",
  } = req.body;

  // if (!name || typeof name !== "string") {
  //   return sendError(res, 400, "filter name is required");
  // }

  // if (!Array.isArray(values)) {
  //   return sendError(res, 400, "values must be an array");
  // }

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   // Check if filter exists
  //   const [filter] = await conn.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [
  //     id,
  //   ]);

  //   if (!filter.length) {
  //     await conn.rollback();
  //     return sendError(res, 404, "Filter not found");
  //   }

  //   // Update filter
  //   await conn.query(
  //     `UPDATE ${TABLE} SET name = ?, code = ?, type = ? WHERE id = ?`,
  //     [name, code, type, id]
  //   );

  //   // Delete existing filter values
  //   await conn.query(`DELETE FROM ${TABLE_VALUES} WHERE filter_id = ?`, [id]);

  //   // Insert new filter values
  //   if (values.length) {
  //     const rows = values.map((v) => [id, v]);

  //     await conn.query(
  //       `INSERT INTO ${TABLE_VALUES} (filter_id, value) VALUES ?`,
  //       [rows]
  //     );
  //   }

  //   // Delete existing category mappings
  //   await conn.query(`DELETE FROM ${TABLE_MAP} WHERE filter_id = ?`, [id]);

  //   // Insert new category mappings
  //   if (categoryIds.length) {
  //     const rows = categoryIds.map((v) => [v, id]);

  //     await conn.query(
  //       `INSERT INTO ${TABLE_MAP} (category_id, filter_id) VALUES ?`,
  //       [rows]
  //     );
  //   }

  //   await conn.commit();

  const result = await updateFilterService(db, { id, name, code, type, values, categoryIds });

  return sendSuccess(res, result.message, { id: result.filterId });
  // } catch (error) {
  //   await conn.rollback();
  //   throw error;
  // } finally {
  //   conn.release();
  // }
});

export const remove = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   // Check if filter exists
  //   const [filter] = await conn.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [
  //     id,
  //   ]);

  //   if (!filter.length) {
  //     await conn.rollback();
  //     return sendError(res, 404, "Filter not found");
  //   }

  //   // Delete filter values (CASCADE should handle this, but explicit is safer)
  //   await conn.query(`DELETE FROM ${TABLE_VALUES} WHERE filter_id = ?`, [id]);

  //   // Delete category mappings
  //   await conn.query(`DELETE FROM ${TABLE_MAP} WHERE filter_id = ?`, [id]);

  //   // Delete filter
  //   await conn.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

  //   await conn.commit();

  const result = await removeFilterService(db, id);

  return sendSuccess(res, result.message);
  // } catch (error) {
  //   await conn.rollback();
  //   throw error;
  // } finally {
  //   conn.release();
  // }
});
