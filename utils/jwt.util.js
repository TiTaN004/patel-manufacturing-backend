import jwt from 'jsonwebtoken';

/**
 * Generate a JWT token (access token)
 * @param {Object} payloadData - The data to encode in the token
 * @param {string} expiresIn - Expiration time (e.g., '24h', '7d')
 * @returns {string} The generated token
 */
export const generateToken = (payloadData, expiresIn = process.env.JWT_ACCESS_EXPIRY || '24h') => {
    return jwt.sign(payloadData, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate access token (alias for generateToken)
 */
export const generateAccessToken = (payloadData, expiresIn = process.env.JWT_ACCESS_EXPIRY || '24h') => {
    return jwt.sign(payloadData, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate refresh token
 * @param {Object} payloadData - The data to encode in the token
 * @param {string} expiresIn - Expiration time (e.g., '30d')
 * @returns {string} The generated refresh token
 */
export const generateRefreshToken = (payloadData, expiresIn = process.env.JWT_REFRESH_EXPIRY || '30d') => {
    return jwt.sign(payloadData, process.env.JWT_REFRESH_SECRET, { expiresIn });
};

/**
 * Verify a JWT token (access token)
 * @param {string} token - The token to verify
 * @returns {Object|null} The decoded payload if valid, otherwise null
 */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Verify a refresh token
 * @param {string} token - The refresh token to verify
 * @returns {Object|null} The decoded payload if valid, otherwise null
 */
export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} payloadData - The data to encode in both tokens
 * @returns {Object} { accessToken, refreshToken }
 */
export const generateTokenPair = (payloadData) => {
    return {
        accessToken: generateAccessToken(payloadData),
        refreshToken: generateRefreshToken(payloadData)
    };
};

/**
 * Decode a JWT token without verification
 * @param {string} token - The token to decode
 * @returns {Object|null} The decoded payload if valid, otherwise null
 */
export const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};
