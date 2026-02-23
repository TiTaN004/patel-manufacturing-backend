import { db } from "../db.js";

const migrateBulkProducts = async () => {
    console.log("Starting Bulk Products Migration...");
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Create bulk_products table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS bulk_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userID INT NOT NULL,
                sr_no VARCHAR(100),
                box_name VARCHAR(255) NOT NULL,
                size VARCHAR(100),
                paper VARCHAR(100),
                liner VARCHAR(100),
                sheet_size VARCHAR(100),
                no_sheet VARCHAR(100),
                die_no VARCHAR(100),
                plate_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (userID) REFERENCES user(userID) ON DELETE CASCADE
            )
        `);

        console.log("Table 'bulk_products' created successfully.");

        await conn.commit();
        console.log("Migration completed successfully.");
    } catch (error) {
        await conn.rollback();
        console.error("Migration failed:", error);
    } finally {
        conn.release();
        process.exit();
    }
};

migrateBulkProducts();
