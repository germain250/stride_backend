const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('username').isLength({ min: 3, max: 30 }).trim().isAlphanumeric(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').isLength({ min: 1, max: 50 }).trim(),
  body('lastName').isLength({ min: 1, max: 50 }).trim(),
  handleValidationErrors,
];

const validateUserLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  handleValidationErrors,
];

// Task validation rules
const validateTaskCreation = [
  body('title').isLength({ min: 1, max: 200 }).trim(),
  body('description').optional().isLength({ max: 2000 }),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']),
  body('category').optional().isLength({ max: 50 }).trim(),
  body('dueDate').optional().isISO8601(),
  body('estimatedTime').optional().isInt({ min: 0 }),
  handleValidationErrors,
];

// Project validation rules
const validateProjectCreation = [
  body('name').isLength({ min: 1, max: 100 }).trim(),
  body('description').optional().isLength({ max: 500 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  handleValidationErrors,
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateTaskCreation,
  validateProjectCreation,
  handleValidationErrors,
};