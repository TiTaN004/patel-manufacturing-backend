import Router from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadSingle, uploadMultiple, deleteFile } from '../controller/upload.controller.js';

export const uploadRoute = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Internal logic to determine folder
    let folder = 'products';
    if (file.mimetype === 'application/pdf' || file.fieldname.toLowerCase().includes('invoice')) {
      folder = 'invoices';
    }
    
    const dest = path.join('uploads', folder);
    
    // Ensure destination exists
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'application/pdf'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
});

// Routes
uploadRoute.post('/single', upload.any(), uploadSingle);
uploadRoute.post('/multiple', upload.any(), uploadMultiple);
uploadRoute.delete('/:folder/:filename', deleteFile);
uploadRoute.delete('/:filename', deleteFile);