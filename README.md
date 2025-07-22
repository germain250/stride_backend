# Stride Task Management Backend

A comprehensive task management backend API built with Node.js, Express, and MongoDB, featuring real-time collaboration, notifications, and Flutter integration support.

## 🚀 Features

### Authentication & User Management
- JWT-based authentication with secure token handling
- User registration, login, and profile management
- Role-based access control (admin, member)
- Password change and account deactivation

### Task Management
- Full CRUD operations for tasks with comprehensive field support
- Priority levels (low, medium, high, urgent)
- Status tracking (pending, in-progress, completed, cancelled)
- Due dates, categories, and time tracking
- Task assignments and watchers
- Recurring task patterns
- File attachments support
- Custom fields and tags

### Team Collaboration
- Project creation and management
- Team member roles and permissions
- Real-time task updates via Socket.IO
- Project analytics and statistics

### Real-time Features
- Socket.IO integration for live updates
- Real-time comments and mentions
- Typing indicators and user presence
- Live task status changes

### Notifications System
- Multi-channel notifications (in-app, email, push)
- Task reminders and due date alerts
- Team collaboration notifications
- Customizable notification preferences

### Analytics & Insights
- Productivity dashboards
- Task completion trends
- Time tracking analytics
- Project performance metrics

## 🛠 Technical Architecture

### Database Models
- **User**: Authentication, preferences, roles
- **Task**: Comprehensive task data with relationships
- **Project**: Team collaboration with member management
- **Comment**: Threaded comments with reactions
- **Notification**: Multi-channel notification system

### API Design
- RESTful API with proper HTTP methods
- Comprehensive validation and error handling
- Pagination and filtering for large datasets
- Search functionality across tasks and projects

### Security Features
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS configuration for cross-origin requests
- Helmet for security headers
- Password hashing with bcryptjs

### Real-time Communication
- Socket.IO for live collaboration
- User authentication for socket connections
- Room-based messaging for projects and tasks
- Presence tracking and typing indicators

## 📱 Flutter Integration Ready

The backend is specifically designed for Flutter integration with:

- Deep linking support (`stride://task/123`, `stride://project/456`)
- Offline sync capabilities with data reconciliation
- Push notification infrastructure (Firebase ready)
- File upload endpoints for attachments
- Comprehensive error responses for mobile error handling

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB**
   Make sure MongoDB is running locally or configure your MongoDB Atlas connection.

4. **Run the Server**
   ```bash
   # Development mode with hot reload
   npm run dev
   
   # Production mode
   npm start
   ```

5. **API Health Check**
   ```bash
   curl http://localhost:3001/api/health
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password

### Tasks
- `GET /api/tasks` - Get tasks with filtering and pagination
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get specific task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Projects
- `GET /api/projects` - Get user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get specific project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

## 🔧 Development Features

### Environment Configuration
- Comprehensive `.env.example` with all required variables
- Development and production configurations
- MongoDB connection with proper error handling

### Monitoring & Logging
- Request logging with Morgan
- Error tracking and stack traces
- Health check endpoints
- Performance monitoring

### Automated Tasks
- Cron jobs for due date reminders
- Recurring task generation
- Notification processing queue
- Database cleanup routines

## 🏗 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Authentication, validation, etc.
├── models/         # Database schemas
├── routes/         # API route definitions
├── services/       # Business logic and external services
├── jobs/           # Cron jobs and scheduled tasks
└── app.js          # Express app configuration
```

## 🚀 Deployment

The backend is ready for deployment to platforms like:
- Heroku
- DigitalOcean
- AWS
- Google Cloud Platform

Make sure to:
1. Set environment variables on your platform
2. Configure MongoDB connection (Atlas recommended)
3. Set up proper process management (PM2 recommended)
4. Configure SSL/TLS for production

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@yourcompany.com or create an issue in the repository.

---

Built with ❤️ for Flutter developers who need a robust task management backend.