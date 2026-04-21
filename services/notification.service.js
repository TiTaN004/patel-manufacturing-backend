import admin from 'firebase-admin';
import { db } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account');
} else {
    console.warn('⚠️ Firebase service account file not found. Push notifications will not be sent.');
}

export const notificationService = {
    /**
     * Create a notification and send push notification
     */
    async sendNotification({ userId, title, message, type = 'system', referenceId = null, pushOnly = false }) {
        try {
            let notificationId = null;

            // 1. Save to database (unless pushOnly)
            if (!pushOnly) {
                const [result] = await db.query(
                    `INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?)`,
                    [userId, title, message, type, referenceId]
                );
                notificationId = result.insertId;
            }

            // 2. Fetch FCM tokens for the user
            const [tokens] = await db.query(
                `SELECT token FROM fcm_tokens WHERE user_id = ?`,
                [userId]
            );

            if (tokens.length > 0 && admin.apps.length > 0) {
                const fcmTokens = tokens.map(t => t.token);

                const payload = {
                    notification: {
                        title: title,
                        body: message,
                    },
                    data: {
                        type: type,
                        referenceId: String(referenceId || ''),
                        notificationId: String(notificationId || '')
                    }
                };

                // Send push notification
                const response = await admin.messaging().sendEachForMulticast({
                    tokens: fcmTokens,
                    notification: payload.notification,
                    data: payload.data,
                });

                console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} messages failed`);

                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error(`FCM Error for token ${fcmTokens[idx]}:`, resp.error);
                        const errorCode = resp.error?.code;
                        if (errorCode === 'messaging/registration-token-not-registered' ||
                            errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/mismatched-credential') {
                            db.query(`DELETE FROM fcm_tokens WHERE token = ?`, [fcmTokens[idx]])
                                .catch(err => console.error('Failed to remove invalid token:', err));
                        }
                    } else {
                        console.log(`FCM Success for token ${fcmTokens[idx]}`);
                    }
                });
            }

            return notificationId;
        } catch (error) {
            console.error('Error in sendNotification:', error);
            throw error;
        }
    },

    /**
     * Register an FCM token for a user
     */
    async registerToken(userId, token, deviceId = null) {
        try {
            await db.query(
                `INSERT INTO fcm_tokens (user_id, token, device_id) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE token = VALUES(token), updated_at = CURRENT_TIMESTAMP`,
                [userId, token, deviceId]
            );
            return true;
        } catch (error) {
            console.error('Error in registerToken:', error);
            throw error;
        }
    },

    /**
     * Unregister an FCM token
     */
    async unregisterToken(token) {
        try {
            await db.query(`DELETE FROM fcm_tokens WHERE token = ?`, [token]);
            return true;
        } catch (error) {
            console.error('Error in unregisterToken:', error);
            throw error;
        }
    },

    /**
     * Unregister all FCM tokens for a user
     */
    async unregisterUserTokens(userId) {
        try {
            await db.query(`DELETE FROM fcm_tokens WHERE user_id = ?`, [userId]);
            return true;
        } catch (error) {
            console.error('Error in unregisterUserTokens:', error);
            throw error;
        }
    },

    /**
     * Get notifications for a user
     */
    async getUserNotifications(userId, limit = 20, offset = 0) {
        try {
            const [notifications] = await db.query(
                `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                [userId, parseInt(limit), parseInt(offset)]
            );
            return notifications;
        } catch (error) {
            console.error('Error in getUserNotifications:', error);
            throw error;
        }
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            await db.query(
                `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
                [notificationId, userId]
            );
            return true;
        } catch (error) {
            console.error('Error in markAsRead:', error);
            throw error;
        }
    },

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        try {
            await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = ?`, [userId]);
            return true;
        } catch (error) {
            console.error('Error in markAllAsRead:', error);
            throw error;
        }
    },

    /**
     * Delete a single notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            await db.query(
                `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
                [notificationId, userId]
            );
            return true;
        } catch (error) {
            console.error('Error in deleteNotification:', error);
            throw error;
        }
    },

    /**
     * Delete all notifications for a user
     */
    async deleteAllNotifications(userId) {
        try {
            await db.query(`DELETE FROM notifications WHERE user_id = ?`, [userId]);
            return true;
        } catch (error) {
            console.error('Error in deleteAllNotifications:', error);
            throw error;
        }
    }
};
