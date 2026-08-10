/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware on its own; this wrapper does that.
 */
function asyncHandler(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
