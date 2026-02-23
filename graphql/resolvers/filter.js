import { createFilterService, removeFilterService, updateFilterService } from "../../services/filter.service.js";
export const filterResolvers = {
    Query: {
        filters: async (_, { filter }, { db, GraphQLError }) => {
            try {
                const conditions = []
                const params = []

                if (filter) {
                    if (filter.id) {
                        conditions.push("id = ?")
                        params.push(filter.id)
                    }
                }

                const whereClause = conditions.length ? `where ${conditions.join(" AND ")}` : ""

                const [rows] = await db.query(`SELECT * FROM filters ${whereClause}`, [...params]);
                return rows;
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
    Filter: {
        values: async (parent, args, { db, GraphQLError, loaders }) => {
            try {
                return loaders.filterValuesByFilterId.load(parent.id);
            } catch (error) {
                console.error("graphy QL error : ", error);
                throw new GraphQLError("Failed to fetch filter values. Please try again later.", {
                    extensions: {
                        code: "DATABASE_ERROR",
                        httpStatusCode: 500
                    }
                });
            }
        }
    },
    Mutation: {
        createFilter: async (_, { input }, { db, GraphQLError }) => {
            try {
                const result = await createFilterService(db, input);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                // fetch the newly created filter to return
                const [rows] = await db.query(`SELECT * FROM filters WHERE id = ?`, [result.filterId]);
                return rows[0];
            } catch (error) {
                console.error("GraphQL createFilter Error:", error);
                throw new GraphQLError(error.message || "Failed to create filter.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        updateFilter: async (_, { input }, { db, GraphQLError }) => {
            try {
                const result = await updateFilterService(db, input);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                // fetch the updated filter to return
                const [rows] = await db.query(`SELECT * FROM filters WHERE id = ?`, [input.id]);
                return rows[0];
            } catch (error) {
                console.error("GraphQL updateFilter Error:", error);
                throw new GraphQLError(error.message || "Failed to update filter.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        },
        deleteFilter: async (_, { input }, { db, GraphQLError }) => {
            try {
                // fetch filter before deletion to return it
                const [filterRows] = await db.query(`SELECT * FROM filters WHERE id = ?`, [input.id]);
                if (!filterRows.length) {
                    throw new Error("Filter not found");
                }

                const result = await removeFilterService(db, input.id);
                if (result.status === 400 || result.status === 404) {
                    throw result;
                }

                return filterRows[0];
            } catch (error) {
                console.error("GraphQL deleteFilter Error:", error);
                throw new GraphQLError(error.message || "Failed to delete filter.", {
                    extensions: {
                        code: error.status === 404 ? "NOT_FOUND" : "DATABASE_ERROR",
                        httpStatusCode: error.status || 500
                    }
                });
            }
        }
    }
}