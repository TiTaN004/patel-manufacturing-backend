/**
 * Standard API response helper
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Response message
 * @param {any} data - Response data (array or object)
 * @param {number|null} outVal - Legacy output value (1 for success, 0 for failure)
 * @param {Object} extra - Any additional fields to include in the response
 */
export const sendResponse = (res, statusCode, message, data = null, outVal = null, extra = {}) => {
    // 1. Safety check to prevent "Headers already sent" errors
    if (res.headersSent) {
        console.warn('Attempted to send response after headers were already sent:', { url: res.req?.url, statusCode, message });
        return;
    }

    // 2. Build standardized response object
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message,
        statusCode,
        ...extra
    };

    if (outVal !== null) {
        response.outVal = outVal;
    }

    if (data !== null) {
        response.data = data;
    } else if (statusCode >= 400) {
        response.data = []; // Default empty array for error responses
    }

    return res.status(statusCode).json(response);
};

/**
 * Standard Error response shorthand
 */
export const sendError = (res, statusCode, message, outVal = 0, data = []) => {
    return sendResponse(res, statusCode, message, data, outVal);
};

/**
 * Standard Success response shorthand
 */
export const sendSuccess = (res, message, data = null, outVal = 1, extra = {}) => {
    return sendResponse(res, 200, message, data, outVal, extra);
};
