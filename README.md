Create a read-only COLORJET Bangladesh Odoo reporting database.

Tables needed:
customers, sales_invoices, payments, products, stock_movements, suppliers, supplier_bills, expenses, daily_financial_summary, sync_logs.

Use UUID primary keys. Keep Odoo IDs unique. Add date, customer, supplier, product and invoice indexes.

This database will receive data from Odoo through API only. The app must not edit Odoo accounting, stock, invoices or payments.

Support reports for:
daily sales, collection, customer due, supplier payable, stock and low stock, expenses, cash/bank balance and dashboard summary.
