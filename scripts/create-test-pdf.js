const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

async function createTestPDF() {
  const pdfDoc = await PDFDocument.create();
  
  // 첫 번째 페이지
  const page1 = pdfDoc.addPage([600, 400]);
  const { width, height } = page1.getSize();
  
  page1.drawText('Test PDF File', {
    x: 50,
    y: height - 50,
    size: 24,
    color: rgb(0, 0, 0),
  });
  
  page1.drawText('This is a test PDF file for text extraction testing.', {
    x: 50,
    y: height - 100,
    size: 12,
    color: rgb(0, 0, 0),
  });
  
  page1.drawText('This PDF contains text that should be extractable.', {
    x: 50,
    y: height - 150,
    size: 12,
    color: rgb(0, 0, 0),
  });
  
  page1.drawText('The text extraction should work properly with this file.', {
    x: 50,
    y: height - 200,
    size: 12,
    color: rgb(0, 0, 0),
  });
  
  // 두 번째 페이지
  const page2 = pdfDoc.addPage([600, 400]);
  const { width: width2, height: height2 } = page2.getSize();
  
  page2.drawText('Second Page', {
    x: 50,
    y: height2 - 50,
    size: 24,
    color: rgb(0, 0, 0),
  });
  
  page2.drawText('This is the second page of the test PDF.', {
    x: 50,
    y: height2 - 100,
    size: 12,
    color: rgb(0, 0, 0),
  });
  
  page2.drawText('Content for PDF processing test.', {
    x: 50,
    y: height2 - 150,
    size: 12,
    color: rgb(0, 0, 0),
  });
  
  page2.drawText('This page should also be processed correctly.', {
    x: 50,
    y: height2 - 200,
    size: 12,
    color: rgb(0, 0, 0),
  });
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test-pdf.pdf', pdfBytes);
  console.log('Test PDF file created: test-pdf.pdf');
}

createTestPDF().catch(console.error); 