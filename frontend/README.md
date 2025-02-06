# Timed Release Crypto System Frontend

A Vue/Nuxt based frontend for the Timed Release Crypto System. This application provides the user interface for a decentralized voting system with time-locked result revelation.

## Core Concepts

The frontend serves as the user interface layer, focusing on:
- Presenting voting information clearly to users
- Collecting and validating user input
- Communicating with backend API
- Displaying encrypted vote status
- Managing user interface state

## Current Implementation Status

### Completed Features
- ✅ Basic application layout and navigation
- ✅ Create Vote form with:
  - Title and description
  - Start/end dates
  - Dynamic voting options
- ✅ Active Votes listing with:
  - Search and filtering
  - Status indicators
  - Vote cards
- ✅ Individual Vote View with:
  - Timeline display
  - Status indicators
  - Secret holder list
  - Result display (when available)

### Frontend TODO List
- [ ] User Interface Components
  - Connect wallet button
  - Loading states
  - Error handling
  - Form validations
  - Responsive design improvements
- [ ] API Integration
  - Vote submission
  - Vote status fetching
  - Result retrieval
  - Error handling
- [ ] User Experience
  - Loading indicators
  - Success/error notifications
  - Form validation feedback
  - Mobile responsiveness
- [ ] Documentation
  - Component documentation
  - API integration docs
  - Usage examples

## Technical Architecture

### Frontend Stack
- Nuxt 3 (Vue.js framework)
- Vue Router for navigation
- State management (to be implemented)
- API client (to be implemented)

### Key Components
```
frontend/
├── components/          # Reusable UI components
│   ├── AppLayout.vue   # Main layout wrapper
│   └── [future components...]
├── pages/              # Route pages
│   ├── index.vue       # Home page
│   ├── create-vote.vue # Vote creation
│   ├── active-votes.vue# Vote listing
│   └── vote/[id].vue   # Individual vote
└── [future directories...]
```

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

## Important Notes
1. **API Integration**: All blockchain and cryptographic operations are handled by the backend
2. **Data Display**: Frontend only displays data, never processes sensitive information
3. **User Input**: Frontend validates input before sending to backend
4. **Error Handling**: Clear error messages for all API interactions
5. **Responsive Design**: Must work well on all device sizes

## Contributing
1. Follow Vue.js style guide
2. Maintain type safety with TypeScript
3. Document all components and functions
4. Write clear commit messages
5. Test across different browsers and devices

## Resources
- [Nuxt Documentation](https://nuxt.com)
- [Vue.js Documentation](https://vuejs.org)
- [Vue Style Guide](https://vuejs.org/style-guide)
