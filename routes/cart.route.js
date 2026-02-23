import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart, syncCart } from '../controller/cart.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const cartRoute = Router();

cartRoute.use(authMiddleware);

cartRoute.get('/', getCart);
cartRoute.post('/', addToCart);
cartRoute.post('/sync', syncCart);
cartRoute.put('/:id', updateCartItem);
cartRoute.delete('/:id', removeFromCart);
cartRoute.delete('/', clearCart);
