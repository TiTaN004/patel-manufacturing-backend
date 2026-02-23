import { db } from "../db.js";
import { generateToken } from "../utils/jwt.util.js";
import { hashPassword, comparePassword } from "../utils/hash.util.js";
import { sendResponse, sendSuccess, sendError } from "../utils/response.util.js";
import { sendPasswordResetOTP } from "../utils/email.service.js";
import { catchAsync } from "../utils/error.util.js";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const register = catchAsync(async (req, res, next) => {
    const { fullName, emailID, password, mobileNo, user_role = 'retail' } = req.body;

    if (!fullName || !emailID || !password) {
        return sendError(res, 400, "FullName, EmailID and Password is required", 0, null);
    }

    const [existing] = await db.query("SELECT COUNT(*) AS total FROM user WHERE emailID = ?", [emailID]);
    if (existing[0].total > 0) {
        return sendError(res, 400, "Email already exists", 0, null);
    }

    const hashedPassword = await hashPassword(password);
    const isActive = 1;
    const isAdmin = 0;
    const userName = emailID;

    const [result] = await db.query(
        "INSERT INTO user (fullName, userName, password, mobileNo, emailID, isActive, isAdmin, user_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [fullName, userName, hashedPassword, mobileNo || null, emailID, isActive, isAdmin, user_role]
    );

    const responseData = {
        userID: Number(result.insertId),
        fullName,
        emailID,
        address: null,
        zipcode: null,
        city: null,
        state: null,
        isActive: true,
        isAdmin: false,
        user_role: user_role
    };

    return sendSuccess(res, "Registration successful!", responseData);
});

export const googleLogin = catchAsync(async (req, res, next) => {
    const { idToken } = req.body;

    if (!idToken) {
        return sendError(res, 400, "ID Token is required");
    }

    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch (error) {
        return sendError(res, 401, "Invalid Google ID Token");
    }

    const { sub: googleId, email, name, picture } = payload;

    // 1. Check if user with googleId exists
    let [users] = await db.query(
        `SELECT u.*, COALESCE(bo.amount, 0) as outstanding_amount 
         FROM user u 
         LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID 
         WHERE u.googleId = ? AND u.isActive = 1 AND u.isAdmin = 0`,
        [googleId]
    );

    let user;
    if (users.length === 0) {
        // 2. Check if user with email exists
        [users] = await db.query(
            `SELECT u.*, COALESCE(bo.amount, 0) as outstanding_amount 
             FROM user u 
             LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID 
             WHERE u.emailID = ? AND u.isActive = 1 AND u.isAdmin = 0`,
            [email]
        );

        if (users.length > 0) {
            // Update existing user with googleId
            user = users[0];
            await db.query("UPDATE user SET googleId = ? WHERE userID = ?", [googleId, user.userID]);
        } else {
            // Create new user
            const [result] = await db.query(
                "INSERT INTO user (fullName, userName, emailID, googleId, isActive, isAdmin, user_role) VALUES (?, ?, ?, ?, 1, 0, 'retail')",
                [name, email, email, googleId]
            );

            const [newUsers] = await db.query(
                "SELECT *, 0 as outstanding_amount FROM user WHERE userID = ?",
                [result.insertId]
            );
            user = newUsers[0];
        }
    } else {
        user = users[0];
    }

    const token = generateToken(
        {
            sub: user.emailID,
            jti: user.userID,
            userID: user.userID,
            UserId: String(user.userID),
            isAdmin: false,
            fullName: user.fullName,
            user_role: user.user_role
        },
        '24h'
    );

    await db.query("UPDATE user SET token = ? WHERE userID = ?", [token, user.userID]);

    const responseData = {
        userID: Number(user.userID),
        fullName: user.fullName,
        userName: user.userName,
        mobileNo: user.mobileNo,
        emailID: user.emailID,
        address: user.address,
        zipcode: user.zipcode,
        city: user.city,
        state: user.state,
        token: token,
        isActive: true,
        isAdmin: false,
        user_role: user.user_role,
        outstanding_amount: user.user_role === 'bulk' ? user.outstanding_amount : undefined,
        picture: picture
    };

    return sendSuccess(res, "Login successful!", [responseData]);
});

export const login = catchAsync(async (req, res, next) => {
    const { emailID, password } = req.body;

    if (!emailID || !password) {
        return sendError(res, 400, "Email and password are required");
    }

    const [users] = await db.query(
        `SELECT u.*, COALESCE(bo.amount, 0) as outstanding_amount 
         FROM user u 
         LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID 
         WHERE u.emailID = ? AND u.isActive = 1 AND u.isAdmin = 0`,
        [emailID]
    );

    if (users.length === 0) {
        return sendResponse(res, 200, "Invalid credentials", [], 0);
    }

    const user = users[0];
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
        return sendResponse(res, 200, "Invalid credentials", [], 0);
    }

    const token = generateToken(
        { sub: user.emailID, jti: user.userID, userID: user.userID, UserId: String(user.userID), isAdmin: false, fullName: user.fullName, user_role: user.user_role },
        '24h'
    );

    await db.query("UPDATE user SET token = ? WHERE userID = ?", [token, user.userID]);

    const responseData = {
        userID: Number(user.userID),
        fullName: user.fullName,
        userName: user.userName,
        mobileNo: user.mobileNo,
        emailID: user.emailID,
        address: user.address,
        zipcode: user.zipcode,
        city: user.city,
        state: user.state,
        token: token,
        isActive: true,
        isAdmin: false,
        user_role: user.user_role,
        outstanding_amount: user.user_role === 'bulk' ? user.outstanding_amount : undefined
    };

    return sendSuccess(res, "Login successful!", [responseData]);
});

