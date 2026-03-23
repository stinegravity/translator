import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api/client';
import { useTranslate } from './hooks/useTranslate';
import { useTranscribe } from './hooks/useTranscribe';
import { useHistory } from './hooks/useHistory';
import { useSpeak } from './hooks/useSpeak';
import { useFolders } from './hooks/useFolders';
import { useConversations } from './hooks/useConversations';
import { useFavorites } from './hooks/useFavorites';
import { useSettings } from './hooks/useSettings';
import { useExports } from './hooks/useExports';
import { useToast } from './hooks/useToast';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useRecording } from './hooks/useRecording';
import { Header } from './components/Header';
import { VerificationBanner } from './components/VerificationBanner';
import { Controls } from './components/Controls';
import { TextInput } from './components/TextInput';
import { Toast } from './components/Toast';
import { ReviewerAccessBanner } from './components/ReviewerAccessBanner';
import type { AuthUser, Direction, HistoryItem, InputMode, TranslationResult, UsageData, UserSettings } from './types';
import { getTierFeatures } from './lib/tierFeatures';
import { downloadBlob, exportConversationAsText, exportResultAsSrt, exportResultAsText, exportResultAsVtt } from './utils/exporters';
import './App.css';

const HistoryPanel = lazy(async () => await import('./components/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
const SettingsPanel = lazy(async () => await import('./components/SettingsPanel').then((module) => ({ default: module.SettingsPanel })));
const AudioInput = lazy(async () => await import('./components/AudioInput').then((module) => ({ default: module.AudioInput })));
const ConversationThread = lazy(async () => await import('./components/ConversationThread').then((module) => ({ default: module.ConversationThread })));
const ResultDisplay = lazy(async () => await import('./components/ResultDisplay').then((module) => ({ default: module.ResultDisplay })));
import { ResultSkeleton } from './components/ResultSkeleton';

interface AppProps {
  auth: {
    user: AuthUser | null;
    usage: UsageData | null;
    logout: () => Promise<void>;
    refreshUsage: () => Promise<void>;
    resendVerification: (email: string) => Promise<unknown>;
  };
}

function App({ auth }: AppProps) {
  const refreshUsage = auth.refreshUsage;
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [direction, setDirection] = useState<Direction>('tw-en');
  const [textInput, setTextInput] = useState(() => sessionStorage.getItem('kyereAse:draft') ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [diarize, setDiarize] = useState(true);
  const [copiedField, setCopiedField] = useState<'transcribed' | 'translated' | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [context, setContext] = useState('Casual');
  const [dialect, setDialect] = useState('Asante Twi');
  const toast = useToast();
  const [voice, setVoice] = useState('nova');
  const [selectedFolder, setSelectedFolder] = useState('none');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<TranslationResult | null>(null);
  const isOnline = useOnlineStatus();
  const hasIdentity = !!auth.user;
  const featureFlags = getTierFeatures(auth.user?.tier);
  const conversationsEnabled = featureFlags.conversationsEnabled;
  const historyDataNeeded = showHistory;
  const conversationDataNeeded = showHistory;
  const folderDataNeeded = showHistory;
  const exportDataNeeded = showSettings && featureFlags.exportEnabled;
  const { translate, loading: translateLoading, error: translateError, result: translateResult, reset: resetTranslate } = useTranslate();
  const { transcribe, transcribeUrl, loading: transcribeLoading, error: transcribeError, result: transcribeResult, reset: resetTranscribe } = useTranscribe();
  const { items: historyItems, loading: historyLoading, hasMore: hasMoreHistory, refetch: refetchHistory, loadMore: loadMoreHistory } = useHistory(20, true, historyDataNeeded);
  const { folders, createFolder } = useFolders(true, folderDataNeeded);
  const currentFolderId = selectedFolder === 'none' ? undefined : selectedFolder;
  const {
    items: conversations,
    activeConversation,
    loading: conversationsLoading,
    refresh: refreshConversations,
    loadConversation,
    createConversation,
    renameConversation,
    moveConversationToFolder,
    deleteConversation,
    clearActiveConversation,
  } = useConversations(currentFolderId, conversationsEnabled, conversationDataNeeded);
  const favoritesDataNeeded = showHistory || !!selectedConversationId || !!previewResult?.id;
  const { items: favoriteItems, loading: favoritesLoading, add: addFavorite, remove: removeFavorite, refresh: refreshFavorites } = useFavorites(hasIdentity, favoritesDataNeeded);
  const { settings, saving: settingsSaving, error: settingsError, save: saveSettings } = useSettings(hasIdentity);
  const { items: exportItems, loading: exportsLoading, error: exportsError, refresh: refreshExports } = useExports(featureFlags.exportEnabled, exportDataNeeded);
  const { speak, activeText, isPlaying, loading: speakLoading } = useSpeak();

  const settingsHydratedRef = useRef(false);
  const settingsSaveTimeoutRef = useRef<number | null>(null);

  // Persist draft text to sessionStorage
  useEffect(() => {
    if (textInput) {
      sessionStorage.setItem('kyereAse:draft', textInput);
    } else {
      sessionStorage.removeItem('kyereAse:draft');
    }
  }, [textInput]);

  useEffect(() => {
    if (!settings || settingsHydratedRef.current) return;
    const timeoutId = window.setTimeout(() => {
      if (settings.preferredDirection) setDirection(settings.preferredDirection);
      if (settings.preferredInputMode) setInputMode(settings.preferredInputMode);
      if (typeof settings.diarizationEnabled === 'boolean') setDiarize(settings.diarizationEnabled);
      if (settings.preferredVoice) setVoice(settings.preferredVoice);
      settingsHydratedRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [settings]);

  useEffect(() => {
    if (!showSettings || !auth.user || auth.usage) {
      return;
    }

    void refreshUsage();
  }, [auth.usage, auth.user, refreshUsage, showSettings]);

  useEffect(() => {
    if (!hasIdentity || !settingsHydratedRef.current) return;

    const nextSettings: UserSettings = {
      preferredDirection: direction,
      preferredInputMode: inputMode,
      diarizationEnabled: diarize,
      preferredVoice: voice,
    };

    if (settingsSaveTimeoutRef.current) {
      window.clearTimeout(settingsSaveTimeoutRef.current);
    }

    const pendingSettings = nextSettings;
    settingsSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSettings(pendingSettings).catch(() => {});
      settingsSaveTimeoutRef.current = null;
    }, 500);

    return () => {
      if (settingsSaveTimeoutRef.current) {
        window.clearTimeout(settingsSaveTimeoutRef.current);
        // Flush pending save immediately on unmount
        void saveSettings(pendingSettings).catch(() => {});
        settingsSaveTimeoutRef.current = null;
      }
    };
  }, [diarize, direction, hasIdentity, inputMode, saveSettings, voice]);

  const loading = translateLoading || transcribeLoading;
  const reviewerEligible = useMemo(() => auth.user?.tier === 'PRO' || auth.user?.tier === 'TEAM' || auth.user?.tier === 'ENTERPRISE', [auth.user?.tier]);
  const canSubmitReviewerFeedback = useMemo(() => auth.user?.reviewerAccess === true && auth.user?.reviewerAccessStatus === 'APPROVED', [auth.user?.reviewerAccess, auth.user?.reviewerAccessStatus]);
  const result = useMemo(
    () => previewResult ?? ((inputMode === 'text' ? translateResult : transcribeResult) as TranslationResult | null),
    [inputMode, previewResult, transcribeResult, translateResult]
  );

  const favoriteHistoryIds = useMemo(() => new Set(favoriteItems.map((item) => item.historyId)), [favoriteItems]);
  const activeConversationId = activeConversation?.id ?? selectedConversationId;
  const activeConversationTitle = activeConversation?.title ?? conversations.find((item) => item.id === selectedConversationId)?.title ?? null;
  const activeConversationItems = activeConversation?.histories ?? [];

  const clearPreview = () => setPreviewResult(null);

  const syncHistoryViews = async () => {
    await Promise.all([refetchHistory(), refreshFavorites(), refreshConversations(), auth.refreshUsage()]);
    if (activeConversationId) {
      await loadConversation(activeConversationId);
    }
  };

  const buildConversationTitle = (seed: string, mode: InputMode) => {
    const trimmed = seed.trim();
    if (trimmed) {
      return trimmed.length > 36 ? `${trimmed.slice(0, 36)}...` : trimmed;
    }

    return mode === 'audio' ? 'Voice conversation' : 'New conversation';
  };

  const ensureConversationId = async (seed: string, mode: InputMode) => {
    if (activeConversationId) {
      return activeConversationId;
    }

    if (!conversationsEnabled) {
      return undefined;
    }

    const conversation = await createConversation(buildConversationTitle(seed, mode));
    setSelectedConversationId(conversation.id);
    await loadConversation(conversation.id);
    return conversation.id;
  };

  const handleTranslate = async () => {
    if (!textInput.trim()) return;
    clearPreview();
    resetTranscribe();
    const conversationId = await ensureConversationId(textInput, 'text');
    const data = await translate(textInput, direction, context, currentFolderId, dialect, conversationId);
    if (data) {
      setPreviewResult({
        id: data.historyId,
        inputText: textInput,
        translated: data.translated,
        source: data.source,
        target: data.target,
      });
    }
    await syncHistoryViews();
  };

  const sendAudio = async (blob: Blob) => {
    clearPreview();
    resetTranslate();
    const conversationId = await ensureConversationId('Voice conversation', 'audio');
    const data = await transcribe(blob, direction, diarize, currentFolderId, dialect, conversationId);
    if (data) {
      setPreviewResult({
        id: data.historyId,
        inputText: undefined,
        transcribed: data.transcribed,
        translated: data.translated,
        source: data.source,
        target: data.target,
        segments: data.segments,
      });
    }
    await syncHistoryViews();
  };

  const {
    isRecording,
    recordingDuration,
    recordingError,
    activeStream,
    startRecording: startRecordingRaw,
    stopRecording,
    handleFileUpload,
    clearError: clearRecordingError,
  } = useRecording({ onRecordingComplete: sendAudio });

  const startRecording = useCallback(() => {
    clearPreview();
    startRecordingRaw();
  }, [clearPreview, startRecordingRaw]);

  const error = translateError ?? transcribeError ?? recordingError;

  const handleTranscribeUrl = async () => {
    if (!youtubeUrl.trim()) return;
    clearPreview();
    resetTranslate();
    const conversationId = await ensureConversationId(youtubeUrl, 'audio');
    const data = await transcribeUrl(youtubeUrl, direction, diarize, currentFolderId, dialect, conversationId);
    if (data) {
      setPreviewResult({
        id: data.historyId,
        inputText: undefined,
        transcribed: data.transcribed,
        translated: data.translated,
        source: data.source,
        target: data.target,
        segments: data.segments,
      });
      setYoutubeUrl('');
    }
    await syncHistoryViews();
  };

  const toggleDirection = () => {
    setDirection((prev) => {
      const parts = prev.split('-');
      return parts.length === 2 ? `${parts[1]}-${parts[0]}` : 'en-tw';
    });
    clearPreview();
    resetTranslate();
    resetTranscribe();
    clearRecordingError();
    setTextInput('');
    setYoutubeUrl('');
  };

  const copyToClipboard = useCallback(async (text: string, field: 'transcribed' | 'translated') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.show('Copied to clipboard');
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.show('Copy failed');
    }
  }, [toast]);

  const handleHistorySelect = (item: HistoryItem) => {
    setInputMode(item.mode);
    setTextInput(item.mode === 'text' ? item.input : '');
    if (item.folder?.id) {
      setSelectedFolder(item.folder.id);
    } else {
      setSelectedFolder('none');
    }
    if (item.conversation?.id) {
      setSelectedConversationId(item.conversation.id);
      void loadConversation(item.conversation.id);
    } else {
      setSelectedConversationId(null);
      clearActiveConversation();
    }
    setPreviewResult({
      id: item.id,
      inputText: item.mode === 'text' ? item.input : undefined,
      transcribed: item.transcribed ?? undefined,
      translated: item.output,
      source: item.source,
      target: item.target,
      segments: item.segments,
    });
    setShowHistory(false);
  };

  const handleClear = () => {
    setTextInput('');
    clearPreview();
    resetTranslate();
    resetTranscribe();
    clearRecordingError();
  };

  const handleRetry = () => {
    clearRecordingError();
    if (translateError && textInput.trim()) {
      void handleTranslate();
      return;
    }
    if (transcribeError) {
      resetTranscribe();
      clearPreview();
    }
  };

  const handleFeedback = useCallback(async (data: import('./components/FeedbackWidget').FeedbackPayload) => {
    try {
      await api.feedback.submit(data);
      toast.show('Feedback saved — thank you!', 3000);
    } catch {
      toast.show('Could not save feedback');
    }
  }, [toast]);

  const handleRetranslateTranscript = async (nextTranscript: string) => {
    const transcript = nextTranscript.trim();
    if (!transcript) return;

    const conversationId = await ensureConversationId(transcript, 'audio');
    const data = await translate(transcript, direction, context, currentFolderId, dialect, conversationId);
    if (!data) return;

    setPreviewResult({
      id: data.historyId,
      inputText: transcript,
      transcribed: transcript,
      translated: data.translated,
      source: data.source,
      target: data.target,
      segments: undefined,
    });
    toast.show('Transcript updated and retranslated');
    await syncHistoryViews();
  };

  const handleUpdateSavedTranscript = async (historyId: string, transcript: string) => {
    const updated = await api.updateHistoryTranscript(historyId, {
      transcript,
      context,
      dialect,
    });

    if (previewResult?.id === historyId) {
      setPreviewResult({
        id: updated.item.id,
        inputText: updated.item.mode === 'text' ? updated.item.input : undefined,
        transcribed: updated.item.transcribed ?? undefined,
        translated: updated.item.output,
        source: updated.item.source,
        target: updated.item.target,
        segments: updated.item.segments,
      });
    }

    if (updated.item.conversation?.id) {
      await loadConversation(updated.item.conversation.id);
    }
    await Promise.all([refetchHistory(), refreshFavorites(), refreshConversations()]);
    toast.show('Saved transcript updated');
  };

  const handleToggleFavorite = async (historyId: string, isFavorite: boolean) => {
    if (!hasIdentity) {
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite(historyId);
        toast.show('Removed from favorites');
      } else {
        await addFavorite(historyId);
        toast.show('Added to favorites');
      }
      await refetchHistory();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handleArchiveHistory = async (historyId: string) => {
    try {
      await api.archiveHistory(historyId);
      if (previewResult?.id === historyId) {
        clearPreview();
      }
      if (activeConversationId) {
        await loadConversation(activeConversationId);
      }
      await Promise.all([refetchHistory(), refreshFavorites(), refreshConversations()]);
      toast.show('History item archived');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to archive history item');
    }
  };

  const downloadPersistentExport = async (exportId: string) => {
    const { blob, fileName } = await api.exports.download(exportId);
    downloadBlob(fileName, blob);
  };

  const handleExportResult = async (format: 'txt' | 'srt' | 'vtt') => {
    if (!result) {
      return;
    }

    try {
      if (result.id && hasIdentity) {
        const created = await api.exports.createHistory(result.id, format);
        await downloadPersistentExport(created.export.id);
        toast.show(`Saved ${format.toUpperCase()} export`);
      } else {
        if (format === 'txt') {
          exportResultAsText(result, result.transcribed ? `${result.target}_transcript_translation` : `${result.target}_translation`);
        } else if (format === 'srt') {
          exportResultAsSrt(result, `${result.target}_subtitles`);
        } else {
          exportResultAsVtt(result, `${result.target}_subtitles`);
        }
        toast.show(`Downloaded ${format.toUpperCase()} export`);
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleExportHistory = async (historyId: string, format: 'txt' | 'srt' | 'vtt') => {
    try {
      const created = await api.exports.createHistory(historyId, format);
      await downloadPersistentExport(created.export.id);
      toast.show(`Saved ${format.toUpperCase()} export`);
    } catch (err) {
      const item = activeConversationItems.find((entry) => entry.id === historyId) ?? historyItems.find((entry) => entry.id === historyId);
      if (item) {
        if (format === 'txt') {
          exportResultAsText(item, `${activeConversationTitle ?? 'translation'}_turn_${item.id}`);
        } else if (format === 'srt') {
          exportResultAsSrt(item, `${activeConversationTitle ?? 'translation'}_turn_${item.id}`);
        } else {
          exportResultAsVtt(item, `${activeConversationTitle ?? 'translation'}_turn_${item.id}`);
        }
      }
      toast.show(err instanceof Error ? `${err.message} — downloaded locally instead` : 'Export failed', 2500);
    }
  };

  const handleExportConversation = async () => {
    if (!activeConversationId || !activeConversationTitle) {
      return;
    }

    try {
      const created = await api.exports.createConversation(activeConversationId);
      await downloadPersistentExport(created.export.id);
      toast.show('Saved conversation export');
    } catch (err) {
      exportConversationAsText(activeConversationTitle, activeConversationItems);
      toast.show(err instanceof Error ? `${err.message} — downloaded locally instead` : 'Conversation export failed', 2500);
    }
  };

  const activeResultHistoryId = result?.id;
  const activeResultIsFavorite = activeResultHistoryId ? favoriteHistoryIds.has(activeResultHistoryId) : false;
  const panelFallback = <div className="panel-loading">Loading...</div>;

  return (
    <div className="app-container">
      <Suspense fallback={panelFallback}>
        <HistoryPanel
          show={showHistory}
          persistent
          loading={historyLoading}
          favoritesLoading={favoritesLoading}
          conversationsLoading={conversationsLoading}
          items={historyItems}
          favorites={favoriteItems}
          folders={folders}
          conversations={conversations}
          activeFolderId={selectedFolder}
          activeConversationId={activeConversationId}
          hasIdentity={hasIdentity}
          hasMoreHistory={hasMoreHistory}
          onLoadMoreHistory={loadMoreHistory}
          onSetActiveFolder={(id) => {
            setSelectedFolder(id);
            setSelectedConversationId(null);
            clearActiveConversation();
          }}
          onCreateFolder={async (name) => {
            try {
              await createFolder(name);
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Failed to create folder');
            }
          }}
          onCreateConversation={async (title) => {
            try {
              const conversation = await createConversation(title);
              setSelectedConversationId(conversation.id);
              await loadConversation(conversation.id);
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Failed to create conversation');
            }
          }}
          onSelectConversation={(id) => {
            setSelectedConversationId(id);
            if (!id) {
              clearActiveConversation();
              return;
            }
            void loadConversation(id);
          }}
          onRenameConversation={async (id, title) => {
            try {
              await renameConversation(id, title);
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Failed to rename conversation');
            }
          }}
          onMoveConversation={async (id, destFolderId) => {
            try {
              await moveConversationToFolder(id, destFolderId);
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Failed to move conversation');
            }
          }}
          onDeleteConversation={async (id) => {
            try {
              await deleteConversation(id);
              if (selectedConversationId === id) {
                setSelectedConversationId(null);
                clearActiveConversation();
                clearPreview();
              }
              await refetchHistory();
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Failed to delete conversation');
            }
          }}
          onArchiveHistory={handleArchiveHistory}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setShowHistory(false)}
          onSelect={handleHistorySelect}
        />
      </Suspense>

      <div className="app-main-area">
      <Suspense fallback={panelFallback}>
        <SettingsPanel
          show={showSettings}
          user={auth.user}
          usage={auth.usage}
          exportEnabled={featureFlags.exportEnabled}
          exports={exportItems}
          exportsLoading={exportsLoading}
          exportsError={exportsError}
          settingsSaving={settingsSaving}
          settingsError={settingsError}
          onDownloadExport={async (exportId) => {
            await downloadPersistentExport(exportId);
            toast.show('Export downloaded');
          }}
          onRefreshExports={refreshExports}
          onSubmitAppFeedback={async (payload) => {
            await api.appFeedback.submit(payload);
            toast.show('App feedback saved');
          }}
          voice={voice}
          onVoiceChange={setVoice}
          onLogout={auth.logout}
          onClose={() => setShowSettings(false)}
        />
      </Suspense>

      <div className={`main-card ${showHistory ? 'with-sidebar' : ''}`}>
        <Header
          onToggleHistory={() => setShowHistory((current) => !current)}
          onToggleSettings={() => setShowSettings((current) => !current)}
          showHistory={showHistory}
          showSettings={showSettings}
          user={auth.user}
          onLogout={auth.logout}
        />

        {auth.user && auth.user.emailVerified === false && (
          <VerificationBanner
            email={auth.user.email}
            onResend={auth.resendVerification}
          />
        )}

        {!isOnline && (
          <div className="offline-banner" role="alert">
            <AlertCircle size={16} />
            <span>You are offline. Some features may not work.</span>
          </div>
        )}

        <Controls
          inputMode={inputMode}
          setInputMode={setInputMode}
          direction={direction}
          onToggleDirection={toggleDirection}
          diarize={diarize}
          setDiarize={setDiarize}
          context={context}
          setContext={setContext}
          dialect={dialect}
          setDialect={setDialect}
        />

        <main id="main-content">
          <AnimatePresence mode="wait">
            {inputMode === 'text' ? (
              <TextInput
                key="text-input"
                textInput={textInput}
                setTextInput={setTextInput}
                onTranslate={() => void handleTranslate()}
                onClear={handleClear}
                loading={loading}
                placeholder={direction === 'tw-en' ? 'Type or paste Twi text...' : 'Type or paste English text...'}
                showClear={Boolean(textInput || result)}
              />
            ) : (
              <Suspense fallback={panelFallback} key="audio-input">
                <AudioInput
                  isRecording={isRecording}
                  recordingDuration={recordingDuration}
                  loading={loading}
                  loadingMessage={transcribeLoading ? 'Processing transcription...' : 'Processing...'}
                  canTrim={featureFlags.audioTrimming}
                  youtubeUrl={youtubeUrl}
                  onYoutubeUrlChange={setYoutubeUrl}
                  onTranscribeUrl={() => void handleTranscribeUrl()}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onFileUpload={handleFileUpload}
                  onSendTrimmed={sendAudio}
                  activeStream={activeStream ?? undefined}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error ? (
              <motion.div id="error-message" className="error-box" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <AlertCircle size={18} />
                <span>{error}</span>
                <button type="button" className="retry-btn" onClick={handleRetry}>
                  Retry
                </button>
              </motion.div>
            ) : null}

            {!activeConversationId && result && activeResultHistoryId ? (
              <div className="result-toolbar">
                <button
                  type="button"
                  className={`favorite-banner ${activeResultIsFavorite ? 'active' : ''}`}
                  onClick={() => void handleToggleFavorite(activeResultHistoryId, activeResultIsFavorite)}
                  disabled={!hasIdentity}
                >
                  {activeResultIsFavorite ? 'Favorited' : 'Save to favorites'}
                </button>
              </div>
            ) : null}

            {!canSubmitReviewerFeedback && result && auth.user ? (
              <ReviewerAccessBanner
                tier={auth.user.tier}
                reviewerAccessStatus={auth.user.reviewerAccessStatus}
                onSubmit={async (payload) => {
                  await api.reviewerAccess.request(payload);
                  toast.show('Reviewer request submitted');
                }}
              />
            ) : null}

            {activeConversationTitle && activeConversationItems.length > 0 ? (
              <Suspense fallback={panelFallback}>
                <ConversationThread
                  title={activeConversationTitle}
                  items={activeConversationItems}
                  favoriteHistoryIds={favoriteHistoryIds}
                  hasIdentity={hasIdentity}
                  exportEnabled={featureFlags.exportEnabled}
                  onExportConversation={handleExportConversation}
                  onExportHistory={handleExportHistory}
                  speakLoading={speakLoading}
                  playingText={activeText}
                  isPlaying={isPlaying}
                  onCopy={copyToClipboard}
                  onSpeak={speak}
                  onArchiveHistory={handleArchiveHistory}
                  onUpdateTranscript={handleUpdateSavedTranscript}
                  onToggleFavorite={handleToggleFavorite}
                />
              </Suspense>
            ) : loading ? (
              <ResultSkeleton
                key="skeleton"
                message={transcribeLoading ? 'Processing transcription...' : 'Translating...'}
              />
            ) : (
              <Suspense fallback={panelFallback}>
                <ResultDisplay
                  key={result?.id || 'result-display'}
                  result={result}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                  onSpeak={speak}
                  speakLoading={speakLoading}
                  playingText={isPlaying ? activeText : null}
                  dialect={dialect}
                  context={context}
                  exportEnabled={featureFlags.exportEnabled}
                  onExportResult={handleExportResult}
                  retranslating={translateLoading}
                  onRetranslateTranscript={result?.transcribed ? handleRetranslateTranscript : undefined}
                  onFeedback={handleFeedback}
                  canSubmitReviewerFeedback={Boolean(reviewerEligible && canSubmitReviewerFeedback)}
                />
              </Suspense>
            )}
          </AnimatePresence>
        </main>
      </div>

      <Toast message={toast.message ?? ''} show={Boolean(toast.message)} />

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      </div>
    </div>
  );
}

export default App;
