const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const facebookAuth = require('../services/facebookAuth');

// قائمة المستخدمين (في التطبيق الحقيقي، استخدم قاعدة بيانات)
const users = {};

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'كلمات المرور غير متطابقة' });
  }

  if (users[email]) {
    return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { email, password: hashedPassword, products: [] };
    req.session.userId = email;
    res.json({ success: true, message: 'تم التسجيل بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التسجيل' });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'البريد والكلمة المرورية مطلوبة' });
  }

  if (!users[email]) {
    return res.status(400).json({ error: 'بريد أو كلمة مرور غير صحيحة' });
  }

  try {
    const isPasswordValid = await bcrypt.compare(password, users[email].password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'بريد أو كلمة مرور غير صحيحة' });
    }

    req.session.userId = email;
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
  }
});

// الحصول على بيانات المستخدم
router.get('/user', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  const user = users[req.session.userId];
  res.json({ email: user.email, productsCount: user.products.length });
});

// تسجيل الخروج
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'خطأ في تسجيل الخروج' });
    res.json({ success: true, message: 'تم تسجيل الخروج' });
  });
});

// ربط فيسبوك
router.post('/connect-facebook', async (req, res) => {
  const { facebookEmail, facebookPassword } = req.body;

  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  try {
    const result = await facebookAuth.connectFacebook(facebookEmail, facebookPassword);
    
    if (result.success) {
      users[req.session.userId].facebookToken = result.token;
      users[req.session.userId].facebookEmail = facebookEmail;
      res.json({ success: true, message: 'تم ربط فيسبوك بنجاح' });
    } else {
      res.status(400).json({ error: result.error || 'فشل الربط مع فيسبوك' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في ربط فيسبوك' });
  }
});

module.exports = router;
