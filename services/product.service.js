import { constructError } from "../utils/error.util.js";

const TABLE = "products";
const TABLE_FILTER = "filters";
const TABLE_VALUES = "filter_values";
const TABLE_MAP = "category_filters";

export const createProductService = async (db, { category_id,
    sku,
    name,
    slug,
    price,
    status,
    stock_quantity,
    stock_status,
    description,
    primary_image,
    images,
    stock_threshold,
    selling_price,
    care_instructions,
    warrenty_period,
    dimension,
    weight,
    filters }) => {
    // Validation
    if (!category_id || !name || !slug || price == null) {
        return constructError("Missing required fields: category_id, name, slug, price", 400)
        // return sendError(res, 400, "Missing required fields: category_id, name, slug, price");
    }

    if (!Array.isArray(filters)) {
        return constructError("filters must be an array", 400)
        // return sendError(res, 400, "filters must be an array");
    }

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Validate category
        const [categories] = await conn.query(
            `SELECT id FROM categories WHERE id = ?`,
            [category_id]
        );

        if (!categories.length) {
            await conn.rollback();
            return constructError("Invalid category", 400)
            // return sendError(res, 400, "Invalid category");
        }

        // 2. Prepare images JSON
        const imagesJson = images ? JSON.stringify(images) : null;

        // 3. Insert product with new fields
        const [productResult] = await conn.query(
            `
          INSERT INTO products
          (category_id, sku, name, slug, price, status, stock_quantity, stock_status, description, primary_image, images, stock_threshold, selling_price, care_instructions, warrenty_period, dimension, weight)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
                category_id,
                sku,
                name,
                slug,
                price,
                status,
                stock_quantity,
                stock_status,
                description,
                primary_image,
                imagesJson,
                stock_threshold,
                selling_price,
                care_instructions,
                warrenty_period,
                dimension,
                weight
            ]
        );

        const productId = productResult.insertId;

        // 4. Insert filter values
        if (filters.length > 0) {
            for (const filter of filters) {
                const { filter_id, value_ids } = filter;

                if (!filter_id || !Array.isArray(value_ids) || !value_ids.length) {
                    await conn.rollback();
                    return constructError("Invalid filter format", 400)
                    // return sendError(res, 400, "Invalid filter format");
                }

                // Validate values belong to filter
                const [validValues] = await conn.query(
                    `
              SELECT id
              FROM filter_values
              WHERE filter_id = ? AND id IN (?)
              `,
                    [filter_id, value_ids]
                );

                if (validValues.length !== value_ids.length) {
                    await conn.rollback();
                    return constructError(`One or more values do not belong to filter ${filter_id}`, 400)
                    // return sendError(res, 400, `One or more values do not belong to filter ${filter_id}`);
                }

                // Bulk insert mappings
                const rows = value_ids.map(value_id => [
                    productId,
                    filter_id,
                    value_id
                ]);

                await conn.query(
                    `
              INSERT INTO product_filter_values
              (product_id, filter_id, value_id)
              VALUES ?
              `,
                    [rows]
                );
            }
        }

        await conn.commit();
        return { message: "Product created successfully", id: productId }
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export const updateProductService = async (db, id, {
    category_id,
    sku,
    name,
    slug,
    price,
    status,
    stock_quantity,
    stock_status,
    description,
    primary_image,
    images,
    stock_threshold,
    selling_price,
    care_instructions,
    warrenty_period,
    dimension,
    weight,
    filters }) => {
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Check product exists
        const [products] = await conn.query(
            `SELECT id FROM products WHERE id = ?`,
            [id]
        );

        if (!products.length) {
            await conn.rollback();
            return constructError("Product not found", 404);
        }

        // 2. Validate category if provided
        if (category_id) {
            const [categories] = await conn.query(
                `SELECT id FROM categories WHERE id = ?`,
                [category_id]
            );

            if (!categories.length) {
                await conn.rollback();
                return constructError("Invalid category", 400);
            }
        }

        // 3. Prepare images JSON
        const imagesJson = images ? JSON.stringify(images) : null;

        // 4. Build dynamic UPDATE query
        const updates = [];
        const values = [];

        // After line 191 (imagesJson), add:
        const primaryImageValue = primary_image === "" ? null : primary_image;

        if (category_id !== undefined) { updates.push("category_id = ?"); values.push(category_id); }
        if (sku !== undefined) { updates.push("sku = ?"); values.push(sku); }
        if (name !== undefined) { updates.push("name = ?"); values.push(name); }
        if (slug !== undefined) { updates.push("slug = ?"); values.push(slug); }
        if (price !== undefined) { updates.push("price = ?"); values.push(price); }
        if (status !== undefined) { updates.push("status = ?"); values.push(status); }
        if (stock_quantity !== undefined) { updates.push("stock_quantity = ?"); values.push(stock_quantity); }
        if (stock_status !== undefined) { updates.push("stock_status = ?"); values.push(stock_status); }
        if (description !== undefined) { updates.push("description = ?"); values.push(description); }
        if (primary_image !== undefined) { updates.push("primary_image = ?"); values.push(primaryImageValue); }
        if (images !== undefined) { updates.push("images = ?"); values.push(imagesJson); }
        if (stock_threshold !== undefined) { updates.push("stock_threshold = ?"); values.push(stock_threshold); }
        if (selling_price !== undefined) { updates.push("selling_price = ?"); values.push(selling_price); }
        if (care_instructions !== undefined) { updates.push("care_instructions = ?"); values.push(care_instructions); }
        if (warrenty_period !== undefined) { updates.push("warrenty_period = ?"); values.push(warrenty_period); }
        if (dimension !== undefined) { updates.push("dimension = ?"); values.push(dimension); }
        if (weight !== undefined) { updates.push("weight = ?"); values.push(weight); }

        if (updates.length > 0) {
            values.push(id);
            await conn.query(
                `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
                values
            );
        }

        // 5. Update filters if provided
        if (Array.isArray(filters)) {
            // Remove existing filters
            await conn.query(
                `DELETE FROM product_filter_values WHERE product_id = ?`,
                [id]
            );

            // Insert new filters
            for (const filter of filters) {
                const { filter_id, value_ids } = filter;

                if (!filter_id || !Array.isArray(value_ids) || value_ids.length === 0) {
                    continue; // Skip invalid filters
                }

                // Validate values
                const [validValues] = await conn.query(
                    `
              SELECT id FROM filter_values
              WHERE filter_id = ? AND id IN (?)
              `,
                    [filter_id, value_ids]
                );

                if (validValues.length !== value_ids.length) {
                    await conn.rollback();
                    return constructError(`Invalid values for filter ${filter_id}`, 400);
                }

                const rows = value_ids.map(value_id => [id, filter_id, value_id]);

                await conn.query(
                    `
              INSERT INTO product_filter_values
              (product_id, filter_id, value_id)
              VALUES ?
              `,
                    [rows]
                );
            }
        }

        await conn.commit();
        return { message: "Product updated successfully", id };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export const removeProductService = async (db, id) => {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    // 1. Check if product exists
    const [products] = await conn.query(
        `SELECT * FROM ${TABLE} WHERE id = ?`,
        [id]
    );

    if (!products.length) {
        await conn.rollback();
        return constructError("Product not found", 404);
    }

    // 2. Delete associated filter values
    await conn.query(
        `DELETE FROM product_filter_values WHERE product_id = ?`,
        [id]
    );

    // 3. Delete product
    await conn.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

    await conn.commit();

    return { message: "Product deleted successfully", id };
}