const fsp = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

async function generatePdfFromHtmlFile(htmlPath, pdfPath) {
  await fsp.mkdir(path.dirname(pdfPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: {
        width: 1240,
        height: 1754
      },
      deviceScaleFactor: 1
    });

    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      }
    });
  } finally {
    await browser.close();
  }

  return pdfPath;
}

module.exports = {
  generatePdfFromHtmlFile
};
