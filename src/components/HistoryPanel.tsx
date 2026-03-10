import { motion, AnimatePresence } from 'framer-motion';
import { Archive, X, Folder as FolderIcon, LayoutGrid, MessageSquare, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ConversationItem, FavoriteItem, FolderItem, HistoryItem } from '../types';

interface HistoryPanelProps {
  show: boolean;
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
  onSetActiveFolder: (id: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onCreateConversation: (title?: string) => Promise<void>;
  onSelectConversation: (id: string | null) => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onArchiveHistory: (historyId: string) => Promise<void>;
  onToggleFavorite: (historyId: string, isFavorite: boolean) => Promise<void>;
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
}

type HistoryTab = 'recent' | 'favorites';

export function HistoryPanel({
  show,
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
  onSetActiveFolder,
  onCreateFolder,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onArchiveHistory,
  onToggleFavorite,
  onClose,
  onSelect,
}: HistoryPanelProps) {
  const [tab, setTab] = useState<HistoryTab>('recent');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedFolderId = activeFolderId === 'none' ? null : activeFolderId;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const favoriteHistoryIds = new Set(favorites.map((item) => item.historyId));
  const activeFolderName = selectedFolderId
    ? folders.find((folder) => folder.id === selectedFolderId)?.name ?? 'Unknown folder'
    : 'No folder';

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

  const renderHistoryItem = (item: HistoryItem) => {
    const isFavorite = favoriteHistoryIds.has(item.id);
    return (
      <li key={item.id} className="history-item" onClick={() => onSelect(item)}>
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
                void onToggleFavorite(item.id, isFavorite);
              }}
              disabled={!hasIdentity}
              title={hasIdentity ? (isFavorite ? 'Remove favorite' : 'Add favorite') : 'Add an email in settings to save favorites'}
            >
              <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              className="favorite-toggle"
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm('Archive this history item?')) {
                  void onArchiveHistory(item.id);
                }
              }}
              title="Archive history item"
            >
              <Archive size={14} />
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
  };

  return (
    <AnimatePresence>
      {show ? (
        <>
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="history-header">
              <span>Library</span>
              <button type="button" className="history-close-btn" onClick={onClose} aria-label="Close history">
                <X size={20} />
              </button>
            </div>

            <div className="history-tabs">
              <button type="button" className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>
                Recent
              </button>
              <button type="button" className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>
                Favorites
              </button>
            </div>

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
              <div className="folder-panel-note">
                New translations save to: <strong>{activeFolderName}</strong>
              </div>
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
                          <span>{conversation.title}</span>
                          <small>{conversation._count?.histories ?? 0}</small>
                        </button>
                        <div className="conversation-pill-actions">
                          <button
                            type="button"
                            className="conversation-action"
                            onClick={() => {
                              const title = window.prompt('Rename chat', conversation.title);
                              if (title && title.trim()) {
                                void onRenameConversation(conversation.id, title.trim());
                              }
                            }}
                            aria-label="Rename chat"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="conversation-action danger"
                            onClick={() => {
                              if (window.confirm(`Delete "${conversation.title}"? Its translations will stay in history.`)) {
                                void onDeleteConversation(conversation.id);
                              }
                            }}
                            aria-label="Delete chat"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
                loading ? (
                  <p className="history-empty">Loading history...</p>
                ) : filteredHistory.length === 0 ? (
                  <p className="history-empty">No translations yet.</p>
                ) : (
                  <ul className="history-list">{filteredHistory.map(renderHistoryItem)}</ul>
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
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
