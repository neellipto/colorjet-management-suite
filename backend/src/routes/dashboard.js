import { Router } from 'express';
import { readDashboardKpis } from '../services/odoo.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  try {
    const kpis = await readDashboardKpis();
    res.json({ ok: true, data: { kpis } });
  } catch (error) {
    res.status(200).json({
      ok: true,
      data: {
        kpis: [
          { key: 'today_sales', label: 'Today Sales', value: '৳0', note: 'Odoo not connected', status: 'normal' },
          { key: 'today_collection', label: 'Today Collection', value: '৳0', note: 'Configure backend .env', status: 'normal' },
          { key: 'open_service', label: 'Open Service Tickets', value: 0, note: 'Service API ready', status: 'warning' },
          { key: 'low_stock', label: 'Low Stock Items', value: 0, note: 'Stock API ready', status: 'danger' }
        ]
      },
      warning: error instanceof Error ? error.message : 'Odoo not connected'
    });
  }
});
