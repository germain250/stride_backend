const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    enum: [
      'task_assigned',
      'task_completed',
      'task_due_soon',
      'task_overdue',
      'comment_added',
      'mention',
      'project_invite',
      'project_update',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  },
  relatedProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
  },
  deliveryStatus: {
    inApp: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
    email: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
    push: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Notification', notificationSchema);