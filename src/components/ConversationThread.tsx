import { Archive, Clock, Copy, Download, Pencil, RefreshCcw, Search, Star, Volume2, X } from 'lucide-react';
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
  onCopy,
  onSpeak,
  onArchiveHistory,
  onUpdateTranscript,
  onToggleFavorite,
}: ConversationThreadProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTranscript, setEditedTranscript] = useState('');
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredItems = items.filter((item) => {
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
                  className="favorite-toggle"
                  onClick={() => {
                    if (window.confirm('Archive this history item?')) {
                      void onArchiveHistory(item.id);
                    }
                  }}
                  title="Archive history item"
                >
                  <Archive size={14} />
                </button>
              </div>

              <div className="thread-block">
                <div className="thread-block-header">
                  <span>Source</span>
                  <div className="thread-actions">
                    <button type="button" className="copy-button" onClick={() => onSpeak(item.input)} disabled={speakLoading}>
                      <Volume2 size={16} />
                    </button>
                    {exportEnabled ? (
                      <button
                        type="button"
                        className="copy-button"
                        onClick={() => void (onExportHistory ? onExportHistory(item.id, 'txt') : Promise.resolve(exportResultAsText(item, `${title}_turn_${item.id}`)))}
                        title="Export text"
                      >
                        <Download size={16} />
                      </button>
                    ) : null}
                    <button type="button" className="copy-button" onClick={() => onCopy(item.input, 'transcribed')}>
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
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
                  <p className="thread-text">{item.transcribed ?? item.input}</p>
                )}
                {item.segments && item.segments.length > 0 ? (
                  <div className="thread-segments">
                    {item.segments.map((segment) => (
                      <div key={segment.id} className="thread-segment">
                        <span className="thread-segment-meta">
                          {segment.speaker} · {Math.floor(segment.start)}s - {Math.floor(segment.end)}s
                        </span>
                        <p className="thread-segment-text">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="thread-block thread-block-output">
                <div className="thread-block-header">
                  <span>Translation</span>
                  <div className="thread-actions">
                    <button type="button" className="copy-button" onClick={() => onSpeak(item.output)} disabled={speakLoading}>
                      <Volume2 size={16} />
                    </button>
                    {exportEnabled && item.segments && item.segments.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={() => void (onExportHistory ? onExportHistory(item.id, 'srt') : Promise.resolve(exportResultAsSrt(item, `${title}_turn_${item.id}`)))}
                          title="Export SRT"
                        >
                          <span className="export-mini-label">SRT</span>
                        </button>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={() => void (onExportHistory ? onExportHistory(item.id, 'vtt') : Promise.resolve(exportResultAsVtt(item, `${title}_turn_${item.id}`)))}
                          title="Export VTT"
                        >
                          <span className="export-mini-label">VTT</span>
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="copy-button" onClick={() => onCopy(item.output, 'translated')}>
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                <p className="thread-text">{item.output}</p>
                {item.segments && item.segments.some((segment) => segment.translatedText) ? (
                  <div className="thread-segments">
                    {item.segments.map((segment) => (
                      <div key={`${segment.id}-translated`} className="thread-segment">
                        <span className="thread-segment-meta">
                          {segment.speaker} translation
                        </span>
                        <p className="thread-segment-text">{segment.translatedText ?? segment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
