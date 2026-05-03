import crypto from 'crypto';
import { db } from "../db.js";
import { hashPassword } from "../utils/hash.util.js";
import { verifyRefreshToken, generateTokenPair } from "../utils/jwt.util.js";
import { encrypt } from "../utils/encryption.util.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

const getRefreshTokenExpiry = () => {
    return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
};

/**
 * Create new refresh token (called on login)
 */
export const createRefreshToken = async (db, userId, token, deviceInfo, userAgent, ipAddress) => {
    const tokenHash = await hashPassword(token);
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

    const tokenHash = await hashPassword(refreshToken);
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

    const tokenHash = await hashPassword(refreshToken);
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