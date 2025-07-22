const Notification = require('../models/Notification');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { emitToUser } = require('./socketService');

// Helper function to populate notification consistently
const populateNotification = async (notification) => {
  return await notification.populate([
    { path: 'sender', select: 'firstName lastName avatar' },
    { path: 'relatedTask', select: 'title' },
    { path: 'relatedProject', select: 'name' },
  ]);
};

const createNotification = async (notificationData) => {
  try {
    // Validate notificationData
    if (!notificationData.recipient || !notificationData.type) {
      throw new Error('Missing required fields: recipient and type');
    }

    const notification = new Notification(notificationData);
    await notification.save();

    // Emit real-time notification to user
    try {
      const populatedNotification = await populateNotification(notification);
      emitToUser(notificationData.recipient, 'new_notification', {
        notification: populatedNotification,
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    throw error;
  }
};

const notifyUsers = async (userIds, type, data) => {
  try {
    // Validate inputs
    if (!userIds?.length || !type || !data) {
      throw new Error('Invalid input: userIds, type, or data missing');
    }

    // Get user preferences to filter notifications
    const users = await User.find({
      _id: { $in: userIds },
      isActive: true,
    }).select('preferences.notifications');

    const filteredUserIds = users
      .filter((user) => {
        const prefs = user.preferences?.notifications || { inApp: true }; // Default to inApp if undefined
        switch (type) {
          case 'task_assigned':
          case 'task_completed':
          case 'task_due_soon':
          case 'task_overdue':
          case 'comment_added':
          case 'mention':
          case 'project_invite':
          case 'project_update':
            return prefs.inApp;
          default:
            return prefs.inApp;
        }
      })
      .map((user) => user._id);

    if (!filteredUserIds.length) return [];

    const notifications = filteredUserIds.map((userId) => ({
      recipient: userId,
      type,
      ...data,
    }));

    const createdNotifications = await Notification.insertMany(notifications, {
      ordered: false, // Continue inserting even if one fails
    });

    // Emit real-time notifications in bulk
    await Promise.all(
      createdNotifications.map(async (notification) => {
        try {
          const populatedNotification = await populateNotification(
            await Notification.findById(notification._id)
          );
          emitToUser(notification.recipient, 'new_notification', {
            notification: populatedNotification,
          });
        } catch (socketError) {
          console.error('Socket emission error:', socketError);
        }
      })
    );

    return createdNotifications;
  } catch (error) {
    console.error('Error notifying users:', error.message);
    throw error;
  }
};

const markAsRead = async (notificationId, userId) => {
  try {
    // Validate inputs
    if (!notificationId || !userId) {
      throw new Error('Missing notificationId or userId');
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found or user not authorized');
    }

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error.message);
    throw error;
  }
};

const getUserNotifications = async (userId, options = {}) => {
  try {
    // Validate userId
    if (!userId) {
      throw new Error('Missing userId');
    }

    const { page = 1, limit = 20, unreadOnly = false } = options;

    const filter = { recipient: userId };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate('sender', 'firstName lastName avatar')
        .populate('relatedTask', 'title')
        .populate('relatedProject', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((page - 1) * Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: userId, isRead: false }),
    ]);

    return {
      notifications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
      unreadCount,
    };
  } catch (error) {
    console.error('Error fetching user notifications:', error.message);
    throw error;
  }
};

const sendDueDateReminders = async () => {
  try {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find tasks due soon, urgent, and overdue in parallel
    const [dueSoonTasks, urgentTasks, overdueTasks] = await Promise.all([
      Task.find({
        dueDate: { $gte: now, $lte: twentyFourHoursFromNow },
        status: { $in: ['pending', 'in-progress'] },
      }).populate('assignee project'),
      Task.find({
        dueDate: { $gte: now, $lte: oneHourFromNow },
        status: { $in: ['pending', 'in-progress'] },
      }).populate('assignee project'),
      Task.find({
        dueDate: { $lt: now },
        status: { $in: ['pending', 'in-progress'] },
      }).populate('assignee project'),
    ]);

    // Process notifications in parallel
    const notificationsPromises = [];

    for (const task of dueSoonTasks) {
      if (task.assignee) {
        notificationsPromises.push(
          notifyUsers([task.assignee._id], 'task_due_soon', {
            title: 'Task Due Soon',
            message: `Task "${task.title}" is due in less than 24 hours`,
            relatedTask: task._id,
            relatedProject: task.project?._id,
            channels: { inApp: true, email: true, push: false },
          })
        );
      }
    }

    for (const task of urgentTasks) {
      if (task.assignee) {
        notificationsPromises.push(
          notifyUsers([task.assignee._id], 'task_due_soon', {
            title: 'URGENT: Task Due Soon!',
            message: `Task "${task.title}" is due in less than 1 hour!`,
            relatedTask: task._id,
            relatedProject: task.project?._id,
            channels: { inApp: true, email: true, push: true },
          })
        );
      }
    }

    for (const task of overdueTasks) {
      if (task.assignee) {
        notificationsPromises.push(
          notifyUsers([task.assignee._id], 'task_overdue', {
            title: 'Task Overdue',
            message: `Task "${task.title}" is overdue`,
            relatedTask: task._id,
            relatedProject: task.project?._id,
            channels: { inApp: true, email: true, push: true },
          })
        );
      }
    }

    await Promise.all(notificationsPromises);

    return {
      dueSoon: dueSoonTasks.length,
      urgent: urgentTasks.length,
      overdue: overdueTasks.length,
    };
  } catch (error) {
    console.error('Error sending due date reminders:', error.message);
    throw error;
  }
};

const notifyProjectUpdate = async (projectId, updateType, data) => {
  try {
    // Validate inputs
    if (!projectId || !updateType || !data) {
      throw new Error('Missing projectId, updateType, or data');
    }

    const project = await Project.findById(projectId).populate('members.user owner');

    if (!project) {
      throw new Error('Project not found');
    }

    // Get all project members
    const memberIds = project.members.map((member) => member.user._id);
    if (!memberIds.includes(project.owner._id)) {
      memberIds.push(project.owner._id);
    }

    // Filter out the user who made the update
    const notifyIds = memberIds.filter((id) => !id.equals(data.sender));

    let title, message;
    switch (updateType) {
      case 'member_added':
        title = 'New Team Member';
        message = `${data.senderName} added a new member to project "${project.name}"`;
        break;
      case 'member_removed':
        title = 'Team Member Removed';
        message = `A member was removed from project "${project.name}"`;
        break;
      case 'project_updated':
        title = 'Project Updated';
        message = `${data.senderName} updated project "${project.name}"`;
        break;
      case 'project_status_changed':
        title = 'Project Status Changed';
        message = `Project "${project.name}" status changed to ${data.newStatus}`;
        break;
      default:
        title = 'Project Update';
        message = `Project "${project.name}" has been updated`;
    }

    if (notifyIds.length > 0) {
      await notifyUsers(notifyIds, 'project_update', {
        title,
        message,
        relatedProject: projectId,
        sender: data.sender,
      });
    }

    return { success: true, notifiedUsers: notifyIds.length };
  } catch (error) {
    console.error('Error notifying project update:', error.message);
    throw error;
  }
};

module.exports = {
  createNotification,
  notifyUsers,
  markAsRead,
  getUserNotifications,
  sendDueDateReminders,
  notifyProjectUpdate,
};