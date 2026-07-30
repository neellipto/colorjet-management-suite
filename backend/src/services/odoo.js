import axios from 'axios';
import { config } from '../config.js';

function ensureConfigured() {
  const { url, db, username, apiKey } = config.odoo;
  if (!url || !db || !username || !apiKey) {
    throw new Error('Odoo is not configured. Set ODOO_URL, ODOO_DB, ODOO_USERNAME and ODOO_API_KEY in backend .env');
  }
}

async function jsonRpc(service, method, args) {
  ensureConfigured();
  const endpoint = `${config.odoo.url.replace(/\/$/, '')}/jsonrpc`;
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: { service, method, args },
    id: Date.now()
  };
  const { data } = await axios.post(endpoint, payload, { timeout: 20000 });
  if (data.error) {
    throw new Error(data.error?.data?.message || data.error?.message || 'Odoo RPC error');
  }
  return data.result;
}

export async function authenticateOdoo() {
  const { db, username, apiKey } = config.odoo;
  return jsonRpc('common', 'authenticate', [db, username, apiKey, {}]);
}

export async function searchRead(model, domain = [], fields = [], limit = 20, order = 'id desc') {
  const uid = await authenticateOdoo();
  const { db, apiKey } = config.odoo;
  return jsonRpc('object', 'execute_kw', [
    db,
    uid,
    apiKey,
    model,
    'search_read',
    [domain],
    { fields, limit, order }
  ]);
}

export async function readDashboardKpis() {
  const [saleOrders, invoices, stockMoves] = await Promise.all([
    searchRead('sale.order', [], ['name', 'amount_total', 'state', 'date_order'], 10),
    searchRead('account.move', [['move_type', '=', 'out_invoice']], ['name', 'amount_total', 'payment_state', 'invoice_date'], 10),
    searchRead('stock.move', [], ['name', 'product_id', 'product_uom_qty', 'state'], 10)
  ]);

  const totalSales = saleOrders.reduce((sum, item) => sum + Number(item.amount_total || 0), 0);
  const unpaidInvoices = invoices.filter((item) => item.payment_state !== 'paid').length;
  const pendingStockMoves = stockMoves.filter((item) => item.state !== 'done').length;

  return [
    { key: 'recent_sales_total', label: 'Recent Sales', value: `৳${totalSales.toLocaleString('en-BD')}`, note: 'Last 10 sales orders', status: 'success' },
    { key: 'unpaid_invoices', label: 'Unpaid Invoices', value: unpaidInvoices, note: 'Odoo customer invoices', status: unpaidInvoices ? 'warning' : 'success' },
    { key: 'pending_stock_moves', label: 'Pending Stock Moves', value: pendingStockMoves, note: 'Odoo stock moves', status: pendingStockMoves ? 'warning' : 'success' },
    { key: 'odoo_sync', label: 'Odoo Sync', value: 'Live', note: 'Backend proxy connected', status: 'success' }
  ];
}
