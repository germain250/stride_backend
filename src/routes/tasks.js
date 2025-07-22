const express = require('express');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { validateTaskCreation } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.post('/', validateTaskCreation, createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;