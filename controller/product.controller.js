import { db } from "../db.js";
import { sendSuccess, sendError, sendResponse } from "../utils/response.util.js";
import { catchAsync } from "../utils/error.util.js";
import { createProductService, removeProductService, updateProductService } from "../services/product.service.js";

const TABLE = "products";
const TABLE_FILTER = "filters";
const TABLE_VALUES = "filter_values";
const TABLE_MAP = "category_filters";


export const getAll = catchAsync(async (req, res, next) => {
  const { category_id, status, stock_status, search, limit = 20, offset = 0 } = req.query;

  const conditions = [];
  const params = [];

  if (category_id) {
    conditions.push("p.category_id = ?");
    params.push(category_id);
  }
  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }
  if (stock_status) {
    conditions.push("p.stock_status = ?");
    params.push(stock_status);
  }
  if (search) {
    conditions.push("(p.name LIKE ? OR p.sku LIKE ?)");
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal);
  }

  // Bulk user product visibility filtering
  if (req.user && req.user.user_role === 'bulk') {
    conditions.push("p.id IN (SELECT productID FROM bulk_user_products WHERE userID = ?)");
    params.push(req.user.userID);
  }


  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // 1. Get total count
  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM products p ${whereClause}`,
    params
  );
  const totalCount = countRows[0].total;

  // 2. Get distinct IDs for current page
  const [idRows] = await db.query(
    `SELECT p.id FROM products p ${whereClause} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  const ids = idRows.map(r => r.id);

  if (ids.length === 0) {
    return sendSuccess(res, "Pagination successful (empty)", [], 1, {
      total: totalCount,
      count: 0
    });
  }

  // 3. Get full details for these IDs
  const [rows] = await db.query(
    `
      SELECT
        p.id AS product_id, p.name, p.slug, p.sku, p.price, p.status, p.stock_quantity,
        p.stock_status, p.description, p.primary_image, p.images, p.stock_threshold,
        p.selling_price, p.care_instructions, p.warrenty_period, p.dimension, p.weight, p.created_at,
        c.id AS category_id, c.name AS category_name, c.path AS category_path, c.level AS category_level,
        f.id AS filter_id, f.code AS filter_code, f.name AS filter_name,
        fv.id AS value_id, fv.value
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_filter_values pfv ON pfv.product_id = p.id
      LEFT JOIN filters f ON f.id = pfv.filter_id
      LEFT JOIN filter_values fv ON fv.id = pfv.value_id
      WHERE p.id IN (?)
      ORDER BY p.id DESC, f.id, fv.sort_order
      `,
    [ids]
  );

  // 4. Group results
  const productsMap = {};
  for (const row of rows) {
    if (!productsMap[row.product_id]) {
      productsMap[row.product_id] = {
        id: row.product_id,
        name: row.name,
        slug: row.slug,
        sku: row.sku,
        price: row.price,
        status: row.status,
        stock_quantity: row.stock_quantity,
        stock_status: row.stock_status,
        description: row.description,
        primary_image: row.primary_image,
        images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : null,
        stock_threshold: row.stock_threshold,
        selling_price: row.selling_price,
        care_instructions: row.care_instructions,
        warrenty_period: row.warrenty_period,
        dimension: row.dimension,
        weight: row.weight,
        created_at: row.created_at,
        category: {
          id: row.category_id,
          name: row.category_name,
          path: row.category_path,
          level: row.category_level
        },
        filters: {}
      };
    }

    if (row.filter_id) {
      if (!productsMap[row.product_id].filters[row.filter_id]) {
        productsMap[row.product_id].filters[row.filter_id] = {
          filter_id: row.filter_id,
          code: row.filter_code,
          name: row.filter_name,
          values: []
        };
      }
      productsMap[row.product_id].filters[row.filter_id].values.push({
        value_id: row.value_id,
        value: row.value
      });
    }
  }

  const products = Object.values(productsMap).map(p => ({
    ...p,
    filters: Object.values(p.filters)
  }));

  return sendSuccess(res, "Products fetched successfully", products, 1, {
    total: totalCount,
    count: products.length
  });
});

