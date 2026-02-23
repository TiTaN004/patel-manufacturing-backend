import { verifyToken } from '../utils/jwt.util.js';
import { db } from '../db.js';

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log('[AuthMiddleware] No auth header found');
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        console.log('[AuthMiddleware] No token found in header');
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    try {
        if (!process.env.JWT_SECRET) {
            console.error('[AuthMiddleware] CRITICAL: JWT_SECRET is missing from environment');
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            console.log('[AuthMiddleware] Token verification failed');
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
        }

        // Single session check: verify token against DB
        const [users] = await db.query("SELECT token FROM user WHERE userID = ?", [decoded.userID]);
        if (users.length === 0 || users[0].token !== token) {
            console.log('[AuthMiddleware] Session invalidated or user logged in elsewhere');
            return res.status(401).json({ success: false, message: 'Unauthorized: Session invalidated' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error('[AuthMiddleware] Error during token verification:', error.message);
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
};

export const adminMiddleware = async (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }
    next();
};

export const softAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = verifyToken(token);
            if (decoded) {
                // Verify against DB even for soft auth to ensure consistency
                const [users] = await db.query("SELECT token FROM user WHERE userID = ?", [decoded.userID]);
                if (users.length > 0 && users[0].token === token) {
                    req.user = decoded;
                }
            }
        } catch (err) {
            // Ignore error, just don't attach user
        }
    }
    next(); // Always continue
};