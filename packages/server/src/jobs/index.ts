/**
 * Jobs entry point.
 *
 * Call `startJobs()` once at server startup to register all cron jobs.
 * Adding a new job: import its registration function and call it here.
 */

import { registerAvailabilityPromptJob } from './availabilityPromptJob';
import { registerMatchingEngineJob } from './matchingEngineJob';

/**
 * Register and start all background cron jobs.
 */
export function startJobs(): void {
  console.info('[jobs] Starting background jobs');
  registerAvailabilityPromptJob();
  registerMatchingEngineJob();
  console.info('[jobs] All background jobs registered');
}
