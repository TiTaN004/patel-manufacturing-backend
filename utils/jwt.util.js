import jwt from 'jsonwebtoken';

/**
 * Generate a JWT token
 * @param {Object} payloadData - The data to encode in the token
 * @param {string} expiresIn - Expiration time (e.g., '24h', '7d')
 * @returns {string} The generated token
 */
export const generateToken = (payloadData, expiresIn = '24h') => {
    return jwt.sign(payloadData, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Verify a JWT token
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
