const { Redis } = require('@upstash/redis');
const { AccessTicket } = require('@arcasdk/core/lib/domain/entities/access-ticket.entity');

class RedisTicketStorage {
  constructor(cuit, production) {
    this.cuit = cuit;
    this.production = production;
    
    // Automáticamente lee KV_REST_API_URL y KV_REST_API_TOKEN del entorno (Vercel)
    this.redis = Redis.fromEnv();
  }

  createKey(serviceName) {
    return `TA-${this.cuit}-${serviceName}${this.production ? "-production" : ""}`;
  }

  async save(ticket, serviceName) {
    const key = this.createKey(serviceName);
    const ticketData = {
      header: ticket.getHeaders(),
      credentials: ticket.getCredentials(),
    };
    
    // Guardamos el ticket. Los tickets de AFIP duran 12 horas.
    // Le ponemos un TTL de 11.5 horas (41400 segundos) para forzar rotación antes de que venza.
    await this.redis.set(key, JSON.stringify(ticketData), { ex: 41400 });
    console.log(`[RedisStorage] Ticket guardado en KV: ${key}`);
  }

  async get(serviceName) {
    const key = this.createKey(serviceName);
    const data = await this.redis.get(key);
    
    if (!data) {
      console.log(`[RedisStorage] No se encontró ticket en KV para: ${key}`);
      return null;
    }

    console.log(`[RedisStorage] Ticket recuperado desde KV: ${key}`);
    
    // Upstash parsea automáticamente JSON
    const ticketData = typeof data === 'string' ? JSON.parse(data) : data;
    
    try {
      return AccessTicket.create(ticketData);
    } catch (e) {
      console.error(`[RedisStorage] Error al instanciar AccessTicket: ${e.message}`);
      return null;
    }
  }

  async delete(serviceName) {
    const key = this.createKey(serviceName);
    await this.redis.del(key);
    console.log(`[RedisStorage] Ticket borrado de KV: ${key}`);
  }
}

module.exports = { RedisTicketStorage };
