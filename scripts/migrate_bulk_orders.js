import { db } from '../db.js';

const migrateBulkOrders = async () => {
    const conn = await db.getConnection();
    try {
        console.log('Starting Bulk Orders migration...');

        // 1. Bulk Orders table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS bulk_orders (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                userID INT NOT NULL,
                total_amount DECIMAL(12, 2) NOT NULL,
                order_status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userID) REFERENCES user(userID)
            )
        `);
        console.log('bulk_orders table created or already exists.');

        // 2. Bulk Order Items table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS bulk_order_items (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                order_id BIGINT UNSIGNED NOT NULL,
                bulk_product_id INT NOT NULL,
                quantity INT UNSIGNED NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL,
                total_price DECIMAL(12, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES bulk_orders(id),
                FOREIGN KEY (bulk_product_id) REFERENCES bulk_products(id)
            )
        `);
        console.log('bulk_order_items table created or already exists.');

        console.log('Bulk Orders migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        conn.release();
        process.exit();
    }
};

migrateBulkOrders();
