import { Router } from 'express';
import { login, googleLogin, register, getProfile, updateProfile, forgotPassword, verifyResetOtp, resetPassword, refresh, logout, getSessions, revokeSession, revokeAllSessions } from '../controller/store-auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const storeAuthRoute = Router();

storeAuthRoute.post('/login', login);
storeAuthRoute.post('/google-login', googleLogin);
storeAuthRoute.post('/refresh', refresh);
storeAuthRoute.post('/register', register);
storeAuthRoute.get('/profile', authMiddleware, getProfile);
storeAuthRoute.put('/profile', authMiddleware, updateProfile);
storeAuthRoute.post('/logout', authMiddleware, logout);
storeAuthRoute.get('/sessions', authMiddleware, getSessions);
storeAuthRoute.delete('/sessions/all', authMiddleware, revokeAllSessions);
storeAuthRoute.delete('/sessions/:id', authMiddleware, revokeSession);

storeAuthRoute.post('/forgot-password', forgotPassword);
storeAuthRoute.post('/verify-reset-otp', verifyResetOtp);
storeAuthRoute.post('/reset-password', resetPassword);
