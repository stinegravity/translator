import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
import { Header } from './components/Header';
import { VerificationBanner } from './components/VerificationBanner';
import { Controls } from './components/Controls';
import { TextInput } from './components/TextInput';
import { Toast } from './components/Toast';
import type { AuthUser, Direction, HistoryItem, InputMode, TranslationResult, UsageData, UserSettings } from './types';
import { getTierFeatures } from './lib/tierFeatures';
import { downloadBlob, exportConversationAsText, exportResultAsSrt, exportResultAsText, exportResultAsVtt } from './utils/exporters';
import './App.css';

const HistoryPanel = lazy(async () => await import('./components/HistoryPanel').then((module) => ({ default: module.HistoryPanel })));
const SettingsPanel = lazy(async () => await import('./components/SettingsPanel').then((module) => ({ default: module.SettingsPanel })));
const AudioInput = lazy(async () => await import('./components/AudioInput').then((module) => ({ default: module.AudioInput })));
const ConversationThread = lazy(async () => await import('./components/ConversationThread').then((module) => ({ default: module.ConversationThread })));
const ResultDisplay = lazy(async () => await import('./components/ResultDisplay').then((module) => ({ default: module.ResultDisplay })));

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

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
  const [textInput, setTextInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [diarize, setDiarize] = useState(true);
  const [copiedField, setCopiedField] = useState<'transcribed' | 'translated' | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [context, setContext] = useState('Casual');
  const [dialect, setDialect] = useState('Asante Twi');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState('none');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<TranslationResult | null>(null);

  const hasIdentity = !!auth.user;
  const featureFlags = getTierFeatures(auth.user?.tier);
  const conversationsEnabled = featureFlags.conversationsEnabled;
  const historyDataNeeded = showHistory;
  const conversationDataNeeded = showHistory;
  const folderDataNeeded = showHistory;
  const exportDataNeeded = showSettings && featureFlags.exportEnabled;
  const { translate, loading: translateLoading, error: translateError, result: translateResult, reset: resetTranslate } = useTranslate();
  const { transcribe, transcribeUrl, loading: transcribeLoading, error: transcribeError, result: transcribeResult, reset: resetTranscribe } = useTranscribe();
  const { items: historyItems, loading: historyLoading, refetch: refetchHistory } = useHistory(20, true, historyDataNeeded);
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
    deleteConversation,
    clearActiveConversation,
  } = useConversations(currentFolderId, conversationsEnabled, conversationDataNeeded);
  const favoritesDataNeeded = showHistory || !!selectedConversationId || !!previewResult?.id;
  const { items: favoriteItems, loading: favoritesLoading, add: addFavorite, remove: removeFavorite, refresh: refreshFavorites } = useFavorites(hasIdentity, favoritesDataNeeded);
  const { settings, saving: settingsSaving, error: settingsError, save: saveSettings } = useSettings(hasIdentity);
  const { items: exportItems, loading: exportsLoading, error: exportsError, refresh: refreshExports } = useExports(featureFlags.exportEnabled, exportDataNeeded);
  const { speak, loading: speakLoading } = useSpeak();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const settingsHydratedRef = useRef(false);
  const settingsSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => setRecordingDuration((durationValue) => durationValue + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (!settings || settingsHydratedRef.current) return;
    const timeoutId = window.setTimeout(() => {
      if (settings.preferredDirection) setDirection(settings.preferredDirection);
      if (settings.preferredInputMode) setInputMode(settings.preferredInputMode);
      if (typeof settings.diarizationEnabled === 'boolean') setDiarize(settings.diarizationEnabled);
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
    };

    if (settingsSaveTimeoutRef.current) {
      window.clearTimeout(settingsSaveTimeoutRef.current);
    }

    settingsSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSettings(nextSettings).catch(() => {});
    }, 500);

    return () => {
      if (settingsSaveTimeoutRef.current) {
        window.clearTimeout(settingsSaveTimeoutRef.current);
      }
    };
  }, [diarize, direction, hasIdentity, inputMode, saveSettings]);

  const loading = translateLoading || transcribeLoading;
  const error = translateError ?? transcribeError ?? recordingError;
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
        translated: data.translated,
        source: data.source,
        target: data.target,
      });
    }
    await syncHistoryViews();
  };

  const startRecording = () => {
    setRecordingError(null);
    clearPreview();
    chunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        setRecordingDuration(0);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        resetTranslate();
        const conversationId = await ensureConversationId('Voice conversation', 'audio');
        const data = await transcribe(blob, direction, diarize, currentFolderId, dialect, conversationId);
        if (data) {
          setPreviewResult({
            id: data.historyId,
            transcribed: data.transcribed,
            translated: data.translated,
            source: data.source,
            target: data.target,
            segments: data.segments,
          });
        }
        await syncHistoryViews();
      };
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
    }).catch((err) => setRecordingError(err instanceof Error ? err.message : 'Microphone access denied'));
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const sendAudio = async (blob: Blob) => {
    clearPreview();
    resetTranslate();
    const conversationId = await ensureConversationId('Voice conversation', 'audio');
    const data = await transcribe(blob, direction, diarize, currentFolderId, dialect, conversationId);
    if (data) {
      setPreviewResult({
        id: data.historyId,
        transcribed: data.transcribed,
        translated: data.translated,
        source: data.source,
        target: data.target,
        segments: data.segments,
      });
    }
    await syncHistoryViews();
  };

  const handleTranscribeUrl = async () => {
    if (!youtubeUrl.trim()) return;
    clearPreview();
    resetTranslate();
    const conversationId = await ensureConversationId(youtubeUrl, 'audio');
    const data = await transcribeUrl(youtubeUrl, direction, diarize, currentFolderId, dialect, conversationId);
    if (data) {
      setPreviewResult({
        id: data.historyId,
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setRecordingError('Only audio files are supported.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setRecordingError('Audio file exceeds the 25 MB limit.');
      event.target.value = '';
      return;
    }

    void sendAudio(file);
    event.target.value = '';
  };

  const toggleDirection = () => {
    setDirection((prev) => {
      const parts = prev.split('-');
      return parts.length === 2 ? `${parts[1]}-${parts[0]}` : 'en-tw';
    });
    clearPreview();
    resetTranslate();
    resetTranscribe();
    setRecordingError(null);
    setTextInput('');
    setYoutubeUrl('');
  };

  const copyToClipboard = async (text: string, field: 'transcribed' | 'translated') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setToastMessage('Copied to clipboard');
      window.setTimeout(() => {
        setCopiedField(null);
        setToastMessage(null);
      }, 2000);
    } catch {
      setToastMessage('Copy failed');
    }
  };

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
    setRecordingError(null);
  };

  const handleRetry = () => {
    setRecordingError(null);
    if (translateError && textInput.trim()) {
      void handleTranslate();
      return;
    }
    if (transcribeError) {
      resetTranscribe();
      clearPreview();
    }
  };

  const handleFeedback = async (data: import('./components/FeedbackWidget').FeedbackPayload) => {
    try {
      await api.feedback.submit(data);
      setToastMessage('Feedback saved — thank you! 🙏');
      window.setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('Could not save feedback');
      window.setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const handleRetranslateTranscript = async (nextTranscript: string) => {
    const transcript = nextTranscript.trim();
    if (!transcript) return;

    const conversationId = await ensureConversationId(transcript, 'audio');
    const data = await translate(transcript, direction, context, currentFolderId, dialect, conversationId);
    if (!data) return;

    setPreviewResult({
      id: data.historyId,
      transcribed: transcript,
      translated: data.translated,
      source: data.source,
      target: data.target,
      segments: undefined,
    });
    setToastMessage('Transcript updated and retranslated');
    window.setTimeout(() => setToastMessage(null), 2000);
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
    setToastMessage('Saved transcript updated');
    window.setTimeout(() => setToastMessage(null), 2000);
  };

  const handleToggleFavorite = async (historyId: string, isFavorite: boolean) => {
    if (!hasIdentity) {
      return;
    }

    if (isFavorite) {
      await removeFavorite(historyId);
      setToastMessage('Removed from favorites');
    } else {
      await addFavorite(historyId);
      setToastMessage('Added to favorites');
    }

    await refetchHistory();
    window.setTimeout(() => setToastMessage(null), 2000);
  };

  const handleArchiveHistory = async (historyId: string) => {
    await api.archiveHistory(historyId);
    if (previewResult?.id === historyId) {
      clearPreview();
    }
    if (activeConversationId) {
      await loadConversation(activeConversationId);
    }
    await Promise.all([refetchHistory(), refreshFavorites(), refreshConversations()]);
    setToastMessage('History item archived');
    window.setTimeout(() => setToastMessage(null), 2000);
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
        setToastMessage(`Saved ${format.toUpperCase()} export`);
      } else {
        if (format === 'txt') {
          exportResultAsText(result, result.transcribed ? `${result.target}_transcript_translation` : `${result.target}_translation`);
        } else if (format === 'srt') {
          exportResultAsSrt(result, `${result.target}_subtitles`);
        } else {
          exportResultAsVtt(result, `${result.target}_subtitles`);
        }
        setToastMessage(`Downloaded ${format.toUpperCase()} export`);
      }
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Export failed');
    }

    window.setTimeout(() => setToastMessage(null), 2000);
  };

  const handleExportHistory = async (historyId: string, format: 'txt' | 'srt' | 'vtt') => {
    try {
      const created = await api.exports.createHistory(historyId, format);
      await downloadPersistentExport(created.export.id);
      setToastMessage(`Saved ${format.toUpperCase()} export`);
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
      setToastMessage(err instanceof Error ? `${err.message} — downloaded locally instead` : 'Export failed');
    }

    window.setTimeout(() => setToastMessage(null), 2500);
  };

  const handleExportConversation = async () => {
    if (!activeConversationId || !activeConversationTitle) {
      return;
    }

    try {
      const created = await api.exports.createConversation(activeConversationId);
      await downloadPersistentExport(created.export.id);
      setToastMessage('Saved conversation export');
    } catch (err) {
      exportConversationAsText(activeConversationTitle, activeConversationItems);
      setToastMessage(err instanceof Error ? `${err.message} — downloaded locally instead` : 'Conversation export failed');
    }

    window.setTimeout(() => setToastMessage(null), 2500);
  };

  const activeResultHistoryId = result?.id;
  const activeResultIsFavorite = activeResultHistoryId ? favoriteHistoryIds.has(activeResultHistoryId) : false;
  const panelFallback = <div className="panel-loading">Loading...</div>;

  return (
    <div className="app-container">
      <Suspense fallback={panelFallback}>
        <HistoryPanel
          show={showHistory}
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
          onSetActiveFolder={(id) => {
            setSelectedFolder(id);
            setSelectedConversationId(null);
            clearActiveConversation();
          }}
          onCreateFolder={async (name) => {
            await createFolder(name);
          }}
          onCreateConversation={async (title) => {
            const conversation = await createConversation(title);
            setSelectedConversationId(conversation.id);
            await loadConversation(conversation.id);
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
            await renameConversation(id, title);
          }}
          onDeleteConversation={async (id) => {
            await deleteConversation(id);
            if (selectedConversationId === id) {
              setSelectedConversationId(null);
              clearActiveConversation();
              clearPreview();
            }
            await refetchHistory();
          }}
          onArchiveHistory={handleArchiveHistory}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setShowHistory(false)}
          onSelect={handleHistorySelect}
        />
      </Suspense>

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
            setToastMessage('Export downloaded');
            window.setTimeout(() => setToastMessage(null), 2000);
          }}
          onRefreshExports={refreshExports}
          onClose={() => setShowSettings(false)}
        />
      </Suspense>

      <div className="main-card">
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

        <main>
          <AnimatePresence mode="wait">
            {inputMode === 'text' ? (
              <TextInput
                textInput={textInput}
                setTextInput={setTextInput}
                onTranslate={() => void handleTranslate()}
                onClear={handleClear}
                loading={loading}
                placeholder={direction === 'tw-en' ? 'Type or paste Twi text...' : 'Type or paste English text...'}
                showClear={Boolean(textInput || result)}
              />
            ) : (
              <Suspense fallback={panelFallback}>
                <AudioInput
                  isRecording={isRecording}
                  recordingDuration={recordingDuration}
                  loading={loading}
                  canTrim={featureFlags.audioTrimming}
                  youtubeUrl={youtubeUrl}
                  onYoutubeUrlChange={setYoutubeUrl}
                  onTranscribeUrl={() => void handleTranscribeUrl()}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onFileUpload={handleFileUpload}
                  onSendTrimmed={sendAudio}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activeConversationTitle ? (
              <motion.div className="conversation-banner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                Continuing in chat: <strong>{activeConversationTitle}</strong>
              </motion.div>
            ) : null}

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
                  onCopy={copyToClipboard}
                  onSpeak={speak}
                  onArchiveHistory={handleArchiveHistory}
                  onUpdateTranscript={handleUpdateSavedTranscript}
                  onToggleFavorite={handleToggleFavorite}
                />
              </Suspense>
            ) : (
              <Suspense fallback={panelFallback}>
                <ResultDisplay
                  key={result?.id ?? result?.transcribed ?? 'result'}
                  result={result}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                  onSpeak={speak}
                  speakLoading={speakLoading}
                  dialect={dialect}
                  context={context}
                  exportEnabled={featureFlags.exportEnabled}
                  onExportResult={handleExportResult}
                  retranslating={translateLoading}
                  onRetranslateTranscript={result?.transcribed ? handleRetranslateTranscript : undefined}
                  onFeedback={handleFeedback}
                />
              </Suspense>
            )}
          </AnimatePresence>
        </main>
      </div>

      <Toast message={toastMessage ?? ''} show={Boolean(toastMessage)} />

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
