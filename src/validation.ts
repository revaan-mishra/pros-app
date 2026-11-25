import { z } from 'zod';

// Use ordinary validation before any schema can try to compile JavaScript.
z.config({ jitless: true });

export { z };
