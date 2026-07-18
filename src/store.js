/**
 * Store en memoria para los pagos procesados.
 *
 * NOTA: En Vercel (serverless), el estado se reinicia entre cold starts.
 * Para persistencia real, integrar Vercel KV, Vercel Postgres, o similar.
 * Para el propósito de este demo, el store en memoria es suficiente.
 */

/** @type {Array<Object>} */
const payments = [];

const MAX_PAYMENTS = 100;

/**
 * Guarda un pago procesado en el store.
 * @param {Object} data - Datos del pago y estado de facturación
 */
function savePayment(data) {
  payments.unshift({
    ...data,
    savedAt: new Date().toISOString(),
  });
  // Mantener solo los últimos MAX_PAYMENTS registros
  if (payments.length > MAX_PAYMENTS) {
    payments.splice(MAX_PAYMENTS);
  }
}

/**
 * Retorna los últimos pagos procesados (máx. 50).
 * @returns {Array<Object>}
 */
function getRecentPayments() {
  return payments.slice(0, 50);
}

/**
 * Busca un pago por ID.
 * @param {string} paymentId
 * @returns {Object|undefined}
 */
function findPayment(paymentId) {
  return payments.find((p) => p.paymentId === String(paymentId));
}

module.exports = { savePayment, getRecentPayments, findPayment };
