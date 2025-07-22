const express = require('express');
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
} = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { validateProjectCreation } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.post('/', validateProjectCreation, createProject);
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/members', addProjectMember);
router.delete('/:id/members/:userId', removeProjectMember);

module.exports = router;