export const updateProfile = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;
    const { fullName, mobileNo, address, zipcode, city, state, user_role } = req.body;

    await db.query(
        "UPDATE user SET fullName = COALESCE(?, fullName), mobileNo = COALESCE(?, mobileNo), address = COALESCE(?, address), zipcode = COALESCE(?, zipcode), city = COALESCE(?, city), state = COALESCE(?, state), user_role = COALESCE(?, user_role) WHERE userID = ?",
        [fullName || null, mobileNo || null, address || null, zipcode || null, city || null, state || null, user_role || null, userId]
    );

    const [users] = await db.query(
        `SELECT u.*, COALESCE(bo.amount, 0) as outstanding_amount 
         FROM user u 
         LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID 
         WHERE u.userID = ?`,
        [userId]
    );
    const user = users[0];

    return sendSuccess(res, "Profile updated successfully!", [{
        userID: Number(user.userID),
        fullName: user.fullName,
        userName: user.userName,
        mobileNo: user.mobileNo,
        emailID: user.emailID,
        address: user.address,
        zipcode: user.zipcode,
        city: user.city,
        state: user.state,
        isActive: true,
        isAdmin: false,
        user_role: user.user_role,
        outstanding_amount: user.user_role === 'bulk' ? user.outstanding_amount : undefined
    }], 1);
});

export const getProfile = catchAsync(async (req, res, next) => {
    const userId = req.user.userID;

    const [users] = await db.query(
        `SELECT u.*, COALESCE(bo.amount, 0) as outstanding_amount 
         FROM user u 
         LEFT JOIN bulk_user_outstanding bo ON u.userID = bo.userID 
         WHERE u.userID = ? AND u.isActive = 1`,
        [userId]
    );
    if (users.length === 0) {
        return sendError(res, 401, "User not found or inactive", 0);
    }

    const user = users[0];
    return sendSuccess(res, "Profile fetched successfully!", [{
        userID: Number(user.userID),
        fullName: user.fullName,
        userName: user.userName,
        mobileNo: user.mobileNo,
        emailID: user.emailID,
        address: user.address,
        zipcode: user.zipcode,
        city: user.city,
        state: user.state,
        isActive: true,
        isAdmin: false,
        user_role: user.user_role,
        outstanding_amount: user.user_role === 'bulk' ? user.outstanding_amount : undefined
    }], 1);
});

export const forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) return sendError(res, 400, "Email is required", 0);

    const [users] = await db.query("SELECT userID, fullName FROM user WHERE emailID = ? AND isAdmin = 0", [email]);
    if (users.length === 0) return sendError(res, 404, "invalid credentials", 0);

    const user = users[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
        "INSERT INTO password_reset_tokens (userID, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP",
        [user.userID, otp, expiresAt]
    );

    if (await sendPasswordResetOTP(email, user.fullName, otp)) {
        return sendSuccess(res, "Password reset OTP sent successfully", { email, expires_in: 15 }, 1);
    } else {
        return sendError(res, 500, "Failed to send reset email", 0);
    }
});

export const verifyResetOtp = catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 400, "Email and OTP are required", 0);

    const [users] = await db.query("SELECT userID FROM user WHERE emailID = ? AND isAdmin = 0", [email]);
    if (users.length === 0) return sendError(res, 404, "User not found", 0);

    const user = users[0];
    const [tokens] = await db.query("SELECT token, expires_at FROM password_reset_tokens WHERE userID = ? AND token = ?", [user.userID, otp]);

    if (tokens.length === 0) return sendError(res, 400, "Invalid OTP", 0);

    if (new Date(tokens[0].expires_at) < new Date()) {
        return sendError(res, 400, "OTP has expired", 0);
    }

    return sendSuccess(res, "OTP verified successfully", { email, verified: true }, 1);
});

export const resetPassword = catchAsync(async (req, res, next) => {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) return sendError(res, 400, "Email, OTP, and new password are required", 0);

    const [users] = await db.query("SELECT userID FROM user WHERE emailID = ? AND isAdmin = 0", [email]);
    if (users.length === 0) return sendError(res, 404, "User not found", 0);

    const user = users[0];
    const [tokens] = await db.query("SELECT token, expires_at FROM password_reset_tokens WHERE userID = ? AND token = ?", [user.userID, otp]);

    if (tokens.length === 0 || new Date(tokens[0].expires_at) < new Date()) {
        return sendError(res, 400, "Invalid or expired OTP", 0);
    }

    const hashedPassword = await hashPassword(password);
    await db.query("UPDATE user SET password = ? WHERE userID = ?", [hashedPassword, user.userID]);
    await db.query("DELETE FROM password_reset_tokens WHERE userID = ?", [user.userID]);

    return sendSuccess(res, "Password reset successful", null, 1);
});
