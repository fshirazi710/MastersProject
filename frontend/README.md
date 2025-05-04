# Timed Release Crypto System Frontend

A Vue/Nuxt based frontend for the Timed Release Crypto System. This application provides the user interface for a decentralized voting system with time-locked result revelation.


## Technical Architecture

### Frontend Stack
- Nuxt 3 (Vue.js framework)
- Vue Router for navigation
- SCSS for styling
- Axios for API requests



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

## Testing

This project uses Vitest for testing. The tests interact with a local Hardhat node.

**Prerequisites:**

1.  **Run Hardhat Node:** In the `../crypto-core` directory, start a local node: `npx hardhat node`
2.  **Deploy Contracts:** In the `../crypto-core` directory, deploy contracts to the local node: `npx hardhat run scripts/deploy.js --network localhost` (or your deployment script).
3.  **Configure Factory Address:** Ensure the `DEPLOYED_FACTORY_ADDRESS` in `frontend/test/setup.js` matches the address output by the deployment script.

**Running All Tests:**

```bash
npm run test
```

**Running Specific Tests:**

*   **Run a single test file:**
    ```bash
    # Replace path/to/file.test.js with the actual file path
    npm run test -- path/to/file.test.js 
    
    # Example:
    npm run test -- test/contracts-tests/factoryService.test.js
    ```

*   **Run tests matching a name pattern (describe or it blocks):** Use the `-t` flag.
    ```bash
    # Run all tests within the "RegistryService" describe block
    npm run test -- -t "RegistryService"
    
    # Run only the test named "should return zero addresses for a non-existent session ID"
    npm run test -- -t "should return zero addresses for a non-existent session ID"
    
    # You can often use a unique substring:
    npm run test -- -t "non-existent session ID"
    ```

*   **Focus tests using `.only` (Temporary):** Modify test code by adding `.only` to `describe` or `it` blocks. Only these will run.
    ```javascript
    // Example in a test file:
    describe('My Suite', () => {
      it.only('My focused test', () => { // Only this test runs
        // ...
      });
      it('Another test', () => { /* skipped */ });
    });
    describe.only('Another Suite', () => { // This whole suite runs
       it('Test A', () => { /* runs */ });
       it('Test B', () => { /* runs */ });
    });
    ```
    *Remember to remove `.only` before committing code.*

## Environment Variables
Create a `.env` file:
```