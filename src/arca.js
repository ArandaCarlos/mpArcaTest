const { Arca } = require('@arcasdk/core');

/**
 * Emite una factura electrónica en ARCA (AFIP) en modo homologación (testing).
 *
 * Tipo: Factura B a Consumidor Final con IVA 21%.
 * Usa createNextVoucher() que obtiene automáticamente el número de comprobante.
 *
 * @param {Object} paymentData
 * @param {number} paymentData.transaction_amount - Importe total (con IVA incluido)
 * @param {string} paymentData.description - Descripción del producto/servicio
 * @param {Object} paymentData.payer - Datos del pagador de MercadoPago
 * @returns {Promise<Object>} Resultado con CAE y fecha de vencimiento
 */
async function emitirFactura(paymentData) {
  const cert = process.env.ARCA_CERT || '';
  const key = process.env.ARCA_KEY || '';

  // Si no hay certificados configurados, informar claramente
  if (!cert || !key) {
    throw new Error(
      'Certificados ARCA no configurados. ' +
      'Completar ARCA_CERT y ARCA_KEY en las variables de entorno. ' +
      'Ver: https://www.afipts.com/tutorial/obtain-testing-certificate.html'
    );
  }

  // Instanciar SDK en modo homologación (testing)
  const arca = new Arca({
    cuit: Number(process.env.ARCA_CUIT) || 20111111112,
    cert,
    key,
    production: false,    // ← modo testing/homologación
    useHttpsAgent: true,  // requerido en Node.js para servidores ARCA legacy
  });

  // ─── Calcular montos con IVA 21% ───
  // Los precios en MercadoPago Argentina son precio final (IVA incluido)
  const total = parseFloat(paymentData.transaction_amount);
  const neto = parseFloat((total / 1.21).toFixed(2));
  const iva = parseFloat((total - neto).toFixed(2));

  // Fecha de hoy en formato YYYYMMDD (requerido por ARCA)
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  console.log(`[arca] Emitiendo Factura B | Total: $${total} | Neto: $${neto} | IVA: $${iva}`);

  // ─── Crear comprobante ───
  // createNextVoucher = getLastVoucher + createVoucher en un solo paso (no requiere CbteDesde/CbteHasta)
  const invoice = await arca.electronicBillingService.createNextVoucher({
    CantReg: 1,          // Cantidad de registros
    PtoVta: 1,           // Punto de venta configurado en ARCA
    CbteTipo: 6,         // 6 = Factura B (para consumidor final)
    Concepto: 1,         // 1 = Productos
    DocTipo: 99,         // 99 = Consumidor Final (sin CUIT)
    DocNro: 0,           // 0 para Consumidor Final
    CbteFch: fecha,      // Fecha del comprobante (string YYYYMMDD)
    ImpTotal: total,     // Importe total (precio + IVA)
    ImpTotConc: 0,       // Importe neto no gravado
    ImpNeto: neto,       // Importe neto gravado (sin IVA)
    ImpOpEx: 0,          // Importe exento
    ImpIVA: iva,         // Importe de IVA
    ImpTrib: 0,          // Otros tributos
    MonId: 'PES',        // Moneda: Pesos argentinos
    MonCotiz: 1,         // Cotización (1 para pesos)
    Iva: [
      {
        Id: 5,           // 5 = Alícuota 21%
        BaseImp: neto,
        Importe: iva,
      },
    ],
  });

  return invoice;
}

module.exports = { emitirFactura };
