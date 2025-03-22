import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { json } from 'body-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import authRoutes from './routes/auth.routes';
import logger from './utils/logger';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../swagger.json';
import { v4 as uuidv4 } from 'uuid';
import externalRoutes from './routes/external.routes';  
import userRoutes from './routes/user.routes';
import { errorHandler } from './middlewares/errorHandler';

// Use centralized configuration instead of dotenv directly
import { config as appConfig } from './config/config';

const prisma = new PrismaClient();
const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"]
      }
    }
  })
);
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
app.use(helmet.noSniff());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false
  })
);
app.use(json());
app.use(mongoSanitize());

app.use((req, res, next) => {
  const traceId = uuidv4();
  req.headers['x-trace-id'] = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - TraceID: ${req.headers['x-trace-id']}`);
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
console.log("Swagger Document:", JSON.stringify(swaggerDocument, null, 2));
app.use('/api/v1/external', externalRoutes);
app.use('/api/v1/users', userRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

// Use the new error handler middleware
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  prisma.$connect().then(() => {
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    const shutdown = () => {
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

export default app;
