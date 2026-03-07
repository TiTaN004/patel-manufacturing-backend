import { db } from "../db.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import {
    assignProductsToBulkUserService,
    getBulkUserProductsService,
    upsertBulkOutstandingService
} from "../services/bulk.service.js";
import { hashPassword } from "../utils/hash.util.js";

/**
 * Add or update outstanding amount for a bulk user
 */
export const upsertOutstandingAmount = catchAsync(async (req, res, next) => {
    const { userID, amount } = req.body;

    if (!userID || amount === undefined) {
        return sendError(res, 400, "userID and amount are required");
    }

    const result = await upsertBulkOutstandingService(db, userID, amount);
    return sendSuccess(res, "Outstanding amount updated successfully", result);
});

/**
 * Get all bulk users with their outstanding amounts
 */
export const getOutstandingAmounts = catchAsync(async (req, res, next) => {
    const [results] = await db.query(`
        SELECT u.userID, u.fullName,u.userName, u.emailID, u.mobileNo, COALESCE(bo.amount, 0) as outstanding_amount
        FROM user u
        LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID
        WHERE u.user_role = 'bulk'
    `);

    return sendSuccess(res, "Outstanding amounts retrieved successfully", results);
});

/**
 * Get outstanding amount for a specific user
 */
export const getOutstandingAmountByUserId = catchAsync(async (req, res, next) => {
    const { userID } = req.params;

    const [results] = await db.query(`
        SELECT u.userID, u.fullName, u.emailID, u.mobileNo, COALESCE(bo.amount, 0) as outstanding_amount
        FROM user u
        LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID
        WHERE u.userID = ? AND u.user_role = 'bulk'
    `, [userID]);

    if (results.length === 0) {
        return sendError(res, 404, "Bulk user not found");
    }

    return sendSuccess(res, "Outstanding amount retrieved successfully", results[0]);
});

/**
 * Assign products to a bulk user
 */
export const assignProductsToBulkUser = catchAsync(async (req, res, next) => {
    const { userID, productIDs } = req.body;

    if (!userID || !Array.isArray(productIDs)) {
        return sendError(res, 400, "userID and productIDs (array) are required");
    }

    const result = await assignProductsToBulkUserService(db, userID, productIDs);
    return sendSuccess(res, result.message, result);
});

/**
 * Get products assigned to a bulk user
 */
export const getBulkUserProducts = catchAsync(async (req, res, next) => {
    const { userID } = req.params;

    if (!userID) {
        return sendError(res, 400, "userID is required");
    }

    const products = await getBulkUserProductsService(db, userID);
    return sendSuccess(res, "Bulk user products retrieved successfully", products);
});

/**
 * Bulk update multiple users
 */
export const bulkUpdateUsers = catchAsync(async (req, res, next) => {
    const { users } = req.body;

    if (!users || !Array.isArray(users)) {
        return sendError(res, 400, "users array is required");
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const user of users) {
            let { userID, fullName, mobileNo, emailID, user_role, isActive } = user;

            if (!userID && (emailID || mobileNo)) {
                // Try to find user by email or mobile
                let query = "SELECT userID FROM user WHERE ";
                let params = [];
                if (emailID && mobileNo) {
                    query += "emailID = ? OR mobileNo = ?";
                    params = [emailID, mobileNo];
                } else if (emailID) {
                    query += "emailID = ?";
                    params = [emailID];
                } else {
                    query += "mobileNo = ?";
                    params = [mobileNo];
                }

                const [rows] = await connection.query(query, params);
                if (rows.length > 0) {
                    userID = rows[0].userID;
                }
            }

            if (!userID) continue;

            await connection.query(
                `UPDATE user SET
                    fullName = COALESCE(?, fullName),
                    mobileNo = COALESCE(?, mobileNo),
                    emailID = COALESCE(?, emailID),
                    user_role = COALESCE(?, user_role),
                    isActive = COALESCE(?, isActive)
                WHERE userID = ?`,
                [fullName || null, mobileNo || null, emailID || null, user_role || null, isActive !== undefined ? isActive : null, userID]
            );
        }

        await connection.commit();
        return sendSuccess(res, "Users updated successfully");
    } catch (error) {
        await connection.rollback();
        return sendError(res, 500, error.message || "Failed to update users");
    } finally {
        connection.release();
    }
});

/**
 * Update user details (sensitive fields like password, userName, isAdmin)
 */
export const updateUser = catchAsync(async (req, res, next) => {
    const { userID, userName, password, isAdmin } = req.body;

    if (!userID) {
        return sendError(res, 400, "userID is required");
    }

    const updates = [];
    const params = [];

    if (userName !== undefined) {
        updates.push("userName = ?");
        params.push(userName);
    }

    if (password !== undefined && password !== "") {
        const hashedPassword = await hashPassword(password);
        updates.push("password = ?");
        params.push(hashedPassword);
    }

    if (isAdmin !== undefined) {
        updates.push("isAdmin = ?");
        params.push(isAdmin ? 1 : 0);
    }

    if (updates.length === 0) {
        return sendError(res, 400, "No fields to update");
    }

    params.push(userID);
    const [result] = await db.query(
        `UPDATE user SET ${updates.join(", ")} WHERE userID = ?`,
        params
    );

    if (result.affectedRows === 0) {
        return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, "User updated successfully");
});

/**
 * Get all admin users
 */
export const getAllAdminUsers = catchAsync(async (req, res, next) => {
    const [results] = await db.query(`
        SELECT userID, fullName, userName, emailID, mobileNo, isAdmin, isActive
        FROM user
        WHERE isAdmin = 1
    `);

    return sendSuccess(res, "Admin users retrieved successfully", results);
});
