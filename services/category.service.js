import { constructError } from "../utils/error.util.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public'); // Adjust as per your structure
const TABLE = "categories";

/**
 * Service to create a category. 
 * Note: No 'res' or 'next' here. Only Data in, Data out (or Error thrown).
 */
export const createCategory = async (db, { name, parent_id }) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        let parent = null;

        // 1. Resolve parent
        if (parent_id) {
            const [parents] = await conn.query(
                `SELECT id, level, path FROM ${TABLE} WHERE id = ?`,
                [parent_id]
            );

            if (!parents.length) {
                // const error = new Error("Parent category not found");
                // error.status = 404;
                throw constructError("Parent category not found", 404);
            }

            parent = parents[0];
        }

        // 2. Calculate level
        const level = parent ? parent.level + 1 : 0;

        // 3. Calculate Path (Hierarchical logic)
        const [siblings] = await conn.query(
            `SELECT path FROM ${TABLE} WHERE parent_id <=> ? ORDER BY path DESC LIMIT 1`,
            [parent_id]
        );

        let nextSeq = "0001";
        if (siblings.length) {
            const lastSegment = siblings[0].path.split(".").pop();
            nextSeq = String(Number(lastSegment) + 1).padStart(4, "0");
        }

        const path = parent ? `${parent.path}.${nextSeq}` : nextSeq;

        // 4. Insert
        const [result] = await conn.query(
            `INSERT INTO ${TABLE} (name, parent_id, path, level) VALUES (?, ?, ?, ?)`,
            [name, parent_id, path, level]
        );

        await conn.commit();

        return {
            id: result.insertId,
            name,
            parent_id,
            path,
            level,
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

export const deleteCategory = async (db, id) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Check if category exists
        const [categories] = await conn.query(
            `SELECT * FROM ${TABLE} WHERE id = ?`,
            [id]
        );

        console.log(categories);

        if (!categories.length) {
            await conn.rollback();
            // const error = new Error("Category not found");
            // error.status = 404;
            throw constructError("Category not found", 404);
        }

        const category = categories[0];

        // 2. Delete children
        await conn.query(`DELETE FROM ${TABLE} WHERE path LIKE ?`, [
            `${category.path}.%`,
        ]);

        // 3. Delete category
        await conn.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

        await conn.commit();

        return "Category deleted";
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export const uploadImageService = async (db, { file, id }) => {
    const [categories] = await db.query(
        `SELECT id, level, img_url FROM ${TABLE} WHERE id = ?`,
        [id]
    );

    if (categories.length === 0) {
        throw constructError("Category not found", 404);
    }

    const category = categories[0];

    if (category.level !== 0) {
        // return sendError(res, 403, "Only main categories can have images");
        throw constructError("Only main categories can have images", 403);
    }

    if (!file) {
        // return sendError(res, 400, "No image uploaded");
        throw constructError("No image uploaded", 400);
    }

    const imgUrl = `/uploads/categories/${file.filename}`;

    // Delete old image if exists
    if (category.img_url) {
        const oldPath = path.join(publicDir, category.img_url);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }

    await db.query(
        `UPDATE ${TABLE} SET img_url = ? WHERE id = ?`,
        [imgUrl, id]
    );

    // return sendSuccess(res, "Category image updated successfully", { url: imgUrl });
    const message = "category image uploaded successfully"
    return {
        imgUrl,
        message
    }
}

export const deleteImageService = async (db, id) => {
    const [categories] = await db.query(
        `SELECT id, level, img_url FROM ${TABLE} WHERE id = ?`,
        [id]
    );

    if (categories.length === 0) {
        throw constructError("Category not found", 404);
    }

    const category = categories[0];

    if (!category.img_url) {
        throw constructError("No image found for this category", 404);
    }

    const filePath = path.join(publicDir, category.img_url);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    await db.query(
        `UPDATE ${TABLE} SET img_url = NULL WHERE id = ?`,
        [id]
    );

    const message = "category image deleted successfully"
    return {
        message
    }
}

export const updateCateService = async (db, { id, name }) => {
    const [result] = await db.query(
        `UPDATE ${TABLE} SET name = ? WHERE id = ?`,
        [name, id]
    );

    if (result.affectedRows === 0) {
        throw constructError("Category not found", 404);
    }

    const message = "Category updated";

    return { message }
}