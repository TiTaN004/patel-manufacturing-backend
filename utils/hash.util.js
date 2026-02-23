import bcrypt from 'bcryptjs';

/**
 * Hash a password
 * @param {string} password - The plain text password
 * @returns {Promise<string>} The hashed password
 */
export const hashPassword = async (password) => {
    const saltRounds = parseInt(process.env.SALT) || 10;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare a plain text password with a hash
 * @param {string} password - The plain text password
 * @param {string} hash - The hashed password
 * @returns {Promise<boolean>} True if match, otherwise false
 */
export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};
