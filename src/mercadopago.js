const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Inicializar cliente con el Access Token del entorno
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 20000 }, // 20s — tolera latencia en cold starts de Vercel
});

/**
 * Crea una preferencia de pago en MercadoPago para un producto.
 * @param {Object} product - { id, title, description, price, currency }
 * @returns {Promise<Object>} Preferencia de MP con init_point y sandbox_init_point
 */
async function createPreference(product) {
  const preference = new Preference(client);

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const response = await preference.create({
    body: {
      items: [
        {
          id: product.id,
          title: product.title,
          description: product.description,
          quantity: 1,
          unit_price: product.price,
          currency_id: product.currency || 'ARS',
        },
      ],
      back_urls: {
        success: `${appUrl}/success`,
        failure: `${appUrl}/?status=failure`,
        pending: `${appUrl}/success?status=pending`,
      },
      auto_return: 'approved',
      // Webhook configurado directamente en la preferencia
      // (tiene prioridad sobre el configurado en Tus Integraciones)
      notification_url: `${appUrl}/webhooks/mp`,
      statement_descriptor: 'Suite Pro Dev',
    },
  });

  return response;
}

/**
 * Consulta los detalles de un pago directamente en la API de MercadoPago.
 * Esto es FUNDAMENTAL para verificar que el pago sea real (no confiar en el webhook body).
 * @param {string|number} id - ID del pago
 * @returns {Promise<Object>} Datos completos del pago
 */
async function getPayment(id) {
  const payment = new Payment(client);
  return await payment.get({ id: String(id) });
}

module.exports = { createPreference, getPayment };
