import express from "express";
import {
    createBulkProduct,
    getBulkProductsByUser,
    updateBulkProduct,
    deleteBulkProduct
} from "../controller/bulk_product.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

const adminOrSelf = (req, res, next) => {
    if (req.user.isAdmin) return next();
    if (req.params.userID === 'me') {
        req.params.userID = req.user.userID;
        return next();
    }
    if (String(req.params.userID) === String(req.user.userID)) return next();
    return res.status(403).json({ success: false, message: 'Forbidden: Access denied' });
};

router.post("/", authMiddleware, adminMiddleware, createBulkProduct);
router.get("/user/:userID", authMiddleware, adminOrSelf, getBulkProductsByUser);
router.put("/:id", authMiddleware, adminMiddleware, updateBulkProduct);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBulkProduct);

export { router as bulkProductRoute };
