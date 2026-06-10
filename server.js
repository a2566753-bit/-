const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'center-al-leith-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/catalog', require('./routes/catalog'));

// Serve HTML Files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ أداة سنتر الليث تعمل على http://localhost:${PORT}`);
});
