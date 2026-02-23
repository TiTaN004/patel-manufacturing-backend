import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api/v1';

async function testBulkUpdate() {
    try {
        // You'll need a valid admin token here to run this script manually
        const token = 'YOUR_ADMIN_TOKEN';

        const response = await axios.put(`${API_BASE_URL}/user/bulk-update`, {
            users: [
                {
                    emailID: 'bulk_user@example.com',
                    fullName: 'Updated Bulk User Name',
                    mobileNo: '9999999999',
                    user_role: 'bulk',
                    isActive: 1
                }
            ]
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

// testBulkUpdate();
console.log('Test script created. Please provide a valid admin token to run it.');
