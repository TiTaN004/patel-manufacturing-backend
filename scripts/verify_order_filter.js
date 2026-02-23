import { db } from '../db.js';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/v1';

async function verify() {
    try {
        console.log('--- Verifying Order Filtering by User Type ---');

        // 1. Ensure we have orders for both types
        const [bulkUsers] = await db.query("SELECT userID FROM user WHERE user_role = 'bulk' LIMIT 1");
        const [retailUsers] = await db.query("SELECT userID FROM user WHERE user_role = 'retail' LIMIT 1");

        if (bulkUsers.length === 0 || retailUsers.length === 0) {
            console.log('❌ Error: Need at least one bulk and one retail user for testing.');
            process.exit(1);
        }

        const bulkUserId = bulkUsers[0].userID;
        const retailUserId = retailUsers[0].userID;

        // Check for orders
        const [bulkOrders] = await db.query("SELECT id FROM user_orders WHERE user_id = ?", [bulkUserId]);
        if (bulkOrders.length === 0) {
            console.log('Creating dummy order for bulk user...');
            // Need a customer first
            const [cust] = await db.query("SELECT id FROM customers LIMIT 1");
            const customerId = cust[0].id;
            await db.query("INSERT INTO user_orders (invoice_number, user_id, customer_id, total_amount, payment_mode, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                [`TEST-BULK-${Date.now()}`, bulkUserId, customerId, 1000, 'cash', 'pending', 'pending']);
        }

        const [retailOrders] = await db.query("SELECT id FROM user_orders WHERE user_id = ?", [retailUserId]);
        if (retailOrders.length === 0) {
            console.log('Creating dummy order for retail user...');
            const [cust] = await db.query("SELECT id FROM customers LIMIT 1");
            const customerId = cust[0].id;
            await db.query("INSERT INTO user_orders (invoice_number, user_id, customer_id, total_amount, payment_mode, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                [`TEST-RETAIL-${Date.now()}`, retailUserId, customerId, 500, 'cash', 'pending', 'pending']);
        }

        // 2. Test API
        console.log('\nTesting API Filters:');

        const testFilter = async (type) => {
            const res = await axios.get(`${BASE_URL}/order/user-orders`, {
                params: { user_type: type }
            });
            const orders = res.data.data;
            console.log(`- Filter '${type}': Found ${orders.length} orders.`);
            if (type !== 'both') {
                const invalid = orders.filter(o => o.user_role !== type);
                if (invalid.length > 0) console.log(`  ❌ Failed: Found orders with wrong role!`);
                else console.log(`  ✅ Success: All orders match role '${type}'.`);
            }
        };

        await testFilter('retail');
        await testFilter('bulk');
        await testFilter('both');

        console.log('\nCleaning up test orders...');
        await db.query("DELETE FROM user_orders WHERE invoice_number LIKE 'TEST-%'");
        console.log('Done.');

    } catch (error) {
        console.error('Verification failed:', error.response?.data || error.message);
    } finally {
        process.exit();
    }
}

verify();
