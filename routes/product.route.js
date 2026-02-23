import { Router } from 'express';
import { create, getAll, getById, remove, update, getBySlug, checkSlug, getStoreProducts } from '../controller/product.controller.js';

export const productRoute = Router();

// Store routes
productRoute.get('/store/products', getStoreProducts);
productRoute.get('/slug/:slug', getBySlug);
productRoute.get('/check-slug', checkSlug);

// Admin routes
productRoute.get('/', getAll);
productRoute.get('/:id', getById);
productRoute.post('/', create);
productRoute.put('/:id', update);
productRoute.delete('/:id', remove);
