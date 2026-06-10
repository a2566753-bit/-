const puppeteer = require('puppeteer');

class FacebookAutomation {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    this.browser = null;
    this.page = null;
  }

  async launch() {
    this.browser = await puppeteer.launch({ headless: false });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1366, height: 768 });
  }

  async login() {
    try {
      await this.page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });
      
      // إدخال البريد الإلكتروني
      await this.page.type('input[name="email"]', this.email);
      
      // إدخال كلمة المرور
      await this.page.type('input[name="pass"]', this.password);
      
      // الضغط على زر تسجيل الدخول
      await this.page.click('button[name="login"]');
      
      // انتظار تحميل الصفحة
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      console.log('✅ تم تسجيل الدخول بنجاح');
      return true;
    } catch (error) {
      console.error('❌ خطأ في تسجيل الدخول:', error);
      return false;
    }
  }

  async navigateToCatalog() {
    try {
      // الذهاب إلى Business Suite
      await this.page.goto('https://business.facebook.com', { waitUntil: 'networkidle2' });
      
      // البحث عن قسم الكتالوج
      await this.page.waitForSelector('a[href*="catalog"]', { timeout: 5000 });
      await this.page.click('a[href*="catalog"]');
      
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      console.log('✅ تم الانتقال إلى الكتالوج');
      return true;
    } catch (error) {
      console.error('❌ خطأ في الانتقال إلى الكتالوج:', error);
      return false;
    }
  }

  async addProduct(product) {
    try {
      // الضغط على زر إضافة منتج
      await this.page.click('button:has-text("إضافة منتج")');
      await this.page.waitForTimeout(1000);

      // إدخال اسم المنتج
      const nameInputs = await this.page.$$('input[type="text"]');
      if (nameInputs.length > 0) {
        await nameInputs[0].type(product.name);
      }

      // إدخال السعر
      const priceInputs = await this.page.$$('input[type="number"]');
      if (priceInputs.length > 0) {
        await priceInputs[0].type(product.price);
      }

      // إدخال الوصف
      const textareas = await this.page.$$('textarea');
      if (textareas.length > 0) {
        await textareas[0].type(product.description);
      }

      // رفع الصورة من الرابط
      if (product.imageUrl) {
        await this.uploadImageFromUrl(product.imageUrl);
      }

      // الضغط على زر الحفظ
      await this.page.click('button:has-text("حفظ")');
      await this.page.waitForTimeout(2000);

      console.log(`✅ تم إضافة المنتج: ${product.name}`);
      return true;
    } catch (error) {
      console.error(`❌ خطأ في إضافة المنتج ${product.name}:`, error);
      return false;
    }
  }

  async uploadImageFromUrl(imageUrl) {
    try {
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');

      // تحميل الصورة
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'stream'
      });

      const tmpPath = path.join('/tmp', 'temp_image.jpg');
      const writer = fs.createWriteStream(tmpPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('❌ خطأ في تحميل الصورة:', error);
    }
  }

  async addAllProducts(products) {
    for (let i = 0; i < products.length; i++) {
      console.log(`📦 جاري إضافة المنتج ${i + 1} من ${products.length}`);
      await this.addProduct(products[i]);
      await this.page.waitForTimeout(1500); // انتظار بين المنتجات
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ تم إغلاق المتصفح');
    }
  }
}

module.exports = FacebookAutomation;
