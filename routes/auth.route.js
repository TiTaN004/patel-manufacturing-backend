import { Router } from 'express';
import { login, register, verifyToken, getValidEmails, sendOtp, verifyOtp, logout } from '../controller/auth.controller.js';
import { authMiddleware, softAuthMiddleware } from '../middleware/auth.middleware.js';

export const authRoute = Router();

authRoute.post('/login', login);
authRoute.post('/register', softAuthMiddleware, register);
authRoute.post('/verify-token', verifyToken);
authRoute.get('/valid-emails', getValidEmails);
authRoute.post('/send-otp', sendOtp);
authRoute.post('/verify-otp', verifyOtp);
authRoute.post('/logout', authMiddleware, logout);