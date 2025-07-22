const express = require('express');
const {
  createComment,
  getTaskComments,
  updateComment,
  deleteComment,
  addReaction,
} = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation for comment creation
const validateComment = [
  body('content').isLength({ min: 1, max: 1000 }).trim(),
  body('taskId').isMongoId(),
  body('parentCommentId').optional().isMongoId(),
  body('mentions').optional().isArray(),
  handleValidationErrors,
];

// Validation for reaction
const validateReaction = [
  body('emoji').isLength({ min: 1, max: 10 }).trim(),
  handleValidationErrors,
];

router.post('/', validateComment, createComment);
router.get('/task/:taskId', getTaskComments);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);
router.post('/:id/reactions', validateReaction, addReaction);

module.exports = router;