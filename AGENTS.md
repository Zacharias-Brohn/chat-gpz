# Agent Instructions for Next.js + Mantine Project

This document provides context, rules, and workflows for AI agents operating in this codebase.

## 1. Project Overview & Commands

### Core Scripts

The project uses `npm` for dependency management and script execution.

- **Development Server:** `npm run dev`
  - Starts the Next.js development server on port 3000.
- **Production Build:** `npm run build`
  - Creates an optimized production build.
- **Start Production:** `npm run start`
  - Runs the built application in production mode.
- **Type Check:** `npm run typecheck`
  - Runs TypeScript compiler (`tsc`) without emitting files to verify types.
- **Storybook:** `npm run storybook`
  - Launches the Storybook UI environment for component development.

### Linting & Formatting

Always ensure code passes these checks before submitting changes.

- **Lint All:** `npm run lint` (Runs ESLint and Stylelint)
- **ESLint:** `npm run eslint` (Checks JavaScript/TypeScript rules)
- **Stylelint:** `npm run stylelint` (Checks CSS/SCSS modules)
- **Prettier Check:** `npm run prettier:check` (Verifies formatting)
- **Prettier Fix:** `npm run prettier:write` (Fixes formatting issues automatically)

### Testing

- **Run All Checks:** `npm test`
  - Comprehensive check: typegen, prettier, lint, typecheck, and unit tests.
- **Run Unit Tests:** `npm run jest`
  - Runs the Jest test suite.
- **Run Single Test File:** `npm run jest -- components/MyComponent/MyComponent.test.tsx`
  - **Critical:** Use this when working on a specific component to save time.
- **Watch Mode:** `npm run jest:watch`

## 2. Architecture & File Structure

### Directory Layout

```text
.
├── app/                  # Next.js App Router pages and layouts
├── components/           # Shared React components (Atomic design preferred)
│   └── Feature/          # Feature-specific directory
│       ├── Feature.tsx        # Main component file
│       ├── Feature.module.css # CSS Modules
│       ├── Feature.story.tsx  # Storybook file
│       └── Feature.test.tsx   # Jest test file
├── public/               # Static assets (images, fonts, etc.)
├── theme.ts              # Mantine theme overrides and configuration
└── ...config files
```

### Framework Conventions

- **Next.js App Router:**
  - Use `page.tsx` for routes.
  - Use `layout.tsx` for wrapping pages.
  - default to **Server Components**.
  - Add `'use client';` at the very top of the file only when interactivity (hooks, event listeners) is required.
- **Mantine UI:**
  - Use `@mantine/core` components for structure (`Stack`, `Group`, `Grid`) instead of raw `div`s with CSS flexbox.
  - Use `rem` functions for sizing to respect user settings.

## 3. Code Style & Standards

### TypeScript

- **Strict Mode:** Enabled. No implicit `any`.
- **Interfaces:** Prefer `interface` over `type` for object definitions.
- **Props:** Define a specific interface for component props, exported if reusable.
  ```typescript
  export interface MyComponentProps {
    title: string;
    isActive?: boolean;
  }
  ```

### Naming Conventions

- **Components:** `PascalCase` (e.g., `UserProfile.tsx`).
- **Functions/Hooks:** `camelCase` (e.g., `useAuth`, `handleSubmit`).
- **CSS Modules:** `camelCase` for class names.
  ```css
  /* styles.module.css */
  .container { ... } /* Good */
  .user-card { ... } /* Avoid kebab-case in modules if possible for dot notation access */
  ```
- **Tests:** `ComponentName.test.tsx`.

### Imports

- **Path Aliases:** Always use `@/` to refer to the project root.
  - `import { Button } from '@mantine/core';`
  - `import { MyComp } from '@/components/MyComp';`
- **Sorting:** Imports are automatically sorted. Run `npm run prettier:write` if the linter complains.

## 4. Component Development Workflow

When creating or modifying a component (e.g., `UserProfile`), follow this checklist:

1.  **Scaffold Files:**
    - `UserProfile.tsx`
    - `UserProfile.module.css`
    - `UserProfile.test.tsx`
    - `UserProfile.story.tsx`
2.  **Implementation:**
    - Define strict Props interface.
    - Use Mantine components for layout.
    - Use CSS Modules for custom styling not covered by Mantine props.
3.  **Theming:**
    - Use `theme` object from Mantine for colors/spacing.
    - Support light/dark mode using Mantine's mixins or standard CSS variables if needed.
4.  **Testing:**
    - Write a basic render test.
    - Test user interactions (clicks, inputs) using `@testing-library/user-event`.
    - Ensure accessibility (`aria-` attributes) if creating custom interactive elements.
5.  **Storybook:**
    - Create a basic story to visualize the component in isolation.

## 5. Testing & Verification

### Jest & React Testing Library

- **Queries:** Prioritize accessibility-based queries:
  1.  `getByRole` (buttons, links, headings)
  2.  `getByLabelText` (form inputs)
  3.  `getByText` (non-interactive content)
  4.  `getByTestId` (last resort)
- **Mocking:**
  - Mock external modules utilizing `jest.mock`.
  - Use `jest.setup.cjs` for global mocks if needed (like `window.matchMedia`).

### Example Test Pattern

```tsx
import { render, screen } from '@/test-utils'; // Use project test-utils if available
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByRole('heading', { name: /test/i })).toBeInTheDocument();
  });
});
```

## 6. Error Handling & Best Practices

- **Async/Await:** Use `try/catch` blocks for API calls.
- **Validation:** Use `zod` if installed for schema validation, otherwise use strict TypeScript checks.
- **Accessibility:**
  - Ensure all `img` tags have `alt` text.
  - Ensure buttons have discernible text or `aria-label`.
  - Verify contrast ratios using the Storybook accessibility addon if available.
- **Performance:**
  - Use `next/image` for images.
  - Avoid heavy computations in render cycles; use `useMemo` sparingly and only when proven necessary.

## 7. Troubleshooting

- **Style Issues:** If styles aren't applying, check if `postcss.config.cjs` is correctly processing the file and that the class is applied via `className={classes.myClass}`.
- **Hydration Errors:** Ensure HTML structure is valid (no `div` inside `p`) and that the server/client output matches. Use `useEffect` for browser-only rendering if needed.
- **Test Failures:** If `jest` fails on imports, check `jest.config.cjs` for `moduleNameMapper` settings matching `tsconfig.json` paths.

## 8. Documentation & External Resources

- **Mantine Documentation:**
  - **CRITICAL:** When implementing Mantine components or features, you MUST refer to the official AI-optimized documentation.
  - **URL:** [https://mantine.dev/llms.txt](https://mantine.dev/llms.txt)
  - Use the `WebFetch` tool to retrieve the latest patterns and examples from this URL if you are unsure about the implementation details or best practices for the current version.
