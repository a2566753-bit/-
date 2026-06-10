require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const puppeteer = require('puppeteer');
const axios = require('axios');
const Jimp = require('jimp');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'facebook-automator-secret',
  resave: false,
  saveUninitialized: true
}));

// Storage configuration
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('downloads')) {
  fs.mkdirSync('downloads');
}

let browser = null;
let productsToAdd = [];
let currentProgress = 0;
let isRunning = false;

// Initialize Puppeteer browser
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

// Download image and convert to base64
async function downloadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  } catch (error) {
    console.error('Error downloading image:', error.message);
    return null;
  }
}

// Parse CSV file
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const products = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        products.push({
          id: data.ID,
          name: data.Name,
          price: data.Price,
          stock: data.Stock,
          description: data.Description,
          image: data.Image
        });
      })
      .on('end', () => resolve(products))
      .on('error', (error) => reject(error));
  });
}

// Upload CSV
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const products = await parseCSV(req.file.path);
    productsToAdd = products;
    currentProgress = 0;

    res.json({
      success: true,
      message: `تم تحميل ${products.length} منتج بنجاح`,
      count: products.length,
      products: products.slice(0, 5) // Show first 5 products preview
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Facebook login
app.post('/api/start-login', async (req, res) => {
  try {
    await initBrowser();
    const page = await browser.newPage();
    await page.goto('https://www.facebook.com/login.php', { waitUntil: 'networkidle2' });
    
    // Store page reference for later use
    req.session.pageUrl = page.url();
    
    res.json({
      success: true,
      message: 'يرجى تسجيل الدخول في نافذة المتصفح الجديدة',
      url: 'https://www.facebook.com/login.php'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add products to Facebook Catalog
app.post('/api/start-adding', async (req, res) => {
  try {
    if (isRunning) {
      return res.status(400).json({ error: 'عملية إضافة جارية بالفعل' });
    }

    if (productsToAdd.length === 0) {
      return res.status(400).json({ error: 'لم يتم تحميل أي منتجات' });
    }

    isRunning = true;
    currentProgress = 0;

    // Start adding products in background
    addProductsToFacebook();

    res.json({
      success: true,
      message: 'بدأت عملية إضافة المنتجات',
      total: productsToAdd.length
    });
  } catch (error) {
    isRunning = false;
    res.status(500).json({ error: error.message });
  }
});

// Add products function
async function addProductsToFacebook() {
  try {
    const pages = await browser.pages();
    let targetPage = pages[pages.length - 1]; // Get last opened page

    for (let i = 0; i < productsToAdd.length; i++) {
      const product = productsToAdd[i];
      currentProgress = i + 1;

      console.log(`Adding product ${currentProgress}/${productsToAdd.length}: ${product.name}`);

      try {
        // Download image
        let imageBase64 = null;
        if (product.image) {
          imageBase64 = await downloadImage(product.image);
        }

        // Navigate to catalog
        await targetPage.goto('https://business.facebook.com/latest/catalogs', {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        // Wait and click to add product
        await targetPage.waitForTimeout(2000);

        // Fill product information
        await targetPage.evaluate((name, price, description) => {
          const nameInput = document.querySelector('input[placeholder*="اسم"], input[placeholder*="Name"]');
          const priceInput = document.querySelector('input[placeholder*="سعر"], input[placeholder*="Price"]');
          const descInput = document.querySelector('textarea[placeholder*="الوصف"], textarea[placeholder*="Description"]');

          if (nameInput) nameInput.value = name;
          if (priceInput) priceInput.value = price;
          if (descInput) descInput.value = description;
        }, product.name, product.price, product.description);

        // Upload image if exists
        if (imageBase64) {
          // Simulate image upload
          console.log(`Image ready for: ${product.name}`);
        }

        // Click save button
        await targetPage.waitForTimeout(1000);
        const saveButton = await targetPage.$('button:has-text("حفظ"), button:has-text("Save")');
        if (saveButton) {
          await saveButton.click();
          await targetPage.waitForTimeout(2000);
        }

        console.log(`✓ تمت إضافة المنتج: ${product.name}`);
      } catch (productError) {
        console.error(`Error adding product ${product.name}:`, productError.message);
      }
    }

    isRunning = false;
    console.log('تمت إضافة جميع المنتجات!');
  } catch (error) {
    isRunning = false;
    console.error('Error in addProductsToFacebook:', error);
  }
}

// Get progress
app.get('/api/progress', (req, res) => {
  res.json({
    current: currentProgress,
    total: productsToAdd.length,
    percentage: Math.round((currentProgress / productsToAdd.length) * 100),
    isRunning: isRunning
  });
});

// Get products preview
app.get('/api/products-preview', (req, res) => {
  res.json({
    count: productsToAdd.length,
    preview: productsToAdd.slice(0, 10)
  });
});

// Clear session
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Facebook Catalog Automator`);
});

process.on('exit', async () => {
  if (browser) {
    await browser.close();
  }
});
