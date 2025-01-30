# Timed Release Crypto System Frontend

Vue/Nuxt based frontend for the Timed Release Crypto System. This application provides the user interface for interacting with the system.

## Architecture

This frontend application:
- Provides user interface for message submission and monitoring
- Handles client-side form validation
- Manages user sessions and authentication
- Communicates with backend API for all operations
- Does NOT directly interact with blockchain or database

## Key Features
- Message submission interface
- Time-lock configuration
- Message status monitoring
- Agent status display
- Transaction history

## API Integration
All blockchain and database operations are handled through the backend API:
- POST /api/messages - Submit new time-locked message
- GET /api/messages - Retrieve message history
- GET /api/agents - Get agent status
- GET /api/messages/{id} - Get specific message details

## Setup and Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables
Create a `.env` file:
```
VITE_API_URL=http://localhost:8000
```

## Project Structure
```
frontend/
├── components/     # Reusable UI components
├── composables/    # Shared logic and API calls
├── pages/         # Route pages
└── utils/         # Helper functions
```

For detailed explanation on how things work, check out [Nuxt.js docs](https://nuxt.com).
