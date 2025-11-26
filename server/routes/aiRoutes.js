const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const StudySession = require('../models/StudySession');

// Initialize OpenAI (if API key provided)
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Initialize Google Gemini (if API key provided)
// Note: Free tier API keys from Google AI Studio should work with default settings
const gemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here'
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Log API key info (first few chars only for security)
if (gemini && process.env.GEMINI_API_KEY) {
  const keyPreview = process.env.GEMINI_API_KEY.substring(0, 10) + '...';
  console.log(`🔑 Gemini API Key: ${keyPreview} (${process.env.GEMINI_API_KEY.length} chars)`);
}

// Log AI service status on startup (async test will happen on first request)
if (gemini) {
  console.log('✅ Gemini AI initialized and ready');
  console.log('   📝 Using FREE tier models: gemini-1.5-flash, gemini-1.5-flash-latest');
  console.log('   🔍 API key will be validated on first AI request');
} else {
  console.log('⚠️  Gemini AI not configured - set GEMINI_API_KEY in server/.env file to enable AI question generation');
  console.log('   📝 Get FREE API key from: https://aistudio.google.com/app/apikey');
  if (process.env.GEMINI_API_KEY) {
    console.log('   ⚠️  GEMINI_API_KEY exists in env but Gemini not initialized - check if API key format is correct');
  }
}

// Hugging Face Inference API (FREE - no API key required for public models)
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium';

/**
 * POST /api/ai/recommend-study-duration
 * Get AI-recommended study duration based on user's study history
 */
