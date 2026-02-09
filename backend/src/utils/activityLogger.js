const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity to the audit trail.
 * Non-blocking — fire-and-forget so it doesn't slow down the request.
 */
const logActivity = async ({ action, entity, entityId, description, metadata = {}, performedBy }) => {
  try {
    await ActivityLog.create({
      action,
      entity,
      entityId,
      description,
      metadata,
      performedBy,
    });
  } catch (err) {
    console.error('[ActivityLog Error]', err.message);
  }
};

module.exports = { logActivity };
