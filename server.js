require("dotenv").config();

const express = require('express'); 
var cors = require('cors')
const { errorHandler } = require('./errorMiddleware');
const { securityHeaders, createRateLimiter } = require('./securityMiddleware');

const port = process.env.PORT || 4001;
const host = process.env.HOST || '0.0.0.0';
const app = express();

// Paslepiame X-Powered-By: Express antraštę
app.disable('x-powered-by');

// Pasitikime tik vietiniu reverse proxy (Nginx 127.0.0.1 / ::1), kad X-Forwarded-For nebūtų suklastotas
app.set('trust proxy', 'loopback');

var corsOptions = {
  origin: ['http://localhost:3300', 'http://localhost:5173', 'http://192.168.4.156:3300', 'https://prabhupada.lt', 'http://prabhupada.admin', 'https://prabhupada.admin'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(securityHeaders);
app.use(cors(corsOptions));
app.use('/api', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 600 }));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use('/api', require('./routes.js'));
app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`Server started on ${host}:${port}`);
});
