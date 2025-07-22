const cron = require('node-cron');
const Task = require('../models/Task');
const { sendDueDateReminders } = require('../services/notificationService');

// Check for due tasks every hour
const checkDueTasks = cron.schedule('0 * * * *', async () => {
  try {
    const result = await sendDueDateReminders();
    console.log('Due date reminders sent:', result);
  } catch (error) {
    console.error('Error checking due tasks:', error);
  }
}, {
  scheduled: false
});
// Send urgent reminders every 15 minutes for tasks due within 1 hour
const urgentTaskReminders = cron.schedule('*/15 * * * *', async () => {
  try {
    const { sendDueDateReminders } = require('../services/notificationService');
    await sendDueDateReminders();
  } catch (error) {
    console.error('Error sending urgent reminders:', error);
  }
}, {
  scheduled: false
});

// Generate recurring tasks daily at midnight
const generateRecurringTasks = cron.schedule('0 0 * * *', async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recurringTasks = await Task.find({
      'recurring.isRecurring': true,
      'recurring.nextDue': { $lte: today },
      status: { $ne: 'cancelled' },
    });

    for (const task of recurringTasks) {
      // Create new task instance
      const newTask = new Task({
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        project: task.project,
        assignee: task.assignee,
        reporter: task.reporter,
        estimatedTime: task.estimatedTime,
        tags: task.tags,
        recurring: {
          isRecurring: true,
          pattern: task.recurring.pattern,
          interval: task.recurring.interval,
          endDate: task.recurring.endDate,
          nextDue: calculateNextDue(task.recurring),
        },
      });

      await newTask.save();

      // Update original task's next due date
      task.recurring.nextDue = calculateNextDue(task.recurring);
      await task.save();
    }

    console.log(`Generated ${recurringTasks.length} recurring tasks`);
  } catch (error) {
    console.error('Error generating recurring tasks:', error);
  }
}, {
  scheduled: false
});

const calculateNextDue = (recurring) => {
  const now = new Date();
  let nextDue = new Date(now);

  switch (recurring.pattern) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + recurring.interval);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + (7 * recurring.interval));
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + recurring.interval);
      break;
    case 'yearly':
      nextDue.setFullYear(nextDue.getFullYear() + recurring.interval);
      break;
  }

  return nextDue;
};

const startCronJobs = () => {
  checkDueTasks.start();
  urgentTaskReminders.start();
  generateRecurringTasks.start();
  console.log('Cron jobs started');
};

const stopCronJobs = () => {
  checkDueTasks.stop();
  urgentTaskReminders.stop();
  generateRecurringTasks.stop();
  console.log('Cron jobs stopped');
};

module.exports = {
  startCronJobs,
  stopCronJobs,
};