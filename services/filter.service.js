import { constructError } from "../utils/error.util.js";

const TABLE = "filters";
const TABLE_VALUES = "filter_values";
const TABLE_MAP = "category_filters";


export const createFilterService = async (db, { name, code, type, values, categoryIds }) => {
    if (!name || typeof name !== "string") {
        return constructError("filter name is required", 400)
    }

    if (!Array.isArray(values)) {
        return constructError("values must be an array", 400)
    }

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Insert filter
        const [result] = await conn.query(
            `INSERT INTO ${TABLE} (name, code, type)
           VALUES (?, ?, ?)`,
            [name, code, type]
        );

        const filterId = result.insertId;

        // Insert filter values
        if (values.length) {
            const rows = values.map((v) => [filterId, v]);

            await conn.query(
                `INSERT INTO ${TABLE_VALUES} (filter_id, value) VALUES ?`,
                [rows]
            );
        }

        // Insert category mappings
        if (categoryIds.length) {
            const rows = categoryIds.map((v) => [v, filterId]);

            await conn.query(
                `INSERT INTO ${TABLE_MAP} (category_id, filter_id) VALUES ?`,
                [rows]
            );
        }

        await conn.commit();

        const message = "Filter created successfully";

        return {
            message,
            filterId,
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export const updateFilterService = async (db, { id, name, code, type, values, categoryIds }) => {
    if (!name || typeof name !== "string") {
        return constructError("filter name is required", 400)
    }

    if (!Array.isArray(values)) {
        return constructError("values must be an array", 400);
    }

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Check if filter exists
        const [filter] = await conn.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [
            id,
        ]);

        if (!filter.length) {
            await conn.rollback();
            return constructError("Filter not found", 404);
        }

        // Update filter
        await conn.query(
            `UPDATE ${TABLE} SET name = ?, code = ?, type = ? WHERE id = ?`,
            [name, code, type, id]
        );

        // Delete existing filter values
        await conn.query(`DELETE FROM ${TABLE_VALUES} WHERE filter_id = ?`, [id]);

        // Insert new filter values
        if (values.length) {
            const rows = values.map((v) => [id, v]);

            await conn.query(
                `INSERT INTO ${TABLE_VALUES} (filter_id, value) VALUES ?`,
                [rows]
            );
        }

        // Delete existing category mappings
        await conn.query(`DELETE FROM ${TABLE_MAP} WHERE filter_id = ?`, [id]);

        // Insert new category mappings
        if (categoryIds.length) {
            const rows = categoryIds.map((v) => [v, id]);

            await conn.query(
                `INSERT INTO ${TABLE_MAP} (category_id, filter_id) VALUES ?`,
                [rows]
            );
        }

        await conn.commit();

        const message = "Filter updated successfully";

        return {
            message,
            filterId: id,
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export const removeFilterService = async (db, id) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Check if filter exists
        const [filter] = await conn.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [
            id,
        ]);

        if (!filter.length) {
            await conn.rollback();
            return sendError(res, 404, "Filter not found");
        }

        // Delete filter values (CASCADE should handle this, but explicit is safer)
        await conn.query(`DELETE FROM ${TABLE_VALUES} WHERE filter_id = ?`, [id]);

        // Delete category mappings
        await conn.query(`DELETE FROM ${TABLE_MAP} WHERE filter_id = ?`, [id]);

        // Delete filter
        await conn.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

        await conn.commit();

        const message = "Filter deleted successfully";

        return {
            message,
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}