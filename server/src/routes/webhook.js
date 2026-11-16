import express, { Router } from 'express'
import { validSignature } from '../lib/paystack.js'
import { findOrderByReference, confirmPayment } from '../lib/orders.js'

// POST /api/paystack/webhook
// Set this URL in Paystack: Settings > API Keys & Webhooks > Test Webhook URL.
// Uses express.raw for THIS route only: the signature is computed over the exact raw bytes.
const router = Router()

router.post('/', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
  if (!validSignature(req.body, req.get('x-paystack-signature'))) return res.sendStatus(401)

  let event
  try {
    event = JSON.parse(req.body.toString('utf8'))
  } catch {
    return res.sendStatus(400)
  }

  if (event?.event === 'charge.success') {
    const reference = event.data?.reference
    const order = await findOrderByReference(reference)
    if (!order) {
      console.warn('[webhook] no order for reference', reference)
      return res.sendStatus(200) // not ours (or test ping): acknowledge so Paystack stops retrying
    }
    await confirmPayment(order, reference, event.data) // throws -> 500 -> Paystack retries later
  }
  res.sendStatus(200)
})

export default router
