const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  status: {
    type: String,
    enum: ['active', 'archived', 'completed'],
    default: 'active',
  },
  color: {
    type: String,
    default: '#3B82F6',
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  settings: {
    allowMemberInvites: { type: Boolean, default: false },
    publicTasks: { type: Boolean, default: true },
    autoAssign: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
});

projectSchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project',
  count: true,
});

module.exports = mongoose.model('Project', projectSchema);