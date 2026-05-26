import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { Restaurant } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: Record<string, Restaurant>;
  blacklist: Record<string, Restaurant>;
  onRemoveFavorite: (amapId: string) => void;
  onRemoveBlacklist: (amapId: string) => void;
}

type TabType = 'favorites' | 'blacklist';

export function ProfileDrawer({
  isOpen,
  onClose,
  favorites,
  blacklist,
  onRemoveFavorite,
  onRemoveBlacklist,
}: ProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('favorites');

  const favList = Object.values(favorites).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  const blackList = Object.values(blacklist).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              margin: '0 auto',
              width: '100%',
              maxWidth: 430,
              height: '75dvh',
              zIndex: 1001,
              background: 'rgba(255, 255, 255, 0.82)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: 'inherit',
            }}
          >
            {/* Grabber/Handle bar */}
            <div style={{
              width: 36,
              height: 5,
              background: 'rgba(0,0,0,0.15)',
              borderRadius: 3,
              margin: '12px auto 8px auto',
              flexShrink: 0,
            }} />

            {/* Header */}
            <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                美食档案
              </h2>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(120, 120, 128, 0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* iOS style Tabs */}
            <div style={{ padding: '0 20px 16px 20px', flexShrink: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
                padding: 3,
                background: 'rgba(120, 120, 128, 0.12)',
                borderRadius: 999,
              }}>
                <button
                  onClick={() => setActiveTab('favorites')}
                  style={{
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: activeTab === 'favorites' ? 600 : 500,
                    background: activeTab === 'favorites' ? 'white' : 'transparent',
                    color: activeTab === 'favorites' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: activeTab === 'favorites' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <span>❤️</span> 我的最爱
                  <span style={{ fontSize: 11, opacity: 0.6 }}>({favList.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('blacklist')}
                  style={{
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: activeTab === 'blacklist' ? 600 : 500,
                    background: activeTab === 'blacklist' ? 'white' : 'transparent',
                    color: activeTab === 'blacklist' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: activeTab === 'blacklist' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <span>⚡</span> 避雷针
                  <span style={{ fontSize: 11, opacity: 0.6 }}>({blackList.length})</span>
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px 20px' }}>
              {activeTab === 'favorites' ? (
                favList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {favList.map(item => (
                      <motion.div
                        layout
                        key={item.amapId || item.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={cardStyle}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 8 }}>
                            {item.cuisine && <span>{item.cuisine}</span>}
                            {item.cost && <span>{item.cost}</span>}
                            {item.rating && <span>★ {item.rating.toFixed(1)}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => item.amapId && onRemoveFavorite(item.amapId)}
                          style={removeBtnStyle}
                        >
                          💔 取消
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="还没有收藏的店铺" subText="摇到美食时，点击小票上的“收藏”图标即可把店铺保存在这里。" emoji="❤️" />
                )
              ) : (
                blackList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {blackList.map(item => (
                      <motion.div
                        layout
                        key={item.amapId || item.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={cardStyle}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'line-through', opacity: 0.6 }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 8 }}>
                            {item.cuisine && <span>{item.cuisine}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => item.amapId && onRemoveBlacklist(item.amapId)}
                          style={restoreBtnStyle}
                        >
                          宽恕
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="避雷名单空空如也" subText="对于那些不好吃或卫生差的店，点击小票上的“避雷”按钮，以后就再也不会摇到了。" emoji="⚡" />
                )
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ text, subText, emoji }: { text: string; subText: string; emoji: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 44 }}>{emoji}</span>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{text}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, maxWidth: 280 }}>{subText}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  background: 'white',
  borderRadius: 14,
  border: '1px solid rgba(0,0,0,0.04)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  gap: 12,
};

const removeBtnStyle: React.CSSProperties = {
  border: '1px solid rgba(255, 59, 48, 0.15)',
  background: 'rgba(255, 59, 48, 0.06)',
  color: '#FF3B30',
  padding: '5px 10px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const restoreBtnStyle: React.CSSProperties = {
  border: '1px solid rgba(255, 107, 53, 0.15)',
  background: 'rgba(255, 107, 53, 0.06)',
  color: 'var(--accent)',
  padding: '5px 10px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
