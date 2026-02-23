import { Router } from 'express';
import { placeBulkOrder, getBulkOrderHistory, getAllBulkOrders, updateBulkOrderStatus, updateBulkOrder, deleteBulkOrder } from '../controller/bulk_order.controller.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

export const bulkOrderRoute = Router();

// User routes
bulkOrderRoute.get('/history', authMiddleware, getBulkOrderHistory);
bulkOrderRoute.post('/place', authMiddleware, placeBulkOrder);
bulkOrderRoute.put('/:id', authMiddleware, updateBulkOrder);
bulkOrderRoute.delete('/:id', authMiddleware, deleteBulkOrder);

// Admin routes
bulkOrderRoute.get('/all', authMiddleware, adminMiddleware, getAllBulkOrders);
bulkOrderRoute.put('/:id/status', authMiddleware, adminMiddleware, updateBulkOrderStatus);
