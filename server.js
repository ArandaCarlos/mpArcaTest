require('dotenv').config();
const express = require('express');
const path = require('path');
const { createPreference, getPayment } = require('./src/mercadopago');
const { emitirFactura } = require('./src/arca');
const { savePayment, getRecentPayments } = require('./src/store');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────
// Definición del producto
// ─────────────────────────────────────────────────────────────
const PRODUCT = {
  id: 'suite-pro-dev-001',
  title: 'Suite Pro Developer',
  description: 'Acceso ilimitado a herramientas de desarrollo premium por 12 meses',
  price: 15000,
  currency: 'ARS',
};

// ─────────────────────────────────────────────────────────────
// POST /api/create-preference
// Crea una preferencia de pago en MercadoPago y retorna el init_point
// ─────────────────────────────────────────────────────────────
app.post('/api/create-preference', async (req, res) => {
  try {
    const preference = await createPreference(PRODUCT);
    res.json({
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      id: preference.id,
    });
  } catch (error) {
    console.error('[create-preference] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /webhooks/mp
// Recibe notificaciones de MercadoPago
// Flujo: recibir → responder 200 → verificar pago en API → facturar → loguear
// ─────────────────────────────────────────────────────────────
app.post('/webhooks/mp', async (req, res) => {
  const { type, data } = req.body;

  // ── IMPORTANTE (Vercel serverless): NO responder antes de procesar.
  // En funciones serverless la ejecución se corta al enviar res.json().
  // MercadoPago espera hasta ~30s el 200, así que procesamos primero.

  // Solo procesar notificaciones de pagos
  if (type !== 'payment' || !data?.id) {
    console.log('[webhook] Ignorando notificación de tipo:', type);
    return res.status(200).json({ status: 'ignored', type });
  }

  const paymentId = String(data.id);
  console.log(`[webhook] Procesando pago ID: ${paymentId}`);

  try {
    // ─── Paso 1: Verificar el pago directamente en la API de MP ───
    // NUNCA confiar solo en el body del webhook
    const payment = await getPayment(paymentId);
    console.log(`[webhook] Estado del pago: ${payment.status}`);

    // ─── Paso 2: Si no está aprobado, loguear y salir ───
    if (payment.status !== 'approved') {
      savePayment({
        paymentId,
        status: payment.status,
        amount: payment.transaction_amount,
        email: payment.payer?.email,
        description: payment.description || PRODUCT.title,
        invoiceStatus: 'skipped',
        invoiceReason: `Pago no aprobado. Estado: ${payment.status}`,
        processedAt: new Date().toISOString(),
      });
      return res.status(200).json({ status: 'received', paymentStatus: payment.status });
    }

    // ─── Paso 3: Emitir factura en ARCA ───
    let invoiceResult = null;
    let invoiceStatus = 'error';
    let invoiceError = null;

    try {
      invoiceResult = await emitirFactura({
        transaction_amount: payment.transaction_amount,
        description: payment.description || PRODUCT.title,
        payer: payment.payer,
      });
      invoiceStatus = invoiceResult?.cae ? 'emitted' : 'error';
      console.log(`[webhook] Factura emitida. CAE: ${invoiceResult?.cae}`);
    } catch (arcaError) {
      invoiceError = arcaError.message;
      console.error('[webhook] Error ARCA:', arcaError.message);
    }

    // ─── Paso 4: Guardar log y responder ───
    savePayment({
      paymentId,
      status: payment.status,
      amount: payment.transaction_amount,
      email: payment.payer?.email,
      description: payment.description || PRODUCT.title,
      invoiceStatus,
      invoiceError,
      cae: invoiceResult?.cae || null,
      caeFchVto: invoiceResult?.caeFchVto || null,
      processedAt: new Date().toISOString(),
    });

    return res.status(200).json({ status: 'processed', invoiceStatus, cae: invoiceResult?.cae || null });

  } catch (error) {
    console.error('[webhook] Error general:', error.message);
    savePayment({
      paymentId,
      status: 'unknown',
      invoiceStatus: 'error',
      invoiceError: error.message,
      processedAt: new Date().toISOString(),
    });
    // Siempre devolver 200 para que MP no reintente indefinidamente
    return res.status(200).json({ status: 'error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /status
// Retorna los últimos pagos procesados con estado de facturación
// ─────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  const payments = getRecentPayments();
  res.json({
    payments,
    count: payments.length,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// GET /success → sirve la página de pago exitoso
// ─────────────────────────────────────────────────────────────
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// ─────────────────────────────────────────────────────────────
// GET / → sirve la landing page
// ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   → Landing:  http://localhost:${PORT}/`);
  console.log(`   → Status:   http://localhost:${PORT}/status`);
  console.log(`   → Webhook:  POST http://localhost:${PORT}/webhooks/mp`);
});

module.exports = app;
