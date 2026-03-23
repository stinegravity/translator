import { Router } from 'express';
import multer from 'multer';
import { translationController } from '../controllers/translationController';
import { validate, schemas } from '../middleware/validate';
import { validateAudioUpload } from '../middleware/fileValidation';
import { auditMiddleware } from '../middleware/audit';
import { strictRateLimiter } from '../middleware/security';
import { requireAuth, requireInternalAdmin, requirePortalAccess, requireReviewerAccess, requireTier } from '../middleware/auth';
import { folderController } from '../controllers/folderController';
import { feedbackController } from '../controllers/feedbackController';
import { auditController } from '../controllers/auditController';
import { appFeedbackController } from '../controllers/appFeedbackController';
import { internalUserController } from '../controllers/internalUserController';
import { reviewerAccessController } from '../controllers/reviewerAccessController';
import { modelConfigController } from '../controllers/modelConfigController';
import { apiKeyController } from '../controllers/apiKeyController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Public
router.get('/health', translationController.health);

// All routes below require authentication
router.use(auditMiddleware);
router.use(requireAuth);

// Core translation
router.post('/translate', strictRateLimiter, validate(schemas.translate, 'body'), translationController.translate);
router.get('/transcribe/:jobId', validate(schemas.transcriptionJobId, 'params'), translationController.getTranscriptionStatus);
router.post('/transcribe', strictRateLimiter, upload.single('audio'), validateAudioUpload, validate(schemas.transcribe, 'body'), translationController.transcribe);
router.post('/transcribe-url', requireTier('PRO'), strictRateLimiter, validate(schemas.transcribeUrl, 'body'), translationController.transcribeUrl);
router.post('/speak', strictRateLimiter, validate(schemas.speak, 'body'), translationController.speak);

// History
router.get('/history', validate(schemas.history, 'query'), translationController.history);
router.delete('/history/:historyId', validate(schemas.historyItemParams, 'params'), translationController.archiveHistory);
router.patch('/history/:historyId/transcript', validate(schemas.historyItemParams, 'params'), validate(schemas.updateHistoryTranscript, 'body'), translationController.updateHistoryTranscript);
router.post('/history/:historyId/export', requireTier('TEAM'), strictRateLimiter, validate(schemas.historyItemParams, 'params'), validate(schemas.createHistoryExport, 'body'), translationController.createHistoryExport);

// Favorites
router.get('/favorites', validate(schemas.listFavorites, 'query'), translationController.favorites);
router.post('/favorites', validate(schemas.addFavorite, 'body'), translationController.addFavorite);
router.delete('/favorites/:historyId', validate(schemas.removeFavoriteParams, 'params'), translationController.removeFavorite);

// Settings
router.get('/settings', translationController.getSettings);
router.post('/settings', validate(schemas.saveSettings, 'body'), translationController.saveSettings);

// Conversations (PRO+)
router.get('/conversations', requireTier('PRO'), validate(schemas.listConversations, 'query'), translationController.listConversations);
router.post('/conversations', requireTier('PRO'), validate(schemas.createConversation, 'body'), translationController.createConversation);
router.get('/conversations/:id', requireTier('PRO'), validate(schemas.conversationParams, 'params'), validate(schemas.getConversation, 'query'), translationController.getConversation);
router.patch('/conversations/:id', requireTier('PRO'), validate(schemas.conversationParams, 'params'), validate(schemas.updateConversation, 'body'), translationController.updateConversation);
router.delete('/conversations/:id', requireTier('PRO'), validate(schemas.conversationParams, 'params'), translationController.deleteConversation);
router.post('/conversations/:id/export', requireTier('TEAM'), strictRateLimiter, validate(schemas.conversationParams, 'params'), validate(schemas.createConversationExport, 'body'), translationController.createConversationExport);

// Folders
router.get('/folders', folderController.list);
router.post('/folders', folderController.create);
router.delete('/folders/:id', folderController.delete);

// Human feedback & review queue
router.post('/feedback', requireReviewerAccess, strictRateLimiter, feedbackController.submit);
router.get('/feedback-stats', requirePortalAccess, strictRateLimiter, feedbackController.getStats);
router.get('/feedback/export', requirePortalAccess, strictRateLimiter, feedbackController.exportFineTuneData);
router.get('/review-queue', requirePortalAccess, strictRateLimiter, feedbackController.getReviewQueue);
router.get('/feedback/:historyId', strictRateLimiter, feedbackController.getForHistory);
router.post('/app-feedback', strictRateLimiter, validate(schemas.submitAppFeedback, 'body'), appFeedbackController.submit);
router.post('/reviewer-access/request', strictRateLimiter, validate(schemas.submitReviewerApplication, 'body'), reviewerAccessController.submitRequest);
router.get('/reviewer-access/requests', requirePortalAccess, validate(schemas.listReviewerApplications, 'query'), reviewerAccessController.listRequests);
router.patch('/reviewer-access/requests/:id', requireInternalAdmin, validate(schemas.reviewerApplicationParams, 'params'), validate(schemas.reviewReviewerApplication, 'body'), reviewerAccessController.reviewRequest);

// Usage & account info
router.get('/audit-logs', requirePortalAccess, auditController.getLogs);
router.get('/app-feedback', requirePortalAccess, validate(schemas.listAppFeedback, 'query'), appFeedbackController.list);
router.get('/internal-users', requirePortalAccess, internalUserController.list);
router.patch('/internal-users/:id', requireInternalAdmin, validate(schemas.internalUserParams, 'params'), validate(schemas.updateInternalUser, 'body'), internalUserController.update);
router.get('/model-config', requireInternalAdmin, modelConfigController.get);
router.patch('/model-config', requireInternalAdmin, modelConfigController.update);
// API key management (TEAM+)
router.get('/api-keys', requireTier('TEAM'), apiKeyController.list);
router.post('/api-keys', requireTier('TEAM'), strictRateLimiter, validate(schemas.createApiKey, 'body'), apiKeyController.create);
router.delete('/api-keys/:id', requireTier('TEAM'), validate(schemas.apiKeyParams, 'params'), apiKeyController.revoke);

router.get('/exports', requireTier('TEAM'), translationController.listExports);
router.get('/exports/:id/download', requireTier('TEAM'), validate(schemas.exportParams, 'params'), translationController.downloadExport);
router.get('/usage', translationController.getUsage);
router.get('/me', translationController.getMe);

export default router;
