import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from "url";
import morgan from "morgan";
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';

// Route imports
import { categoryRoute } from "./routes/category.route.js";
import { filterRoute } from "./routes/filter.route.js";
import { productRoute } from "./routes/product.route.js";
import { uploadRoute } from "./routes/upload.route.js";
import { orderRoute } from "./routes/order.route.js";
import { authRoute } from "./routes/auth.route.js";
import { storeAuthRoute } from "./routes/store-auth.route.js";
import { cartRoute } from "./routes/cart.route.js";
import { couponRoute } from "./routes/coupon.route.js";
import { contactRoute } from "./routes/contact.route.js";
import { userRoute } from "./routes/user.route.js";
import { bulkProductRoute } from "./routes/bulk_product.route.js";
import { bulkOrderRoute } from "./routes/bulk_order.route.js";
import bulkMasterRoute from "./routes/bulk_master.route.js";
import bulkMasterProductRoute from "./routes/bulk_master_product.route.js";
import { notificationRoute } from "./routes/notification.route.js";
import { sendError } from "./utils/response.util.js";
import { db } from "./db.js";
import { softAuthMiddleware } from "./middleware/auth.middleware.js";
import { GraphQLError } from "graphql";
import { createDataLoader } from "./graphql/loaders/loader.js";

dotenv.config();

const app = express();

// 1. Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
    // app.use((req, res, next) => {
    //     if (req.method !== 'GET') {
    //         console.log(`📦 [${new Date().toISOString()}] Request Body:`, JSON.stringify(req.body, null, 2));
    //     }
    //     next();
    // });
}

// 2. CORS Configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [/\.patelmanufacturing\.com$/, 'https://patelmanufacturing.com']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:4173', 'http://192.168.1.11:3001', 'https://patelmanufacturing.com', 'https://admin.patelmanufacturing.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization']
}));

const BASE_URL = '/api/v1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3. Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'php-backend/public/uploads')));

// 4. Routes
app.use(`${BASE_URL}/category`, categoryRoute);
app.use(`${BASE_URL}/filter`, filterRoute);
app.use(`${BASE_URL}/product`, productRoute);
app.use(`${BASE_URL}/upload`, uploadRoute);
app.use(`${BASE_URL}/order`, orderRoute);
app.use(`${BASE_URL}/auth`, authRoute);
app.use(`${BASE_URL}/store/auth`, storeAuthRoute);
app.use(`${BASE_URL}/cart`, cartRoute);
app.use(`${BASE_URL}/coupon`, couponRoute);
app.use(`${BASE_URL}/contact`, contactRoute);
app.use(`${BASE_URL}/user`, userRoute);
app.use(`${BASE_URL}/bulk-product`, bulkProductRoute);
app.use(`${BASE_URL}/bulk-order`, bulkOrderRoute);
app.use(`${BASE_URL}/bulk-master`, bulkMasterRoute);
app.use(`${BASE_URL}/bulk-master-product`, bulkMasterProductRoute);
app.use(`${BASE_URL}/notifications`, notificationRoute);

// 4.5 GraphQL Integration
// const server = new ApolloServer({
//     typeDefs,
//     resolvers,
// });

// await server.start();
// app.use('/graphql', softAuthMiddleware, expressMiddleware(server, {
//     context: ({ req }) => ({
//         db,
//         GraphQLError,
//         user: req.user,
//         loaders: createDataLoader(db)
//     })
// }));


// 5. Global Error Handler
app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal server error';

    // Log the error for internal tracking
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url} - Error:`, {
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Send standardized error response
    return sendError(res, statusCode, message, 0, {
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`📂 Uploads directory: ${path.join(__dirname, 'uploads')}`);
});