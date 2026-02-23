import { db } from '../db.js';

async function migrate() {
    try {
        console.log('Starting migration: Adding googleId column...');
        
        // Check if column already exists
        const [columns] = await db.query("SHOW COLUMNS FROM user LIKE 'googleId'");
        
        if (columns.length === 0) {
            await db.query("ALTER TABLE user ADD COLUMN googleId VARCHAR(255) UNIQUE AFTER user_role");
            console.log('Successfully added googleId column.');
        } else {
            console.log('googleId column already exists.');
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
