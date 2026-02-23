import DataLoader from "dataloader";

export const createDataLoader = (db) => {
    return {
        // categories loaders
        productsByCategory: new DataLoader(async (categoryIds) => {
            const [rows] = await db.query(
                'SELECT * FROM products WHERE category_id IN (?)',
                [categoryIds]
            );
            return categoryIds.map((categoryId) => {
                return rows.filter((row) => row.category_id === Number(categoryId));
            });
        }),
        filtersByCategory: new DataLoader(async (categoryIds) => {
            const [rows] = await db.query(
                'SELECT f.*, pfv.product_id as category_id FROM filters f JOIN product_filter_values pfv ON f.id = pfv.filter_id WHERE pfv.product_id IN (?)',
                [categoryIds]
            );
            return categoryIds.map((categoryId) => {
                return rows.filter((row) => row.category_id === Number(categoryId));
            });
        }),
        categoryParent: new DataLoader(async (ids) => {
            const [rows] = await db.query('SELECT * FROM categories WHERE id IN (?)', [ids])
            return ids.map((id) => rows.find((row) => row.id === Number(id)) || null);
        }),

        // 3. Batch fetching filters by their IDs
        filters: new DataLoader(async (ids) => {
            const [rows] = await db.query('SELECT * FROM filters WHERE id IN (?)', [ids]);
            return ids.map(id => rows.find(row => row.id === Number(id)) || null);
        }),

        // 4. Batch fetching filter values by their IDs
        filterValues: new DataLoader(async (ids) => {
            const [rows] = await db.query('SELECT * FROM filter_values WHERE id IN (?)', [ids]);
            return ids.map(id => rows.find(row => row.id === Number(id)) || null);
        }),

        // 5. Batch fetching filter values for multiple products (for Product.filterValues)
        productFilterValues: new DataLoader(async (productIds) => {
            const [rows] = await db.query('SELECT * FROM product_filter_values WHERE product_id IN (?)', [productIds]);
            return productIds.map(id => rows.filter(row => row.product_id === Number(id)));
        }),

        filterValuesByFilterId: new DataLoader(async (filterIds) => {
            const [rows] = await db.query('SELECT * FROM filter_values WHERE filter_id IN (?)', [filterIds]);
            return filterIds.map(id => rows.filter(row => row.filter_id === Number(id)));
        }),

    }
}
