/**
 * Adds jest-dom's DOM matchers (toHaveAccessibleName, toBeVisible, ...) to
 * expect. Only component tests use them; node-environment tests are unaffected.
 */
import "@testing-library/jest-dom/vitest";
