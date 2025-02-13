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
  - Secret holder requirements
  - Deposit configuration
- ✅ Active Votes listing with:
  - Search and filtering
  - Status indicators
  - Vote cards
- ✅ Individual Vote View with:
  - Timeline display
  - Status indicators
  - Secret holder list
  - Result display (when available)
- ✅ Secret Holder Features:
  - Deposit requirements
  - Holder registration
  - Status tracking

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
  - Deposit management
- [ ] User Experience
  - Loading indicators
  - Success/error notifications
  - Form validation feedback
  - Mobile responsiveness
- [ ] Documentation
  - Component documentation
  - API integration docs
  - Usage examples
  - Deposit flow documentation

## Technical Architecture

### Frontend Stack
- Nuxt 3 (Vue.js framework)
- Vue Router for navigation
- SCSS for styling
- Axios for API requests

### Directory Structure
```
frontend/
├── assets/
│   └── styles/
│       ├── _variables.scss     # Global design tokens
│       ├── _mixins.scss       # Reusable mixins
│       ├── main.scss          # Main style entry
│       ├── components/        # Component styles
│       │   ├── _buttons.scss  # Button variations
│       │   ├── _cards.scss    # Card components
│       │   ├── _forms.scss    # Form elements
│       │   └── _votes.scss    # Vote-specific styles
│       └── pages/            # Page-specific styles
│           ├── _home.scss    
│           ├── _vote-details.scss
│           ├── _faq.scss
│           ├── _become-holder.scss
│           └── _create-vote.scss
├── components/               # Vue components
│   └── AppLayout.vue        # Main layout wrapper
├── pages/                   # Route pages
│   ├── index.vue           # Home page
│   ├── create-vote.vue     # Vote creation
│   ├── active-votes.vue    # Vote listing
│   ├── become-holder.vue   # Holder registration
│   └── vote/
│       └── [id].vue        # Individual vote view
└── public/                 # Static assets
```

### Key Principles

1. **Module Organization**
   - Each component gets its own SCSS file
   - Use `@use` instead of `@import` for module imports
   - Keep styles scoped to their component
   - Page-specific styles go in the `pages/` directory

2. **Import Structure**
   - Import variables and mixins at the top of each file that uses them
   - Use `@use '../variables' as *` pattern
   - Keep imports consistent across files

3. **Component Style Pattern**
   - Base styles first
   - Nested modifiers second
   - Media queries last
   - Maximum nesting depth of 3 levels

4. **Variable Usage**
   - Use design tokens from _variables.scss
   - Maintain consistent spacing, colors, and typography
   - Avoid hard-coded values

5. **Responsive Design**
   - Use breakpoint mixins consistently
   - Mobile-first approach
   - Test across different screen sizes

6. **Vue Component Integration**
   - Use `<style lang="scss" scoped>`
   - Keep component-specific overrides minimal
   - Move reusable styles to SCSS modules

7. **File Naming**
   - Prefix partial files with underscore
   - Use kebab-case for multi-word files

### Best Practices

1. **Keep Specificity Low**
   - Avoid deep nesting (max 3 levels)
   - Use classes instead of element selectors
   - Avoid `!important`

2. **Maintain Consistency**
   - Use variables for repeated values
   - Follow established naming patterns
   - Keep similar components styled similarly

3. **Performance**
   - Split styles into logical modules
   - Use appropriate selectors
   - Minimize style rule duplications

4. **Documentation**
   - Comment complex selectors
   - Document mixin parameters
   - Explain non-obvious style decisions

### Common Issues and Solutions

1. **Undefined Mixin Error**
   - Ensure mixins are imported in files that use them
   - Check import paths are correct

2. **Variable Scope**
   - Import variables in each file that needs them
   - Use consistent import patterns

3. **Component Style Isolation**
   - Use scoped styles in Vue components
   - Be mindful of selector specificity

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

## Package Dependencies

### Production Dependencies
Dependencies required to run the application in production:
- `nuxt`: Core framework
- `vue`: View library
- `vue-router`: Routing functionality
- `axios`: HTTP client

These packages are essential for the actual functioning of the app and get shipped to production.

### Development Dependencies
Dependencies only needed during development or building:
- `sass`: SCSS compiler
- `sass-loader`: Webpack loader for SCSS

These packages are used only during development/build and don't get shipped to production. For example, Sass compiles SCSS to CSS during build, but only the compiled CSS is shipped to production.

### Key Design Decisions

1. **Secret Holder System**
   - No limit on number of secret holders (more = better security)
   - Reward pool is divided equally among all participating holders
   - Minimum deposits kept low (0.001 ETH) to encourage participation
   - Security deposits are returned after successful participation

2. **Information Architecture**
   - Complex reward explanations belong in become-holder view
   - Create-vote form keeps minimal, essential inputs
   - Dynamic reward calculations shown where holders make decisions
   - Clear separation between vote creation and holder recruitment

3. **User Experience Principles**
   - Show relevant information where decisions are made
   - Display dynamic reward calculations for holders
   - Keep forms simple and focused
   - Provide clear feedback about deposits and rewards

4. **Common Pitfalls to Avoid**
   - Don't put holder-specific information in vote creation
   - Avoid hardcoding minimum holder counts
   - Don't complicate the vote creation process
   - Keep deposit requirements clear and simple
