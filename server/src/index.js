import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import productsRouter from './routes/products.js'
import settingsRouter from './routes/settings.js'
import adminRouter from './routes/admin.js'
import adminOrdersRouter from './routes/adminOrders.js'
import importRouter from './routes/import.js'
import checkoutRouter from './routes/checkout.js'
import webhookRouter from './routes/webhook.js'
import { expirePendingOrders } from './lib/orders.js'
import { errorHandler } from './lib/http.js'

const app = express()
const PORT = process.env.PORT || 4000

// CLIENT_URL may list several origins separated by commas (e.g. the Vercel URL and localhost)
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim())

app.set('trust proxy', 1) // behind Render/Railway
app.use(helmet())
app.use(cors({ origin: allowed }))

// The Paystack webhook needs the RAW body to check its signature, so it is mounted BEFORE express.json.
app.use('/api/paystack/webhook', webhookRouter)

// Spreadsheet import takes bigger bodies (the file, then the checked rows), so it brings its
// own body parsers and is mounted before the global one. It requires an admin first.
app.use('/api/admin/import', importRouter)

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/products', productsRouter)
app.use('/api', settingsRouter)
app.use('/api', checkoutRouter)
app.use('/api/admin', adminOrdersRouter)
app.use('/api/admin', adminRouter)

app.use('/api', (_req, res) => res.status(404).json({ message: 'We could not find that.' }))
app.use(errorHandler)

app.listen(PORT, () => console.log(`Sika API listening on http://localhost:${PORT}`))

// Unpaid orders older than 30 minutes are marked failed. Every 5 minutes, and once at start.
expirePendingOrders()
setInterval(expirePendingOrders, 5 * 60 * 1000).unref()
