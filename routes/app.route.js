import Router from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendError } from '../utils/response.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const appRoute = Router();

const apkPath = path.join(__dirname, '../uploads/apk/app.apk');

// appRoute.get('/download', (req, res) => {
//   if (!fs.existsSync(apkPath)) {
//     return sendError(res, 404, 'APK not found. Please upload app.apk to uploads/apk/ folder.');
//   }

//   res.setHeader('Content-Disposition', 'attachment; filename="app.apk"');
//   res.setHeader('Content-Type', 'application/vnd.android.package-archive');

//   const fileStream = fs.createReadStream(apkPath);
//   fileStream.pipe(res);
// });

appRoute.get('/download', (req, res) => {
  if (!fs.existsSync(apkPath)) {
    return sendError(res, 404, 'APK not found. Please upload app.apk to uploads/apk/ folder.');
  }
  // ✅ NEW: Get file stats
  const stats = fs.statSync(apkPath);

  // ✅ NEW: Set Content-Length header
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', 'attachment; filename="app.apk"');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  const fileStream = fs.createReadStream(apkPath);
  fileStream.pipe(res);
});