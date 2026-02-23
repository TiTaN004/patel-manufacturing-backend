import { Router } from 'express';
import { getAll, create, remove } from '../controller/contact.controller.js';
import { adminMiddleware } from '../middleware/auth.middleware.js';

export const contactRoute = Router();

contactRoute.post('/', create);
contactRoute.get('/',  getAll);
contactRoute.delete('/:id', remove);
// contactRoute.get('/', adminMiddleware, getAll);
// contactRoute.delete('/:id', adminMiddleware, remove);