router.post('/recommend-study-duration', async (req, res) => {
  try {
    const { studyData, userId } = req.body;

    if (!studyData) {
      return res.status(400).json({
        success: false,
        message: 'Study data is required'
      });
    }

    const {
      hoursStudiedToday = 0,
      sessionCount = 0,
      averageSessionLength = 25,
      timeOfDay = new Date().getHours(),
      fatigueLevel = 0
    } = studyData;

    let recommendedMinutes = 25; // Default

    // If OpenAI API key is configured, use AI
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        const prompt = `Based on the following study data, recommend an optimal study session duration in minutes (return only the number)":
- Hours studied today: ${hoursStudiedToday}
- Session count: ${sessionCount}
- Average session length: ${averageSessionLength} minutes
- Time of day: ${timeOfDay}:00
- Fatigue level: ${fatigueLevel}

Consider:
- If the user has studied a lot today (>4 hours), recommend shorter sessions (15-20 min)
- If just starting (<1 hour), recommend longer sessions (30-45 min)
- Morning sessions (6-12) can be longer, evening (20+) should be shorter
- After many sessions (4+), recommend shorter breaks between

Return only a number between 15 and 60.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a study productivity assistant. Return only a number (minutes) between 15-60.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 10
        });

        const aiResponse = completion.choices[0].message.content.trim();
        recommendedMinutes = parseInt(aiResponse) || 25;

        // Ensure it's within valid range
        if (recommendedMinutes < 15) recommendedMinutes = 15;
        if (recommendedMinutes > 60) recommendedMinutes = 60;
      } catch (aiError) {
        console.error('OpenAI API error:', aiError.message);
        // Fall back to algorithm
        recommendedMinutes = calculateRecommendedDuration(studyData);
      }
    } else {
      // Use algorithm-based fallback
      recommendedMinutes = calculateRecommendedDuration(studyData);
    }

    // Generate AI insights (if using AI)
    let insights = null;
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        const insightsPrompt = `Based on this study data, provide a brief insight (1-2 sentences):
- Hours studied today: ${hoursStudiedToday}
- Session count: ${sessionCount}
- Time of day: ${timeOfDay}:00
- Recommended duration: ${recommendedMinutes} minutes

Provide a motivational or analytical insight. Keep it short and encouraging.`;
        
        const insightsCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a study productivity coach. Provide brief, encouraging insights.'
            },
            {
              role: 'user',
              content: insightsPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 50
        });
        
        insights = insightsCompletion.choices[0].message.content.trim();
      } catch (error) {
        // Ignore insights error, not critical
        console.log('Could not generate insights:', error.message);
      }
    }

    res.json({
      success: true,
      recommendedMinutes,
      method: process.env.OPENAI_API_KEY ? 'ai' : 'algorithm',
      insights: insights || getFallbackInsight(studyData, recommendedMinutes)
    });
  } catch (error) {
    console.error('Error recommending study duration:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recommendation',
      error: error.message
    });
  }
});

/**
 * GET /api/ai/list-models
 * List all available models for the API key
 */
router.get('/list-models', async (req, res) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
    return res.json({
      success: false,
      message: 'GEMINI_API_KEY not set in .env file'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // Try v1beta first
    const v1betaUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await axios.get(v1betaUrl, {
      timeout: 10000
    });

    if (response.data && response.data.models) {
      const availableModels = response.data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => ({
          name: m.name,
          displayName: m.displayName,
          description: m.description,
          supportedMethods: m.supportedGenerationMethods
        }));

      return res.json({
        success: true,
        apiVersion: 'v1beta',
        models: availableModels,
        total: availableModels.length
      });
    }
  } catch (v1betaError) {
    console.log('v1beta failed, trying v1...');
    
    // Try v1
    try {
      const v1Url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const response = await axios.get(v1Url, {
        timeout: 10000
      });

      if (response.data && response.data.models) {
        const availableModels = response.data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => ({
            name: m.name,
            displayName: m.displayName,
            description: m.description,
            supportedMethods: m.supportedGenerationMethods
          }));

        return res.json({
          success: true,
          apiVersion: 'v1',
          models: availableModels,
          total: availableModels.length
        });
      }
    } catch (v1Error) {
      return res.json({
        success: false,
        error: 'Failed to list models',
        v1betaError: v1betaError.response?.data?.error?.message || v1betaError.message,
        v1Error: v1Error.response?.data?.error?.message || v1Error.message
      });
    }
  }

  return res.json({
    success: false,
    message: 'Could not retrieve available models'
  });
});

/**
 * GET /api/ai/test-models
 * Test which Gemini models are available with the current API key
 */
router.get('/test-models', async (req, res) => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
    return res.json({
      success: false,
      message: 'GEMINI_API_KEY not set in .env file'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelsToTest = [
    'gemini-1.5-flash', // Most common, works with v1 API
    'gemini-1.5-flash-001', // Specific version
    'gemini-1.5-flash-latest', // Latest version
    'gemini-pro', // Fallback (older but stable)
    'gemini-1.5-pro' // Alternative (may require paid tier)
  ];

  const results = [];

  // First, try using REST API directly (more reliable)
  for (const modelName of modelsToTest) {
    let restError = null;
    let restWorked = false;

    // Try REST API first - try v1 then v1beta
    let restResponse = null;
    let apiVersion = null;
    
    // Try v1 first (more stable)
    try {
      const v1Url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
      restResponse = await axios.post(v1Url, {
        contents: [{
          parts: [{
            text: 'Say "test"'
          }]
        }]
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      apiVersion = 'v1';
    } catch (v1Error) {
      // Try v1beta as fallback
      try {
        const v1betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        restResponse = await axios.post(v1betaUrl, {
          contents: [{
            parts: [{
              text: 'Say "test"'
            }]
          }]
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        apiVersion = 'v1beta';
      } catch (v1betaError) {
        restError = v1betaError;
        // Don't throw - let it continue to SDK fallback
      }
    }

    if (restResponse) {
      if (restResponse.data && restResponse.data.candidates && restResponse.data.candidates[0]) {
        results.push({
          model: modelName,
          status: '✅ WORKING (REST API)',
          response: restResponse.data.candidates[0].content?.parts[0]?.text?.substring(0, 50) || 'Success'
        });
        restWorked = true;
      }
    } else {
      // REST API failed, will try SDK
      restError = new Error('REST API request failed');
    }

    // Try SDK as fallback if REST didn't work
    if (!restWorked && gemini) {
      try {
        const model = gemini.getGenerativeModel({ model: modelName });
        const testResult = await model.generateContent('Say "test"');
        const response = await testResult.response;
        results.push({
          model: modelName,
          status: '✅ WORKING (SDK)',
          response: response.text().substring(0, 50)
        });
      } catch (sdkError) {
        results.push({
          model: modelName,
          status: '❌ FAILED',
          error: sdkError.message?.substring(0, 150) || 'Unknown error',
          restError: restError?.response?.data?.error?.message || restError?.message || 'N/A'
        });
      }
    } else if (!restWorked) {
      results.push({
        model: modelName,
        status: '❌ FAILED',
        error: 'Both REST API and SDK failed',
        restError: restError?.response?.data?.error?.message || restError?.message || 'N/A'
      });
    }
  }

  res.json({
    success: true,
    results,
    message: 'Check which models work with your API key',
    apiKeyPreview: apiKey.substring(0, 10) + '...',
    apiKeyLength: apiKey.length
  });
});

/**
 * POST /api/ai/generate-questions
 * Generate questions from file content using AI
 */
router.post('/generate-questions', async (req, res) => {
  try {
    const { fileContent, subject, numQuestions = 5, testType = 'multiple_choice' } = req.body;

    console.log(`\n🔵 ===== Question Generation Request =====`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📊 Requested questions: ${numQuestions}`);
    console.log(`📝 Test type: ${testType}`);
    console.log(`📄 File content length: ${fileContent?.length || 0} characters`);
    console.log(`🔑 Gemini configured: ${gemini ? 'YES ✅' : 'NO ❌'}`);
    console.log(`🔑 Gemini API Key exists: ${process.env.GEMINI_API_KEY ? 'YES ✅' : 'NO ❌'}`);

    if (!fileContent || !subject) {
      return res.status(400).json({
        success: false,
        message: 'File content and subject are required'
      });
    }

    // Validate test type
    const validTestTypes = ['multiple_choice', 'true_false', 'fill_blank'];
    if (!validTestTypes.includes(testType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid test type. Must be one of: ${validTestTypes.join(', ')}`
      });
    }

    let questions = [];
    let method = 'fallback'; // Track which method was used

    // Try to use AI (Gemini FREE or OpenAI if configured)
    // If no AI available, use fallback (no error thrown)
    try {
      // Check if Gemini is available
      if (!gemini) {
        console.log('⚠️ Gemini is not initialized - will use fallback question generation');
        console.log('   GEMINI_API_KEY in env:', process.env.GEMINI_API_KEY ? 'EXISTS' : 'MISSING');
        if (process.env.GEMINI_API_KEY) {
          const isPlaceholder = process.env.GEMINI_API_KEY === 'your-gemini-api-key-here';
          console.log('   ⚠️  API key is placeholder:', isPlaceholder ? 'YES - Replace with real key!' : 'NO');
        }
        // Don't throw error - use fallback instead
        throw new Error('USE_FALLBACK'); // Special error to trigger fallback
      }
      
      // Use Gemini (FREE) as primary AI
      // For Google AI Studio free tier, use gemini-1.5-flash (FREE tier model)
      // Model names for FREE tier: gemini-1.5-flash, gemini-1.5-flash-latest
      let model;
      let modelName = 'gemini-1.5-flash'; // FREE tier model
      let modelWorked = false;
      
      // Try different FREE tier model names
      // Updated: Use v1 API compatible model names (v1beta has limited support)
      const freeTierModels = [
        'gemini-1.5-flash', // Most common, works with v1 API
        'gemini-1.5-flash-001', // Specific version
        'gemini-1.5-flash-latest', // Latest version
        'gemini-pro', // Fallback (older but stable)
        'gemini-1.5-pro' // Alternative (may require paid tier)
      ];
      
      for (const testModelName of freeTierModels) {
        try {
          console.log(`🔍 Trying Gemini SDK model: ${testModelName}...`);
          // Remove 'models/' prefix if present (SDK doesn't need it)
          const cleanModelName = testModelName.replace(/^models\//, '');
          model = gemini.getGenerativeModel({ model: cleanModelName });
          
          // Quick test to verify model works
          console.log('🧪 Testing model with a small API call...');
          const testResult = await model.generateContent('Say "test"');
          const testResponse = await testResult.response;
          const testText = testResponse.text();
          
          if (testText && testText.length > 0) {
            modelName = cleanModelName; // Use clean name without prefix
            modelWorked = true;
            console.log(`✅ SDK Model ${modelName} is working! Test response: ${testText.substring(0, 50)}`);
            break;
          }
        } catch (testError) {
          // Check if it's an API version error - skip SDK and go to REST API
          if (testError.message && testError.message.includes('not found for API version')) {
            console.log(`⚠️ Model ${testModelName} not available in SDK API version: ${testError.message}`);
            console.log('   → Will try REST API instead (supports v1 and v1beta)');
            break; // Exit SDK testing, go to REST API
          }
          console.log(`⚠️ SDK Model ${testModelName} failed: ${testError.message}`);
          continue; // Try next model
        }
      }
      
      // If SDK failed, try REST API directly
      if (!modelWorked) {
        console.log('⚠️ SDK failed, trying REST API directly...');
        const apiKey = process.env.GEMINI_API_KEY;
        // Use v1 API models (more stable than v1beta)
        const modelsToTry = [
          'gemini-1.5-flash',  // Most common free tier model
          'gemini-1.5-flash-001',  // Specific version
          'gemini-pro',  // Fallback
          'gemini-1.5-pro'  // Alternative
        ];
        
        for (const restModelName of modelsToTry) {
          try {
            const contentPreview = fileContent.length > 20000 
              ? fileContent.substring(0, 20000) + '\n\n[... content continues ...]' 
              : fileContent;
            const prompt = generatePromptForTestType(testType, numQuestions, subject, contentPreview);
            
            // Try v1 API first (more stable, recommended)
            let restUrl = `https://generativelanguage.googleapis.com/v1/models/${restModelName}:generateContent?key=${apiKey}`;
            console.log(`🔍 Trying REST API with model: ${restModelName} (v1 - recommended)...`);
            const startTime = Date.now();
            
            let restResponse = null;
            let apiVersionUsed = 'v1';
            
            try {
              restResponse = await axios.post(restUrl, {
                contents: [{
                  parts: [{
                    text: prompt
                  }]
                }]
              }, {
                headers: {
                  'Content-Type': 'application/json'
                },
                timeout: 60000
              });
              
              console.log(`✅ REST API (v1) worked with ${restModelName}!`);
            } catch (v1Error) {
              // Only try v1beta if v1 fails (v1beta has limited model support)
              console.log(`⚠️ v1 failed for ${restModelName}, trying v1beta...`);
              restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${restModelName}:generateContent?key=${apiKey}`;
              apiVersionUsed = 'v1beta';
              
              try {
                restResponse = await axios.post(restUrl, {
                  contents: [{
                    parts: [{
                      text: prompt
                    }]
                  }]
                }, {
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  timeout: 60000
                });
                
                console.log(`✅ REST API (v1beta) worked with ${restModelName}!`);
              } catch (v1betaError) {
                console.log(`❌ Both v1 and v1beta failed for ${restModelName}: ${v1betaError.message}`);
                continue; // Try next model
              }
            }
            
            if (restResponse && restResponse.data && restResponse.data.candidates && restResponse.data.candidates[0]) {
              const aiResponse = restResponse.data.candidates[0].content?.parts[0]?.text?.trim() || '';
              
              // Parse response
              let jsonString = aiResponse;
              jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              let jsonMatch = jsonString.match(/\[[\s\S]*\]/);
              
              if (jsonMatch) {
                questions = JSON.parse(jsonMatch[0]);
                method = `gemini-ai-rest-${apiVersionUsed}`;
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`✅ Successfully generated ${questions.length} questions using REST API ${apiVersionUsed} (took ${duration}s)`);
                modelWorked = true;
                break;
              }
            } else {
              console.log(`⚠️ REST API response invalid for ${restModelName}`);
            }
          } catch (restError) {
            console.log(`⚠️ REST API failed for ${restModelName}: ${restError.message}`);
            continue; // Try next model
          }
        }
      }
      
      if (!modelWorked) {
        // Don't throw error - use fallback instead
        console.log('⚠️ All Gemini models failed - using fallback question generation');
        throw new Error('USE_FALLBACK');
      }
      
      // If SDK worked, use it
      if (model && questions.length === 0) {
        console.log(`✅ Using Gemini model: ${modelName}`);
        
        // Increase content limit - Gemini Pro can handle up to ~30k tokens
        // Use more content for better question quality (up to 20k characters)
        const contentPreview = fileContent.length > 20000 
          ? fileContent.substring(0, 20000) + '\n\n[... content continues ...]' 
          : fileContent;
        
        console.log(`\n🤖 ===== Using Gemini AI =====`);
        console.log(`📝 Sending ${contentPreview.length} characters to Gemini AI`);
        console.log(`📄 Content preview (first 500 chars): ${contentPreview.substring(0, 500)}...`);
        
        const startTime = Date.now();
        
        // Generate prompt based on test type
        const prompt = generatePromptForTestType(testType, numQuestions, subject, contentPreview);

        console.log('📤 Sending request to Gemini API...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponse = response.text().trim();
      console.log('📥 Received response from Gemini API');
      console.log('📄 Response length:', aiResponse.length);
      console.log('📄 Response preview (first 200 chars):', aiResponse.substring(0, 200));
      
      // Extract JSON from response (remove markdown code blocks if present)
      let jsonString = aiResponse;
      // Remove markdown code blocks
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Extract JSON array - try multiple patterns
      let jsonMatch = jsonString.match(/\[[\s\S]*\]/);
      
      // If no array found, try to find JSON object with questions array
      if (!jsonMatch) {
        const objectMatch = jsonString.match(/\{[\s\S]*"questions"[\s\S]*\[[\s\S]*\][\s\S]*\}/);
        if (objectMatch) {
          try {
            const parsed = JSON.parse(objectMatch[0]);
            if (parsed.questions && Array.isArray(parsed.questions)) {
              questions = parsed.questions;
              method = 'gemini-ai';
              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(`✅ Successfully generated ${questions.length} questions using Gemini AI (took ${duration}s)`);
            }
          } catch (e) {
            // Continue to try array pattern
          }
        }
      }
      
      // Try parsing the array directly
      if (questions.length === 0 && jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            questions = parsed;
            method = 'gemini-ai';
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Successfully generated ${questions.length} questions using Gemini AI (took ${duration}s)`);
          } else {
            throw new Error('Parsed array is empty or invalid');
          }
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError.message);
          console.error('Attempted to parse:', jsonMatch[0].substring(0, 200));
          throw new Error(`Could not parse JSON from AI response: ${parseError.message}`);
        }
      }
      
      // If still no questions, throw error
      if (!questions.length) {
        console.error('❌ Could not extract questions from Gemini response');
        console.error('Raw response (first 500 chars):', aiResponse.substring(0, 500));
        throw new Error('Could not parse JSON from AI response - no valid questions array found');
      }
      }
    } catch (geminiError) {
      // Check if this is a fallback request
      if (geminiError.message === 'USE_FALLBACK') {
        console.log('📝 Using fallback question generation (no AI required)');
        questions = generateContentBasedQuestions(fileContent, subject, numQuestions, testType);
        method = 'fallback';
      } else {
        console.error('\n❌ ===== Gemini AI Error =====');
        console.error('Error message:', geminiError.message);
        console.error('Error name:', geminiError.name);
        console.error('Error code:', geminiError.code);
        console.error('Full error:', JSON.stringify(geminiError, null, 2));
        
        // Check for common Gemini API errors and provide helpful messages
        if (geminiError.message?.includes('API_KEY_INVALID') || 
            geminiError.message?.includes('invalid API key') ||
            geminiError.message?.includes('API key not valid')) {
          console.error('🔑 API KEY ERROR: Your GEMINI_API_KEY appears to be invalid!');
          console.error('   📝 Steps to fix:');
          console.error('   1. Go to: https://aistudio.google.com/app/apikey');
          console.error('   2. Create a new API key (FREE tier)');
          console.error('   3. Copy the API key');
          console.error('   4. Add it to server/.env file as: GEMINI_API_KEY=your-api-key-here');
          console.error('   5. Restart the backend server');
        } else if (geminiError.message?.includes('quota') || 
                   geminiError.message?.includes('QUOTA') ||
                   geminiError.message?.includes('rate limit')) {
          console.error('📊 QUOTA ERROR: You may have exceeded your API quota');
          console.error('   💡 FREE tier has rate limits. Wait a few minutes and try again.');
        } else if (geminiError.message?.includes('PERMISSION_DENIED') ||
                   geminiError.message?.includes('permission')) {
          console.error('🚫 PERMISSION ERROR: API key may not have proper permissions');
          console.error('   📝 Make sure you created the API key from: https://aistudio.google.com/app/apikey');
        } else if (geminiError.message?.includes('model') || 
                   geminiError.message?.includes('not found')) {
          console.error('🤖 MODEL ERROR: The model name may be incorrect');
          console.error('   💡 FREE tier models: gemini-1.5-flash, gemini-1.5-flash-latest');
        }
        
        // Fallback to OpenAI if available
        if (openai) {
        try {
          // Increase content limit for OpenAI (GPT-3.5-turbo can handle ~4k tokens)
          const contentPreview = fileContent.length > 8000 
            ? fileContent.substring(0, 8000) + '\n\n[... content continues ...]' 
            : fileContent;
          
          console.log(`📝 Sending ${contentPreview.length} characters to OpenAI for question generation`);
          
          const prompt = generatePromptForTestType(testType, numQuestions, subject, contentPreview);

          const systemMessage = testType === 'multiple_choice' 
            ? 'You are an educational assistant. Generate multiple choice questions in valid JSON format only. Write questions directly without phrases like "Based on the material" or "According to the text".'
            : `You are an educational assistant. Generate ${testType === 'true_false' ? 'true/false' : 'fill-in-the-blank'} questions in valid JSON format only. Write questions directly without phrases like "Based on the material" or "According to the text".`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: systemMessage
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2000
          });

          const aiResponse = completion.choices[0].message.content.trim();
          const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
            method = 'openai';
            console.log(`✅ Successfully generated ${questions.length} questions using OpenAI`);
          }
        } catch (openaiError) {
          console.error('OpenAI API error:', openaiError.message);
          // Return error response instead of throwing
          return res.status(500).json({
            success: false,
            message: 'AI question generation failed',
            error: `Both Gemini and OpenAI failed. Gemini: ${geminiError.message}. OpenAI: ${openaiError.message}`,
            details: 'Please check your API keys and restart the backend server'
          });
        }
        } else {
          // No OpenAI fallback available - use content-based fallback
          console.log('📝 No AI available - using content-based question generation');
          questions = generateContentBasedQuestions(fileContent, subject, numQuestions, testType);
          method = 'fallback';
        }
      }
    }

    // Final fallback - if still no questions, generate basic ones
    if (!questions || questions.length === 0) {
      console.log('⚠️ No questions generated yet - using final fallback');
      questions = generateContentBasedQuestions(fileContent, subject, numQuestions, testType);
      method = 'fallback';
    }

    // Validate questions were generated
    if (!questions || questions.length === 0) {
      // Last resort - generate sample questions
      console.log('⚠️ Using sample questions as last resort');
      questions = generateSampleQuestions(subject, numQuestions, testType);
      method = 'sample';
    }

    console.log(`\n✅ ===== Question Generation Complete =====`);
    console.log(`📊 Generated ${questions.length} questions using: ${method}`);
    console.log(`📋 Subject: ${subject}`);
    
    res.json({
      success: true,
      questions,
      method: method // Indicate which method was used (gemini-ai, openai, or fallback)
    });
  } catch (error) {
    console.error('\n❌ ===== Question Generation Error =====');
    console.error('Error:', error.message);
    
    // Final fallback - always generate questions even if everything fails
    if (!questions || questions.length === 0) {
      console.log('📝 Using final fallback to generate questions');
      try {
        questions = generateContentBasedQuestions(fileContent, subject, numQuestions, testType);
        method = 'fallback';
        
        if (questions && questions.length > 0) {
          console.log(`✅ Generated ${questions.length} questions using fallback method`);
          return res.json({
            success: true,
            questions,
            method: method,
            note: 'Questions generated using fallback method (no AI required)'
          });
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError.message);
      }
    }
    
    // If we have questions, return them even if there was an error
    if (questions && questions.length > 0) {
      console.log(`✅ Returning ${questions.length} questions despite error`);
      return res.json({
        success: true,
        questions,
        method: method || 'fallback',
        note: 'Questions generated successfully'
      });
    }
    
    // Last resort - return sample questions
    console.log('⚠️ Using sample questions as last resort');
    questions = generateSampleQuestions(subject, numQuestions, testType);
    return res.json({
      success: true,
      questions,
      method: 'sample',
      note: 'Basic sample questions generated'
    });
  }
});

