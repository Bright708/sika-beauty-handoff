import { db } from './supabase.js'

// Optional order emails through Resend. Off unless EMAILS_ENABLED=true and RESEND_API_KEY is set.
// The owner gets "New order SB-1042"; the customer gets a receipt.
const enabled = () => process.env.EMAILS_ENABLED === 'true' && Boolean(process.env.RESEND_API_KEY)
const ghs = (n) => `GH₵ ${Number(n).toLocaleString('en-US')}`
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function send({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Sika Beauty <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => '')}`)
}

export async function sendOrderEmails(orderId) {
  if (!enabled()) return
  const { data: o, error } = await db
    .from('orders')
    .select('*, items:order_items(product_name, size_label, unit_price_ghs, quantity)')
    .eq('id', orderId)
    .single()
  if (error) throw error

  const lines = o.items
    .map((i) => `<tr><td>${esc(i.product_name)}, ${esc(i.size_label)} x ${i.quantity}</td><td align="right">${ghs(i.unit_price_ghs * i.quantity)}</td></tr>`)
    .join('')
  const table = `<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${lines}
    <tr><td>Delivery</td><td align="right">${ghs(o.delivery_fee_ghs)}</td></tr>
    <tr><td><b>Total paid</b></td><td align="right"><b>${ghs(o.total_ghs)}</b></td></tr></table>`
  const where =
    o.fulfilment === 'pickup'
      ? 'Pick up from the shop'
      : `Delivery to ${esc(o.area)}${o.delivery_zone ? `, ${esc(o.delivery_zone)}` : ''}${o.gps_address ? ` (${esc(o.gps_address)})` : ''}`

  const jobs = []
  if (process.env.OWNER_EMAIL) {
    jobs.push(
      send({
        to: process.env.OWNER_EMAIL,
        subject: `New order ${o.order_number} · ${ghs(o.total_ghs)}${o.needs_attention ? ' · NEEDS ATTENTION' : ''}`,
        html: `<p><b>${esc(o.customer_name)}</b>, ${esc(o.phone)}, ${esc(o.email)}</p><p>${where}</p>
          ${o.notes ? `<p>Notes: ${esc(o.notes)}</p>` : ''}${o.gift_message ? `<p>Gift message: ${esc(o.gift_message)}</p>` : ''}
          ${o.needs_attention ? '<p><b>Stock ran out for something in this order. Contact the customer.</b></p>' : ''}${table}`,
      }),
    )
  }
  jobs.push(
    send({
      to: o.email,
      subject: `Your Sika Beauty order ${o.order_number}`,
      html: `<p>Thank you, ${esc(o.customer_name.split(' ')[0])}. We have your order and payment.</p>
        <p>${where}. We'll WhatsApp you when it's on the way.</p>${table}`,
    }),
  )
  const results = await Promise.allSettled(jobs)
  for (const r of results) if (r.status === 'rejected') console.error('[email]', r.reason?.message)
}
