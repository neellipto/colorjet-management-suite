import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  appName: process.env.APP_NAME || 'COLORJET ERP API',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  odoo: {
    url: process.env.ODOO_URL || '',
    db: process.env.ODOO_DB || '',
    username: process.env.ODOO_USERNAME || '',
    apiKey: process.env.ODOO_API_KEY || ''
  }
};