/**
 * POST /api/ai/create-reviewer
 * Create a reviewer with study notes/review material from a file
 */
router.post('/create-reviewer', async (req, res) => {
  try {
    const { fileId, fileName, fileContent, subject, userId } = req.body;

    if (!fileContent || !subject) {
      return res.status(400).json({
        success: false,
        message: 'File content and subject are required'
      });
    }

    // Validate file content is not a placeholder
    if (fileContent.includes('[DOCX File:') || 
        fileContent.includes('text extraction') || fileContent.length < 50) {
      console.warn('⚠️ File content appears to be a placeholder or too short');
    }

    console.log(`📄 Creating reviewer (study notes) for: ${fileName}`);
    console.log(`📝 Content length: ${fileContent.length} characters`);
    console.log(`📚 Subject: ${subject}`);

    // Use demo user if userId not provided
    const finalUserId = userId || 'demo-user';

    let reviewContent = '';
    let keyPoints = [];
    let aiUsed = false;
    
    // Validate file content before processing
    if (!fileContent || fileContent.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'File content is too short or invalid. Please ensure the file was uploaded correctly and contains readable text.'
      });
    }

    // Check for placeholder or error messages
    if (fileContent.includes('[DOCX File:') || 
        fileContent.includes('text extraction failed') || fileContent.includes('Text extraction failed')) {
      return res.status(400).json({
        success: false,
        message: 'File content extraction failed. Please re-upload the DOCX file or ensure it contains readable text.'
      });
    }

    // Try Gemini first (if API key provided)
    if (gemini) {
      try {
        console.log('🤖 Attempting to use Gemini AI for study notes...');
        console.log(`📊 File content length: ${fileContent.length} characters`);
        
        // Use FREE tier model - try multiple model names (v1 API compatible)
        let model;
        let modelName = null;
        const modelNames = [
          'gemini-1.5-flash', // Most common, works with v1 API
          'gemini-1.5-flash-001', // Specific version
          'gemini-1.5-flash-latest', // Latest version
          'gemini-pro' // Fallback (older but stable)
        ];
        
        for (const testName of modelNames) {
          try {
            // Remove 'models/' prefix if present (SDK doesn't need it)
            const cleanModelName = testName.replace(/^models\//, '');
            model = gemini.getGenerativeModel({ model: cleanModelName });
            // Test if model works
            const testResult = await model.generateContent('test');
            await testResult.response;
            modelName = cleanModelName;
            console.log(`✅ Using model: ${modelName}`);
            break;
          } catch (e) {
            // Check if it's an API version error
            if (e.message && e.message.includes('not found for API version')) {
              console.log(`⚠️ Model ${testName} not available in SDK API version: ${e.message}`);
              console.log('   → This is likely an API version mismatch. Will use fallback.');
              break; // Exit SDK testing
            }
            console.log(`⚠️ Model ${testName} failed: ${e.message}`);
            continue;
          }
        }
        
        if (!modelName) {
          throw new Error('No working Gemini model found. Please check your API key.');
        }
        
        // Use more content for better review material (up to 20k characters)
        const contentPreview = fileContent.length > 20000 
          ? fileContent.substring(0, 20000) + '\n\n[... content continues ...]' 
          : fileContent;
        
        console.log(`📝 Sending ${contentPreview.length} characters to Gemini AI`);
        console.log(`📄 Content preview (first 500 chars): ${contentPreview.substring(0, 500)}...`);
        
        const prompt = `You are an educational assistant. Create comprehensive study notes and review material from this ${subject} study material.

Study Material:
${contentPreview}

Create well-organized study notes that include:
1. A comprehensive summary of the key concepts
2. Important definitions and explanations
3. Key points and takeaways
4. Organized sections for easy review

Return your response in this JSON format:
{
  "reviewContent": "Comprehensive study notes here. Organize with clear sections, headings, and explanations. Make it detailed and educational.",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ]
}

Important:
- Return ONLY valid JSON, no markdown, no code blocks
- Make the reviewContent comprehensive and well-organized
- Include at least 5-10 key points
- Use clear headings and sections
- Make it suitable for studying and review
- Focus on the most important concepts from the material`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponse = response.text().trim();
        
        console.log('📝 Gemini response received:', aiResponse.substring(0, 200) + '...');
        
        // Extract JSON from response
        let jsonString = aiResponse;
        jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          reviewContent = parsed.reviewContent || '';
          keyPoints = parsed.keyPoints || [];
          if (reviewContent.length > 100) {
            console.log(`✅ Successfully generated study notes using Gemini AI (${reviewContent.length} chars, ${keyPoints.length} key points)`);
            aiUsed = true;
          } else {
            throw new Error('Generated review content is too short');
          }
        } else {
          throw new Error('Could not parse JSON from AI response');
        }
      } catch (geminiError) {
        console.error('❌ Gemini AI error:', geminiError.message);
      }
    }
    
    // Try OpenAI if Gemini failed
    if (!aiUsed && openai) {
      try {
        console.log('🤖 Attempting to use OpenAI for study notes...');
        console.log(`📊 File content length: ${fileContent.length} characters`);
        
        const contentPreview = fileContent.length > 8000 
          ? fileContent.substring(0, 8000) + '\n\n[... content continues ...]' 
          : fileContent;
        
        console.log(`📝 Sending ${contentPreview.length} characters to OpenAI`);
        
        const prompt = `Create comprehensive study notes and review material from this ${subject} study material:

${contentPreview}

Return your response in this JSON format:
{
  "reviewContent": "Comprehensive study notes here. Organize with clear sections, headings, and explanations.",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
}

Make the reviewContent detailed and well-organized for studying.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an educational assistant. Create comprehensive study notes in valid JSON format only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });

        const aiResponse = completion.choices[0].message.content.trim();
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          reviewContent = parsed.reviewContent || '';
          keyPoints = parsed.keyPoints || [];
          if (reviewContent.length > 100) {
            console.log(`✅ Successfully generated study notes using OpenAI (${reviewContent.length} chars, ${keyPoints.length} key points)`);
            aiUsed = true;
          }
        }
      } catch (openaiError) {
        console.error('❌ OpenAI API error:', openaiError.message);
      }
    }
    
    // If no AI worked, create basic review content from file
    if (!aiUsed) {
      console.log('⚠️ No AI available, creating basic review content from file...');
      // Create a simple summary from the file content
      const sentences = fileContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const summary = sentences.slice(0, Math.min(20, sentences.length)).join('. ') + '.';
      reviewContent = `# Study Notes: ${fileName}\n\n## Summary\n\n${summary}\n\n## Key Concepts\n\n${fileContent.substring(0, 1000)}...`;
      keyPoints = sentences.slice(0, 5).map(s => s.trim().substring(0, 100));
      console.log(`✅ Created basic review content (${reviewContent.length} chars, ${keyPoints.length} key points)`);
    }

    // Generate questions for practice (10 questions by default)
    console.log('📝 Generating questions for practice...');
    let questions = [];
    const numQuestions = 10; // Default 10 questions for practice
    
    try {
      // Try Gemini first
      if (gemini) {
        try {
          // Use FREE tier model - try multiple model names (v1 API compatible)
          let model;
          let modelName = null;
          const modelNames = [
            'gemini-1.5-flash', // Most common, works with v1 API
            'gemini-1.5-flash-001', // Specific version
            'gemini-1.5-flash-latest', // Latest version
            'gemini-pro' // Fallback (older but stable)
          ];
          
          for (const testName of modelNames) {
            try {
              // Remove 'models/' prefix if present (SDK doesn't need it)
              const cleanModelName = testName.replace(/^models\//, '');
              model = gemini.getGenerativeModel({ model: cleanModelName });
              // Quick test
              const testResult = await model.generateContent('test');
              await testResult.response;
              modelName = cleanModelName;
              console.log(`✅ Using model for questions: ${modelName}`);
              break;
            } catch (e) {
              // Check if it's an API version error
              if (e.message && e.message.includes('not found for API version')) {
                console.log(`⚠️ Model ${testName} not available in SDK API version: ${e.message}`);
                console.log('   → This is likely an API version mismatch. Will use fallback.');
                break; // Exit SDK testing
              }
              console.log(`⚠️ Model ${testName} failed: ${e.message}`);
              continue;
            }
          }
          
          if (!modelName) {
            throw new Error('No working Gemini model found');
          }
          const contentPreview = fileContent.length > 20000 
            ? fileContent.substring(0, 20000) + '\n\n[... content continues ...]' 
            : fileContent;
          
          const prompt = `You are an educational assistant. Generate exactly ${numQuestions} multiple choice questions from this ${subject} study material.

Study Material:
${contentPreview}

Generate ${numQuestions} multiple choice questions with exactly 4 options each. Return ONLY a valid JSON array in this exact format (no markdown, no code blocks, just pure JSON):
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this is the correct answer"
  }
]

Important:
- Return ONLY the JSON array, nothing else
- Each question must have exactly 4 options
- correctAnswer should be 0, 1, 2, or 3 (index of correct option)
- Questions must be direct and clear - DO NOT include phrases like "Based on the material", "According to the text", or "Based on this" in the question text
- Write questions as if testing knowledge directly, not referencing the material
- Make questions relevant to the study material content
- Make explanations clear and educational`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const aiResponse = response.text().trim();
          
          let jsonString = aiResponse;
          jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
            console.log(`✅ Successfully generated ${questions.length} questions using Gemini AI`);
          }
        } catch (geminiError) {
          console.error('Gemini AI error for questions:', geminiError.message);
        }
      }
      
      // Try OpenAI if Gemini failed
      if (questions.length === 0 && openai) {
        try {
          const contentPreview = fileContent.length > 8000 
            ? fileContent.substring(0, 8000) + '\n\n[... content continues ...]' 
            : fileContent;
          
          const prompt = `Generate ${numQuestions} multiple choice questions (with exactly 4 options each) from this ${subject} study material:

${contentPreview}

Return the questions in this JSON format:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of the correct answer"
  }
]

Important:
- Questions must be direct and clear - DO NOT include phrases like "Based on the material", "According to the text", or "Based on this" in the question text
- Write questions as if testing knowledge directly, not referencing the material
- Make sure questions are relevant to the content and explanations are clear.`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are an educational assistant. Generate multiple choice questions in valid JSON format only. Write questions directly without phrases like "Based on the material" or "According to the text".'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2000
          });

          const aiResponse = completion.choices[0].message.content.trim();
          const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
            console.log(`✅ Successfully generated ${questions.length} questions using OpenAI`);
          }
        } catch (openaiError) {
          console.error('OpenAI API error for questions:', openaiError.message);
        }
      }
      
      // Fallback to content-based questions if AI failed
      if (questions.length === 0) {
        console.log('⚠️ AI not available for questions, using content-based generation...');
        questions = generateContentBasedQuestions(fileContent, subject, numQuestions);
      }
    } catch (questionError) {
      console.error('Error generating questions:', questionError);
      // Use fallback
      questions = generateContentBasedQuestions(fileContent, subject, numQuestions);
    }
    
    console.log(`✅ Generated ${questions.length} questions for practice`);

    // Create reviewer and save to database
    const Reviewer = require('../models/Reviewer');
    const mongoose = require('mongoose');
    
    // Handle userId - schema now accepts both ObjectId and String
    let reviewerUserId = finalUserId;
    if (mongoose.Types.ObjectId.isValid(finalUserId) && finalUserId.toString().length === 24) {
      reviewerUserId = new mongoose.Types.ObjectId(finalUserId);
      console.log(`📝 Using ObjectId for userId: ${reviewerUserId}`);
    } else {
      // String userId (like 'demo-user') - schema accepts this now
      reviewerUserId = finalUserId.toString();
      console.log(`📝 Using string for userId: ${reviewerUserId}`);
    }
    
    // Handle fileId - convert to ObjectId if valid, otherwise null
    let reviewerFileId = null;
    if (fileId) {
      if (mongoose.Types.ObjectId.isValid(fileId) && fileId.toString().length === 24) {
        reviewerFileId = new mongoose.Types.ObjectId(fileId);
      } else {
        console.log(`⚠️ fileId "${fileId}" is not a valid ObjectId, setting to null`);
      }
    }
    
    const reviewer = new Reviewer({
      userId: reviewerUserId,
      fileId: reviewerFileId,
      fileName: fileName || 'Unknown',
      subject,
      reviewContent: reviewContent || 'No review content generated',
      keyPoints: keyPoints || [],
      questions: questions, // Now includes generated questions!
      totalQuestions: questions.length
    });

    let savedReviewer = null;
    try {
      savedReviewer = await reviewer.save();
      console.log(`✅ Reviewer saved to database with ID: ${savedReviewer._id}`);
      console.log(`   userId: ${savedReviewer.userId} (type: ${typeof savedReviewer.userId})`);
    } catch (dbError) {
      console.error('❌ Failed to save reviewer to database:', dbError.message);
      console.error('   Error details:', dbError);
      
      // If save fails, still return the reviewer object (for frontend)
      savedReviewer = reviewer;
      savedReviewer._id = savedReviewer._id || new mongoose.Types.ObjectId();
      console.log('⚠️ Returning reviewer without database save');
    }

    res.json({
      success: true,
      reviewer: {
        id: savedReviewer._id || savedReviewer.id,
        _id: savedReviewer._id || savedReviewer.id,
        fileName: savedReviewer.fileName,
        subject: savedReviewer.subject,
        reviewContent: savedReviewer.reviewContent,
        keyPoints: savedReviewer.keyPoints,
        totalQuestions: savedReviewer.totalQuestions,
        questions: savedReviewer.questions,
        createdAt: savedReviewer.createdAt || new Date(),
        userId: savedReviewer.userId
      }
    });
  } catch (error) {
    console.error('Error creating reviewer:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating reviewer',
      error: error.message
    });
  }
});

