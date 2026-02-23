import { createCategory, deleteCategory, updateCateService } from "../../services/category.service.js";

export const categoryResolvers = {
    Query: {
        categories: async (_, { filter, limit = 20, offset = 0 }, { db, GraphQLError }) => {
            try {
                const conditions = [];
                const params = [];
                if (filter) {
                    if (filter.parent_id) {
                        conditions.push('parent_id = ?');
                        params.push(filter.parent_id)
                    }
                    if (filter.id) {
                        conditions.push('id = ?');
                        params.push(filter.id)
                    }
                }

                const whereClause = conditions.length ? `where ${conditions.join(' AND ')}` : "";

                // count total
                const [countRows] = await db.query(`SELECT COUNT(*) as total FROM categories ${whereClause}`, params);

                // 2. Get items
                const [items] = await db.query(
                    `SELECT * FROM categories ${whereClause} LIMIT ? OFFSET ?`,
                    [...params, Number(limit), Number(offset)]
                );

                return {
                    total: countRows[0].total,
                    count: items.length,
                    items: items
                };
            } catch (error) {
                console.error("graphy QL error : ", error);
                throw new GraphQLError("Failed to fetch categories. Please try again later.", {
                    extensions: {
                        code: "DATABASE_ERROR",
                        httpStatusCode: 500
                    }
                });
            }
        }
    },
    Category: {
        parent: async (parent, args, { db, GraphQLError, loaders }) => {
            try {
                if (!parent.parent_id) return null;
                return loaders.categoryParent.load(parent.parent_id);
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
        products: async (parent, args, { db, GraphQLError, loaders }) => {
            try {
                return loaders.productsByCategory.load(parent.id);
            } catch (error) {
                console.error("graphy QL error : ", error);
                throw new GraphQLError("Failed to fetch products. Please try again later.", {
                    extensions: {
                        code: "DATABASE_ERROR",
                        httpStatusCode: 500
                    }
                });
            }
        },
        filters: async (parent, args, { db, GraphQLError, loaders }) => {
            try {
                const categoryId = parent.id || parent.category_id;
                return loaders.filtersByCategory.load(categoryId);
            } catch (error) {
                console.error("graphy QL error : ", error);
                throw new GraphQLError("Failed to fetch filters. Please try again later.", {
                    extensions: {
                        code: "DATABASE_ERROR",
                        httpStatusCode: 500
                    }
                });
            }
        },
    },
    Mutation: {
        createCategory: async (_, { input }, { db, user, GraphQLError }) => {
            try {
                // Here we pass the 'input' object directly to our service
                const result = await createCategory(db, input);
                return result;
            } catch (error) {
                console.error("GraphQL createCategory Error:", error);
                throw new GraphQLError(error.message || "Failed to create category.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        deleteCategory: async (_, { input }, { db, user, GraphQLError }) => {
            try {
                const result = await deleteCategory(db, input.id);
                return result;
            } catch (error) {
                console.error("GraphQL deleteCategory Error:", error);
                throw new GraphQLError(error.message || "Failed to delete category.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        updateCategory: async (_, { input }, { db, user, GraphQLError }) => {
            try {
                const result = await updateCateService(db, input);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                // fetch the updated category to return
                const [rows] = await db.query(`SELECT * FROM categories WHERE id = ?`, [input.id]);
                return rows[0];
            } catch (error) {
                console.error("GraphQL updateCategory Error:", error);
                throw new GraphQLError(error.message || "Failed to update category.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        // uploadImage: async (_, { input }, { db, user, GraphQLError }) => {
        //     try {
        //         const result = await uploadImageService(db, input);
        //         return result;
        //     } catch (error) {
        //         console.error("GraphQL uploadImage Error:", error);
        //         throw new GraphQLError(error.message || "Failed to upload image.", {
        //             extensions: {
        //                 code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
        //                 httpStatusCode: error.status || 500
        //             }
        //         });
        //     }
        // }
    }
};