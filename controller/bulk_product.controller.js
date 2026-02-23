import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import {
    createBulkProductService,
    getBulkProductsByUserService,
    updateBulkProductService,
    deleteBulkProductService
} from "../services/bulk.service.js";

/**
 * Create a new bulk product
 */
export const createBulkProduct = catchAsync(async (req, res, next) => {
    const { userID, box_name } = req.body;

    if (!userID || !box_name) {
        return sendError(res, 400, "userID and box_name (required) are missing");
    }

    const result = await createBulkProductService(db, req.body);
    return sendSuccess(res, "Bulk product created successfully", result);
});

/**
 * Get all bulk products for a user
 */
export const getBulkProductsByUser = catchAsync(async (req, res, next) => {
    const { userID } = req.params;

    if (!userID) {
        return sendError(res, 400, "userID is required");
    }

    const result = await getBulkProductsByUserService(db, userID);
    return sendSuccess(res, "Bulk products retrieved successfully", result);
});

/**
 * Update a bulk product
 */
export const updateBulkProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
        return sendError(res, 400, "Product ID is required");
    }

    const result = await updateBulkProductService(db, id, req.body);
    return sendSuccess(res, "Bulk product updated successfully", result);
});

/**
 * Delete a bulk product
 */
export const deleteBulkProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
        return sendError(res, 400, "Product ID is required");
    }

    const result = await deleteBulkProductService(db, id);
    return sendSuccess(res, "Bulk product deleted successfully", result);
});
