const Project = require('../models/Project');
const Task = require('../models/Task');
const { notifyProjectUpdate } = require('../services/notificationService');

const createProject = async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      owner: req.user._id,
      members: [{
        user: req.user._id,
        role: 'admin',
        joinedAt: new Date(),
      }],
    };

    const project = new Project(projectData);
    await project.save();

    await project.populate([
      { path: 'owner', select: 'firstName lastName email' },
      { path: 'members.user', select: 'firstName lastName email' },
    ]);

    // Notify about new project creation
    await notifyProjectUpdate(project._id, 'project_created', {
      sender: req.user._id,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
    });
    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: 'Server error creating project' });
  }
};

const getProjects = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const filter = {
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id },
      ],
    };

    if (status) filter.status = status;
    if (search) {
      filter.$or.push({
        name: { $regex: search, $options: 'i' },
      });
    }

    const projects = await Project.find(filter)
      .populate([
        { path: 'owner', select: 'firstName lastName email avatar' },
        { path: 'members.user', select: 'firstName lastName email avatar' },
      ])
      .populate('taskCount')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Project.countDocuments(filter);

    res.json({
      projects,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Server error fetching projects' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate([
        { path: 'owner', select: 'firstName lastName email avatar' },
        { path: 'members.user', select: 'firstName lastName email avatar' },
      ]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check access permissions
    const hasAccess = project.owner.equals(req.user._id) || 
      project.members.some(member => member.user._id.equals(req.user._id));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to project' });
    }

    // Get project statistics
    const taskStats = await Task.aggregate([
      { $match: { project: project._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    taskStats.forEach(stat => {
      stats.total += stat.count;
      stats[stat._id.replace('-', '')] = stat.count;
    });

    res.json({
      project,
      stats,
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Server error fetching project' });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can update project
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can update project' });
    }

    const allowedUpdates = [
      'name', 'description', 'status', 'color', 'startDate', 'endDate', 'tags', 'settings',
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate([
      { path: 'owner', select: 'firstName lastName email avatar' },
      { path: 'members.user', select: 'firstName lastName email avatar' },
    ]);

    // Notify project members about update
    await notifyProjectUpdate(req.params.id, 'project_updated', {
      sender: req.user._id,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
    });
    res.json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Server error updating project' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can delete project
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can delete project' });
    }

    // Check if project has tasks
    const taskCount = await Task.countDocuments({ project: project._id });
    if (taskCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete project with existing tasks. Please delete or move tasks first.' 
      });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Server error deleting project' });
  }
};

const addProjectMember = async (req, res) => {
  try {
    const { userId, role = 'member' } = req.body;
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can add members
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can add members' });
    }

    // Check if user is already a member
    const existingMember = project.members.find(member => member.user.equals(userId));
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a project member' });
    }

    project.members.push({
      user: userId,
      role,
      joinedAt: new Date(),
    });

    await project.save();
    await project.populate([
      { path: 'owner', select: 'firstName lastName email avatar' },
      { path: 'members.user', select: 'firstName lastName email avatar' },
    ]);

    // Notify about new member
    await notifyProjectUpdate(project._id, 'member_added', {
      sender: req.user._id,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
    });

    res.json({
      message: 'Member added successfully',
      project,
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Server error adding member' });
  }
};

const removeProjectMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only owner can remove members
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can remove members' });
    }

    project.members = project.members.filter(member => !member.user.equals(userId));
    await project.save();

    // Notify about member removal
    await notifyProjectUpdate(project._id, 'member_removed', {
      sender: req.user._id,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error removing member' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
};