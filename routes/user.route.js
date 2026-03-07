import { Router } from 'express';
import { upsertOutstandingAmount, getOutstandingAmounts, getOutstandingAmountByUserId, assignProductsToBulkUser, getBulkUserProducts, bulkUpdateUsers, updateUser, getAllAdminUsers } from '../controller/user.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

export const userRoute = Router();

// Middlewares
const adminOrSelf = (req, res, next) => {
    if (req.user.isAdmin) return next();
    if (req.params.userID === 'me') {
        req.params.userID = req.user.userID;
        return next();
    }
    if (String(req.params.userID) === String(req.user.userID)) return next();
    return res.status(403).json({ success: false, message: 'Forbidden: Access denied' });
};

// Admin only routes
userRoute.post('/outstanding', authMiddleware, adminMiddleware, upsertOutstandingAmount);
userRoute.get('/outstanding', authMiddleware, adminMiddleware, getOutstandingAmounts);
userRoute.get('/admin-users', authMiddleware, adminMiddleware, getAllAdminUsers);

// Admin or Self routes
userRoute.get('/outstanding/:userID', authMiddleware, adminOrSelf, getOutstandingAmountByUserId);
userRoute.get('/products/:userID', authMiddleware, adminOrSelf, getBulkUserProducts);

// Admin only for assignment
userRoute.post('/assign-products', authMiddleware, adminMiddleware, assignProductsToBulkUser);

// Admin only for bulk update
userRoute.put('/bulk-update', authMiddleware, adminMiddleware, bulkUpdateUsers);

// Admin only for single user update (sensitive fields)
userRoute.put('/update', authMiddleware, adminMiddleware, updateUser);
