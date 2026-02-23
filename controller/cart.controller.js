import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";

export const getCart = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;

    const [items] = await db.query(
        `SELECT ci.*, p.name, p.price, p.selling_price, p.primary_image, p.sku
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC`,
        [userId]
    );

    const itemsWithFilters = items.map(item => ({
        ...item,
        selected_filters: item.selected_filters ? JSON.parse(item.selected_filters) : null
    }));

    return sendSuccess(res, "Cart items fetched", itemsWithFilters);
});

export const addToCart = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { product_id, quantity = 1, selected_filters = null } = req.body;

    if (!product_id) {
        return sendError(res, 400, "Product ID is required");
    }

    const filterHash = selected_filters ? JSON.stringify(selected_filters) : null;

    // Check if item with same filters exists
    const [existing] = await db.query(
        "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND (selected_filters <=> ? OR selected_filters = ?)",
        [userId, product_id, filterHash, filterHash]
    );

    if (existing.length > 0) {
        const newQuantity = existing[0].quantity + quantity;
        await db.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [newQuantity, existing[0].id]);
    } else {
        await db.query(
            "INSERT INTO cart_items (user_id, product_id, quantity, selected_filters) VALUES (?, ?, ?, ?)",
            [userId, product_id, quantity, filterHash]
        );
    }

    return sendSuccess(res, "Item added to cart");
});

export const updateCartItem = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 1) {
        return sendError(res, 400, "Invalid quantity");
    }

    const [result] = await db.query(
        "UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?",
        [quantity, id, userId]
    );

    if (result.affectedRows === 0) {
        return sendError(res, 404, "Cart item not found");
    }

    return sendSuccess(res, "Cart item updated");
});

export const removeFromCart = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { id } = req.params;

    const [result] = await db.query(
        "DELETE FROM cart_items WHERE id = ? AND user_id = ?",
        [id, userId]
    );

    if (result.affectedRows === 0) {
        return sendError(res, 404, "Cart item not found");
    }

    return sendSuccess(res, "Item removed from cart");
});

export const clearCart = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;

    await db.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);
    return sendSuccess(res, "Cart cleared");
});

export const syncCart = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { items } = req.body; // Array of { product_id, quantity, selected_filters }

    if (!Array.isArray(items)) {
        return sendError(res, 400, "Items must be an array");
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        for (const item of items) {
            const { product_id, quantity = 1, selected_filters = null } = item;
            const filterHash = selected_filters ? JSON.stringify(selected_filters) : null;

            const [existing] = await conn.query(
                "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND (selected_filters <=> ? OR selected_filters = ?)",
                [userId, product_id, filterHash, filterHash]
            );

            if (existing.length > 0) {
                const newQuantity = Math.max(existing[0].quantity, quantity);
                await conn.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [newQuantity, existing[0].id]);
            } else {
                await conn.query(
                    "INSERT INTO cart_items (user_id, product_id, quantity, selected_filters) VALUES (?, ?, ?, ?)",
                    [userId, product_id, quantity, filterHash]
                );
            }
        }

        await conn.commit();
        return sendSuccess(res, "Cart synced successfully");
    } catch (error) {
        await conn.rollback();
        throw error; // Let catchAsync handle it
    } finally {
        conn.release();
    }
});
