import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";

const TABLE = "contacts";

export const getAll = catchAsync(async (req, res, next) => {
    const { search, limit = 20, offset = 0 } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
        conditions.push("(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)");
        const searchVal = `%${search}%`;
        params.push(searchVal, searchVal, searchVal, searchVal, searchVal);
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM ${TABLE} ${whereClause}`, params);
    const totalCount = countRows[0].total;

    let sql = `SELECT * FROM ${TABLE} ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.query(sql, [...params, Number(limit), Number(offset)]);

    return sendSuccess(res, "Contact inquiries fetched", rows, 1, {
        total: totalCount,
        count: rows.length
    });
});

export const create = catchAsync(async (req, res, next) => {
    const { first_name, last_name, email, mobile, subject, message } = req.body;

    if (!first_name || !last_name || !email || !mobile || !subject) {
        return sendError(res, 400, "Required fields missing");
    }

    const [result] = await db.query(
        `INSERT INTO ${TABLE} (first_name, last_name, email, mobile, subject, message) VALUES (?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, email, mobile, subject, message || '']
    );

    return sendSuccess(res, "Contact inquiry submitted successfully", { id: result.insertId });
});

export const remove = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const [result] = await db.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
        return sendError(res, 404, "Contact not found");
    }

    return sendSuccess(res, "Contact deleted successfully");
});
