# 🛒 MP + ARCA — Sistema de Pagos con Facturación Electrónica

Sistema que integra **MercadoPago CheckoutPro** (modo test) con **facturación electrónica ARCA** (AFIP) en modo homologación.

## ✨ Funcionalidades

| Feature | Descripción |
|---|---|
| Landing page | Producto con botón de compra CheckoutPro |
| Webhook seguro | Verifica cada pago directamente en la API de MP |
| Factura ARCA | Emite Factura B a Consumidor Final vía `@arcasdk/core` |
| Dashboard | `GET /status` muestra pagos procesados y estado de facturas |
| Deploy | Preparado para Vercel |

## 🚀 Instalación local

```bash
npm install

# Copiar template de env
cp .env.example .env
# → Completar MP_ACCESS_TOKEN y APP_URL en el .env

npm run dev
# → http://localhost:3000
```

## ⚙️ Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `MP_ACCESS_TOKEN` | Access Token TEST de MercadoPago | `TEST-abc123...` |
| `APP_URL` | URL pública de la app | `https://mi-app.vercel.app` |
| `ARCA_CUIT` | CUIT del emisor | `20111111112` |
| `ARCA_CERT` | Contenido del certificado .crt (para facturación real) | `-----BEGIN CERT...` |
| `ARCA_KEY` | Contenido de la clave privada .key (para facturación real) | `-----BEGIN RSA...` |
| `PORT` | Puerto local (opcional) | `3000` |

## 🌐 Deploy en Vercel

### 1. Instalar Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
vercel
# Seguir los prompts
```

### 3. Configurar variables de entorno

En el dashboard de Vercel → Project → Settings → Environment Variables, agregar:

- `MP_ACCESS_TOKEN` = `TEST-xxxx`
- `APP_URL` = `https://tu-app.vercel.app`
- `ARCA_CUIT` = `20111111112`
- `ARCA_CERT` = *(contenido del .crt)*
- `ARCA_KEY` = *(contenido del .key)*

### 4. Redeploy para aplicar variables

```bash
vercel --prod
```

## 📡 Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Landing page |
| `POST` | `/api/create-preference` | Crea preferencia MP y retorna `init_point` |
| `POST` | `/webhooks/mp` | Recibe notificaciones de MercadoPago |
| `GET` | `/status` | Lista pagos procesados con estado de factura |
| `GET` | `/success` | Página post-pago |

## 🔐 Seguridad del Webhook

El sistema **nunca confía solo en el body del webhook**. Al recibir una notificación:

1. Responde `200 OK` inmediatamente (evita timeout de MP)
2. Extrae el `payment_id` del body
3. Consulta `GET /v1/payments/{id}` directamente en la API de MP con el token
4. Verifica `status === 'approved'`
5. Solo entonces procede a emitir la factura

## 🧾 Sobre la facturación ARCA

Para que la integración con ARCA funcione necesitás:

1. Un certificado digital X.509 (`.crt`) y clave privada (`.key`)
2. En modo testing/homologación: obtenerlos desde el [portal ARCA testing](https://www.afipts.com/tutorial/obtain-testing-certificate.html)
3. Cargar el contenido de ambos archivos en las variables `ARCA_CERT` y `ARCA_KEY`

Si los certificados no están configurados, el sistema registra el pago pero marca la factura con error `cert_missing`, sin tirar excepción que rompa el flujo.

## 🧪 Tarjetas de prueba MercadoPago (Argentina)

| Tarjeta | Número | CVV | Venc. | Resultado |
|---|---|---|---|---|
| Mastercard aprobada | `5031 7557 3453 0604` | `123` | `11/25` | ✅ Aprobado |
| Visa aprobada | `4509 9535 6623 3704` | `123` | `11/25` | ✅ Aprobado |
| Cualquier tarjeta rechazada | cualquier número | `123` | vencida | ❌ Rechazado |

## 📁 Estructura del proyecto

```
mpArca/
├── server.js              # Servidor Express + todos los endpoints
├── vercel.json            # Config de deploy en Vercel
├── package.json
├── .env.example           # Template de variables de entorno
├── src/
│   ├── mercadopago.js     # createPreference() + getPayment()
│   ├── arca.js            # emitirFactura() via @arcasdk/core
│   └── store.js           # Store en memoria (pagos procesados)
└── public/
    ├── index.html         # Landing page del producto
    ├── success.html       # Página post-pago con detalles de factura
    ├── style.css          # Sistema de diseño
    └── product-hero.png   # Imagen del producto
```
