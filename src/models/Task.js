const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    maxlength: 2000,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  category: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  dueDate: {
    type: Date,
  },
  startDate: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  estimatedTime: {
    type: Number, // in minutes
  },
  actualTime: {
    type: Number, // in minutes
  },
  timeEntries: [{
    start: { type: Date, required: true },
    end: { type: Date },
    duration: { type: Number }, // in minutes
    description: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  }],
  subtasks: [{
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  attachments: [{
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  }],
  tags: [{
    type: String,
    trim: true,
  }],
  recurring: {
    isRecurring: { type: Boolean, default: false },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
    },
    interval: { type: Number, default: 1 },
    endDate: { type: Date },
    nextDue: { type: Date },
  },
  customFields: [{
    name: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed },
    type: { type: String, enum: ['text', 'number', 'date', 'boolean'], required: true },
  }],
}, {
  timestamps: true,
});

taskSchema.index({ title: 'text', description: 'text' });
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ assignee: 1, dueDate: 1 });
taskSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);