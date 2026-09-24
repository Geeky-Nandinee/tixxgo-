function errorHandler(err, req, res, next) {
  console.error('[GlobalErrorHandler]', err.stack || err.message);

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR'
  });
}

module.exports = errorHandler;
