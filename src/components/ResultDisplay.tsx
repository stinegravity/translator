import { motion, type Variants } from 'framer-motion';
import { Copy, Check, Volume2, Clock, Download, Pencil, RefreshCcw, X, Square } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState } from 'react';
import { TranslationResult, TranscriptionSegment } from '../types';
import { FeedbackWidget, type FeedbackPayload } from './FeedbackWidget';
import { exportResultAsSrt, exportResultAsText, exportResultAsVtt } from '../utils/exporters';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function speakerToVoice(speaker: string): string {
  const map: Record<string, string> = {
    A: 'Voice 1',
    B: 'Voice 2',
    C: 'Voice 3',
    D: 'Voice 4',
    E: 'Voice 5',
  };
  return map[speaker] ?? `Voice ${speaker}`;
}

interface ResultDisplayProps {
  result: TranslationResult | null;
  copiedField: 'transcribed' | 'translated' | null;
  onCopy: (text: string, field: 'transcribed' | 'translated') => void;
  onSpeak: (text: string) => void;
  speakLoading: boolean;
  playingText?: string | null;
  dialect: string;
  context: string;
  exportEnabled?: boolean;
  onExportResult?: (format: 'txt' | 'srt' | 'vtt') => Promise<void>;
  retranslating?: boolean;
  onRetranslateTranscript?: (text: string) => Promise<void>;
  onFeedback: (data: FeedbackPayload) => Promise<void>;
  canSubmitReviewerFeedback?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

export function ResultDisplay({
  result,
  copiedField,
  onCopy,
  onSpeak,
  speakLoading,
  playingText,
  dialect,
  context,
  exportEnabled = false,
  onExportResult,
  retranslating = false,
  onRetranslateTranscript,
  onFeedback,
  canSubmitReviewerFeedback = false,
}: ResultDisplayProps) {
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState(result?.transcribed ?? '');

  if (!result) return null;

  const segments = result.segments;

  return (
    <motion.div
      id="translation-results"
      className="results-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {segments && segments.length > 0 ? (
        <>
          <motion.div className="result-box result-box-success" id="transcription-box" variants={itemVariants}>
            <div className="result-header">
              <span className="label">Transcribed (with timestamps)</span>
              <div className="result-actions">
                <motion.button type="button" className="copy-button" onClick={() => onSpeak(result.transcribed ?? '')} disabled={speakLoading && playingText !== result.transcribed} whileTap={{ scale: 0.9 }} title={playingText === result.transcribed ? 'Stop' : 'Listen'}>
                  {playingText === result.transcribed ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} className={cn(speakLoading && "animate-pulse")} />}
                </motion.button>
                {exportEnabled ? (
                  <motion.button
                    type="button"
                    className="copy-button"
                    onClick={() => void (onExportResult ? onExportResult('txt') : Promise.resolve(exportResultAsText(result, `${result.target}_transcript_translation`)))}
                    whileTap={{ scale: 0.9 }}
                    title="Export transcript and translation"
                  >
                    <Download size={16} />
                  </motion.button>
                ) : null}
                <motion.button type="button" id="copy-transcription-btn" className="copy-button" onClick={() => onCopy(result.transcribed ?? '', 'transcribed')} whileTap={{ scale: 0.9 }}>
                  {copiedField === 'transcribed' ? <Check size={16} /> : <Copy size={16} />}
                </motion.button>
              </div>
            </div>
            <div className="segments-list">
              {segments.map((seg: TranscriptionSegment, index: number) => (
                <div key={seg.id || `segment-${index}`} className="segment-row">
                  <span className="segment-meta">
                    <Clock size={14} />
                    {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                  </span>
                  <span className="segment-voice">{speakerToVoice(seg.speaker)}</span>
                  <span className="segment-text">{seg.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div className="result-box result-box-success" id="translation-box" variants={itemVariants}>
            <div className="result-header">
              <span className="label">Translation</span>
              <div className="result-actions">
                <motion.button type="button" className="copy-button" onClick={() => onSpeak(result.translated)} disabled={speakLoading && playingText !== result.translated} whileTap={{ scale: 0.9 }} title={playingText === result.translated ? 'Stop' : 'Listen'}>
                  {playingText === result.translated ? <Square size={18} fill="currentColor" /> : <Volume2 size={18} className={cn(speakLoading && "animate-pulse")} />}
                </motion.button>
                {exportEnabled ? (
                  <>
                    <motion.button
                      type="button"
                      className="copy-button"
                      onClick={() => void (onExportResult ? onExportResult('srt') : Promise.resolve(exportResultAsSrt(result, `${result.target}_subtitles`)))}
                      whileTap={{ scale: 0.9 }}
                      title="Export SRT subtitles"
                    >
                      <span className="export-mini-label">SRT</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      className="copy-button"
                      onClick={() => void (onExportResult ? onExportResult('vtt') : Promise.resolve(exportResultAsVtt(result, `${result.target}_subtitles`)))}
                      whileTap={{ scale: 0.9 }}
                      title="Export VTT subtitles"
                    >
                      <span className="export-mini-label">VTT</span>
                    </motion.button>
                  </>
                ) : null}
                <motion.button type="button" id="copy-translation-btn" className="copy-button" onClick={() => onCopy(result.translated, 'translated')} whileTap={{ scale: 0.9 }}>
                  {copiedField === 'translated' ? <Check size={18} /> : <Copy size={18} />}
                </motion.button>
              </div>
            </div>
            <div className="segments-list">
              {segments.map((seg: TranscriptionSegment, index: number) => (
                <div key={(seg.id || `segment-${index}`) + '-trans'} className="segment-row">
                  <span className="segment-voice">{speakerToVoice(seg.speaker)}</span>
                  <span className="segment-text">{seg.translatedText ?? seg.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      ) : (
        <>
          {result.transcribed !== undefined && (
            <motion.div className="result-box result-box-success" id="transcription-box" variants={itemVariants}>
              <div className="result-header">
                <span className="label">Transcribed</span>
                <div className="result-actions">
                  <motion.button type="button" className="copy-button" onClick={() => onSpeak(result.transcribed ?? '')} disabled={speakLoading && playingText !== result.transcribed} whileTap={{ scale: 0.9 }} title={playingText === result.transcribed ? 'Stop' : 'Listen'}>
                    {playingText === result.transcribed ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} className={cn(speakLoading && "animate-pulse")} />}
                  </motion.button>
                  {exportEnabled ? (
                    <motion.button
                      type="button"
                      className="copy-button"
                      onClick={() => void (onExportResult ? onExportResult('txt') : Promise.resolve(exportResultAsText(result, `${result.target}_transcript_translation`)))}
                      whileTap={{ scale: 0.9 }}
                      title="Export transcript and translation"
                    >
                      <Download size={16} />
                    </motion.button>
                  ) : null}
                  {onRetranslateTranscript ? (
                    <motion.button type="button" className="copy-button" onClick={() => setIsEditingTranscript((current) => !current)} whileTap={{ scale: 0.9 }}>
                      <Pencil size={16} />
                    </motion.button>
                  ) : null}
                  <motion.button type="button" id="copy-transcription-btn" className="copy-button" onClick={() => onCopy(result.transcribed!, 'transcribed')} whileTap={{ scale: 0.9 }}>
                    {copiedField === 'transcribed' ? <Check size={16} /> : <Copy size={16} />}
                  </motion.button>
                </div>
              </div>
              {isEditingTranscript ? (
                <div className="transcript-editor">
                  <textarea
                    className="transcript-editor-input"
                    rows={5}
                    value={editedTranscript}
                    onChange={(event) => setEditedTranscript(event.target.value)}
                    placeholder="Edit the transcript before retranslating..."
                  />
                  <div className="transcript-editor-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setEditedTranscript(result.transcribed ?? '');
                        setIsEditingTranscript(false);
                      }}
                    >
                      <X size={16} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={retranslating || !editedTranscript.trim()}
                      onClick={() => void onRetranslateTranscript?.(editedTranscript)}
                    >
                      {retranslating ? <RefreshCcw size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                      {retranslating ? 'Retranslating...' : 'Retranslate'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={cn('result-text', !result.transcribed && 'empty')}>{result.transcribed || 'No speech detected.'}</div>
              )}
            </motion.div>
          )}
          <motion.div className="result-box result-box-success" id="translation-box" variants={itemVariants}>
            <div className="result-header">
              <span className="label">Translation</span>
              <div className="result-actions">
                <motion.button type="button" className="copy-button" onClick={() => onSpeak(result.translated)} disabled={speakLoading && playingText !== result.translated} whileTap={{ scale: 0.9 }} title={playingText === result.translated ? 'Stop' : 'Listen'}>
                  {playingText === result.translated ? <Square size={18} fill="currentColor" /> : <Volume2 size={18} className={cn(speakLoading && "animate-pulse")} />}
                </motion.button>
                {exportEnabled ? (
                  <motion.button
                    type="button"
                    className="copy-button"
                    onClick={() => void (onExportResult ? onExportResult('txt') : Promise.resolve(exportResultAsText(result, `${result.target}_translation`)))}
                    whileTap={{ scale: 0.9 }}
                    title="Export text"
                  >
                    <Download size={18} />
                  </motion.button>
                ) : null}
                <motion.button type="button" id="copy-translation-btn" className="copy-button" onClick={() => onCopy(result.translated, 'translated')} whileTap={{ scale: 0.9 }}>
                  {copiedField === 'translated' ? <Check size={18} /> : <Copy size={18} />}
                </motion.button>
              </div>
            </div>
            <div className="result-text">{result.translated}</div>
          </motion.div>
        </>
      )}

      {/* Approved reviewer feedback only */}
      {canSubmitReviewerFeedback ? (
        <FeedbackWidget
          historyId={result.id}
          source={result.transcribed ?? result.inputText ?? ''}
          aiOutput={result.translated}
          dialect={dialect}
          context={context}
          onSubmit={onFeedback}
        />
      ) : null}
    </motion.div>
  );
}
