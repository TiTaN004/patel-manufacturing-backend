import { Router } from 'express';
import { create, getAll, remove, update, uploadImage, deleteImage } from '../controller/category.controller.js';
import { upload } from '../middleware/upload.middleware.js';

export const categoryRoute = Router();

categoryRoute.get('/', getAll);
categoryRoute.post('/', create);
categoryRoute.put('/:id', update);
categoryRoute.delete('/:id', remove);

categoryRoute.post('/:id/upload-image', upload.single('image'), uploadImage);
categoryRoute.delete('/:id/delete-image', deleteImage);
