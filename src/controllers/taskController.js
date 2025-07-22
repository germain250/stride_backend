const Task = require('../models/Task');
const Project = require('../models/Project');
const { notifyUsers } = require('../services/notificationService');

const createTask = async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      reporter: req.user._id,
    };

    // Validate project exists and user has access
    if (taskData.project) {
      const project = await Project.findById(taskData.project);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const hasAccess = project.owner.equals(req.user._id) || 
        project.members.some(member => member.user.equals(req.user._id));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to project' });
      }
    }

    const task = new Task(taskData);
    await task.save();

    await task.populate([
      { path: 'reporter', select: 'firstName lastName email' },
      { path: 'assignee', select: 'firstName lastName email' },
      { path: 'project', select: 'name' },
    ]);

    // Notify assignee if different from reporter
    if (task.assignee && !task.assignee._id.equals(req.user._id)) {
      await notifyUsers([task.assignee._id], 'task_assigned', {
        title: 'New Task Assigned',
        message: `You have been assigned to task: ${task.title}`,
        relatedTask: task._id,
        sender: req.user._id,
      });
    }

    res.status(201).json({
      message: 'Task created successfully',
      task,
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ error: 'Server error creating task' });
  }
};

const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignee,
      project,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};
    
    // Build filter based on user role and project access
    if (req.user.role !== 'admin') {
      const userProjects = await Project.find({
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id },
        ],
      }).select('_id');
      
      const projectIds = userProjects.map(p => p._id);
      
      filter.$or = [
        { reporter: req.user._id },
        { assignee: req.user._id },
        { watchers: req.user._id },
        { project: { $in: projectIds } },
      ];
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignee = assignee;
    if (project) filter.project = project;
    if (search) {
      filter.$text = { $search: search };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const tasks = await Task.find(filter)
      .populate([
        { path: 'reporter', select: 'firstName lastName email avatar' },
        { path: 'assignee', select: 'firstName lastName email avatar' },
        { path: 'project', select: 'name color' },
        { path: 'watchers', select: 'firstName lastName email' },
      ])
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Task.countDocuments(filter);

    res.json({
      tasks,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error fetching tasks' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate([
        { path: 'reporter', select: 'firstName lastName email avatar' },
        { path: 'assignee', select: 'firstName lastName email avatar' },
        { path: 'project', select: 'name color' },
        { path: 'watchers', select: 'firstName lastName email' },
        { path: 'timeEntries.user', select: 'firstName lastName' },
      ]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access permissions
    const hasAccess = await checkTaskAccess(task, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to task' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Server error fetching task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasAccess = await checkTaskAccess(task, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to task' });
    }

    const allowedUpdates = [
      'title', 'description', 'status', 'priority', 'category',
      'assignee', 'dueDate', 'estimatedTime', 'tags', 'customFields',
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Handle status changes
    if (updates.status === 'completed' && task.status !== 'completed') {
      updates.completedAt = new Date();
      
      // Notify watchers and assignee
      const notifyList = [...task.watchers];
      if (task.assignee && !notifyList.includes(task.assignee)) {
        notifyList.push(task.assignee);
      }
      
      await notifyUsers(notifyList, 'task_completed', {
        title: 'Task Completed',
        message: `Task "${task.title}" has been completed`,
        relatedTask: task._id,
        sender: req.user._id,
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate([
      { path: 'reporter', select: 'firstName lastName email avatar' },
      { path: 'assignee', select: 'firstName lastName email avatar' },
      { path: 'project', select: 'name color' },
      { path: 'watchers', select: 'firstName lastName email' },
    ]);

    res.json({
      message: 'Task updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Server error updating task' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasAccess = await checkTaskAccess(task, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to task' });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Server error deleting task' });
  }
};

// Helper function to check task access permissions
const checkTaskAccess = async (task, user) => {
  if (user.role === 'admin') return true;
  
  if (task.reporter.equals(user._id) || 
      task.assignee?.equals(user._id) || 
      task.watchers.includes(user._id)) {
    return true;
  }

  if (task.project) {
    const project = await Project.findById(task.project);
    if (project && (
      project.owner.equals(user._id) || 
      project.members.some(member => member.user.equals(user._id))
    )) {
      return true;
    }
  }

  return false;
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
};