// Helper function: Calculate recommended duration using algorithm
function calculateRecommendedDuration(studyData) {
  const {
    hoursStudiedToday = 0,
    sessionCount = 0,
    timeOfDay = new Date().getHours(),
    fatigueLevel = 0
  } = studyData;

  let recommendedMinutes = 25;

  if (hoursStudiedToday >= 4) {
    recommendedMinutes = 15;
  } else if (hoursStudiedToday >= 2) {
    recommendedMinutes = 20;
  } else if (hoursStudiedToday < 1) {
    recommendedMinutes = 30;
  }

  if (timeOfDay >= 6 && timeOfDay < 12) {
    recommendedMinutes = Math.min(recommendedMinutes + 5, 45);
  } else if (timeOfDay >= 20 || timeOfDay < 6) {
    recommendedMinutes = Math.max(recommendedMinutes - 5, 15);
  }

  if (sessionCount >= 4) {
    recommendedMinutes = 15;
  }

  return recommendedMinutes;
}

// Helper function: Generate prompt based on test type
function generatePromptForTestType(testType, numQuestions, subject, contentPreview) {
  const baseInstructions = `You are an educational assistant. Generate exactly ${numQuestions} questions from this ${subject} study material.

Study Material:
${contentPreview}

Important:
- Questions must be direct and clear - DO NOT include phrases like "Based on the material", "According to the text", or "Based on this" in the question text
- Write questions as if testing knowledge directly, not referencing the material
- Make questions relevant to the study material content
- Make explanations clear and educational
- Return ONLY a valid JSON array (no markdown, no code blocks, just pure JSON)`;

  switch (testType) {
    case 'multiple_choice':
      return `${baseInstructions}

Generate ${numQuestions} multiple choice questions with exactly 4 options each. Return ONLY a valid JSON array in this exact format:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this is the correct answer"
  }
]

- Each question must have exactly 4 options
- correctAnswer should be 0, 1, 2, or 3 (index of correct option)`;

    case 'true_false':
      return `${baseInstructions}

Generate ${numQuestions} true/false questions. Return ONLY a valid JSON array in this exact format:
[
  {
    "question": "Statement that is either true or false",
    "options": ["True", "False"],
    "correctAnswer": 0,
    "explanation": "Explanation of why this statement is true or false"
  }
]

- Each question must have exactly 2 options: ["True", "False"]
- correctAnswer should be 0 (True) or 1 (False)
- Questions should be clear statements that can be definitively answered as true or false`;

    case 'fill_blank':
      return `${baseInstructions}

Generate ${numQuestions} fill-in-the-blank questions. Return ONLY a valid JSON array in this exact format:
[
  {
    "question": "Sentence with a blank: The capital of France is ____.",
    "options": ["Paris", "London", "Berlin", "Madrid"],
    "correctAnswer": 0,
    "explanation": "Explanation of the correct answer"
  }
]

- Each question should have a blank (represented by ____ or [blank])
- Each question must have exactly 4 options (possible answers)
- correctAnswer should be 0, 1, 2, or 3 (index of correct option)
- Questions should test understanding of key concepts from the material`;

    default:
      // Fallback to multiple choice
      return generatePromptForTestType('multiple_choice', numQuestions, subject, contentPreview);
  }
}

