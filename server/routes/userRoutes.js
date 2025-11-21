const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const User = require('../models/User');

/**
 * POST /api/users/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;

    // Validation
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Email domain validation (check if domain has MX records)
    // Only validate in production - skip in development for testing
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!isDevelopment) {
      try {
        const domain = email.split('@')[1];
        if (!domain) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email format'
          });
        }

        // Check MX records for the domain
        try {
          const mxRecords = await dns.resolveMx(domain);
          if (!mxRecords || mxRecords.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'Email domain does not exist or is invalid. Please use a valid email address.'
            });
          }
          console.log(`✅ Email domain validated: ${domain} has ${mxRecords.length} MX record(s)`);
        } catch (dnsError) {
          // If DNS lookup fails, the domain likely doesn't exist
          console.warn(`⚠️ DNS validation failed for ${domain}:`, dnsError.message);
          return res.status(400).json({
            success: false,
            message: 'Email domain does not exist or is invalid. Please use a valid email address.'
          });
        }
      } catch (validationError) {
        console.error('Email validation error:', validationError);
        return res.status(400).json({
          success: false,
          message: 'Email validation failed. Please use a valid email address.'
        });
      }
    } else {
      console.log(`🔧 Development mode: Skipping DNS validation for ${email}`);
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      username,
      email: email.toLowerCase(),
      password // Will be hashed automatically by the pre-save hook
    });

    await user.save();

    console.log('✅ User registered successfully:', user.email);
    console.log('📝 User ID:', user._id);
    console.log('📝 Database:', user.db?.databaseName || 'spireworks');

    // Don't send password back
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('❌ Error registering user:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

/**
 * POST /api/users/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Don't send password back
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

/**
 * GET /api/users
 * Get all users (for testing)
 */
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    console.log(`📊 Total users in database: ${users.length}`);
    console.log(`📊 Users:`, users.map(u => ({ email: u.email, username: u.username })));

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user by ID
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // If userId is "list" or "all", return all users
    if (userId === 'list' || userId === 'all') {
      const users = await User.find().select('-password');
      return res.json({
        success: true,
        count: users.length,
        users
      });
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

module.exports = router;

