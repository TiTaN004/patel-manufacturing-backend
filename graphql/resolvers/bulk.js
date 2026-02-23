import { assignProductsToBulkUserService, getBulkUserProductsService, getBulkOutstandingService, upsertBulkOutstandingService } from "../../services/bulk.service.js";

export const bulkResolvers = {
    Query: {
        bulkUserProducts: async (_, { userID }, { db, GraphQLError }) => {
            try {
                return await getBulkUserProductsService(db, userID);
            } catch (error) {
                console.error("GraphQL bulkUserProducts Error:", error);
                throw new GraphQLError(error.message || "Failed to fetch bulk user products.");
            }
        },
        bulkOutstanding: async (_, { userID }, { db, GraphQLError }) => {
            try {
                return await getBulkOutstandingService(db, userID);
            } catch (error) {
                console.error("GraphQL bulkOutstanding Error:", error);
                throw new GraphQLError(error.message || "Failed to fetch bulk outstanding amount.");
            }
        }
    },
    Mutation: {
        assignProductsToBulkUser: async (_, { input }, { db, GraphQLError }) => {
            try {
                const { userID, productIDs } = input;
                const result = await assignProductsToBulkUserService(db, userID, productIDs);
                return result.message;
            } catch (error) {
                console.error("GraphQL assignProductsToBulkUser Error:", error);
                throw new GraphQLError(error.message || "Failed to assign products to bulk user.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        upsertBulkOutstanding: async (_, { userID, amount }, { db, GraphQLError }) => {
            try {
                return await upsertBulkOutstandingService(db, userID, amount);
            } catch (error) {
                console.error("GraphQL upsertBulkOutstanding Error:", error);
                throw new GraphQLError(error.message || "Failed to upsert bulk outstanding amount.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        }
    }
};
