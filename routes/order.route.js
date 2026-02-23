import express from "express";
import { 
    createOrder, getAllOrders, getOrderById, updateOrder, deleteOrder,
    checkout, getAllUserOrders, getUserHistory, deleteUserOrder, getUserOrderById 
} from "../controller/order.controller.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// User routes
router.post("/checkout", authMiddleware, checkout);
router.get("/history", authMiddleware, getUserHistory);
router.get("/user-order/:id", authMiddleware, getUserOrderById);
router.delete("/user-order/:id", authMiddleware, deleteUserOrder);

// Admin routes
router.get("/", getAllOrders);
router.get("/user-orders", getAllUserOrders);
router.get("/all-user-orders", getAllUserOrders); // Backward compatibility
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.put("/:id", updateOrder);
router.delete("/:id", deleteOrder);
// router.get("/", adminMiddleware, getAllOrders);
// router.get("/all-user-orders", adminMiddleware, getAllUserOrders);
// router.get("/:id", adminMiddleware, getOrderById);
// router.post("/", adminMiddleware, createOrder);
// router.put("/:id", adminMiddleware, updateOrder);
// router.delete("/:id", adminMiddleware, deleteOrder);

export { router as orderRoute };
