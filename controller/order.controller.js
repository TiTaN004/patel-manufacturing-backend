import { db } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendOrderConfirmation } from "../utils/email.service.js";
import { sendSuccess, sendError } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import { notificationService } from "../services/notification.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");

// Validation helper functions
const isValidIndianMobile = (mobile) => /^[6-9]\d{9}$/.test(mobile);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const createOrder = catchAsync(async (req, res, next) => {
  const {
    invoice_number,
    invoice_url,
    total_amount,
    payment_mode,
    payment_status = "paid",
    order_status = "completed",
    customer_name,
    customer_mobile,
    customer_email,
    customer_address,
    customer_city,
    customer_state,
    customer_zipcode,
    items,
    coupon_code,
    discount_amount = 0,
    shipping_fee = 0,
    subtotal
  } = req.body;

  if (!invoice_number || !customer_name || !customer_mobile || !customer_address || !items || !items.length) {
    return sendError(res, 400, "Missing required fields: invoice_number, customer details, or items");
  }

  if (!isValidIndianMobile(customer_mobile)) {
    return sendError(res, 400, "Invalid Indian mobile number. It must be 10 digits and start with 6-9.");
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    let customerId;
    const [existingCustomers] = await conn.query("SELECT id FROM customers WHERE mobile = ?", [customer_mobile]);

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      await conn.query(
        "UPDATE customers SET name = ?, email = ?, address = ?, city = ?, state = ?, zipcode = ? WHERE id = ?",
        [customer_name, customer_email || null, customer_address, customer_city || null, customer_state || null, customer_zipcode || null, customerId]
      );
    } else {
      const [customerResult] = await conn.query(
        "INSERT INTO customers (name, mobile, email, address, city, state, zipcode) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [customer_name, customer_mobile, customer_email || null, customer_address, customer_city || null, customer_state || null, customer_zipcode || null]
      );
      customerId = customerResult.insertId;
    }

    const [orderResult] = await conn.query(
      `INSERT INTO orders (invoice_number, invoice_url, customer_id, total_amount, payment_mode, payment_status, order_status, coupon_code, discount_amount, shipping_fee, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_number, invoice_url || null, customerId, total_amount, payment_mode, payment_status, order_status, coupon_code || null, discount_amount, shipping_fee, subtotal || total_amount]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      const { product_id, product_name, unit_price, quantity, selected_filters } = item;
      const total_price = unit_price * quantity;
      const filters = selected_filters ? (typeof selected_filters === 'object' ? JSON.stringify(selected_filters) : selected_filters) : null;

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price, selected_filters)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, product_id, product_name, unit_price, quantity, total_price, filters]
      );

      await conn.query("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [quantity, product_id]);
    }

    await conn.commit();
    return sendSuccess(res, "Order created successfully", {
      orderId: orderId,
      customerId: customerId
    });

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

export const getAllOrders = catchAsync(async (req, res, next) => {
  const { limit = 20, offset = 0, search = null } = req.query;
  const params = [];
  let whereClause = "";

  if (search) {
    whereClause = "WHERE (o.invoice_number LIKE ? OR c.name LIKE ? OR c.mobile LIKE ? OR c.address LIKE ?)";
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal, searchVal, searchVal);
  }

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM orders o JOIN customers c ON o.customer_id = c.id ${whereClause}`,
    params
  );
  const totalCount = countRows[0].total;

  const [orders] = await db.query(
    `SELECT o.*, c.name as customer_name, c.email as customer_email, c.address as customer_address, c.mobile as customer_mobile 
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    const [items] = await db.query(
      `SELECT oi.*, p.sku, p.primary_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    const itemsByOrder = items.reduce((acc, item) => {
      if (item.selected_filters) {
        try { item.selected_filters = JSON.parse(item.selected_filters); } catch (e) { }
      }
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});

    orders.forEach(order => {
      order.items = itemsByOrder[order.id] || [];
    });
  }

  return sendSuccess(res, "Orders fetched successfully", orders, 1, {
    total: totalCount,
    count: orders.length
  });
});

