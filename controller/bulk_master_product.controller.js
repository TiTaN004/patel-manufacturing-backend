import { db } from "../db.js";
import { catchAsync } from "../utils/error.util.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import {
    createBulkMasterProductService,
    getAllBulkMasterProductsService,
    updateBulkMasterProductService,
    deleteBulkMasterProductService,
    bulkAssignToUserService
} from "../services/bulk_master_product.service.js";

export const createBulkMasterProduct = catchAsync(async (req, res) => {
    const { box_name } = req.body;
    if (!box_name) {
        return sendError(res, 400, "Box name is required");
    }
    const result = await createBulkMasterProductService(db, req.body);
    return sendSuccess(res, "Master product created successfully", result);
});

export const getAllBulkMasterProducts = catchAsync(async (req, res) => {
    const result = await getAllBulkMasterProductsService(db);
    return sendSuccess(res, "Master products retrieved successfully", result);
});

export const updateBulkMasterProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await updateBulkMasterProductService(db, id, req.body);
    if (!result) {
        return sendError(res, 404, "Master product not found or no changes made");
    }
    return sendSuccess(res, "Master product updated successfully", result);
});

export const deleteBulkMasterProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    await deleteBulkMasterProductService(db, id);
    return sendSuccess(res, "Master product deleted successfully");
});

export const bulkAssignToUser = catchAsync(async (req, res) => {
    const { userID, masterProductIds } = req.body;
    if (!userID || !masterProductIds || !Array.isArray(masterProductIds)) {
        return sendError(res, 400, "userID and an array of masterProductIds are required");
    }
    const result = await bulkAssignToUserService(db, userID, masterProductIds);
    return sendSuccess(res, "Master products assigned successfully", result);
});
