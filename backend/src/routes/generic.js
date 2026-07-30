import { Router } from 'express';
import { searchRead } from '../services/odoo.js';

export const genericRouter = Router();

function handleOdooList(model, fields) {
  return async (req, res) => {
    try {
      const data = await searchRead(model, [], fields, 50);
      res.json({ ok: true, data });
    } catch (error) {
      res.json({ ok: true, data: [], warning: error instanceof Error ? error.message : 'Not connected' });
    }
  };
}

genericRouter.get('/customers', handleOdooList('res.partner', ['name', 'phone', 'mobile', 'email', 'customer_rank']));
genericRouter.get('/stock', handleOdooList('stock.quant', ['product_id', 'quantity', 'location_id']));
genericRouter.get('/tasks', (req, res) => res.json({ ok: true, data: [] }));
genericRouter.get('/service-tickets', (req, res) => res.json({ ok: true, data: [] }));
