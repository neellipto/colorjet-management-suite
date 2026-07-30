import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    ok: true,
    data: {
      service: config.appName,
      time: new Date().toISOString(),
      odooConfigured: Boolean(config.odoo.url && config.odoo.db && config.odoo.username && config.odoo.apiKey)
    }
  });
});
