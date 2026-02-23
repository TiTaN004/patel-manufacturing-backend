import Router from 'express'
import { create, getAll, remove, update } from '../controller/filter.controller.js';

export const filterRoute = Router();

filterRoute.get('/', getAll);
filterRoute.post('/', create);
filterRoute.put('/:id',update);
filterRoute.delete('/:id', remove);