// Helper function: Generate fallback insight
function getFallbackInsight(studyData, recommendedMinutes) {
  const { hoursStudiedToday, sessionCount, timeOfDay } = studyData;
  
  if (hoursStudiedToday >= 4) {
    return "You've studied a lot today! Shorter sessions will help maintain focus.";
  } else if (hoursStudiedToday < 1) {
    return `Perfect time to start! ${recommendedMinutes} minutes is ideal for a fresh session.`;
  } else if (timeOfDay >= 6 && timeOfDay < 12) {
    return "Morning is your peak productivity time! Great choice for focused study.";
  } else if (timeOfDay >= 20) {
    return "Evening study session! Keep it focused and avoid burnout.";
  } else if (sessionCount >= 4) {
    return "You're on a roll! Take breaks between sessions to maintain quality.";
  } else {
    return `Recommended ${recommendedMinutes} minutes based on your study patterns.`;
  }
}

// Helper function: Generate content-based questions from file text
function generateContentBasedQuestions(fileContent, subject, numQuestions, testType = 'multiple_choice') {
  const questions = [];
  
  if (!fileContent || fileContent.trim().length < 50) {
    console.warn('⚠️ File content too short for question generation');
    // Return basic questions based on test type
    for (let i = 0; i < numQuestions; i++) {
      if (testType === 'true_false') {
        const isTrue = i % 2 === 0;
        questions.push({
          question: `An important concept in ${subject} is fundamental to understanding the subject.`,
          options: ['True', 'False'],
          correctAnswer: isTrue ? 0 : 1,
          explanation: `This statement is ${isTrue ? 'TRUE' : 'FALSE'} based on ${subject} principles.`
        });
      } else if (testType === 'fill_blank') {
        questions.push({
          question: `An important concept in ${subject} is ____.`,
          options: [`Concept ${i + 1}`, `Topic ${i + 1}`, `Principle ${i + 1}`, `Idea ${i + 1}`],
          correctAnswer: 0,
          explanation: `This question tests your understanding of ${subject} concepts.`
        });
      } else {
        // Multiple choice
        questions.push({
          question: `What is an important concept in ${subject}? (Question ${i + 1})`,
          options: [
            `A key concept in ${subject}`,
            `An important topic in ${subject}`,
            `A fundamental principle`,
            `A core idea in ${subject}`
          ],
          correctAnswer: 0,
          explanation: `This question tests your understanding of ${subject} concepts.`
        });
      }
    }
    return questions;
  }
  
  // Extract sentences and key phrases from content
  const sentences = fileContent
    .split(/[.!?]\s+/)
    .filter(s => s.trim().length > 20 && s.trim().length < 300)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, numQuestions * 5); // Get more sentences than needed
  
  // Extract important words/phrases (longer words are usually more meaningful)
  const words = fileContent
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 5 && !['which', 'where', 'there', 'their', 'these', 'those', 'about', 'after', 'before'].includes(w))
    .filter((w, i, arr) => arr.indexOf(w) === i) // unique words
    .slice(0, 50); // Limit to top 50 unique words
  
  // Generate questions from sentences based on test type
  for (let i = 0; i < numQuestions && i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence || sentence.length < 20) continue;
    
    if (testType === 'true_false') {
      // True/False questions
      const isTrue = i % 2 === 0; // Alternate between true and false
      let questionText;
      
      if (isTrue) {
        // Use sentence as-is for true statement
        questionText = sentence.endsWith('.') ? sentence : sentence + '.';
      } else {
        // Create false statement by modifying the sentence
        const words = sentence.split(/\s+/);
        if (words.length > 3) {
          // Negate or modify the statement
          questionText = sentence.replace(/\b(is|are|was|were|has|have|can|could|will|would)\b/i, 
            (match) => match === 'is' ? 'is not' : match === 'are' ? 'are not' : match);
          if (!questionText.includes('not') && !questionText.includes('no')) {
            questionText = 'It is not true that ' + sentence.toLowerCase();
          }
        } else {
          questionText = 'It is not true that ' + sentence.toLowerCase();
        }
        questionText = questionText.endsWith('.') ? questionText : questionText + '.';
      }
      
      questions.push({
        question: questionText,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 0 : 1,
        explanation: isTrue 
          ? `This statement is TRUE based on the study material: ${sentence.substring(0, 150)}...`
          : `This statement is FALSE. The correct information is: ${sentence.substring(0, 150)}...`
      });
      
    } else if (testType === 'fill_blank') {
      // Fill in the blank questions
      const words = sentence.split(/\s+/);
      if (words.length < 3) continue;
      
      // Find a key word to blank out (prefer longer, meaningful words)
      const keyWordIndex = words.findIndex(w => w.length > 5 && !/[.!?]/.test(w));
      if (keyWordIndex === -1) continue;
      
      const keyWord = words[keyWordIndex].replace(/[.!?,;:]$/, '');
      const blankedSentence = sentence.replace(keyWord, '____');
      
      const options = [keyWord]; // Correct answer
      
      // Generate wrong answers from other sentences
      for (let j = 1; j < 4; j++) {
        const otherIndex = (i + j) % sentences.length;
        if (otherIndex !== i && sentences[otherIndex]) {
          const otherWords = sentences[otherIndex].split(/\s+/);
          const otherWord = otherWords.find(w => w.length > 5 && !/[.!?]/.test(w)) || 'concept';
          options.push(otherWord.replace(/[.!?,;:]$/, ''));
        } else {
          options.push(`term${j}`);
        }
      }
      
      // Shuffle options
      const correctOption = options[0];
      const shuffled = options.sort(() => Math.random() - 0.5);
      const correctIndex = shuffled.indexOf(correctOption);
      
      questions.push({
        question: blankedSentence,
        options: shuffled,
        correctAnswer: correctIndex,
        explanation: `The correct answer is "${keyWord}". ${sentence.substring(0, 150)}...`
      });
      
    } else {
      // Multiple choice (default)
      let questionText;
      if (sentence.endsWith('?')) {
        questionText = sentence;
      } else {
        // Extract key phrase from sentence
        const words = sentence.split(/\s+/).filter(w => w.length > 3);
        const keyPhrase = words.slice(0, 5).join(' ');
        questionText = `What is "${keyPhrase}"?`;
      }
      
      // Generate options based on content
      const correctAnswer = i % 4; // Distribute correct answers
      const options = [];
      
      // Correct answer - extract meaningful part of sentence
      const correctOption = sentence.substring(0, Math.min(100, sentence.length)).trim();
      options.push(correctOption.length > 80 ? correctOption.substring(0, 77) + '...' : correctOption);
      
      // Wrong answers - use other sentences or generate related options
      for (let j = 1; j < 4; j++) {
        const otherIndex = (i + j) % sentences.length;
        if (otherIndex !== i && sentences[otherIndex]) {
          const otherSentence = sentences[otherIndex];
          const wrongOption = otherSentence.substring(0, Math.min(100, otherSentence.length)).trim();
          options.push(wrongOption.length > 80 ? wrongOption.substring(0, 77) + '...' : wrongOption);
        } else {
          // Generate generic wrong answer
          options.push(`A different concept in ${subject}`);
        }
      }
      
      // Shuffle options but keep track of correct answer
      const correctOptionText = options[0];
      const shuffled = options.sort(() => Math.random() - 0.5);
      const newCorrectIndex = shuffled.indexOf(correctOptionText);
      
      questions.push({
        question: questionText,
        options: shuffled,
        correctAnswer: newCorrectIndex,
        explanation: `${sentence.substring(0, 200)}${sentence.length > 200 ? '...' : ''}`
      });
    }
  }
  
  // If we don't have enough questions, fill with content-aware questions
  while (questions.length < numQuestions) {
    const wordIndex = questions.length % words.length;
    const word = words[wordIndex] || 'concept';
    const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
    
    if (testType === 'true_false') {
      const isTrue = questions.length % 2 === 0;
      questions.push({
        question: `${capitalizedWord} is an important concept in ${subject}.`,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 0 : 1,
        explanation: isTrue 
          ? `This statement is TRUE. ${capitalizedWord} is indeed an important concept in ${subject}.`
          : `This statement is FALSE.`
      });
    } else if (testType === 'fill_blank') {
      questions.push({
        question: `The term "${capitalizedWord}" is related to ____ in ${subject}.`,
        options: [capitalizedWord, `A concept in ${subject}`, 'A different term', 'An unrelated topic'],
        correctAnswer: 0,
        explanation: `The correct answer is "${capitalizedWord}".`
      });
    } else {
      // Multiple choice
      questions.push({
        question: `What is "${capitalizedWord}" in ${subject}?`,
        options: [
          `A key term related to ${capitalizedWord}`,
          `An important concept in ${subject}`,
          `A fundamental principle`,
          `A core topic in ${subject}`
        ],
        correctAnswer: 0,
        explanation: `"${capitalizedWord}" is an important term/concept in ${subject}.`
      });
    }
  }
  
  return questions.slice(0, numQuestions);
}

