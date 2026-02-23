import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";

export const getAll = catchAsync(async (req, res, next) => {
    const { limit, offset = 0, search, show_in_promo, coming_soon, is_active, exclude_expired } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
        conditions.push("code LIKE ?");
        params.push(`%${search}%`);
    }

    if (show_in_promo !== undefined) {
        conditions.push("show_in_promo = ?");
        params.push(Number(show_in_promo));
    }

    if (coming_soon !== undefined) {
        conditions.push("coming_soon = ?");
        params.push(Number(coming_soon));
    }

    if (is_active !== undefined) {
        conditions.push("is_active = ?");
        params.push(Number(is_active));
    }

    if (Number(exclude_expired) === 1) {
        const date = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const now = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        conditions.push("(start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)");
        params.push(now, now);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Get total count
    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM coupons ${whereClause}`, params);
    const totalCount = countResult[0].total;

    // 2. Get data
    let sql = `SELECT * FROM coupons ${whereClause} ORDER BY created_at DESC`;
    if (limit !== undefined) {
        sql += ` LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));
    }

    const [coupons] = await db.query(sql, params);

    return sendSuccess(res, "Coupons fetched", coupons, 1, {
        total: totalCount,
        count: coupons.length
    });
});

export const getPromoCoupons = catchAsync(async (req, res, next) => {
    const date = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const now = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    const [coupons] = await db.query(
        `SELECT * FROM coupons 
         WHERE (show_in_promo = 1 OR coming_soon = 1) 
         AND is_active = 1 
         AND (start_date IS NULL OR start_date <= ?) 
         AND (end_date IS NULL OR end_date >= ?) 
         ORDER BY created_at DESC`,
        [now, now]
    );

    return sendSuccess(res, "Promo coupons fetched", coupons, 1, {
        count: coupons.length
    });
});

const formatMySQLDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    } catch (e) {
        return null;
    }
};

export const create = catchAsync(async (req, res, next) => {
    const data = req.body;

    if (!data.code || !data.discount_type || data.discount_value === undefined) {
        return sendError(res, 400, "Missing required fields: code, discount_type, discount_value");
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const code = data.code.toUpperCase();
        const [existing] = await conn.query("SELECT id FROM coupons WHERE code = ?", [code]);
        if (existing.length > 0) {
            await conn.rollback();
            return sendError(res, 400, "Coupon code already exists");
        }

        let showInPromo = data.show_in_promo == 1;
        let comingSoon = data.coming_soon == 1;

        if (showInPromo || comingSoon) {
            await conn.query("UPDATE coupons SET show_in_promo = 0, coming_soon = 0");
            if (showInPromo) comingSoon = false;
        }

        const [result] = await conn.query(
            `INSERT INTO coupons 
             (code, discount_type, discount_value, min_cart_amount, max_discount_amount, usage_limit, start_date, end_date, is_active, show_in_promo, coming_soon) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                code,
                data.discount_type,
                data.discount_value,
                data.min_cart_amount || 0.00,
                data.max_discount_amount || null,
                data.usage_limit || null,
                formatMySQLDate(data.start_date),
                formatMySQLDate(data.end_date),
                data.is_active !== undefined ? data.is_active : 1,
                showInPromo ? 1 : 0,
                comingSoon ? 1 : 0
            ]
        );

        await conn.commit();
        return sendSuccess(res, "Coupon created successfully", { id: result.insertId });
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
});

export const update = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const data = req.body;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.query("SELECT * FROM coupons WHERE id = ?", [id]);
        if (existing.length === 0) {
            await conn.rollback();
            return sendError(res, 404, "Coupon not found");
        }

        if (data.code) {
            const newCode = data.code.toUpperCase();
            const [duplicate] = await conn.query("SELECT id FROM coupons WHERE code = ? AND id != ?", [newCode, id]);
            if (duplicate.length > 0) {
                await conn.rollback();
                return sendError(res, 400, "Coupon code already exists");
            }
        }

        const isPromoActive = data.show_in_promo == 1;
        const isComingSoonActive = data.coming_soon == 1;

        if (isPromoActive || isComingSoonActive) {
            await conn.query("UPDATE coupons SET show_in_promo = 0, coming_soon = 0 WHERE id != ?", [id]);
            if (isPromoActive) data.coming_soon = 0;
            if (isComingSoonActive && !isPromoActive) data.show_in_promo = 0;
        }

        const fields = [
            'code', 'discount_type', 'discount_value', 'min_cart_amount',
            'max_discount_amount', 'usage_limit', 'start_date', 'end_date',
            'is_active', 'show_in_promo', 'coming_soon'
        ];

        const updates = [];
        const params = [];

        for (const field of fields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                let value = data[field];
                if (field === 'code') value = value.toUpperCase();
                if (field === 'start_date' || field === 'end_date') value = formatMySQLDate(value);
                params.push(value);
            }
        }

        if (updates.length > 0) {
            params.push(id);
            await conn.query(`UPDATE coupons SET ${updates.join(", ")} WHERE id = ?`, params);
        }

        await conn.commit();
        return sendSuccess(res, "Coupon updated successfully");
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
});

export const remove = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM coupons WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
        return sendError(res, 404, "Coupon not found");
    }
    return sendSuccess(res, "Coupon deleted successfully");
});

export const validate = catchAsync(async (req, res, next) => {
    const { code, cartTotal } = req.body;
    if (!code) {
        return sendError(res, 400, "Coupon code is required");
    }

    const uppercaseCode = code.toUpperCase();
    const [rows] = await db.query("SELECT * FROM coupons WHERE code = ? AND is_active = 1", [uppercaseCode]);
    const coupon = rows[0];

    if (!coupon) {
        return sendError(res, 404, "Invalid or inactive coupon code");
    }

    const now = new Date();
    if ((coupon.start_date && now < new Date(coupon.start_date)) || (coupon.end_date && now > new Date(coupon.end_date))) {
        return sendError(res, 400, "This coupon is either not yet valid or has expired");
    }

    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
        return sendError(res, 400, "This coupon has reached its usage limit");
    }

    const total = parseFloat(cartTotal || 0);
    if (total < parseFloat(coupon.min_cart_amount)) {
        return sendError(res, 400, `Minimum cart amount of ${coupon.min_cart_amount} required`);
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
        discountAmount = (total * coupon.discount_value) / 100;
        if (coupon.max_discount_amount !== null && discountAmount > coupon.max_discount_amount) {
            discountAmount = coupon.max_discount_amount;
        }
    } else {
        discountAmount = coupon.discount_value;
    }

    if (discountAmount > total) discountAmount = total;

    return sendSuccess(res, "Coupon applied successfully", {
        coupon: {
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value
        },
        discount_amount: Number(discountAmount.toFixed(2)),
        new_total: Number((total - discountAmount).toFixed(2))
    });
});

export const redeem = catchAsync(async (req, res, next) => {
    const { code } = req.body;
    if (!code) {
        return sendError(res, 400, "Coupon code is required for redemption");
    }

    const uppercaseCode = code.toUpperCase();
    const [rows] = await db.query("SELECT id, usage_limit, used_count FROM coupons WHERE code = ? AND is_active = 1", [uppercaseCode]);
    const coupon = rows[0];

    if (!coupon) {
        return sendError(res, 404, "Coupon not found or inactive");
    }

    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
        return sendError(res, 400, "Usage limit reached for this coupon");
    }

    await db.query("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?", [uppercaseCode]);
    return sendSuccess(res, "Coupon usage recorded successfully");
});
