import { db } from "../db.js";
import { generateToken, verifyToken as jwtVerify, generateTokenPair } from "../utils/jwt.util.js";
import { hashPassword, comparePassword } from "../utils/hash.util.js";
import { sendResponse, sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import { sendOTP } from "../utils/email.service.js";
import { createRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeAllUserTokens, getUserSessions, revokeSessionById } from "../services/auth.service.js";

export const login = catchAsync(async (req, res, next) => {
    const { userName, password } = req.body;
    const deviceInfo = req.headers['x-device-info'] || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!userName || !password) {
        return sendError(res, 400, "User Name and password are required");
    }

    const [users] = await db.query(
        "SELECT * FROM user WHERE userName = ? AND isActive = 1 AND (isAdmin = 1 OR user_role = 'bulk')",
        [userName]
    );

    if (users.length === 0) {
        return sendResponse(res, 200, "Invalid credentials", [], 0);
    }

    const user = users[0];
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
        return sendResponse(res, 200, "Invalid credentials", [], 0);
    }

    const payload = {
        sub: user.userName,
        jti: user.userID,
        userID: user.userID,
        UserId: String(user.userID),
        isAdmin: Boolean(user.isAdmin),
        fullName: user.fullName,
        user_role: user.user_role
    };

    const { accessToken, refreshToken } = generateTokenPair(payload);

    await createRefreshToken(db, user.userID, refreshToken, deviceInfo, userAgent, ipAddress);

    await db.query("UPDATE user SET token = ? WHERE userID = ?", [accessToken, user.userID]);

    const responseData = {
        userID: Number(user.userID),
        fullName: user.fullName,
        userName: user.userName,
        mobileNo: user.mobileNo,
        emailID: user.emailID,
        token: accessToken,
        refreshToken: refreshToken,
        isActive: Boolean(user.isActive),
        isAdmin: Boolean(user.isAdmin),
        user_role: user.user_role
    };

    return sendSuccess(res, "Login successful!", [responseData]);
});

export const register = catchAsync(async (req, res, next) => {
    const { fullName, userName, password, mobileNo, emailID, isActive = 1, user_role = 'retail' } = req.body;
    let { isAdmin = 0 } = req.body;

    if (!fullName || !userName || !password || !mobileNo) {
        return sendError(res, 400, "All fields are required", 0, null);
    }

    // Only admins can create another admin
    if (isAdmin == 1) {
        if (!req.user || !req.user.isAdmin) {
            isAdmin = 0; // Force to non-admin if requester is not an admin
        }
    }

    const [existing] = await db.query("SELECT COUNT(*) AS total FROM user WHERE userName = ? OR emailID = ?", [userName, emailID]);
    if (existing[0].total > 0) {
        return sendError(res, 400, "Username or email already exists", 0, null);
    }

    const hashedPassword = await hashPassword(password);
    const [result] = await db.query(
        "INSERT INTO user (fullName, userName, password, mobileNo, emailID, isActive, isAdmin, user_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [fullName, userName, hashedPassword, mobileNo, emailID || null, isActive, isAdmin, user_role]
    );

    const responseData = {
        userID: Number(result.insertId),
        fullName,
        userName,
        mobileNo,
        emailID,
        isActive: Boolean(isActive),
        isAdmin: Boolean(isAdmin),
        user_role: user_role
    };

    return sendSuccess(res, "User created successfully!", responseData);
});

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwtVerify(token);
            if (decoded) {
                return sendSuccess(res, 'Token is valid', decoded);
            }
        } catch (error) {
            // fall through
        }
    }

    return sendError(res, 401, 'Unauthorized');
};

export const getValidEmails = catchAsync(async (req, res, next) => {
    const [emails] = await db.query("SELECT email FROM valid_emails");
    return sendSuccess(res, "Emails retrieved successfully", emails, 1);
});


export const sendOtp = catchAsync(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return sendError(res, 400, 'Email is required', 0);
    }

    const [validEmails] = await db.query("SELECT id FROM valid_emails WHERE email = ?", [email]);

    if (validEmails.length === 0) {
        return sendError(res, 404, 'No account found with this email address', 0);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(" DELETE from password_reset_tokens where userID = ?", [validEmails[0].id]);

    await db.query(
        "INSERT INTO password_reset_tokens (userID, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP",
        [validEmails[0].id, otp, expiresAt]
    );

    if (await sendOTP(email, email, otp)) {
        return sendSuccess(res, 'OTP sent successfully to your email', { email, expires_in: 15 });
    } else {
        return sendError(res, 500, 'Failed to send OTP email');
    }
});

export const verifyOtp = catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return sendError(res, 400, 'Email and OTP are required', 0);
    }

    const [validEmails] = await db.query("SELECT id FROM valid_emails WHERE email = ?", [email]);

    if (validEmails.length === 0) {
        return sendError(res, 404, 'User not found', 0);
    }

    const [tokens] = await db.query(
        "SELECT token, expires_at FROM password_reset_tokens WHERE userID = ? AND token = ?",
        [validEmails[0].id, otp]
    );

    if (tokens.length === 0) {
        return sendError(res, 400, 'Invalid OTP', 0);
    }

    if (new Date(tokens[0].expires_at) < new Date()) {
        return sendError(res, 400, 'OTP has expired');
    }

    await db.query("DELETE FROM password_reset_tokens WHERE userID = ?", [validEmails[0].id]);

    return sendSuccess(res, 'OTP verified successfully', { email, verified: true });
});

export const logout = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { refreshToken } = req.body;

    if (refreshToken) {
        await revokeRefreshToken(db, refreshToken);
    }

    await db.query("UPDATE user SET token = NULL WHERE userID = ?", [userId]);

    try {
        const { notificationService } = await import('../services/notification.service.js');
        await notificationService.unregisterUserTokens(userId);
        console.log('Logout: Unregistered all FCM tokens for user:', userId);
    } catch (error) {
        console.error('Logout: Failed to unregister FCM tokens:', error.message);
    }

    return sendSuccess(res, "Logged out successfully");
});

export const refresh = catchAsync(async (req, res, next) => {
    const { refreshToken } = req.body;
    const deviceInfo = req.headers['x-device-info'] || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!refreshToken) {
        return sendError(res, 400, "Refresh token is required");
    }

    const result = await rotateRefreshToken(db, refreshToken, deviceInfo, userAgent, ipAddress);

    return sendSuccess(res, "Token refreshed successfully", [{
        token: result.accessToken,
        refreshToken: result.refreshToken
    }]);
});

export const getSessions = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const sessions = await getUserSessions(db, userId);
    return sendSuccess(res, "Sessions fetched successfully", sessions);
});

export const revokeSession = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { id } = req.params;
    const revoked = await revokeSessionById(db, userId, id);
    if (!revoked) return sendError(res, 404, "Session not found");
    return sendSuccess(res, "Session revoked successfully");
});

export const revokeAllSessions = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    await revokeAllUserTokens(db, userId);
    await db.query("UPDATE user SET token = NULL WHERE userID = ?", [userId]);
    return sendSuccess(res, "All sessions revoked successfully");
});