import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';

// Import route registration functions
import { registerInitRoutes } from './routes/init.js';
import { registerConsultantRoutes } from './routes/consultant.js';
import { registerBabiesRoutes } from './routes/babies.js';
import { registerContractsRoutes } from './routes/contracts.js';
import { registerRoutinesRoutes } from './routes/routines.js';
import { registerNapsRoutes } from './routes/naps.js';
import { registerNightSleepRoutes } from './routes/night-sleep.js';
import { registerOrientationsRoutes } from './routes/orientations.js';
import { registerSleepWindowsRoutes } from './routes/sleep-windows.js';
import { registerReportsRoutes } from './routes/reports.js';
import { registerUploadRoutes } from './routes/upload.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable authentication
app.withAuth();

// Enable storage
app.withStorage();

// Register all routes
registerInitRoutes(app);
registerConsultantRoutes(app);
registerBabiesRoutes(app);
registerContractsRoutes(app);
registerRoutinesRoutes(app);
registerNapsRoutes(app);
registerNightSleepRoutes(app);
registerOrientationsRoutes(app);
registerSleepWindowsRoutes(app);
registerReportsRoutes(app);
registerUploadRoutes(app);

await app.run();
app.logger.info('Application running');
