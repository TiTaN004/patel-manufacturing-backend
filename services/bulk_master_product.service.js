export const createBulkMasterProductService = async (db, productData) => {
    const {
        product_type, sr_no, box_name, size, paper, liner,
        sheet_size, no_sheet, die_no, plate_name, available_colors, available_shapes, product_image
    } = productData;

    const [result] = await db.query(
        `INSERT INTO bulk_products 
        (is_master, product_type, sr_no, box_name, size, paper, liner, sheet_size, no_sheet, die_no, plate_name, available_colors, available_shapes, product_image) 
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [product_type || 'box', sr_no, box_name, size, paper, liner, sheet_size, no_sheet, die_no, plate_name, available_colors, available_shapes, product_image]
    );

    return { id: result.insertId, ...productData };
};

export const getAllBulkMasterProductsService = async (db) => {
    const [rows] = await db.query(
        "SELECT * FROM bulk_products WHERE is_master = 1 AND is_deleted = 0 ORDER BY (sr_no IS NULL OR sr_no = '') ASC, CAST(sr_no AS UNSIGNED) ASC, sr_no ASC"
    );
    return rows;
};

export const updateBulkMasterProductService = async (db, id, productData) => {
    const fields = [];
    const params = [];

    Object.entries(productData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && key !== 'is_master') {
            fields.push(`${key} = ?`);
            params.push(value);
        }
    });

    if (fields.length === 0) return null;

    params.push(id);
    await db.query(
        `UPDATE bulk_products SET ${fields.join(', ')} WHERE id = ? AND is_master = 1 AND is_deleted = 0`,
        params
    );

    return { id, ...productData };
};

export const bulkAssignToUserService = async (db, userID, masterProductIds) => {
    if (!masterProductIds || masterProductIds.length === 0) return [];

    const results = [];
    for (const masterId of masterProductIds) {
        // Check if master product exists
        const [master] = await db.query("SELECT id FROM bulk_products WHERE id = ? AND is_master = 1 AND is_deleted = 0", [masterId]);
        if (master.length === 0) continue;

        // Check if already assigned
        const [existing] = await db.query(
            "SELECT id FROM user_bulk_product_mapping WHERE userID = ? AND bulkProductID = ?",
            [userID, masterId]
        );

        if (existing.length > 0) continue;

        await db.query(
            "INSERT INTO user_bulk_product_mapping (userID, bulkProductID) VALUES (?, ?)",
            [userID, masterId]
        );
        results.push({ userID, bulkProductID: masterId });
    }

    return results;
};

export const deleteBulkMasterProductService = async (db, id) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        // Delete mappings first
        await conn.query("DELETE FROM user_bulk_product_mapping WHERE bulkProductID = ?", [id]);
        // Mark product as deleted
        await conn.query("UPDATE bulk_products SET is_deleted = 1 WHERE id = ? AND is_master = 1", [id]);
        await conn.commit();
        return { id };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};
