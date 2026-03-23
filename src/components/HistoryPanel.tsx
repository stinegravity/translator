import { motion, AnimatePresence } from 'framer-motion';
import { Archive, Check, X, Folder as FolderIcon, FolderPlus, LayoutGrid, MessageSquare, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useState, memo, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { ConversationItem, FavoriteItem, FolderItem, HistoryItem } from '../types';

interface HistoryPanelProps {
  show: boolean;
  /** When true, renders as a persistent left sidebar. When false, slides in from right as overlay. */
  persistent?: boolean;
  loading: boolean;
  favoritesLoading: boolean;
  conversationsLoading: boolean;
  items: HistoryItem[];
  favorites: FavoriteItem[];
  folders: FolderItem[];
  conversations: ConversationItem[];
  activeFolderId: string;
  activeConversationId?: string | null;
  hasIdentity: boolean;
  hasMoreHistory?: boolean;
  onLoadMoreHistory?: () => void;
  onSetActiveFolder: (id: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onCreateConversation: (title?: string) => Promise<void>;
  onSelectConversation: (id: string | null) => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onMoveConversation: (id: string, folderId: string | null) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onArchiveHistory: (historyId: string) => Promise<void>;
  onToggleFavorite: (historyId: string, isFavorite: boolean) => Promise<void>;
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
}

type HistoryTab = 'recent' | 'favorites';

const HistoryListItem = memo(function HistoryListItem({
  item,
  isFavorite,
  confirmArchiveId,
  hasIdentity,
  onSelect,
  onToggleFavorite,
  onArchiveClick,
}: {
  item: HistoryItem;
  isFavorite: boolean;
  confirmArchiveId: string | null;
  hasIdentity: boolean;
  onSelect: (item: HistoryItem) => void;
  onToggleFavorite: (historyId: string, isFavorite: boolean) => void;
  onArchiveClick: (historyId: string) => void;
}) {
  return (
    <li className="history-item" onClick={() => onSelect(item)}>
      <div className="history-item-top">
        <div className="history-item-meta">
          <span className="history-mode">{item.mode}</span>
          {item.folder ? <span className="history-folder-tag">{item.folder.name}</span> : null}
        </div>
        <div className="history-item-actions">
          <button
            type="button"
            className={`favorite-toggle ${isFavorite ? 'active' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(item.id, isFavorite);
            }}
            disabled={!hasIdentity}
            title={hasIdentity ? (isFavorite ? 'Remove favorite' : 'Add favorite') : 'Add an email in settings to save favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className={`favorite-toggle ${confirmArchiveId === item.id ? 'confirm' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              onArchiveClick(item.id);
            }}
            title={confirmArchiveId === item.id ? 'Click to confirm archive' : 'Archive history item'}
            aria-label="Archive history item"
          >
            {confirmArchiveId === item.id ? <Check size={14} /> : <Archive size={14} />}
          </button>
          <span className="history-time">
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      <span className="history-text">{item.input.slice(0, 60)}{item.input.length > 60 ? '...' : ''}</span>
      <span className="history-output">{item.output.slice(0, 60)}{item.output.length > 60 ? '...' : ''}</span>
    </li>
  );
});

export function HistoryPanel({
  show,
  persistent = false,
  loading,
  favoritesLoading,
  conversationsLoading,
  items,
  favorites,
  folders,
  conversations,
  activeFolderId,
  activeConversationId,
  hasIdentity,
  hasMoreHistory,
  onLoadMoreHistory,
  onSetActiveFolder,
  onCreateFolder,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onMoveConversation,
  onDeleteConversation,
  onArchiveHistory,
  onToggleFavorite,
  onClose,
  onSelect,
}: HistoryPanelProps) {
  const focusTrapRef = useFocusTrap(show && !persistent);
  const [tab, setTab] = useState<HistoryTab>('recent');
  const [isCreating, setIsCreating] = useState(false);
  const [movingConversationId, setMovingConversationId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitle, setEditChatTitle] = useState('');
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedFolderId = activeFolderId === 'none' ? null : activeFolderId;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const favoriteHistoryIds = new Set(favorites.map((item) => item.historyId));

  const matchesSearch = (value: string | null | undefined) =>
    !normalizedSearch || (value ?? '').toLowerCase().includes(normalizedSearch);

  const historyMatchesSearch = (item: HistoryItem) =>
    matchesSearch(item.input) ||
    matchesSearch(item.output) ||
    matchesSearch(item.transcribed ?? undefined) ||
    matchesSearch(item.folder?.name) ||
    matchesSearch(item.conversation?.title);

  const filteredHistory = (!selectedFolderId ? items : items.filter((item) => item.folder?.id === selectedFolderId))
    .filter((item) => !activeConversationId || item.conversation?.id === activeConversationId)
    .filter(historyMatchesSearch);

  const filteredFavorites = (!selectedFolderId ? favorites : favorites.filter((item) => item.history.folder?.id === selectedFolderId))
    .filter((item) => historyMatchesSearch(item.history));

  const filteredConversations = (!selectedFolderId ? conversations : conversations.filter((item) => item.folder?.id === selectedFolderId))
    .filter((item) => matchesSearch(item.title) || matchesSearch(item.folder?.name));

  const filteredFolders = !normalizedSearch ? folders : folders.filter((folder) => matchesSearch(folder.name));

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await onCreateFolder(name);
    setNewName('');
    setIsCreating(false);
  };

  const handleCreateConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newConversationTitle.trim();
    await onCreateConversation(title || undefined);
    setNewConversationTitle('');
    setIsCreatingConversation(false);
  };

  const handleArchiveClick = useCallback((historyId: string) => {
    if (confirmArchiveId === historyId) {
      void onArchiveHistory(historyId);
      setConfirmArchiveId(null);
    } else {
      setConfirmArchiveId(historyId);
      setTimeout(() => setConfirmArchiveId(null), 3000);
    }
  }, [confirmArchiveId, onArchiveHistory]);

  const handleToggleFavoriteClick = useCallback((historyId: string, isFavorite: boolean) => {
    void onToggleFavorite(historyId, isFavorite);
  }, [onToggleFavorite]);

  const renderHistoryItem = (item: HistoryItem) => (
    <HistoryListItem
      key={item.id}
      item={item}
      isFavorite={favoriteHistoryIds.has(item.id)}
      confirmArchiveId={confirmArchiveId}
      hasIdentity={hasIdentity}
      onSelect={onSelect}
      onToggleFavorite={handleToggleFavoriteClick}
      onArchiveClick={handleArchiveClick}
    />
  );

  const innerContent = (
    <>
            <div className="history-header">
              <span>Library</span>
              <button type="button" className="history-close-btn" onClick={onClose} aria-label="Close history">
                <X size={20} />
              </button>
            </div>

            <nav className="history-tabs" aria-label="Library sections">
              <button type="button" className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')} aria-pressed={tab === 'recent'}>
                Recent
              </button>
              <button type="button" className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')} aria-pressed={tab === 'favorites'}>
                Favorites
              </button>
            </nav>

            <div className="history-search">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search chats, history, favorites..."
                aria-label="Search library"
              />
            </div>

            <div className="sidebar-folders">
              <button className={`folder-pill ${selectedFolderId === null ? 'active' : ''}`} onClick={() => onSetActiveFolder('none')}>
                <LayoutGrid size={14} />
                <span>No folder</span>
              </button>
              {filteredFolders.map((folder) => (
                <button key={folder.id} className={`folder-pill ${selectedFolderId === folder.id ? 'active' : ''}`} onClick={() => onSetActiveFolder(folder.id)}>
                  <FolderIcon size={14} />
                  <span>{folder.name}</span>
                </button>
              ))}
              {!isCreating ? (
                <button className="folder-pill create-btn" onClick={() => setIsCreating(true)}>
                  <Plus size={14} />
                  <span>New Folder</span>
                </button>
              ) : (
                <form className="sidebar-new-folder" onSubmit={handleCreate}>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Folder name..."
                    onBlur={() => !newName.trim() && setIsCreating(false)}
                    className="sidebar-folder-input"
                  />
                </form>
              )}
              {normalizedSearch && filteredFolders.length === 0 ? <p className="history-empty compact">No folders match.</p> : null}
            </div>

            <div className="history-content">
              {tab === 'recent' ? (
                <>
                  <div className="history-subheader">Conversations</div>
                  <div className="conversation-list">
                    <button
                      type="button"
                      className={`conversation-pill ${activeConversationId ? '' : 'active'}`}
                      onClick={() => onSelectConversation(null)}
                    >
                      <MessageSquare size={14} />
                      <span>Standalone mode</span>
                    </button>
                    {filteredConversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`conversation-pill ${activeConversationId === conversation.id ? 'active' : ''}`}
                      >
                        <button type="button" className="conversation-select" onClick={() => onSelectConversation(conversation.id)}>
                          <MessageSquare size={14} />
                          {editingChatId === conversation.id ? (
                            <input
                              className="inline-chat-edit"
                              autoFocus
                              type="text"
                              value={editChatTitle}
                              onChange={(e) => setEditChatTitle(e.target.value)}
                              onBlur={() => {
                                if (editChatTitle.trim() && editChatTitle !== conversation.title) {
                                  void onRenameConversation(conversation.id, editChatTitle.trim());
                                }
                                setEditingChatId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editChatTitle.trim() && editChatTitle !== conversation.title) {
                                    void onRenameConversation(conversation.id, editChatTitle.trim());
                                  }
                                  setEditingChatId(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingChatId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span>{conversation.title}</span>
                          )}
                          {!editingChatId && <small>{conversation._count?.histories ?? 0}</small>}
                        </button>
                        <div className="conversation-pill-actions">
                          <button
                            type="button"
                            className="conversation-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingChatId(conversation.id);
                              setEditChatTitle(conversation.title);
                            }}
                            aria-label="Rename chat"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="conversation-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMovingConversationId(movingConversationId === conversation.id ? null : conversation.id);
                            }}
                            aria-label="Move chat to folder"
                          >
                            <FolderPlus size={13} />
                          </button>
                          <button
                            type="button"
                            className={`conversation-action danger ${confirmDeleteChatId === conversation.id ? 'confirm' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (confirmDeleteChatId === conversation.id) {
                                void onDeleteConversation(conversation.id);
                                setConfirmDeleteChatId(null);
                              } else {
                                setConfirmDeleteChatId(conversation.id);
                                setTimeout(() => setConfirmDeleteChatId(null), 3000);
                              }
                            }}
                            title={confirmDeleteChatId === conversation.id ? 'Click to confirm delete' : 'Delete chat'}
                            aria-label="Delete chat"
                          >
                            {confirmDeleteChatId === conversation.id ? <Check size={13} /> : <Trash2 size={13} />}
                          </button>
                        </div>
                        {movingConversationId === conversation.id && (
                          <div className="move-folder-flyout">
                            <div className="move-flyout-header">
                              <span>Move to folder...</span>
                              <button type="button" onClick={() => setMovingConversationId(null)}>
                                <X size={12} />
                              </button>
                            </div>
                            <div className="move-flyout-list">
                              <button
                                type="button"
                                className={`move-flyout-item ${(conversation.folder?.id ?? null) === null ? 'active' : ''}`}
                                onClick={() => {
                                  void onMoveConversation(conversation.id, null);
                                  setMovingConversationId(null);
                                }}
                              >
                                <LayoutGrid size={13} /> No folder
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  className={`move-flyout-item ${(conversation.folder?.id ?? null) === f.id ? 'active' : ''}`}
                                  onClick={() => {
                                    void onMoveConversation(conversation.id, f.id);
                                    setMovingConversationId(null);
                                  }}
                                >
                                  <FolderIcon size={13} /> {f.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {!isCreatingConversation ? (
                      <button type="button" className="conversation-pill create-btn" onClick={() => setIsCreatingConversation(true)}>
                        <Plus size={14} />
                        <span>New Chat</span>
                      </button>
                    ) : (
                      <form className="sidebar-new-folder" onSubmit={handleCreateConversation}>
                        <input
                          autoFocus
                          type="text"
                          value={newConversationTitle}
                          onChange={(event) => setNewConversationTitle(event.target.value)}
                          placeholder="Chat title..."
                          onBlur={() => !newConversationTitle.trim() && setIsCreatingConversation(false)}
                          className="sidebar-folder-input"
                        />
                      </form>
                    )}
                    {conversationsLoading ? <p className="history-empty compact">Loading conversations...</p> : null}
                    {!conversationsLoading && filteredConversations.length === 0 ? <p className="history-empty compact">No chats match.</p> : null}
                  </div>

                  <div className="history-subheader">Recent activity</div>
                </>
              ) : (
                <div className="history-subheader">Starred translations</div>
              )}

              {tab === 'recent' ? (
                loading && items.length === 0 ? (
                  <p className="history-empty">Loading history...</p>
                ) : filteredHistory.length === 0 ? (
                  <p className="history-empty">No translations yet.</p>
                ) : (
                  <>
                    <ul className="history-list">{filteredHistory.map(renderHistoryItem)}</ul>
                    {hasMoreHistory && onLoadMoreHistory && (
                      <button
                        type="button"
                        className="load-more-btn"
                        onClick={onLoadMoreHistory}
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Load more'}
                      </button>
                    )}
                  </>
                )
              ) : favoritesLoading ? (
                <p className="history-empty">Loading favorites...</p>
              ) : !hasIdentity ? (
                <p className="history-empty">Add your email in settings to keep personal favorites.</p>
              ) : filteredFavorites.length === 0 ? (
                <p className="history-empty">No favorites yet.</p>
              ) : (
                <ul className="history-list">
                  {filteredFavorites.map((item) => renderHistoryItem(item.history))}
                </ul>
              )}
            </div>
    </>
  );

  if (!show) return null;

  if (persistent) {
    return (
      <aside className="history-sidebar library-sidebar-persistent" aria-label="Library sidebar">
        {innerContent}
      </aside>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="history-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        className="history-sidebar"
        ref={focusTrapRef}
        role="dialog"
        aria-label="Library panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {innerContent}
      </motion.aside>
    </AnimatePresence>
  );
}
