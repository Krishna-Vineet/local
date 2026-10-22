import http from 'node:http'
import { printJob, probePrinters, type PrintRequest } from './hardware.js'
import { getDnpTelemetry } from './dnpTelemetry.js'

let server: http.Server | null = null

export interface PrintServerOptions {
  port?: number
  host?: string
}

/**
 * Lightweight, zero-dependency HTTP Print Server
 * Allows Android/iOS booth tablets on the local network to print to
 * DNP RX1HS, Citizen, or any Windows-installed dye-sub printer.
 */
export function startPrintServer(options: PrintServerOptions = {}): http.Server {
  if (server) return server

  const port = options.port || Number(process.env.HAPPYPIX_PRINT_SERVER_PORT) || 9123
  const host = options.host || '0.0.0.0'

  server = http.createServer(async (req, res) => {
    // Enable CORS for mobile booth app on local network
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url || '/'

    // 1. Health & Status
    if (url === '/api/status' || url === '/api/health') {
      try {
        const printers = await probePrinters()
        const defaultPrinter = process.env.HAPPYPIX_PRINTER_NAME || printers[0] || null
        const dnp = await getDnpTelemetry(defaultPrinter || '')

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            service: 'Happypix Print Bridge',
            version: '2.0.0',
            platform: process.platform,
            connected: printers.length > 0 || dnp.connected,
            defaultPrinter: dnp.connected ? (dnp.printerName || 'DNP DS-RX1HS') : defaultPrinter,
            printers,
            dnp: {
              connected: dnp.connected,
              status: dnp.status,
              paperRemaining: dnp.paperRemaining,
              ribbonPercent: dnp.ribbonPercent,
              initialMediaCount: dnp.initialMediaCount,
              lifetimePrints: dnp.lifetimePrints,
              error: dnp.error,
            },
          })
        )
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: err.message || 'Error checking printers' }))
      }
      return
    }

    // 2. Print Dispatch
    if (url === '/api/print' && req.method === 'POST') {
      const chunks: Buffer[] = []
      let totalLength = 0
      const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024 // 50MB max for high-res 300 DPI composite

      req.on('data', (chunk: Buffer) => {
        totalLength += chunk.length
        if (totalLength > MAX_PAYLOAD_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Payload too large (max 50MB)' }))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })

      req.on('end', async () => {
        try {
          const bodyStr = Buffer.concat(chunks).toString('utf8')
          const payload = JSON.parse(bodyStr)

          if (!payload.bitmap && !payload.bitmapDataUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: 'Bitmap image data is required for printing' }))
            return
          }

          const request: PrintRequest = {
            copies: Math.max(1, Math.min(10, Number(payload.copies) || 1)),
            layoutId: String(payload.layoutId || 'strip'),
            templateName: String(payload.templateName || 'standard'),
            bitmapDataUrl: payload.bitmap || payload.bitmapDataUrl,
            printerName: payload.printerName || process.env.HAPPYPIX_PRINTER_NAME || '',
          }

          console.log(`[PrintServer] Received print request (${request.copies} copies) from ${req.socket.remoteAddress}`)
          const result = await printJob(request)

          res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (err: any) {
          console.error('[PrintServer] Print processing error:', err)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: err.message || 'Invalid print request body' }))
        }
      })
      return
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'Not found' }))
  })

  server.listen(port, host, () => {
    console.log(`🖨️ [PrintServer] Happypix Print Bridge listening on http://${host}:${port}`)
  })

  server.on('error', (err: any) => {
    console.warn(`[PrintServer] Could not bind to port ${port}:`, err.message)
  })

  return server
}

export function stopPrintServer(): void {
  if (server) {
    server.close()
    server = null
    console.log('[PrintServer] Stopped.')
  }
}
