/** Error carrying an HTTP status code, thrown by validators/models and turned into JSON by errorHandler. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
module.exports = HttpError;
