import { constructError } from "../utils/error.util.js";
import { notificationService } from "./notification.service.js";

/**
 * Assign a list of products to a bulk user
 */
export const assignProductsToBulkUserService = async (db, userID, productIDs) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check if user is bulk user
        const [users] = await conn.query("SELECT user_role FROM user WHERE userID = ?", [userID]);
        if (users.length === 0) {
            throw constructError("User not found", 404);
        }
        if (users[0].user_role !== 'bulk') {
            throw constructError("Only bulk users can have assigned products", 400);
        }

        // Remove existing assignments
        await conn.query("DELETE FROM bulk_user_products WHERE userID = ?", [userID]);

        // Insert new assignments
        if (productIDs && productIDs.length > 0) {
            const values = productIDs.map(pid => [userID, pid]);
            await conn.query("INSERT INTO bulk_user_products (userID, productID) VALUES ?", [values]);
        }

        await conn.commit();
        return { message: "Products assigned successfully", userID, productIDs };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Get products assigned to a bulk user
 */
export const getBulkUserProductsService = async (db, userID) => {
    const [rows] = await db.query(`
        SELECT p.* 
        FROM products p
        JOIN bulk_user_products bup ON p.id = bup.productID
        WHERE bup.userID = ?
    `, [userID]);
    return rows;
};

/**
 * Get outstanding amount for a bulk user
 */
export const getBulkOutstandingService = async (db, userID) => {
    const [rows] = await db.query("SELECT amount FROM bulk_user_outstanding WHERE userID = ?", [userID]);
    return rows.length > 0 ? rows[0].amount : 0;
};

/**
 * Update or insert outstanding amount for a bulk user
 */
export const upsertBulkOutstandingService = async (db, userID, amount) => {
    const [users] = await db.query("SELECT user_role FROM user WHERE userID = ?", [userID]);
    if (users.length === 0) {
        throw constructError("User not found", 404);
    }
    if (users[0].user_role !== 'bulk') {
        throw constructError("Outstanding amount can only be set for bulk users", 400);
    }

    await db.query(
        "INSERT INTO bulk_user_outstanding (userID, amount) VALUES (?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)",
        [userID, amount]
    );
    return { userID, amount };
};

/**
 * Create a new bulk product
 */
