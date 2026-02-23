import express from 'express';
import {
    getUserNotifications,
    registerToken,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    unregisterToken
} from '../controller/notification.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

router.get('/', getUserNotifications);
router.post('/register-token', registerToken);
router.post('/unregister-token', unregisterToken);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/delete-all', deleteAllNotifications);

export const notificationRoute = router;
