import { Router } from 'express';
import multer from 'multer';
import { translationController } from '../controllers/translationController';
import { validate, schemas } from '../middleware/validate';
import { validateAudioUpload } from '../middleware/fileValidation';
import { auditMiddleware } from '../middleware/audit';
import { strictRateLimiter } from '../middleware/security';
import { requireAuth, requireTier } from '../middleware/auth';
import { folderController } from '../controllers/folderController';
import { feedbackController } from '../controllers/feedbackController';

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
router.post('/translate', validate(schemas.translate, 'body'), translationController.translate);
router.post('/transcribe', strictRateLimiter, upload.single('audio'), validateAudioUpload, validate(schemas.transcribe, 'body'), translationController.transcribe);
router.post('/transcribe-url', strictRateLimiter, validate(schemas.transcribeUrl, 'body'), translationController.transcribeUrl);
router.post('/speak', strictRateLimiter, validate(schemas.speak, 'body'), translationController.speak);

// History
router.get('/history', validate(schemas.history, 'query'), translationController.history);
router.delete('/history/:historyId', validate(schemas.historyItemParams, 'params'), translationController.archiveHistory);
router.patch('/history/:historyId/transcript', validate(schemas.historyItemParams, 'params'), validate(schemas.updateHistoryTranscript, 'body'), translationController.updateHistoryTranscript);
router.post('/history/:historyId/export', requireTier('TEAM'), validate(schemas.historyItemParams, 'params'), validate(schemas.createHistoryExport, 'body'), translationController.createHistoryExport);

// Favorites
router.get('/favorites', translationController.favorites);
router.post('/favorites', validate(schemas.addFavorite, 'body'), translationController.addFavorite);
router.delete('/favorites/:historyId', validate(schemas.removeFavoriteParams, 'params'), translationController.removeFavorite);

// Settings
router.get('/settings', translationController.getSettings);
router.post('/settings', validate(schemas.saveSettings, 'body'), translationController.saveSettings);

// Conversations (PRO+)
router.get('/conversations', requireTier('PRO'), validate(schemas.listConversations, 'query'), translationController.listConversations);
router.post('/conversations', requireTier('PRO'), validate(schemas.createConversation, 'body'), translationController.createConversation);
router.get('/conversations/:id', requireTier('PRO'), validate(schemas.conversationParams, 'params'), translationController.getConversation);
router.patch('/conversations/:id', requireTier('PRO'), validate(schemas.conversationParams, 'params'), validate(schemas.updateConversation, 'body'), translationController.updateConversation);
router.delete('/conversations/:id', requireTier('PRO'), validate(schemas.conversationParams, 'params'), translationController.deleteConversation);
router.post('/conversations/:id/export', requireTier('TEAM'), validate(schemas.conversationParams, 'params'), validate(schemas.createConversationExport, 'body'), translationController.createConversationExport);

// Folders
router.get('/folders', folderController.list);
router.post('/folders', folderController.create);
router.delete('/folders/:id', folderController.delete);

// Human feedback & review queue
router.post('/feedback', feedbackController.submit);
router.get('/feedback-stats', feedbackController.getStats);
router.get('/feedback/export', requireTier('TEAM'), feedbackController.exportFineTuneData);
router.get('/review-queue', requireTier('TEAM'), feedbackController.getReviewQueue);
router.get('/feedback/:historyId', feedbackController.getForHistory);

// Usage & account info
router.get('/exports', requireTier('TEAM'), translationController.listExports);
router.get('/exports/:id/download', requireTier('TEAM'), validate(schemas.exportParams, 'params'), translationController.downloadExport);
router.get('/usage', translationController.getUsage);
router.get('/me', translationController.getMe);

export default router;
