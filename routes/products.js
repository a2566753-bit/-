const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// إعداد multer لرفع الملفات
const upload = multer({ dest: 'uploads/' });

// قائمة المنتجات المؤقتة
const allProducts = {};

// تحميل الملف وقراءة المنتجات
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع ملف' });
  }

  const filePath = req.file.path;
  const products = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      products.push({
        name: row.name || row.الاسم,
        price: row.price || row.السعر,
        description: row.description || row.الوصف,
        imageUrl: row.imageUrl || row.رابط_الصورة
      });
    })
    .on('end', () => {
      allProducts[req.session.userId] = products;
      fs.unlinkSync(filePath);
      res.json({ 
        success: true, 
        message: `تم تحميل ${products.length} منتج`,
        productsCount: products.length 
      });
    })
    .on('error', (err) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: 'خطأ في قراءة الملف' });
    });
});

// الحصول على قائمة المنتجات
router.get('/list', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  const products = allProducts[req.session.userId] || [];
  res.json({ products, count: products.length });
});

// حذف منتج
router.delete('/:index', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  const index = parseInt(req.params.index);
  if (allProducts[req.session.userId] && allProducts[req.session.userId][index]) {
    allProducts[req.session.userId].splice(index, 1);
    res.json({ success: true, message: 'تم حذف المنتج' });
  } else {
    res.status(400).json({ error: 'المنتج غير موجود' });
  }
});

module.exports = router;
