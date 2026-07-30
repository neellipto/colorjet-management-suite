import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { dashboardRouter } from './routes/dashboard.js';
import { genericRouter } from './routes/generic.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1', genericRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`${config.appName} running on port ${config.port}`);
});
