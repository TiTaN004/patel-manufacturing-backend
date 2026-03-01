import mysql2 from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Validate required database environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export const db = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+05:30',
    dateStrings: true
});

// Set session timezone to IST for all connections in the pool
db.on('connection', (connection) => {
    connection.query("SET time_zone = '+05:30'");
});


export const testConnection = async () => {
    try {
        const connection = await db.getConnection();
        console.log('Database connection established successfully:', {
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            timestamp: new Date().toISOString()
        });
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', {
            error: error.message,
            code: error.code,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            timestamp: new Date().toISOString()
        });
        throw error; // Re-throw to prevent silent failures
    }
}