import { Router } from 'express';
import { getAll, getPromoCoupons, create, update, remove, validate, redeem } from '../controller/coupon.controller.js';

export const couponRoute = Router();

// Store routes
couponRoute.get('/promo', getPromoCoupons);
couponRoute.post('/validate', validate);
couponRoute.post('/redeem', redeem);

// Admin routes
couponRoute.get('/', getAll);
couponRoute.post('/', create);
couponRoute.put('/:id', update);
couponRoute.delete('/:id', remove);
