/**
 * Wraps an async function and passes any errors to the next() middleware.
 * This eliminates the need for repeated try-catch blocks in controllers.
 * 
 * @param {Function} fn - The asynchronous function to wrap
 * @returns {Function} - The wrapped Express middleware/controller
 */
export const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

export const constructError = (text, statusCode) => {
    const error = new Error(text);
    error.status = statusCode;
    return error;
}