export const create = catchAsync(async (req, res, next) => {
  const {
    category_id,
    sku,
    name,
    slug,
    price,
    status = "draft",
    stock_quantity = 0,
    stock_status = "in_stock",
    description = null,
    primary_image = null,
    images = null,
    stock_threshold = 0,
    selling_price = 0,
    care_instructions = null,
    warrenty_period = null,
    dimension = null,
    weight = null,
    filters = []
  } = req.body;

  // Validation
  // if (!category_id || !name || !slug || price == null) {
  //   return sendError(res, 400, "Missing required fields: category_id, name, slug, price");
  // }

  // if (!Array.isArray(filters)) {
  //   return sendError(res, 400, "filters must be an array");
  // }

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   // 1. Validate category
  //   const [categories] = await conn.query(
  //     `SELECT id FROM categories WHERE id = ?`,
  //     [category_id]
  //   );

  //   if (!categories.length) {
  //     await conn.rollback();
  //     return sendError(res, 400, "Invalid category");
  //   }

  //   // 2. Prepare images JSON
  //   const imagesJson = images ? JSON.stringify(images) : null;

  //   // 3. Insert product with new fields
  //   const [productResult] = await conn.query(
  //     `
  //     INSERT INTO products
  //     (category_id, sku, name, slug, price, status, stock_quantity, stock_status, description, primary_image, images, stock_threshold, selling_price, care_instructions, warrenty_period, dimension, weight)
  //     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  //     `,
  //     [
  //       category_id,
  //       sku,
  //       name,
  //       slug,
  //       price,
  //       status,
  //       stock_quantity,
  //       stock_status,
  //       description,
  //       primary_image,
  //       imagesJson,
  //       stock_threshold,
  //       selling_price,
  //       care_instructions,
  //       warrenty_period,
  //       dimension,
  //       weight
  //     ]
  //   );

  //   const productId = productResult.insertId;

  //   // 4. Insert filter values
  //   if (filters.length > 0) {
  //     for (const filter of filters) {
  //       const { filter_id, value_ids } = filter;

  //       if (!filter_id || !Array.isArray(value_ids) || !value_ids.length) {
  //         await conn.rollback();
  //         return sendError(res, 400, "Invalid filter format");
  //       }

  //       // Validate values belong to filter
  //       const [validValues] = await conn.query(
  //         `
  //         SELECT id
  //         FROM filter_values
  //         WHERE filter_id = ? AND id IN (?)
  //         `,
  //         [filter_id, value_ids]
  //       );

  //       if (validValues.length !== value_ids.length) {
  //         await conn.rollback();
  //         return sendError(res, 400, `One or more values do not belong to filter ${filter_id}`);
  //       }

  //       // Bulk insert mappings
  //       const rows = value_ids.map(value_id => [
  //         productId,
  //         filter_id,
  //         value_id
  //       ]);

  //       await conn.query(
  //         `
  //         INSERT INTO product_filter_values
  //         (product_id, filter_id, value_id)
  //         VALUES ?
  //         `,
  //         [rows]
  //       );
  //     }
  //   }

  //   await conn.commit();

  const result = await createProductService(db, {
    category_id,
    sku,
    name,
    slug,
    price,
    status,
    stock_quantity,
    stock_status,
    description,
    primary_image,
    images,
    stock_threshold,
    selling_price,
    care_instructions,
    warrenty_period,
    dimension,
    weight,
    filters
  });

  return sendSuccess(res, result.message, { id: result.id }, 1);

});

