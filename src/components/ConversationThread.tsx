import { Archive, Check, Clock, Copy, Download, Pencil, RefreshCcw, Search, Star, Volume2, X, Pause } from 'lucide-react';
import { useState } from 'react';
import type { HistoryItem } from '../types';
import { exportConversationAsText, exportResultAsSrt, exportResultAsText, exportResultAsVtt } from '../utils/exporters';

interface ConversationThreadProps {
  title: string;
  items: HistoryItem[];
  favoriteHistoryIds: Set<string>;
  hasIdentity: boolean;
  exportEnabled?: boolean;
  onExportConversation?: () => Promise<void>;
  onExportHistory?: (historyId: string, format: 'txt' | 'srt' | 'vtt') => Promise<void>;
  speakLoading: boolean;
  playingText?: string | null;
  isPlaying?: boolean;
  onCopy: (text: string, field: 'transcribed' | 'translated') => void;
  onSpeak: (text: string) => void;
  onArchiveHistory: (historyId: string) => Promise<void>;
  onUpdateTranscript: (historyId: string, transcript: string) => Promise<void>;
  onToggleFavorite: (historyId: string, isFavorite: boolean) => Promise<void>;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationThread({
  title,
  items,
  favoriteHistoryIds,
  hasIdentity,
  exportEnabled = false,
  onExportConversation,
  onExportHistory,
  speakLoading,
  playingText,
  isPlaying,
  onCopy,
  onSpeak,
  onArchiveHistory,
  onUpdateTranscript,
  onToggleFavorite,
}: ConversationThreadProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredItems = [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((item) => {
      if (!normalizedSearch) return true;
      const haystacks = [
        item.input,
        item.output,
        item.transcribed ?? '',
        ...(item.segments?.flatMap((segment) => [segment.text, segment.translatedText ?? '']) ?? []),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(normalizedSearch));
    });

  return (
    <section className="thread-panel">
      <div className="thread-header">
        <div>
          <p className="thread-kicker">Active chat</p>
          <h2>{title}</h2>
        </div>
        <div className="thread-header-actions">
          <span className="thread-count">
            {items.length} {items.length === 1 ? 'turn' : 'turns'}
          </span>
          {exportEnabled ? (
            <button
              type="button"
              className="copy-button"
              onClick={() => void (onExportConversation ? onExportConversation() : Promise.resolve(exportConversationAsText(title, items)))}
              title="Export conversation text"
            >
              <Download size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="thread-search">
        <Search size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search this chat..."
          aria-label="Search this chat"
        />
        {normalizedSearch ? <span className="thread-search-count">{filteredItems.length} match{filteredItems.length === 1 ? '' : 'es'}</span> : null}
      </div>

      <div className="thread-list">
        {filteredItems.length === 0 ? (
          <div className="thread-empty">No turns match this search.</div>
        ) : filteredItems.map((item) => {
          const isFavorite = favoriteHistoryIds.has(item.id);
          return (
            <article key={item.id} className="thread-entry">
              <div className="thread-entry-top">
                <div className="thread-entry-meta">
                  <span className="history-mode">{item.mode}</span>
                  <span className="thread-time">
                    <Clock size={13} />
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>
                <div className="thread-actions">
                  <button
                  type="button"
                  className={`favorite-toggle ${isFavorite ? 'active' : ''}`}
                  onClick={() => void onToggleFavorite(item.id, isFavorite)}
                  disabled={!hasIdentity}
                  title={hasIdentity ? (isFavorite ? 'Remove favorite' : 'Add favorite') : 'Add an email in settings to save favorites'}
                >
                  <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
                {item.mode === 'audio' ? (
                  <button
                    type="button"
                    className="favorite-toggle"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditedTranscript(item.transcribed ?? item.input);
                    }}
                    title="Edit transcript"
                  >
                    <Pencil size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`favorite-toggle ${confirmArchiveId === item.id ? 'confirm' : ''}`}
                  onClick={() => {
                    if (confirmArchiveId === item.id) {
                      void onArchiveHistory(item.id);
                      setConfirmArchiveId(null);
                    } else {
                      setConfirmArchiveId(item.id);
                      setTimeout(() => setConfirmArchiveId(null), 3000);
                    }
                  }}
                  title={confirmArchiveId === item.id ? 'Confirm archive' : 'Archive history item'}
                >
                  {confirmArchiveId === item.id ? <Check size={14} /> : <Archive size={14} />}
                </button>
                </div>
              </div>

              <div className="chat-bubble chat-bubble-source">
                {editingId === item.id ? (
                  <div className="thread-editor">
                    <textarea
                      className="transcript-editor-input"
                      rows={5}
                      value={editedTranscript}
                      onChange={(event) => setEditedTranscript(event.target.value)}
                    />
                    <div className="transcript-editor-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setEditingId(null);
                          setEditedTranscript('');
                        }}
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={!editedTranscript.trim()}
                        onClick={async () => {
                          await onUpdateTranscript(item.id, editedTranscript);
                          setEditingId(null);
                          setEditedTranscript('');
                        }}
                      >
                        <RefreshCcw size={16} />
                        Save & Retranslate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="chat-content-stack">
                    {item.transcribed ? (
                      <>
                        <p className="chat-text-meta">
                          {item.input.length > 60 ? `${item.input.slice(0, 60)}...` : item.input}
                        </p>
                        <p className="chat-text transcribed">{item.transcribed}</p>
                      </>
                    ) : (
                      <p className="chat-text">{item.input}</p>
                    )}
                  </div>
                )}
                {item.segments && item.segments.length > 0 ? (
                  <div className="chat-segments">
                    {item.segments.map((segment, index) => (
                      <div key={segment.id ?? `${item.id}-seg-${index}`} className="chat-segment">
                        <span className="chat-segment-meta">{segment.speaker} · {Math.floor(segment.start)}s - {Math.floor(segment.end)}s</span>
                        <p className="chat-segment-text">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="chat-actions chat-actions-source">
                  <button 
                    type="button" 
                    className="copy-button" 
                    onClick={() => onSpeak(item.input)} 
                    disabled={speakLoading && playingText !== item.input} 
                    title={(isPlaying && playingText === item.input) ? "Pause" : "Listen"}
                  >
                    {(isPlaying && playingText === item.input) ? <Pause size={13} fill="currentColor" /> : <Volume2 size={13} />}
                  </button>
                  {exportEnabled ? (
                    <button type="button" className="copy-button" onClick={() => void (onExportHistory ? onExportHistory(item.id, 'txt') : Promise.resolve(exportResultAsText(item, `${title}_turn_${item.id}`)))} title="Export text">
                      <Download size={13} />
                    </button>
                  ) : null}
                  <button type="button" className="copy-button" onClick={() => onCopy(item.input, 'transcribed')} title="Copy source">
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="chat-bubble chat-bubble-target">
                <p className="chat-text">{item.output}</p>
                {item.segments && item.segments.some((segment) => segment.translatedText) ? (
                  <div className="chat-segments">
                    {item.segments.map((segment, index) => (
                      <div key={`${segment.id ?? `${item.id}-seg-${index}`}-translated`} className="chat-segment">
                        <span className="chat-segment-meta">{segment.speaker} translation</span>
                        <p className="chat-segment-text">{segment.translatedText ?? segment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="chat-actions chat-actions-target">
                  <button 
                    type="button" 
                    className="copy-button" 
                    onClick={() => onSpeak(item.output)} 
                    disabled={speakLoading && playingText !== item.output} 
                    title={(isPlaying && playingText === item.output) ? "Pause" : "Listen"}
                  >
                    {(isPlaying && playingText === item.output) ? <Pause size={13} fill="currentColor" /> : <Volume2 size={13} />}
                  </button>
                  {exportEnabled && item.segments && item.segments.length > 0 ? (
                    <>
                      <button type="button" className="copy-button" onClick={() => void (onExportHistory ? onExportHistory(item.id, 'srt') : Promise.resolve(exportResultAsSrt(item, `${title}_turn_${item.id}`)))} title="Export SRT">
                        <span className="export-mini-label">SRT</span>
                      </button>
                      <button type="button" className="copy-button" onClick={() => void (onExportHistory ? onExportHistory(item.id, 'vtt') : Promise.resolve(exportResultAsVtt(item, `${title}_turn_${item.id}`)))} title="Export VTT">
                        <span className="export-mini-label">VTT</span>
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="copy-button" onClick={() => onCopy(item.output, 'translated')} title="Copy translation">
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
