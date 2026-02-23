export const productFilterValuesResolvers = {
    Query: {
        productFilterValues: async (_, __, { db, GraphQLError }) => {
            try {
                const [rows] = await db.query('SELECT * FROM product_filter_values');
                return rows;
            } catch (error) {
                console.error("GraphQL productFilterValues Error:", error);
                throw new GraphQLError("Failed to fetch product filter values.", {
                    extensions: { code: "DATABASE_ERROR", httpStatusCode: 500 }
                });
            }
        }
    },
    ProductFilterValue: {
        filter: async (parent, _, { loaders, GraphQLError }) => {
            try {
                return loaders.filters.load(parent.filter_id);
            } catch (error) {
                console.error("GraphQL ProductFilterValue.filter Error:", error);
                throw new GraphQLError("Failed to fetch filter.");
            }
        },
        value: async (parent, _, { loaders, GraphQLError }) => {
            try {
                return loaders.filterValues.load(parent.value_id);
            } catch (error) {
                console.error("GraphQL ProductFilterValue.value Error:", error);
                throw new GraphQLError("Failed to fetch filter value.");
            }
        }
    },
    ProductFilterGroup: {
        filter: async (parent, _, { loaders }) => {
            return loaders.filters.load(parent.filter_id);
        },
        values: async (parent, _, { loaders }) => {
            // parent.value_ids is an array, loadMany is perfect here
            return loaders.filterValues.loadMany(parent.value_ids);
        }
    }
};