export const getById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // 1. Get product with new fields
  const [products] = await db.query(
    `
    SELECT 
      p.*,
      c.name AS category_name,
      c.path AS category_path,
      c.level AS category_level
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
    `,
    [id]
  );

  if (!products.length) {
    return sendError(res, 404, "Product not found");
  }

  const product = products[0];

  // Parse images JSON if it exists
  if (product.images) {
    product.images = typeof product.images === 'string'
      ? JSON.parse(product.images)
      : product.images;
  }

  // 2. Get filters + values
  const [rows] = await db.query(
    `
    SELECT
      f.id AS filter_id,
      f.code,
      f.name AS filter_name,
      fv.id AS value_id,
      fv.value
    FROM product_filter_values pfv
    JOIN filters f ON f.id = pfv.filter_id
    JOIN filter_values fv ON fv.id = pfv.value_id
    WHERE pfv.product_id = ?
    ORDER BY f.id, fv.sort_order
    `,
    [id]
  );

  // 3. Group filters
  const filtersMap = {};

  for (const row of rows) {
    if (!filtersMap[row.filter_id]) {
      filtersMap[row.filter_id] = {
        filter_id: row.filter_id,
        code: row.code,
        name: row.filter_name,
        values: []
      };
    }

    filtersMap[row.filter_id].values.push({
      value_id: row.value_id,
      value: row.value
    });
  }

  return sendSuccess(res, "Product fetched successfully", {
    ...product,
    filters: Object.values(filtersMap)
  });
});

export const update = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    category_id,
    sku,
    name,
    slug,
    price,
    status,
    stock_quantity,
    stock_status,
    description,
    primary_image,
    images,
    stock_threshold,
    selling_price,
    care_instructions,
    warrenty_period,
    dimension,
    weight,
    filters
  } = req.body;

  // const conn = await db.getConnection();

  // try {
  //   await conn.beginTransaction();

  //   // 1. Check product exists
  //   const [products] = await conn.query(
  //     `SELECT id FROM products WHERE id = ?`,
  //     [id]
  //   );

  //   if (!products.length) {
  //     await conn.rollback();
  //     return sendError(res, 404, "Product not found");
  //   }

  //   // 2. Validate category if provided
  //   if (category_id) {
  //     const [categories] = await conn.query(
  //       `SELECT id FROM categories WHERE id = ?`,
  //       [category_id]
  //     );

  //     if (!categories.length) {
  //       await conn.rollback();
  //       return sendError(res, 400, "Invalid category");
  //     }
  //   }

  //   // 3. Prepare images JSON
  //   const imagesJson = images ? JSON.stringify(images) : null;

  //   // 4. Build dynamic UPDATE query
  //   const updates = [];
  //   const values = [];

  //   if (category_id !== undefined) { updates.push("category_id = ?"); values.push(category_id); }
  //   if (sku !== undefined) { updates.push("sku = ?"); values.push(sku); }
  //   if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  //   if (slug !== undefined) { updates.push("slug = ?"); values.push(slug); }
  //   if (price !== undefined) { updates.push("price = ?"); values.push(price); }
  //   if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  //   if (stock_quantity !== undefined) { updates.push("stock_quantity = ?"); values.push(stock_quantity); }
  //   if (stock_status !== undefined) { updates.push("stock_status = ?"); values.push(stock_status); }
  //   if (description !== undefined) { updates.push("description = ?"); values.push(description); }
  //   if (primary_image !== undefined) { updates.push("primary_image = ?"); values.push(primary_image); }
  //   if (images !== undefined) { updates.push("images = ?"); values.push(imagesJson); }
  //   if (stock_threshold !== undefined) { updates.push("stock_threshold = ?"); values.push(stock_threshold); }
  //   if (selling_price !== undefined) { updates.push("selling_price = ?"); values.push(selling_price); }
  //   if (care_instructions !== undefined) { updates.push("care_instructions = ?"); values.push(care_instructions); }
  //   if (warrenty_period !== undefined) { updates.push("warrenty_period = ?"); values.push(warrenty_period); }
  //   if (dimension !== undefined) { updates.push("dimension = ?"); values.push(dimension); }
  //   if (weight !== undefined) { updates.push("weight = ?"); values.push(weight); }

  //   if (updates.length > 0) {
  //     values.push(id);
  //     await conn.query(
  //       `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
  //       values
  //     );
  //   }

  //   // 5. Update filters if provided
  //   if (Array.isArray(filters)) {
  //     // Remove existing filters
  //     await conn.query(
  //       `DELETE FROM product_filter_values WHERE product_id = ?`,
  //       [id]
  //     );

  //     // Insert new filters
  //     for (const filter of filters) {
  //       const { filter_id, value_ids } = filter;

  //       if (!filter_id || !Array.isArray(value_ids) || value_ids.length === 0) {
  //         continue; // Skip invalid filters
  //       }

  //       // Validate values
  //       const [validValues] = await conn.query(
  //         `
  //         SELECT id FROM filter_values
  //         WHERE filter_id = ? AND id IN (?)
  //         `,
  //         [filter_id, value_ids]
  //       );

  //       if (validValues.length !== value_ids.length) {
  //         await conn.rollback();
  //         return sendError(res, 400, `Invalid values for filter ${filter_id}`);
  //       }

  //       const rows = value_ids.map(value_id => [id, filter_id, value_id]);

  //       await conn.query(
  //         `
  //         INSERT INTO product_filter_values
  //         (product_id, filter_id, value_id)
  //         VALUES ?
  //         `,
  //         [rows]
  //       );
  //     }
  //   }

  //   await conn.commit();

  const result = await updateProductService(db, id, {
    category_id,
    sku,
    name,
    slug,
    price,
    status,
    stock_quantity,
    stock_status,
    description,
    primary_image,
    images,
    stock_threshold,
    selling_price,
    care_instructions,
    warrenty_period,
    dimension,
    weight,
    filters
  })

  return sendSuccess(res, result.message);

});

