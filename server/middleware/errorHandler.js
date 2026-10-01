/**
 * Global error handler.
 * Maps PostgreSQL error codes to HTTP status codes.
 * P0001 = RAISE EXCEPTION from triggers → 400
 */
function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          success: false,
          error: 'Duplicate entry',
          detail: err.detail,
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({
          success: false,
          error: 'Referenced record not found',
          detail: err.detail,
        });
      case '23514': // check_violation
        return res.status(400).json({
          success: false,
          error: 'Constraint violation',
          detail: err.detail || err.message,
        });
      case 'P0001': // raise_exception (from triggers)
        return res.status(400).json({
          success: false,
          error: err.message.replace('error: ', ''),
        });
      default:
        break;
    }
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
