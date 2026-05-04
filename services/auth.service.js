import crypto from 'crypto';
import { db } from "../db.js";
import { hashPassword, hashToken } from "../utils/hash.util.js";
import { verifyRefreshToken, generateTokenPair } from "../utils/jwt.util.js";
import { encrypt } from "../utils/encryption.util.js";
import { constructError } from "../utils/error.util.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

const getRefreshTokenExpiry = () => {
    return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
};

/**
 * Create new refresh token (called on login)
 */
export const createRefreshToken = async (db, userId, token, deviceInfo, userAgent, ipAddress) => {
    const tokenHash = hashToken(token);
    const encryptedToken = encrypt(token);
    const tokenFamily = crypto.randomUUID();
    const expiresAt = getRefreshTokenExpiry();

    await db.query(
        `INSERT INTO refresh_tokens 
         (user_id, token_hash, encrypted_token, token_family, device_info, user_agent, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, tokenHash, encryptedToken, tokenFamily, deviceInfo, userAgent, ipAddress, expiresAt]
    );

    return { tokenFamily, expiresAt };
};

/**
 * Rotate refresh token (called on /refresh)
 * Validates old token, revokes it, creates new token pair
 */
export const rotateRefreshToken = async (db, refreshToken, deviceInfo, userAgent, ipAddress) => {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        throw new Error("Invalid refresh token");
    }

    const userId = decoded.userID;

    const tokenHash = hashToken(refreshToken);
    const [tokens] = await db.query(
        `SELECT * FROM refresh_tokens 
         WHERE user_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()`,
        [userId, tokenHash]
    );
    if (tokens.length === 0) {
        throw new Error("Refresh token not found or expired");
    }

    const oldToken = tokens[0];

    await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`,
        [oldToken.id]
    );

    const payload = {
        sub: decoded.sub,
        jti: decoded.jti,
        userID: decoded.userID,
        UserId: String(decoded.userID),
        isAdmin: decoded.isAdmin,
        fullName: decoded.fullName,
        user_role: decoded.user_role
    };

    const newTokens = generateTokenPair(payload);

    const newTokenHash = await hashPassword(newTokens.refreshToken);
    const encryptedNewToken = encrypt(newTokens.refreshToken);
    const expiresAt = getRefreshTokenExpiry();

    await db.query(
        `INSERT INTO refresh_tokens 
         (user_id, token_hash, encrypted_token, token_family, device_info, user_agent, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, newTokenHash, encryptedNewToken, oldToken.token_family, deviceInfo, userAgent, ipAddress, expiresAt]
    );

    return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: payload
    };
};

/**
 * Revoke specific refresh token (single session logout)
 */
export const revokeRefreshToken = async (db, refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) return null;

    const tokenHash = hashToken(refreshToken);
    await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() 
         WHERE user_id = ? AND token_hash = ?`,
        [decoded.userID, tokenHash]
    );
};

/**
 * Revoke all sessions for a user
 */
export const revokeAllUserTokens = async (db, userId) => {
    await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() 
         WHERE user_id = ? AND revoked_at IS NULL`,
        [userId]
    );
};

/**
 * Get active sessions for a user
 */
export const getUserSessions = async (db, userId) => {
    const [tokens] = await db.query(
        `SELECT id, device_info, user_agent, ip_address, created_at, expires_at
         FROM refresh_tokens 
         WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [userId]
    );
    return tokens;
};

/**
 * Delete specific session by ID
 */
export const revokeSessionById = async (db, userId, sessionId) => {
    const [result] = await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() 
         WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        [sessionId, userId]
    );
    return result.affectedRows > 0;
};

/**
 * Soft delete a bulk user (admin only)
 * Deletes all associated data and marks user for deletion
 */
export const softDeleteBulkUser = async (db, userId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Verify user is bulk user and not already deleted
        const [users] = await conn.query(
            "SELECT userID, user_role FROM user WHERE userID = ? AND user_role = 'bulk' AND deleted_at IS NULL",
            [userId]
        );

        if (users.length === 0) {
            throw constructError("Bulk user not found or already deleted", 404);
        }

        // 2. Delete associated data in order

        // Bulk order items (via join)
        await conn.query(
            "DELETE boi FROM bulk_order_items boi JOIN bulk_orders bo ON boi.order_id = bo.id WHERE bo.userID = ?",
            [userId]
        );

        // Bulk orders
        await conn.query("DELETE FROM bulk_orders WHERE userID = ?", [userId]);

        // Product mappings
        await conn.query("DELETE FROM user_bulk_product_mapping WHERE userID = ?", [userId]);
        await conn.query("DELETE FROM bulk_user_products WHERE userID = ?", [userId]);

        // Outstanding amount
        await conn.query("DELETE FROM bulk_user_outstanding WHERE userID = ?", [userId]);

        // Notifications
        await conn.query("DELETE FROM notifications WHERE user_id = ?", [userId]);
        await conn.query("DELETE FROM fcm_tokens WHERE user_id = ?", [userId]);

        // Refresh tokens
        await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ?", [userId]);

        // 3. Soft delete user
        const now = new Date();
        const scheduledDeletion = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await conn.query(
            "UPDATE user SET deleted_at = ?, scheduled_deletion_at = ? WHERE userID = ?",
            [now, scheduledDeletion, userId]
        );

        // 4. Record for tracking
        await conn.query(
            "INSERT INTO pending_user_deletions (user_id, deleted_at, hard_delete_at) VALUES (?, ?, ?)",
            [userId, now, scheduledDeletion]
        );

        await conn.commit();

        return {
            message: "User deleted successfully",
            scheduledHardDelete: scheduledDeletion
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};