export const createBulkProductService = async (db, productData) => {
    const {
        userID, product_type, sr_no, box_name, size, paper, liner,
        sheet_size, no_sheet, die_no, plate_name, available_colors, available_shapes, product_image
    } = productData;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check for duplicate for this user (including deleted ones, maybe we want to restore?)
        // For now, let's just ignore deleted ones when checking for duplicates so they can "re-create" it
        const [existing] = await conn.query(
            `SELECT bp.id FROM bulk_products bp
             JOIN user_bulk_product_mapping ubpm ON bp.id = ubpm.bulkProductID
             WHERE ubpm.userID = ? AND bp.product_type = ? AND bp.box_name = ? AND bp.size = ? AND bp.is_deleted = 0`,
            [userID, product_type || 'box', box_name, size]
        );

        if (existing.length > 0) {
            throw constructError("This product is already registered for this user", 400);
        }

        // Insert product (is_master = 0 for custom user-created products)
        const [result] = await conn.query(
            `INSERT INTO bulk_products 
            (is_master, product_type, sr_no, box_name, size, paper, liner, sheet_size, no_sheet, die_no, plate_name, available_colors, available_shapes, product_image) 
            VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [product_type || 'box', sr_no, box_name, size, paper, liner, sheet_size, no_sheet, die_no, plate_name, available_colors, available_shapes, product_image]
        );

        const productId = result.insertId;

        // Create mapping
        await conn.query(
            "INSERT INTO user_bulk_product_mapping (userID, bulkProductID) VALUES (?, ?)",
            [userID, productId]
        );

        await conn.commit();
        return { id: productId, ...productData };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Get all bulk products for a specific user
 */
export const getBulkProductsByUserService = async (db, userID) => {
    const [rows] = await db.query(
        `SELECT bp.* 
         FROM bulk_products bp
         JOIN user_bulk_product_mapping ubpm ON bp.id = ubpm.bulkProductID
         WHERE ubpm.userID = ? AND bp.is_deleted = 0
         ORDER BY (bp.sr_no IS NULL OR bp.sr_no = '') ASC, CAST(bp.sr_no AS UNSIGNED) ASC, bp.sr_no ASC`,
        [userID]
    );
    return rows;
};

/**
 * Update a bulk product
 */
export const updateBulkProductService = async (db, id, productData) => {
    const fields = [];
    const params = [];

    Object.entries(productData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'userID' && key !== 'created_at' && key !== 'updated_at' && key !== 'is_master') {
            fields.push(`${key} = ?`);
            params.push(value);
        }
    });

    if (fields.length === 0) return null;

    params.push(id);
    await db.query(
        `UPDATE bulk_products SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`,
        params
    );

    return { id, ...productData };
};

/**
 * Delete a bulk product
 */
export const deleteBulkProductService = async (db, id) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Find if it's a master or custom
        const [product] = await conn.query("SELECT is_master FROM bulk_products WHERE id = ?", [id]);
        if (product.length === 0) return { id };

        // Delete mapping
        await conn.query("DELETE FROM user_bulk_product_mapping WHERE bulkProductID = ?", [id]);

        // If it's a custom product (is_master = 0), mark it as deleted instead of DELETE
        if (product[0].is_master === 0) {
            await conn.query("UPDATE bulk_products SET is_deleted = 1 WHERE id = ?", [id]);
        }

        await conn.commit();
        return { id };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Create a new bulk order
 */
export const createBulkOrderService = async (db, orderData) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { userID, items } = orderData;

        // Memorable Order Number: PB-YYMMDD-XXXX
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const invoiceNumber = `PB-${yy}${mm}${dd}-${random}`;

        const [orderResult] = await conn.query(
            "INSERT INTO bulk_orders (invoice_number, userID, order_status) VALUES (?, ?, 'pending')",
            [invoiceNumber, userID]
        );
        const orderId = orderResult.insertId;

        for (const item of items) {
            const { bulk_product_id, quantity, selected_color, selected_shape } = item;
            await conn.query(
                "INSERT INTO bulk_order_items (order_id, bulk_product_id, quantity, selected_color, selected_shape) VALUES (?, ?, ?, ?, ?)",
                [orderId, bulk_product_id, quantity, selected_color, selected_shape]
            );
        }

        await conn.commit();

        // Notify Admins about new bulk order with Party name, Item names and Qties
        try {
            const [users] = await conn.query("SELECT fullName FROM user WHERE userID = ?", [userID]);
            const partyName = users.length > 0 ? users[0].fullName : "Unknown Party";

            // Get product names and quantities for the message
            const productIds = items.map(i => i.bulk_product_id);
            const [products] = await conn.query("SELECT id, box_name FROM bulk_products WHERE id IN (?)", [productIds]);
            const productMap = products.reduce((acc, p) => {
                acc[p.id] = p.box_name;
                return acc;
            }, {});

            const itemString = items.map(item => {
                const name = productMap[item.bulk_product_id] || "Product";
                return `${name} (${item.quantity})`;
            }).join(", ");

            const messageBody = `Party: ${partyName}\nItems: ${itemString}`;

            const [admins] = await conn.query("SELECT userID FROM user WHERE isAdmin = 1");
            for (const admin of admins) {
                await notificationService.sendNotification({
                    userId: admin.userID,
                    title: "New Bulk Order",
                    message: messageBody,
                    type: "order",
                    referenceId: orderId,
                    pushOnly: true
                });
            }
        } catch (notifyError) {
            console.error("Failed to notify admins about new bulk order:", notifyError);
        }

        return { orderId, invoiceNumber, ...orderData };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Get bulk order history for a user
 */
export const getBulkOrderHistoryService = async (db, userID) => {
    const [orders] = await db.query(
        "SELECT * FROM bulk_orders WHERE userID = ? ORDER BY created_at DESC",
        [userID]
    );

    if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const [items] = await db.query(`
            SELECT oi.*, bp.box_name, bp.size, bp.die_no, bp.sr_no, bp.paper, bp.liner, bp.sheet_size, bp.no_sheet, bp.plate_name, bp.product_type, bp.available_colors, bp.available_shapes, bp.product_image 
            FROM bulk_order_items oi 
            JOIN bulk_products bp ON oi.bulk_product_id = bp.id 
            WHERE oi.order_id IN (?)
        `, [orderIds]);

        const itemsByOrder = items.reduce((acc, item) => {
            if (!acc[item.order_id]) acc[item.order_id] = [];
            acc[item.order_id].push(item);
            return acc;
        }, {});

        orders.forEach(o => o.items = itemsByOrder[o.id] || []);
    }

    return orders;
};

/**
 * Get all bulk orders (for admin)
 */
export const getAllBulkOrdersService = async (db, limit = 20, offset = 0) => {
    const [orders] = await db.query(`
        SELECT o.*, u.fullName as customerName, u.emailID as customerEmail, u.mobileNo as customerMobile 
        FROM bulk_orders o 
        JOIN user u ON o.userID = u.userID 
        ORDER BY o.created_at DESC 
        LIMIT ? OFFSET ?
    `, [Number(limit), Number(offset)]);

    if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const [items] = await db.query(`
            SELECT oi.*, bp.box_name, bp.size, bp.die_no, bp.sr_no, bp.paper, bp.liner, bp.sheet_size, bp.no_sheet, bp.plate_name, bp.product_type, bp.available_colors, bp.available_shapes, bp.product_image 
            FROM bulk_order_items oi 
            JOIN bulk_products bp ON oi.bulk_product_id = bp.id 
            WHERE oi.order_id IN (?)
        `, [orderIds]);

        const itemsByOrder = items.reduce((acc, item) => {
            if (!acc[item.order_id]) acc[item.order_id] = [];
            acc[item.order_id].push(item);
            return acc;
        }, {});

        orders.forEach(o => o.items = itemsByOrder[o.id] || []);
    }

    return orders;
};

/**
 * Update bulk order status
 */
export const updateBulkOrderStatusService = async (db, id, status) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        if (status && status.toLowerCase() === 'cancelled') {
            // Delete order items first
            await conn.query("DELETE FROM bulk_order_items WHERE order_id = ?", [id]);
            // Delete order
            const [result] = await conn.query("DELETE FROM bulk_orders WHERE id = ?", [id]);

            if (result.affectedRows === 0) {
                throw constructError("Bulk order not found", 404);
            }

            await conn.commit();
            return { id, status: 'cancelled', deleted: true };
        } else {
            const [result] = await conn.query(
                "UPDATE bulk_orders SET order_status = ? WHERE id = ?",
                [status, id]
            );

            if (result.affectedRows === 0) {
                throw constructError("Bulk order not found", 404);
            }

            // Notify user about status update
            try {
                const [order] = await db.query("SELECT userID, invoice_number FROM bulk_orders WHERE id = ?", [id]);
                if (order.length > 0) {
                    await notificationService.sendNotification({
                        userId: order[0].userID,
                        title: "Order Status Updated",
                        message: `Your order ${order[0].invoice_number} is now ${status}.`,
                        type: "order",
                        referenceId: id,
                        pushOnly: true
                    });
                }
            } catch (notifyError) {
                console.error("Failed to notify user about order status update:", notifyError);
            }

            await conn.commit();
            return { id, status };
        }
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Update a pending bulk order by user
 */
export const updateBulkOrderService = async (db, id, userID, items) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check if order exists and belongs to user and is pending
        const [orders] = await conn.query(
            "SELECT id, invoice_number, order_status FROM bulk_orders WHERE id = ? AND userID = ?",
            [id, userID]
        );

        if (orders.length === 0) {
            throw constructError("Order not found", 404);
        }

        if (orders[0].order_status !== 'pending') {
            throw constructError("Only pending orders can be updated", 400);
        }

        // Delete existing items
        await conn.query("DELETE FROM bulk_order_items WHERE order_id = ?", [id]);

        // Insert new items
        for (const item of items) {
            const { bulk_product_id, quantity, selected_color, selected_shape } = item;
            await conn.query(
                "INSERT INTO bulk_order_items (order_id, bulk_product_id, quantity, selected_color, selected_shape) VALUES (?, ?, ?, ?, ?)",
                [id, bulk_product_id, quantity, selected_color, selected_shape]
            );
        }

        await conn.commit();

        // Notify Admins about update
        try {
            const [users] = await conn.query("SELECT fullName FROM user WHERE userID = ?", [userID]);
            const partyName = users.length > 0 ? users[0].fullName : "Unknown Party";
            const invoiceNumber = orders[0].invoice_number;

            const [admins] = await conn.query("SELECT userID FROM user WHERE isAdmin = 1");
            for (const admin of admins) {
                await notificationService.sendNotification({
                    userId: admin.userID,
                    title: "Order Updated",
                    message: `Party: ${partyName} updated their order ${invoiceNumber}`,
                    type: "order",
                    referenceId: id,
                    pushOnly: true
                });
            }
        } catch (notifyError) {
            console.error("Failed to notify admins about order update:", notifyError);
        }

        return { id, items };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Delete (cancel) a pending bulk order by user
 */
export const deleteBulkOrderService = async (db, id, userID) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check if order exists and belongs to user and is pending
        const [orders] = await conn.query(
            "SELECT id, invoice_number, order_status FROM bulk_orders WHERE id = ? AND userID = ?",
            [id, userID]
        );

        if (orders.length === 0) {
            throw constructError("Order not found", 404);
        }

        if (orders[0].order_status !== 'pending') {
            throw constructError("Only pending orders can be deleted", 400);
        }

        // Hard delete items first (due to foreign key if any, or just good practice)
        await conn.query("DELETE FROM bulk_order_items WHERE order_id = ?", [id]);

        // Hard delete the order
        await conn.query("DELETE FROM bulk_orders WHERE id = ?", [id]);

        await conn.commit();

        // Notify Admins about deletion (cancellation)
        try {
            const [users] = await conn.query("SELECT fullName FROM user WHERE userID = ?", [userID]);
            const partyName = users.length > 0 ? users[0].fullName : "Unknown Party";
            const invoiceNumber = orders[0].invoice_number;

            const [admins] = await conn.query("SELECT userID FROM user WHERE isAdmin = 1");
            for (const admin of admins) {
                await notificationService.sendNotification({
                    userId: admin.userID,
                    title: "Order Cancelled",
                    message: `Party: ${partyName} cancelled their order ${invoiceNumber}`,
                    type: "order",
                    referenceId: id,
                    pushOnly: true
                });
            }
        } catch (notifyError) {
            console.error("Failed to notify admins about order cancellation:", notifyError);
        }

        return { id, status: 'cancelled' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};
