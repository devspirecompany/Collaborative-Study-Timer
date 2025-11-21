const mammoth = require('mammoth');

/**
 * Extract text from base64 encoded DOCX file
 * @param {string} base64Data - Base64 encoded file data (with or without data URL prefix)
 * @param {string} fileType - File type ('docx', 'txt', 'md')
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromFile(base64Data, fileType) {
  try {
    // Only DOCX files need extraction, txt and md are already text
    if (fileType !== 'docx') {
      // For txt and md, the content is already text
      // But if it's base64, decode it
      let base64Content = base64Data;
      if (base64Data.includes(',')) {
        base64Content = base64Data.split(',')[1];
      }
      
      try {
        return Buffer.from(base64Content, 'base64').toString('utf-8');
      } catch {
        // If decoding fails, assume it's already text
        return base64Data;
      }
    }

    // Remove data URL prefix if present (e.g., "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,")
    let base64Content = base64Data;
    if (base64Data.includes(',')) {
      base64Content = base64Data.split(',')[1];
    }

    // Validate base64 content
    if (!base64Content || base64Content.trim().length === 0) {
      throw new Error('Empty base64 content received');
    }

    // Convert base64 to buffer
    let buffer;
    try {
      buffer = Buffer.from(base64Content, 'base64');
      if (buffer.length === 0) {
        throw new Error('Invalid base64 data - buffer is empty');
      }
    } catch (bufferError) {
      throw new Error(`Failed to decode base64: ${bufferError.message}`);
    }

    // Extract text from DOCX
    console.log(`📄 Extracting text from DOCX file (${buffer.length} bytes)...`);
    
    try {
      // Validate buffer is not empty and looks like a DOCX file (should start with PK signature for ZIP)
      if (buffer.length < 4) {
        throw new Error('File is too small to be a valid DOCX file');
      }
      
      // Check for ZIP signature (DOCX files are ZIP archives)
      const zipSignature = buffer.slice(0, 2);
      if (zipSignature[0] !== 0x50 || zipSignature[1] !== 0x4B) {
        console.warn('⚠️ File does not have ZIP signature - might not be a valid DOCX file');
        // Continue anyway, mammoth will handle it
      }
      
      const result = await mammoth.extractRawText({ buffer });
      let extractedText = result.value ? result.value.trim() : '';
      
      // Check for warnings (images, formatting that couldn't be extracted)
      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages.filter(m => m.type === 'warning');
        if (warnings.length > 0) {
          console.warn('⚠️ DOCX extraction warnings:', warnings.map(m => m.message).join(', '));
        }
      }
      
      if (!extractedText || extractedText.length === 0) {
        throw new Error('DOCX file appears to be empty or contains no readable text. Please ensure the file contains actual text content (not just images or formatting).');
      }
      
      console.log(`✅ Extracted ${extractedText.length} characters from DOCX`);
      console.log(`📝 First 200 chars: ${extractedText.substring(0, 200)}...`);
      
      // Validate extracted text length
      if (extractedText.trim().length < 10) {
        throw new Error(`Extracted text is too short (${extractedText.length} characters). The DOCX file might be empty or contain only images/formatting without text.`);
      }
      
      return extractedText;
    } catch (mammothError) {
      console.error('❌ Mammoth extraction error:', mammothError);
      console.error('Error name:', mammothError.name);
      console.error('Error message:', mammothError.message);
      console.error('Error stack:', mammothError.stack);
      
      // Provide specific error messages based on error type
      if (mammothError.message && mammothError.message.includes('Invalid file') || mammothError.message.includes('not a valid')) {
        throw new Error('Invalid DOCX file. The file might be corrupted or not a valid DOCX document. Please ensure the file was saved as .docx format.');
      } else if (mammothError.message && mammothError.message.includes('empty')) {
        throw new Error('DOCX file appears to be empty or contains no readable text.');
      } else if (mammothError.message && mammothError.message.includes('too small')) {
        throw new Error('File is too small to be a valid DOCX file. The file might be corrupted.');
      } else {
        // Return the actual error message from mammoth
        const errorMsg = mammothError.message || mammothError.toString();
        throw new Error(`DOCX extraction failed: ${errorMsg}. Please ensure the file is a valid DOCX document and contains readable text.`);
      }
    }
  } catch (error) {
    console.error(`❌ Error extracting text from ${fileType}:`, error.message);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to extract text from ${fileType} file: ${error.message}`);
  }
}

module.exports = {
  extractTextFromFile
};


