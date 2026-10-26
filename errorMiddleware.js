const logger = require("./logger");

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack || err.message || String(err));

  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : err.status || err.statusCode || 400;

  res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Vidinė serverio klaida"
        : err.message || "Užklausos vykdymo klaida",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = {
  errorHandler,
};
