// Errors with a friendly message that is safe to show to shoppers or the owner.
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export const notFound = (msg = 'We could not find that.') => new HttpError(404, msg)
export const badRequest = (msg, extra) => new HttpError(400, msg, extra)

// Throw a friendly error if Supabase returned one; log the real details server-side.
export function check({ data, error }, context = 'database') {
  if (error) {
    console.error(`[${context}]`, error)
    throw new HttpError(500, 'Something went wrong on our side. Please try again in a moment.')
  }
  return data
}

// Express 5 forwards rejected promises here automatically.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500
  if (status >= 500 && !(err instanceof HttpError)) console.error(err)
  const message =
    err instanceof HttpError
      ? err.message
      : status === 400
        ? 'That request did not look right. Please try again.'
        : 'Something went wrong on our side. Please try again in a moment.'
  res.status(status).json({ message, ...(err.extra || {}) })
}

export const intParam = (value, { min, max, fallback }) => {
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(Math.max(n, min), max)
}
