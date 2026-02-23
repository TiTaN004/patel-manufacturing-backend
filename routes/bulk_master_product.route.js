import express from "express";
import {
    createBulkMasterProduct,
    getAllBulkMasterProducts,
    updateBulkMasterProduct,
    deleteBulkMasterProduct,
    bulkAssignToUser
} from "../controller/bulk_master_product.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getAllBulkMasterProducts);
router.post("/", createBulkMasterProduct);
router.post("/assign", bulkAssignToUser);
router.put("/:id", updateBulkMasterProduct);
router.delete("/:id", deleteBulkMasterProduct);

export default router;
