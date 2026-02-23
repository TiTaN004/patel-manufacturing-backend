export const createBulkBaseMasterService = async (db, data) => {
    const { type, value } = data;
    const [result] = await db.query(
        "INSERT INTO bulk_base_masters (type, value) VALUES (?, ?)",
        [type, value]
    );
    return { id: result.insertId, ...data };
};

export const getAllBulkBaseMastersService = async (db) => {
    const [rows] = await db.query("SELECT * FROM bulk_base_masters ORDER BY type, value");
    return rows;
};

export const deleteBulkBaseMasterService = async (db, id) => {
    await db.query("DELETE FROM bulk_base_masters WHERE id = ?", [id]);
    return { success: true };
};