export const remove = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // const conn = await db.getConnection();

  try {
    // await conn.beginTransaction();

    // // 1. Check if product exists
    // const [products] = await conn.query(
    //   `SELECT * FROM ${TABLE} WHERE id = ?`,
    //   [id]
    // );

    // if (!products.length) {
    //   await conn.rollback();
    //   return sendError(res, 404, "Product not found");
    // }

    // // 2. Delete associated filter values
    // await conn.query(
    //   `DELETE FROM product_filter_values WHERE product_id = ?`,
    //   [id]
    // );

    // // 3. Delete product
    // await conn.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);

    // await conn.commit();

    const result = await removeProductService(db, id)

    return sendSuccess(res, result.message);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

export const getBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, c.path AS category_path
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.slug = ?`,
    [slug]
  );

  if (rows.length === 0) {
    return sendError(res, 404, "Product not found");
  }

  const product = rows[0];

  // Fetch filters
  const [filters] = await db.query(
    `SELECT f.id as filter_id, f.code, f.name as filter_name, fv.id as value_id, fv.value
     FROM product_filter_values pfv
     JOIN filters f ON pfv.filter_id = f.id
     JOIN filter_values fv ON pfv.value_id = fv.id
     WHERE pfv.product_id = ?`,
    [product.id]
  );

  const filtersMap = {};
  filters.forEach(row => {
    if (!filtersMap[row.filter_id]) {
      filtersMap[row.filter_id] = {
        filter_id: row.filter_id,
        code: row.code,
        name: row.filter_name,
        values: []
      };
    }
    filtersMap[row.filter_id].values.push({
      value_id: row.value_id,
      value: row.value
    });
  });

  return sendSuccess(res, "Product fetched successfully", {
    ...product,
    images: product.images ? JSON.parse(product.images) : null,
    filters: Object.values(filtersMap)
  });
});

export const checkSlug = catchAsync(async (req, res, next) => {
  const { slug, exclude_id } = req.query;

  if (!slug) {
    return sendError(res, 400, "Slug is required");
  }

  let sql = "SELECT COUNT(*) as total FROM products WHERE slug = ?";
  const params = [slug];

  if (exclude_id) {
    sql += " AND id != ?";
    params.push(exclude_id);
  }

  const [rows] = await db.query(sql, params);
  const count = parseInt(rows[0].total);

  return sendSuccess(res, "Slug check complete", { exists: count > 0 });
});

export const getStoreProducts = catchAsync(async (req, res, next) => {
  const { category_id, search, limit = 20, offset = 0 } = req.query;

  const conditions = ["p.status = 'active'"];
  const params = [];

  if (category_id) {
    conditions.push("p.category_id = ?");
    params.push(category_id);
  }
  if (search) {
    conditions.push("(p.name LIKE ? OR p.sku LIKE ?)");
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal);
  }

  // Bulk user product visibility filtering
  if (req.user && req.user.user_role === 'bulk') {
    conditions.push("p.id IN (SELECT productID FROM bulk_user_products WHERE userID = ?)");
    params.push(req.user.userID);
  }

  const whereClause = "WHERE " + conditions.join(" AND ");

  // 1. Get total count
  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM products p ${whereClause}`,
    params
  );
  const totalCount = countRows[0].total;

  // 2. Get IDs for pagination
  const [idRows] = await db.query(
    `SELECT p.id FROM products p ${whereClause} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  if (idRows.length === 0) {
    return sendSuccess(res, "Pagination successful (empty)", [], 1, {
      total: totalCount,
      count: 0
    });
  }

  const ids = idRows.map(r => r.id);

  // 3. Get full details
  const [rows] = await db.query(
    `SELECT
          p.id AS product_id, p.name, p.slug, p.sku, p.price, p.status, p.stock_quantity,
          p.stock_status, p.description, p.primary_image, p.images, p.stock_threshold,
          p.selling_price, p.care_instructions, p.warrenty_period, p.dimension, p.weight, p.created_at,
          c.id AS category_id, c.name AS category_name, c.path AS category_path, c.level AS category_level,
          f.id AS filter_id, f.code AS filter_code, f.name AS filter_name,
          fv.id AS value_id, fv.value
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_filter_values pfv ON pfv.product_id = p.id
      LEFT JOIN filters f ON f.id = pfv.filter_id
      LEFT JOIN filter_values fv ON fv.id = pfv.value_id
      WHERE p.id IN (?)
      ORDER BY p.id DESC, f.id, fv.sort_order`,
    [ids]
  );

  const productsMap = {};
  rows.forEach(row => {
    const pid = row.product_id;
    if (!productsMap[pid]) {
      productsMap[pid] = {
        id: pid,
        name: row.name,
        slug: row.slug,
        sku: row.sku,
        price: row.price,
        status: row.status,
        stock_quantity: row.stock_quantity,
        stock_status: row.stock_status,
        description: row.description,
        primary_image: row.primary_image,
        images: row.images ? JSON.parse(row.images) : null,
        stock_threshold: row.stock_threshold,
        selling_price: row.selling_price,
        care_instructions: row.care_instructions,
        warrenty_period: row.warrenty_period,
        dimension: row.dimension,
        weight: row.weight,
        created_at: row.created_at,
        category: {
          id: row.category_id,
          name: row.category_name,
          path: row.category_path,
          level: row.category_level
        },
        filters: {}
      };
    }

    if (row.filter_id) {
      const fid = row.filter_id;
      if (!productsMap[pid].filters[fid]) {
        productsMap[pid].filters[fid] = {
          filter_id: fid,
          code: row.filter_code,
          name: row.filter_name,
          values: []
        };
      }
      productsMap[pid].filters[fid].values.push({
        value_id: row.value_id,
        value: row.value
      });
    }
  });

  const products = Object.values(productsMap).map(p => {
    p.filters = Object.values(p.filters);
    return p;
  });

  return sendSuccess(res, "Store products fetched successfully", products, 1, {
    total: totalCount,
    count: products.length
  });
});
