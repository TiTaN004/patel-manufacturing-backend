import { db } from "../db.js";
import { catchAsync } from "../utils/error.util.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import {
    createBulkOrderService,
    getBulkOrderHistoryService,
    getAllBulkOrdersService,
    updateBulkOrderStatusService,
    updateBulkOrderService,
    deleteBulkOrderService
} from "../services/bulk.service.js";

/**
 * Place a new bulk order
 */
export const placeBulkOrder = catchAsync(async (req, res, next) => {
    const userID = req.user.userID;
    const { items } = req.body;

    if (!items || !items.length) {
        return sendError(res, 400, "Order items are required");
    }

    const order = await createBulkOrderService(db, {
        userID,
        items
    });

    return sendSuccess(res, "Bulk order placed successfully", order);
});

/**
 * Get bulk order history for the logged-in user
 */
export const getBulkOrderHistory = catchAsync(async (req, res, next) => {
    const userID = req.user.userID;
    const orders = await getBulkOrderHistoryService(db, userID);
    return sendSuccess(res, "Bulk order history fetched successfully", orders);
});

/**
 * Get all bulk orders (Admin)
 */
export const getAllBulkOrders = catchAsync(async (req, res, next) => {
    const { limit = 20, offset = 0 } = req.query;
    const orders = await getAllBulkOrdersService(db, limit, offset);
    return sendSuccess(res, "All bulk orders fetched successfully", orders);
});

/**
 * Update bulk order status (Admin)
 */
export const updateBulkOrderStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return sendError(res, 400, "Status is required");
    }

    const updated = await updateBulkOrderStatusService(db, id, status);
    return sendSuccess(res, "Bulk order status updated successfully", updated);
});

/**
 * Update a bulk order (User)
 */
export const updateBulkOrder = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const userID = req.user.userID;
    const { items } = req.body;

    if (!items || !items.length) {
        return sendError(res, 400, "Order items are required");
    }

    const updated = await updateBulkOrderService(db, id, userID, items);
    return sendSuccess(res, "Bulk order updated successfully", updated);
});

/**
 * Delete (cancel) a bulk order (User)
 */
export const deleteBulkOrder = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const userID = req.user.userID;

    const result = await deleteBulkOrderService(db, id, userID);
    return sendSuccess(res, "Bulk order cancelled successfully", result);
});
