import express from "express";
import {
    createBulkBaseMaster,
    getAllBulkBaseMasters,
    deleteBulkBaseMaster
} from "../controller/bulk_master.controller.js";

const router = express.Router();

router.post("/", createBulkBaseMaster);
router.get("/", getAllBulkBaseMasters);
router.delete("/:id", deleteBulkBaseMaster);

export default router;
