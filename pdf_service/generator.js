const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;

async function generatePDF(baseFileUrl, fieldSchema, payload, options = {}) {
  try {
    // Load the base PDF
    let pdfBytes;
    if (baseFileUrl.startsWith('http')) {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(baseFileUrl);
      pdfBytes = await response.arrayBuffer();
    } else {
      pdfBytes = await fs.readFile(baseFileUrl);
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fonts = {
      'Helvetica': helvetica,
      'Helvetica-Bold': helveticaBold,
      'default': helvetica
    };

    // Process each field
    for (const field of fieldSchema) {
      const page = pages[field.pageIndex];
      if (!page) continue;

      const pageHeight = page.getHeight();
      const value = getValueFromPayload(payload, field.key);

      if (value === null || value === undefined) continue;

      const font = fonts[field.style.fontFamily] || fonts.default;
      let fontSize = field.style.fontSize || 11;
      const { x, y, w, h } = field.rect;

      // Convert from PDF bottom-left coordinates
      const yPosition = pageHeight - y - h;

      switch (field.type) {
        case 'TEXT':
          const text = String(value);
          
          // Auto-shrink if text is too wide
          let textWidth = font.widthOfTextAtSize(text, fontSize);
          if (textWidth > w) {
            fontSize = fontSize * (w / textWidth) * 0.95;
            textWidth = font.widthOfTextAtSize(text, fontSize);
          }

          // Calculate alignment
          let xPos = x;
          if (field.style.alignment === 'CENTER') {
            xPos = x + (w - textWidth) / 2;
          } else if (field.style.alignment === 'RIGHT') {
            xPos = x + w - textWidth;
          }

          page.drawText(text, {
            x: xPos,
            y: yPosition + (h - fontSize) / 2,
            size: fontSize,
            font: font,
            color: hexToRgb(field.style.color || '#000000')
          });
          break;

        case 'CHECKBOX':
          if (value === true || value === 'true' || value === 1) {
            const tickChar = field.style.tickChar || '✓';
            const tickSize = Math.min(w, h) * 0.7;
            page.drawText(tickChar, {
              x: x + (w - font.widthOfTextAtSize(tickChar, tickSize)) / 2,
              y: yPosition + (h - tickSize) / 2,
              size: tickSize,
              font: font,
              color: hexToRgb(field.style.color || '#000000')
            });
          }
          break;

        case 'DATE':
          const dateStr = formatDate(value);
          page.drawText(dateStr, {
            x: x,
            y: yPosition + (h - fontSize) / 2,
            size: fontSize,
            font: font,
            color: hexToRgb(field.style.color || '#000000')
          });
          break;

        case 'SIGNATURE_ANCHOR':
          // Draw transparent anchor text for e-sign services
          page.drawText(`\\s${field.id}\\`, {
            x: x,
            y: yPosition,
            size: 1,
            font: font,
            color: rgb(1, 1, 1) // Nearly white, invisible
          });
          break;
      }
    }

    // Flatten if requested
    if (options.flatten) {
      const form = pdfDoc.getForm();
      form.flatten();
    }

    const pdfBytesResult = await pdfDoc.save();
    
    if (options.output === 'base64') {
      return Buffer.from(pdfBytesResult).toString('base64');
    } else {
      return pdfBytesResult;
    }
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
}

function getValueFromPayload(obj, path) {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return null;
    value = value[key];
  }
  return value;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : rgb(0, 0, 0);
}

function formatDate(value) {
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return String(value);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node generator.js <input-json>');
    process.exit(1);
  }

  const inputJson = JSON.parse(args[0]);
  generatePDF(inputJson.fileUrl, inputJson.fieldSchema, inputJson.payload, inputJson.options)
    .then(result => {
      console.log(result);
    })
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { generatePDF };