// Helper function: Generate sample questions (fallback only - should not be used)
function generateSampleQuestions(subject, numQuestions, testType = 'multiple_choice') {
  console.warn('⚠️ Using generic sample questions - AI not available');
  const questions = [];
  for (let i = 0; i < numQuestions; i++) {
    if (testType === 'true_false') {
      const isTrue = i % 2 === 0;
      questions.push({
        id: i + 1,
        question: `An important concept in ${subject} is fundamental to understanding the subject.`,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 0 : 1,
        explanation: `This statement is ${isTrue ? 'TRUE' : 'FALSE'} based on ${subject} principles.`
      });
    } else if (testType === 'fill_blank') {
      questions.push({
        id: i + 1,
        question: `An important concept in ${subject} is ____.`,
        options: [`Concept ${i + 1}`, `Topic ${i + 1}`, `Principle ${i + 1}`, `Idea ${i + 1}`],
        correctAnswer: 0,
        explanation: `This is the correct answer based on ${subject} principles.`
      });
    } else {
      // Multiple choice
      questions.push({
        id: i + 1,
        question: `What is an important concept in ${subject}? (Question ${i + 1})`,
        options: [
          `Concept A for ${subject}`,
          `Concept B for ${subject}`,
          `Concept C for ${subject}`,
          `Concept D for ${subject}`
        ],
        correctAnswer: i % 4,
        explanation: `This is the correct answer based on ${subject} principles.`
      });
    }
  }
  return questions;
}

module.exports = router;

