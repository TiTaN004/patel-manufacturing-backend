import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import {
    createBulkBaseMasterService,
    getAllBulkBaseMastersService,
    deleteBulkBaseMasterService
} from "../services/bulk_master.service.js";

export const createBulkBaseMaster = catchAsync(async (req, res) => {
    const { type, value } = req.body;
    if (!type || !value) {
        return sendError(res, 400, "Type and value are required");
    }
    const result = await createBulkBaseMasterService(db, req.body);
    return sendSuccess(res, "Master created successfully", result);
});

export const getAllBulkBaseMasters = catchAsync(async (req, res) => {
    const result = await getAllBulkBaseMastersService(db);
    return sendSuccess(res, "Masters retrieved successfully", result);
});

export const deleteBulkBaseMaster = catchAsync(async (req, res) => {
    const { id } = req.params;
    await deleteBulkBaseMasterService(db, id);
    return sendSuccess(res, "Master deleted successfully");
});