export const getOrderById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const [orders] = await db.query(
    `SELECT o.*, c.name as customer_name, c.mobile as customer_phone, c.email as customer_email, c.address as customer_address
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE o.id = ?`,
    [id]
  );

  if (orders.length === 0) {
    return sendError(res, 404, "Order not found");
  }

  const order = orders[0];
  const [items] = await db.query(
    `SELECT oi.*, p.sku, p.primary_image
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [id]
  );

  order.items = items.map(item => {
    if (item.selected_filters) {
      try { item.selected_filters = JSON.parse(item.selected_filters); } catch (e) { }
    }
    return item;
  });

  return sendSuccess(res, "Order fetched successfully", order);
});

export const updateOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const data = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [existingOrders] = await conn.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (existingOrders.length === 0) {
      await conn.rollback();
      return sendError(res, 404, "Order not found");
    }

    const existingOrder = existingOrders[0];
    let customerId = existingOrder.customer_id;

    if (data.customer_mobile) {
      const [existingCustomers] = await conn.query("SELECT id FROM customers WHERE mobile = ?", [data.customer_mobile]);
      if (existingCustomers.length > 0) {
        customerId = existingCustomers[0].id;
        const cUpdates = [];
        const cParams = [];
        if (data.customer_name) { cUpdates.push("name = ?"); cParams.push(data.customer_name); }
        if (data.customer_email !== undefined) { cUpdates.push("email = ?"); cParams.push(data.customer_email); }
        if (data.customer_address) { cUpdates.push("address = ?"); cParams.push(data.customer_address); }
        if (cUpdates.length > 0) {
          cParams.push(customerId);
          await conn.query(`UPDATE customers SET ${cUpdates.join(", ")} WHERE id = ?`, cParams);
        }
      } else {
        if (data.customer_name && data.customer_address) {
          const [result] = await conn.query(
            "INSERT INTO customers (name, mobile, email, address) VALUES (?, ?, ?, ?)",
            [data.customer_name, data.customer_mobile, data.customer_email || null, data.customer_address]
          );
          customerId = result.insertId;
        } else {
          await conn.rollback();
          return sendError(res, 400, "Customer mobile not found. Name and address are required to create a new customer.");
        }
      }
    } else if (data.customer_name || data.customer_email !== undefined || data.customer_address) {
      const cUpdates = [];
      const cParams = [];
      if (data.customer_name) { cUpdates.push("name = ?"); cParams.push(data.customer_name); }
      if (data.customer_email !== undefined) { cUpdates.push("email = ?"); cParams.push(data.customer_email); }
      if (data.customer_address) { cUpdates.push("address = ?"); cParams.push(data.customer_address); }
      if (cUpdates.length > 0) {
        cParams.push(existingOrder.customer_id);
        await conn.query(`UPDATE customers SET ${cUpdates.join(", ")} WHERE id = ?`, cParams);
      }
    }

    const orderFields = ['invoice_number', 'invoice_url', 'total_amount', 'payment_mode', 'payment_status', 'order_status', 'coupon_code', 'discount_amount', 'shipping_fee', 'subtotal'];
    const oUpdates = [];
    const oParams = [];
    for (const field of orderFields) {
      if (data[field] !== undefined) { oUpdates.push(`${field} = ?`); oParams.push(data[field]); }
    }
    if (customerId != existingOrder.customer_id) { oUpdates.push("customer_id = ?"); oParams.push(customerId); }

    if (oUpdates.length > 0) {
      oParams.push(id);
      await conn.query(`UPDATE orders SET ${oUpdates.join(", ")} WHERE id = ?`, oParams);
    }

    if (data.items && Array.isArray(data.items)) {
      const [existingItems] = await conn.query("SELECT * FROM order_items WHERE order_id = ?", [id]);
      const existingItemsMap = existingItems.reduce((acc, item) => { acc[item.product_id] = item; return acc; }, {});
      const newItemProductIds = new Set();

      for (const item of data.items) {
        const { product_id, product_name, unit_price, quantity, selected_filters } = item;
        const total_price = unit_price * quantity;
        const filters = selected_filters ? (typeof selected_filters === 'object' ? JSON.stringify(selected_filters) : selected_filters) : null;
        newItemProductIds.add(product_id);

        if (existingItemsMap[product_id]) {
          const diff = quantity - existingItemsMap[product_id].quantity;
          await conn.query("UPDATE order_items SET product_name = ?, unit_price = ?, quantity = ?, total_price = ?, selected_filters = ? WHERE order_id = ? AND product_id = ?", [product_name, unit_price, quantity, total_price, filters, id, product_id]);
          await conn.query("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [diff, product_id]);
        } else {
          await conn.query("INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price, selected_filters) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, product_id, product_name, unit_price, quantity, total_price, filters]);
          await conn.query("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [quantity, product_id]);
        }
      }

      for (const eItem of existingItems) {
        if (!newItemProductIds.has(eItem.product_id)) {
          await conn.query("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [eItem.quantity, eItem.product_id]);
          await conn.query("DELETE FROM order_items WHERE order_id = ? AND product_id = ?", [id, eItem.product_id]);
        }
      }
    }

    await conn.commit();
    return sendSuccess(res, "Order updated successfully");
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

export const deleteOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const restoreStock = req.query.restore_stock === 'true';
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const [orders] = await conn.query("SELECT invoice_url FROM orders WHERE id = ?", [id]);
    if (orders.length === 0) {
      await conn.rollback();
      return sendError(res, 404, "Order not found");
    }
    const invoiceUrl = orders[0].invoice_url;

    if (restoreStock) {
      const [items] = await conn.query("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [id]);
      for (const item of items) {
        await conn.query("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [item.quantity, item.product_id]);
      }
    }

    await conn.query("DELETE FROM order_items WHERE order_id = ?", [id]);
    await conn.query("DELETE FROM orders WHERE id = ?", [id]);
    await conn.commit();

    if (invoiceUrl) {
      const filePath = path.join(uploadsDir, invoiceUrl.replace(/^\/uploads\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    return sendSuccess(res, "Order and associated invoice deleted successfully");
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

export const checkout = catchAsync(async (req, res, next) => {
  const userId = req.user.userID;
  const data = req.body;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const [cartItems] = await conn.query("SELECT ci.*, p.name as product_name, p.selling_price as unit_price FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.user_id = ?", [userId]);
    if (cartItems.length === 0) {
      await conn.rollback();
      return sendError(res, 400, "Cart is empty");
    }

    const [users] = await conn.query("SELECT * FROM user WHERE userID = ?", [userId]);
    const user = users[0];
    let customerId;
    const [customers] = await conn.query("SELECT id FROM customers WHERE mobile = ?", [user.mobileNo]);

    if (customers.length > 0) {
      customerId = customers[0].id;
      await conn.query("UPDATE customers SET name = ?, email = ?, address = ?, city = ?, state = ?, zipcode = ? WHERE id = ?", [user.fullName, user.emailID, user.address || '', user.city || null, user.state || null, user.zipcode || null, customerId]);
    } else {
      const [result] = await conn.query("INSERT INTO customers (name, mobile, email, address, city, state, zipcode) VALUES (?, ?, ?, ?, ?, ?, ?)", [user.fullName, user.mobileNo, user.emailID, user.address || '', user.city || null, user.state || null, user.zipcode || null]);
      customerId = result.insertId;
    }

    let subtotal = 0;
    for (const item of cartItems) subtotal += item.unit_price * item.quantity;
    const totalAmount = subtotal - (data.discount_amount || 0) + (data.shipping_fee || 0);
    const invoiceNumber = `INV-${Date.now()}-${userId}`;

    const [orderResult] = await conn.query("INSERT INTO user_orders (invoice_number, user_id, customer_id, total_amount, payment_mode, payment_status, order_status, coupon_code, discount_amount, shipping_fee, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [invoiceNumber, userId, customerId, totalAmount, data.payment_mode || 'cash', 'pending', 'completed', data.coupon_code || null, data.discount_amount || 0, data.shipping_fee || 0, subtotal]);
    const orderId = orderResult.insertId;

    let orderSummaryText = `New Order: ${invoiceNumber}\nSubtotal: ${subtotal}\n`;
    if (data.discount_amount > 0) orderSummaryText += `Discount: -${data.discount_amount} (${data.coupon_code})\n`;
    if (data.shipping_fee > 0) orderSummaryText += `Shipping: +${data.shipping_fee}\n`;
    orderSummaryText += `Total: ${totalAmount}\n\nItems:\n`;

    for (const item of cartItems) {
      await conn.query("INSERT INTO user_order_items (order_id, product_id, product_name, unit_price, quantity, total_price, selected_filters) VALUES (?, ?, ?, ?, ?, ?, ?)", [orderId, item.product_id, item.product_name, item.unit_price, item.quantity, item.unit_price * item.quantity, item.selected_filters]);
      await conn.query("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [item.quantity, item.product_id]);

      const filters = item.selected_filters ? JSON.parse(item.selected_filters) : {};
      let filterText = "";
      for (const [k, v] of Object.entries(filters)) filterText += ` (${k}: ${v})`;
      orderSummaryText += `- ${item.product_name}${filterText} x ${item.quantity} = ${item.unit_price * item.quantity}\n`;
    }

    if (data.coupon_code) await conn.query("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?", [data.coupon_code]);
    await conn.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);

    await conn.commit();

    // Notify Admins about new retail order with Party name, Item names and Qties
    try {
      const itemString = cartItems.map(item => `${item.product_name} (${item.quantity})`).join(", ");
      const messageBody = `Party: ${user.fullName}\nItems: ${itemString}`;

      const [admins] = await conn.query("SELECT userID FROM user WHERE isAdmin = 1");
      for (const admin of admins) {
        await notificationService.sendNotification({
          userId: admin.userID,
          title: "New Retail Order",
          message: messageBody,
          type: "order",
          referenceId: orderId,
          pushOnly: true
        });
      }
    } catch (notifyError) {
      console.error("Failed to notify admins about new order:", notifyError);
    }

    await sendOrderConfirmation(user.emailID, user.fullName, { invoice_number: invoiceNumber, total_amount: totalAmount, items: cartItems, subtotal, discount_amount: data.discount_amount, shipping_fee: data.shipping_fee, coupon_code: data.coupon_code });

    const whatsappPhone = '919876543210';
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(orderSummaryText)}`;

    return sendSuccess(res, "Order placed successfully", { orderId, invoice_number: invoiceNumber, whatsappUrl });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

export const getAllUserOrders = catchAsync(async (req, res, next) => {
  const { limit = 20, offset = 0, search = null, user_type = null } = req.query;
  const params = [];
  let conditions = [];

  if (search) {
    conditions.push("(o.invoice_number LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (user_type && user_type !== 'both') {
    conditions.push("u.user_role = ?");
    params.push(user_type);
  }

  let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await db.query(`SELECT COUNT(*) as total FROM user_orders o JOIN customers c ON o.customer_id = c.id JOIN user u ON o.user_id = u.userID ${whereClause}`, params);
  const totalCount = rows[0].total;

  const [orders] = await db.query(`SELECT o.*, c.name as customer_name, c.mobile as customer_phone, c.email as customer_email, c.address, c.city, c.state, c.zipcode, u.user_role 
        FROM user_orders o 
        JOIN customers c ON o.customer_id = c.id 
        JOIN user u ON o.user_id = u.userID
        ${whereClause} 
        ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);

  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    const [allItems] = await db.query(`SELECT oi.*, p.sku, p.primary_image FROM user_order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id IN (?)`, [orderIds]);
    const itemsByOrder = allItems.reduce((acc, item) => {
      if (item.selected_filters) { try { item.selected_filters = JSON.parse(item.selected_filters); } catch (e) { } }
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});
    orders.forEach(o => o.items = itemsByOrder[o.id] || []);
  }

  return sendSuccess(res, "User orders fetched successfully", orders, 1, { total: totalCount, count: orders.length });
});

export const getUserHistory = catchAsync(async (req, res, next) => {
  const userId = req.user.userID;
  const [orders] = await db.query(`SELECT o.*, c.name as customer_name, c.mobile as customer_phone, c.email as customer_email, c.address, c.city, c.state, c.zipcode FROM user_orders o JOIN customers c ON o.customer_id = c.id WHERE o.user_id = ? ORDER BY created_at DESC`, [userId]);
  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    const [allItems] = await db.query(`SELECT oi.*, p.sku, p.primary_image FROM user_order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id IN (?)`, [orderIds]);
    const itemsByOrder = allItems.reduce((acc, item) => {
      if (item.selected_filters) { try { item.selected_filters = JSON.parse(item.selected_filters); } catch (e) { } }
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push(item);
      return acc;
    }, {});
    orders.forEach(o => o.items = itemsByOrder[o.id] || []);
  }
  return sendSuccess(res, "User history fetched successfully", orders, 1, { count: orders.length });
});

export const deleteUserOrder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const restoreStock = req.query.restore_stock === 'true';
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query("SELECT id FROM user_orders WHERE id = ?", [id]);
    if (orders.length === 0) { await conn.rollback(); return sendError(res, 404, "Order not found"); }
    if (restoreStock) {
      const [items] = await conn.query("SELECT product_id, quantity FROM user_order_items WHERE order_id = ?", [id]);
      for (const item of items) await conn.query("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [item.quantity, item.product_id]);
    }
    await conn.query("DELETE FROM user_order_items WHERE order_id = ?", [id]);
    await conn.query("DELETE FROM user_orders WHERE id = ?", [id]);
    await conn.commit();
    return sendSuccess(res, "User order deleted successfully");
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

export const getUserOrderById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const [orders] = await db.query(
    `SELECT o.*, c.name as customer_name, c.mobile as customer_phone, c.email as customer_email, c.address, c.city, c.state, c.zipcode 
     FROM user_orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE o.id = ?`,
    [id]
  );

  if (orders.length === 0) {
    return sendError(res, 404, "Order not found");
  }

  const order = orders[0];
  const [items] = await db.query(
    `SELECT oi.*, p.sku, p.primary_image
     FROM user_order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [id]
  );

  order.items = items.map(item => {
    if (item.selected_filters) {
      try { item.selected_filters = JSON.parse(item.selected_filters); } catch (e) { }
    }
    return item;
  });

  return sendSuccess(res, "User order fetched successfully", order);
});
