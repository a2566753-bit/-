const express = require('express');
const router = express.Router();
const FacebookAutomation = require('../services/facebookAutomation');

// بدء عملية إضافة المنتجات
router.post('/start', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  const { facebookEmail, facebookPassword } = req.body;
  const products = req.session.userProducts || [];

  if (!facebookEmail || !facebookPassword) {
    return res.status(400).json({ error: 'بيانات فيسبوك مطلوبة' });
  }

  if (products.length === 0) {
    return res.status(400).json({ error: 'لا توجد منتجات للإضافة' });
  }

  try {
    const automation = new FacebookAutomation(facebookEmail, facebookPassword);
    
    // إطلاق المتصفح
    await automation.launch();
    
    // تسجيل الدخول
    const loginSuccess = await automation.login();
    if (!loginSuccess) {
      await automation.close();
      return res.status(400).json({ error: 'فشل تسجيل الدخول إلى فيسبوك' });
    }

    // الانتقال إلى الكتالوج
    const navigateSuccess = await automation.navigateToCatalog();
    if (!navigateSuccess) {
      await automation.close();
      return res.status(400).json({ error: 'فشل الانتقال إلى الكتالوج' });
    }

    // إضافة المنتجات
    await automation.addAllProducts(products);
    
    // إغلاق المتصفح
    await automation.close();

    res.json({ 
      success: true, 
      message: `تم إضافة ${products.length} منتج بنجاح إلى الكتالوج`,
      productsAdded: products.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في عملية الإضافة' });
  }
});

// الحصول على حالة العملية
router.get('/status', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'غير مسجل دخول' });
  }

  res.json({ 
    status: 'جاهز',
    message: 'الأداة جاهزة لإضافة المنتجات'
  });
});

module.exports = router;
