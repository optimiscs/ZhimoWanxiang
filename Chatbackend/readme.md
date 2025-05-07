# PR Strategy Generator - Backend

This module provides a professional PR strategy generation system using Flask, Celery, MongoDB, and AI.

## Features

- **Chat Sessions**: Create and manage chat sessions for PR strategy generation
- **Real-time Analysis**: Analyze industry-specific news and hot topics 
- **Structured Strategy Generation**: Generate comprehensive PR strategies following a structured approach
- **Streaming Responses**: Support for streaming AI responses for better user experience
- **Privacy Protection**: Secure user authentication and data isolation
- **High Concurrency**: Celery-based task queue for handling high load

## API Endpoints

### Chat Sessions

- `GET /api/v1/chat/sessions` - Get all chat sessions for the current user
- `POST /api/v1/chat/sessions` - Create a new chat session
- `GET /api/v1/chat/sessions/<session_id>` - Get a specific chat session
- `DELETE /api/v1/chat/sessions/<session_id>` - Delete a chat session
- `PUT /api/v1/chat/sessions/<session_id>/title` - Update a chat session title
- `PUT /api/v1/chat/sessions/<session_id>/settings` - Update a chat session settings

### Chat Messages

- `GET /api/v1/chat/sessions/<session_id>/messages` - Get chat history for a session
- `POST /api/v1/chat/sessions/<session_id>/messages` - Send a message to the chat session
- `POST /api/v1/chat/sessions/<session_id>/stream` - Stream a message response

### News Analysis

- `POST /api/v1/chat/analyze-news` - Analyze hot news for a specific domain

### PR Strategy Generation

- `POST /api/v1/chat/pr-strategy` - Generate PR strategy based on collected information
- `GET /api/v1/chat/task-status/<task_id>` - Check the status of a background task
- `GET /api/v1/chat/export-chat/<session_id>` - Export chat history as JSON

## Architecture

The PR Strategy Generator uses a multi-layer architecture:

1. **Web Layer**: Flask provides REST API endpoints
2. **Service Layer**: Service classes handle business logic
3. **Task Layer**: Celery handles background tasks and high concurrency
4. **Data Layer**: MongoDB stores chat sessions, messages, and analysis results

## Database Collections

- `chat_sessions` - User chat sessions
- `news_analysis` - Industry-specific news analysis results
- `strategy_results` - Generated PR strategies
- `token_usage` - API token usage tracking

## Authentication and Privacy

- JWT-based authentication
- User-specific data isolation
- HTTPS for all API communications
- Token usage tracking for billing and monitoring

## Deployment

### Requirements

- Python 3.8+
- MongoDB 4.4+
- Redis (for Celery)
- Node.js 14+ (for frontend)

### Configuration

1. Set environment variables:
   - `OPENAI_API_KEY` - OpenAI API key
   - `OPENAI_BASE_URL` - OpenAI API base URL (optional, for custom endpoints)
   - `MONGODB_URI` - MongoDB connection URI
   - `REDIS_URI` - Redis connection URI for Celery
   - `SECRET_KEY` - Flask secret key for session management

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run Celery worker:
   ```
   celery -A celery_app.celery worker -l info
   ```

4. Run Flask application:
   ```
   python app.py
   ```

## Frontend Integration

Frontend components (located in `newsweb/src/pages/chatboard`) interact with the backend through service files in `newsweb/src/services/chat.ts`.

## Future Improvements

- Advanced caching for common industry analyses
- Multi-language support
- User-specific prompt templates
- AI model selection and fine-tuning
- Enhanced data visualization for strategy reports 