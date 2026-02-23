import { notificationService } from '../services/notification.service.js';
import { sendSuccess, sendError } from '../utils/response.util.js';

export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.userID;
        const { limit = 20, offset = 0 } = req.query;
        const notifications = await notificationService.getUserNotifications(userId, limit, offset);
        return sendSuccess(res, 'Notifications fetched successfully', notifications);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const registerToken = async (req, res) => {
    try {
        const userId = req.user.userID;
        const { token, deviceId } = req.body;
        if (!token) {
            return sendError(res, 400, 'FCM token is required');
        }
        await notificationService.registerToken(userId, token, deviceId);
        return sendSuccess(res, 'Token registered successfully');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const markAsRead = async (req, res) => {
    try {
        const userId = req.user.userID;
        const { id } = req.params;
        await notificationService.markAsRead(id, userId);
        return sendSuccess(res, 'Notification marked as read');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.userID;
        await notificationService.markAllAsRead(userId);
        return sendSuccess(res, 'All notifications marked as read');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const userId = req.user.userID;
        const { id } = req.params;
        await notificationService.deleteNotification(id, userId);
        return sendSuccess(res, 'Notification deleted successfully');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user.userID;
        await notificationService.deleteAllNotifications(userId);
        return sendSuccess(res, 'All notifications deleted successfully');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

export const unregisterToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return sendError(res, 400, 'FCM token is required');
        }
        await notificationService.unregisterToken(token);
        return sendSuccess(res, 'Token unregistered successfully');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};
