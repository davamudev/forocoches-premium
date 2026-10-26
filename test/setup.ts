import { afterEach, beforeEach } from 'vitest';
import { resetEnvironment } from './helpers';

// Network is blocked before any test code runs and again after every test.
resetEnvironment();
beforeEach(resetEnvironment);
afterEach(resetEnvironment);
