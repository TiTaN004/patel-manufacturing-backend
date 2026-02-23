import { categoryResolvers } from "./resolvers/category.js";
import { filterResolvers } from "./resolvers/filter.js";
import { productResolvers } from "./resolvers/product.js";
import { productFilterValuesResolvers } from "./resolvers/productFilterValues.js";
import { bulkResolvers } from "./resolvers/bulk.js";

export const resolvers = {
    Query: {
        ...productResolvers.Query,
        ...categoryResolvers.Query,
        ...filterResolvers.Query,
        ...productFilterValuesResolvers.Query,
        ...bulkResolvers.Query,
    },
    Product: {
        ...productResolvers.Product
    },
    ProductFilterValue: {
        ...productFilterValuesResolvers.ProductFilterValue
    },
    ProductFilterGroup: {
        ...productFilterValuesResolvers.ProductFilterGroup
    },
    Category: {
        ...categoryResolvers.Category
    },
    Filter: {
        ...filterResolvers.Filter
    },
    Mutation: {
        ...categoryResolvers.Mutation,
        ...productResolvers.Mutation,
        ...filterResolvers.Mutation,
        ...bulkResolvers.Mutation,
    }
};
