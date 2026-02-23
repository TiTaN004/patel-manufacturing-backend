import { Router } from 'express';
import { login, googleLogin, register, getProfile, updateProfile, forgotPassword, verifyResetOtp, resetPassword } from '../controller/store-auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const storeAuthRoute = Router();

storeAuthRoute.post('/login', login);
storeAuthRoute.post('/google-login', googleLogin);
storeAuthRoute.post('/register', register);
storeAuthRoute.get('/profile', authMiddleware, getProfile);
storeAuthRoute.put('/profile', authMiddleware, updateProfile);

storeAuthRoute.post('/forgot-password', forgotPassword);
storeAuthRoute.post('/verify-reset-otp', verifyResetOtp);
storeAuthRoute.post('/reset-password', resetPassword);
