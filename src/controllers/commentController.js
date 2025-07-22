const Comment = require('../models/Comment');
const Task = require('../models/Task');
const { notifyUsers } = require('../services/notificationService');

const createComment = async (req, res) => {
  try {
    const { content, taskId, parentCommentId, mentions } = req.body;

    // Verify task exists and user has access
    const task = await Task.findById(taskId).populate('project');
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access permissions (same logic as task access)
    const hasAccess = await checkTaskAccess(task, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to task' });
    }

    const comment = new Comment({
      content,
      author: req.user._id,
      task: taskId,
      parentComment: parentCommentId,
      mentions: mentions || [],
    });

    await comment.save();
    await comment.populate([
      { path: 'author', select: 'firstName lastName email avatar' },
      { path: 'mentions', select: 'firstName lastName email' },
    ]);

    // Notify mentioned users
    if (mentions && mentions.length > 0) {
      await notifyUsers(mentions, 'mention', {
        title: 'You were mentioned',
        message: `${req.user.firstName} ${req.user.lastName} mentioned you in a comment on "${task.title}"`,
        relatedTask: taskId,
        sender: req.user._id,
      });
    }

    // Notify task watchers and assignee about new comment
    const notifyList = [...task.watchers];
    if (task.assignee && !notifyList.includes(task.assignee.toString())) {
      notifyList.push(task.assignee);
    }
    if (task.reporter && !notifyList.includes(task.reporter.toString())) {
      notifyList.push(task.reporter);
    }

    // Remove the comment author from notification list
    const filteredNotifyList = notifyList.filter(
      userId => !userId.equals(req.user._id)
    );

    if (filteredNotifyList.length > 0) {
      await notifyUsers(filteredNotifyList, 'comment_added', {
        title: 'New Comment Added',
        message: `${req.user.firstName} ${req.user.lastName} commented on "${task.title}"`,
        relatedTask: taskId,
        sender: req.user._id,
      });
    }

    res.status(201).json({
      message: 'Comment created successfully',
      comment,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Server error creating comment' });
  }
};

const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Verify task exists and user has access
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasAccess = await checkTaskAccess(task, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to task' });
    }

    const comments = await Comment.find({ task: taskId })
      .populate([
        { path: 'author', select: 'firstName lastName email avatar' },
        { path: 'mentions', select: 'firstName lastName email' },
        { path: 'parentComment', select: 'content author' },
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Comment.countDocuments({ task: taskId });

    res.json({
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
};

const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only author can update comment
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only comment author can update comment' });
    }

    comment.content = content;
    comment.edited.isEdited = true;
    comment.edited.editedAt = new Date();

    await comment.save();
    await comment.populate([
      { path: 'author', select: 'firstName lastName email avatar' },
      { path: 'mentions', select: 'firstName lastName email' },
    ]);

    res.json({
      message: 'Comment updated successfully',
      comment,
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Server error updating comment' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only author can delete comment
    if (!comment.author.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only comment author can delete comment' });
    }

    await Comment.findByIdAndDelete(id);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Server error deleting comment' });
  }
};

const addReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = comment.reactions.find(
      reaction => reaction.user.equals(req.user._id) && reaction.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction if it exists
      comment.reactions = comment.reactions.filter(
        reaction => !(reaction.user.equals(req.user._id) && reaction.emoji === emoji)
      );
    } else {
      // Add new reaction
      comment.reactions.push({
        user: req.user._id,
        emoji,
      });
    }

    await comment.save();

    res.json({
      message: existingReaction ? 'Reaction removed' : 'Reaction added',
      reactions: comment.reactions,
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Server error managing reaction' });
  }
};

// Helper function to check task access (reused from taskController)
const checkTaskAccess = async (task, user) => {
  if (user.role === 'admin') return true;
  
  if (task.reporter.equals(user._id) || 
      task.assignee?.equals(user._id) || 
      task.watchers.includes(user._id)) {
    return true;
  }

  if (task.project) {
    const Project = require('../models/Project');
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
  createComment,
  getTaskComments,
  updateComment,
  deleteComment,
  addReaction,
};