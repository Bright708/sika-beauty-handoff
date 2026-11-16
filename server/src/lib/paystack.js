import { createHmac, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http.js'

// Paystack, server side only. PAYSTACK_SECRET_KEY never leaves this server.
// Use the sk_test_ key while developing.
const BASE = 'https://api.paystack.co'
const secret = () => {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new HttpError(503, 'Payments are not set up yet. Please order on WhatsApp for now.')
  return key
}

async function call(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error('[paystack] network', err.message)
    throw new HttpError(502, 'We could not reach the payment service. Please try again in a moment.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.status !== true) {
    console.error('[paystack]', method, path, res.status, json.message)
    throw new HttpError(502, 'The payment could not be started. Please try again in a moment.')
  }
  return json.data
}

// amount in GH₵; Paystack wants pesewas.
export function initializeTransaction({ email, amountGhs, reference, callbackUrl, metadata }) {
  return call('POST', '/transaction/initialize', {
    email,
    amount: amountGhs * 100,
    currency: 'GHS',
    reference,
    channels: ['mobile_money', 'card'],
    callback_url: callbackUrl,
    metadata,
  })
}

export const verifyTransaction = (reference) => call('GET', `/transaction/verify/${encodeURIComponent(reference)}`)

// Webhook check: HMAC SHA512 of the RAW request body with the secret key.
export function validSignature(rawBody, signature) {
  if (!signature || !Buffer.isBuffer(rawBody)) return false
  const expected = createHmac('sha512', secret()).update(rawBody).digest('hex')
  const a = Buffer.from(String(signature))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
