const express = require('express');
const {
  getNotifications,
  markNotificationAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  updateNotificationPreferences,
} = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markNotificationAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);
router.put('/preferences', updateNotificationPreferences);

module.exports = router;