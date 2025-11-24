const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI if API key is available
const gemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here'
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Use AI to enhance and clean extracted text from DOCX content
 * @param {string} extractedText - Text extracted by mammoth
 * @param {Buffer} buffer - Original DOCX file buffer (for context)
 * @returns {Promise<string>} AI-enhanced text content
 */
async function enhanceExtractionWithAI(extractedText, buffer) {
  if (!gemini) {
    console.log('⚠️  Gemini AI not available, using standard extraction');
    return extractedText;
  }

  try {
    console.log('🤖 Using AI to enhance and clean extracted text...');
    
    // Try multiple models for better compatibility
    let model;
    let modelName = 'gemini-1.5-flash';
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro'];
    
    for (const testModel of modelsToTry) {
      try {
        model = gemini.getGenerativeModel({ model: testModel });
        modelName = testModel;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!model) {
      throw new Error('Could not initialize any Gemini model');
    }
    
    // Use more content for better enhancement (up to 30k chars)
    const contentToEnhance = extractedText.length > 30000 
      ? extractedText.substring(0, 30000) + '\n\n[... content continues ...]' 
      : extractedText;
    
    // Use AI to clean up, structure, and enhance the extracted text
    const prompt = `You are a document processing assistant. I have extracted text from a DOCX (Word document) file. Please clean, structure, and enhance it while preserving ALL content.

Current extracted text:
${contentToEnhance}

CRITICAL INSTRUCTIONS:
1. Preserve ALL actual content - do not remove any meaningful text, sentences, or information
2. Clean up formatting artifacts, extra whitespace, and noise
3. Maintain document structure - keep headings, paragraphs, lists, and tables organized
4. Fix any extraction errors or garbled text if you can identify what it should be
5. Ensure proper spacing and readability
6. If there are tables, preserve their structure clearly with clear separators
7. If there are lists, maintain their hierarchy and formatting
8. Do NOT summarize or shorten the content - this is for study material, we need all details
9. If content seems incomplete, note it but don't make up content

Return ONLY the cleaned and enhanced text content. Do not add any commentary, explanations, or notes. Just return the cleaned text exactly as it should appear.`;

    console.log(`📤 Sending ${contentToEnhance.length} characters to AI for enhancement...`);
    const startTime = Date.now();
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text().trim();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`📥 AI enhancement completed in ${duration}s`);
    
    // Validate AI result is meaningful
    // AI might clean up text, so it could be shorter but still valid
    if (aiText && aiText.length > 50) {
      // Check if AI result is reasonable (at least 30% of original or substantial content)
      if (aiText.length > extractedText.length * 0.3 || aiText.length > 500) {
        console.log(`✅ AI enhancement complete: ${aiText.length} characters (was ${extractedText.length})`);
        return aiText;
      }
    }
    
    console.log('⚠️  AI enhancement returned insufficient result, using original');
    return extractedText;
  } catch (aiError) {
    console.error('❌ AI enhancement failed:', aiError.message);
    console.log('📄 Falling back to standard extraction');
    // Don't throw - always return original text as fallback
    return extractedText;
  }
}

/**
 * Use AI to extract text when mammoth fails or produces poor results
 * @param {Buffer} buffer - DOCX file buffer
 * @param {string} extractedText - Text from mammoth (may be empty or poor quality)
 * @returns {Promise<string>} AI-extracted text content
 */
async function extractWithAI(buffer, extractedText = '') {
  if (!gemini) {
    throw new Error('AI extraction not available - Gemini API key not configured');
  }

  try {
    console.log('🤖 Using AI for text extraction (mammoth failed or produced poor results)...');
    
    // Try multiple models for better compatibility
    let model;
    let modelName = 'gemini-1.5-flash';
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro'];
    
    for (const testModel of modelsToTry) {
      try {
        model = gemini.getGenerativeModel({ model: testModel });
        modelName = testModel;
        console.log(`✅ Using model: ${modelName}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!model) {
      throw new Error('Could not initialize any Gemini model');
    }
    
    // If we have some text from mammoth, use it as context for enhancement
    if (extractedText && extractedText.length > 50) {
      const prompt = `The text extraction from a DOCX file produced incomplete or poor results. Please help reconstruct and enhance the full text content.

Partial extracted text (may be incomplete or have errors):
${extractedText.substring(0, 20000)}${extractedText.length > 20000 ? '\n\n[... truncated ...]' : ''}

Please provide a complete, well-structured version of the document text. 
- Include all content that should be in the document
- Fix any extraction errors you can identify
- Maintain proper structure (headings, paragraphs, lists)
- Do NOT summarize - we need the full content for study purposes
- If some parts seem garbled, try to reconstruct them based on context

Return ONLY the cleaned and complete text, no explanations.`;

      console.log(`📤 Sending ${extractedText.length} characters to AI for reconstruction...`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text().trim();
      
      if (aiText && aiText.length > 100) {
        console.log(`✅ AI extraction/reconstruction successful: ${aiText.length} characters`);
        return aiText;
      }
    }
    
    // If no text from mammoth, we can't extract with current AI setup
    throw new Error('AI extraction requires at least partial text from standard extraction. The file may be corrupted or in an unsupported format.');
  } catch (aiError) {
    console.error('❌ AI extraction error:', aiError.message);
    throw new Error(`AI extraction failed: ${aiError.message}`);
  }
}

/**
 * Extract text from base64 encoded DOCX file
 * @param {string} base64Data - Base64 encoded file data (with or without data URL prefix)
 * @param {string} fileType - File type ('docx', 'txt', 'md')
 * @param {boolean} useAI - Whether to use AI enhancement (default: true if available)
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromFile(base64Data, fileType, useAI = true) {
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
      
      // If extraction failed or produced poor results, try AI
      if ((!extractedText || extractedText.length === 0 || extractedText.trim().length < 50) && useAI && gemini) {
        console.log('⚠️  Mammoth extraction produced poor results, trying AI extraction...');
        try {
          extractedText = await extractWithAI(buffer, extractedText);
        } catch (aiError) {
          console.error('❌ AI extraction also failed:', aiError.message);
          // If AI fails and we have no text, throw error
          if (!extractedText || extractedText.length === 0) {
            throw new Error('Both standard and AI extraction failed. The file might be corrupted or contain no readable text.');
          }
          // Continue with mammoth result even if poor
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
      
      // Use AI to enhance extraction if available and enabled
      if (useAI && gemini && extractedText.length > 100) {
        try {
          console.log('🤖 Enhancing extraction with AI...');
          const enhancedText = await enhanceExtractionWithAI(extractedText, buffer);
          if (enhancedText && enhancedText.length > extractedText.length * 0.8) {
            // Only use AI result if it's not significantly shorter (might have lost content)
            extractedText = enhancedText;
            console.log(`✅ AI enhancement complete: ${extractedText.length} characters`);
          } else {
            console.log('⚠️  AI enhancement produced shorter result, keeping original');
          }
        } catch (enhanceError) {
          console.warn('⚠️  AI enhancement failed, using standard extraction:', enhanceError.message);
          // Continue with mammoth result
        }
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


