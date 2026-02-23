import { createProductService, removeProductService, updateProductService } from "../../services/product.service.js";
export const productResolvers = {
    Query: {
        products: async (_, { filter, limit = 20, offset = 0 }, { db, user, GraphQLError }) => {
            try {
                const conditions = [];
                const params = [];
                let sortClause = "ORDER BY id DESC";

                console.log(user)

                if (filter) {
                    if (filter.id) {
                        conditions.push("id = ?");
                        params.push(filter.id);
                    }
                    if (filter.search) {
                        conditions.push("(name LIKE ? OR sku LIKE ? OR category_id LIKE ?)");
                        params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
                    }
                    if (filter.status) {
                        conditions.push("status = ?");
                        params.push(filter.status);
                    }
                    if (filter.category_id) {
                        conditions.push("category_id = ?");
                        params.push(filter.category_id);
                    }
                    if (filter.sort) {
                        const sortMap = {
                            'price_ASC': 'price ASC',
                            'price_DESC': 'price DESC',
                            'created_at_ASC': 'created_at ASC',
                            'created_at_DESC': 'created_at DESC'
                        }
                        if (sortMap[filter.sort]) {
                            sortClause = `ORDER BY ${sortMap[filter.sort]}`;
                        }
                    }
                }

                // Bulk user product visibility filtering
                if (user && user.user_role === 'bulk') {
                    conditions.push("id IN (SELECT productID FROM bulk_user_products WHERE userID = ?)");
                    params.push(user.userID);
                }

                const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

                // 1. Get total count
                const [countRows] = await db.query(`SELECT COUNT(*) as total FROM products ${whereClause}`, params);

                // 2. Get items
                const [items] = await db.query(
                    `SELECT * FROM products ${whereClause} ${sortClause} LIMIT ? OFFSET ?`,
                    [...params, Number(limit), Number(offset)]
                );

                return {
                    total: countRows[0].total,
                    count: items.length,
                    items: items
                };
            } catch (error) {
                console.error("graphy QL error : ", error);
                throw new GraphQLError("Failed to fetch products. Please try again later.", {
                    extensions: {
                        code: "DATABASE_ERROR",
                        httpStatusCode: 500
                    }
                });
            }
        }
    },
    Product: {
        category: async (parent, args, { db, GraphQLError, loaders }) => {
            try {
                if (!parent.category_id) return null;
                return loaders.categoryParent.load(parent.category_id);
            } catch (error) {
                console.error("graphy QL error : ", error);
                throw new GraphQLError("Failed to fetch category. Please try again later.", {
                    extensions: {
                        code: "DATABASE_ERROR",
                        httpStatusCode: 500
                    }
                });
            }
        },
        filterGroups: async (parent, args, { db, GraphQLError, loaders }) => {
            try {
                if (!parent.id) return [];
                const rows = await loaders.productFilterValues.load(parent.id);

                // Grouping logic: many rows -> few groups
                const groupsMap = rows.reduce((acc, row) => {
                    if (!acc[row.filter_id]) {
                        acc[row.filter_id] = { filter_id: row.filter_id, value_ids: [] };
                    }
                    acc[row.filter_id].value_ids.push(row.value_id);
                    return acc;
                }, {});

                return Object.values(groupsMap);
            } catch (error) {
                console.error("GraphQL Product.filterGroups Error:", error);
                throw new GraphQLError("Failed to fetch product filter groups.");
            }
        }
    },
    Mutation: {
        createProduct: async (_, { input }, { db, GraphQLError }) => {
            try {
                const result = await createProductService(db, input);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                // fetch the newly created product to return
                const [rows] = await db.query(`SELECT * FROM products WHERE id = ?`, [result.id]);
                return rows[0];
            } catch (error) {
                console.error("GraphQL createProduct Error:", error);
                throw new GraphQLError(error.message || "Failed to create product.", {
                    extensions: {
                        code: error.status === 400 ? "BAD_REQUEST" : error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        updateProduct: async (_, { input }, { db, GraphQLError }) => {
            try {
                const result = await updateProductService(db, input.id, input);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                // fetch the updated product to return
                const [rows] = await db.query(`SELECT * FROM products WHERE id = ?`, [input.id]);
                return rows[0];
            } catch (error) {
                console.error("GraphQL updateProduct Error:", error);
                throw new GraphQLError(error.message || "Failed to update product.", {
                    extensions: {
                        code: error.status === 400 ? "BAD_REQUEST" : error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        deleteProduct: async (_, { input }, { db, GraphQLError }) => {
            try {
                const result = await removeProductService(db, input.id);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                return "Product deleted successfully";
            } catch (error) {
                console.error("GraphQL deleteProduct Error:", error);
                throw new GraphQLError(error.message || "Failed to delete product.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        }
    }
};