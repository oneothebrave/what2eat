import { motion } from 'framer-motion';
import type { AppState } from '../types';

interface ControlButtonProps {
  appState: AppState;
  restaurantCount: number;
  onStart: () => void;
  onReset: () => void;
}

export function ControlButton({ appState, restaurantCount, onStart, onReset }: ControlButtonProps) {
  const isRolling = appState === 'rolling';
  const hasResult = appState === 'result';
  const isLoading = appState === 'locating' || appState === 'scanning';
  const isEmpty = restaurantCount === 0 && !isLoading && !hasResult;

  const label = hasResult ? '再选一次'
    : isRolling ? '正在纠结…'
    : isLoading ? '正在获取…'
    : isEmpty ? '附近没有餐厅'
    : '开始选择';

  const isDisabled = isRolling || isLoading || isEmpty;

  const handleClick = () => {
    if (hasResult) onReset();
    else if (!isDisabled) onStart();
  };

  return (
    <motion.button
      id="main-action-btn"
      className={`btn-apple ${hasResult ? 'btn-secondary' : ''}`}
      onClick={handleClick}
      disabled={isDisabled}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {isRolling && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            style={{
              display: 'inline-block', width: 16, height: 16,
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: 'white', borderRadius: '50%',
            }}
          />
        )}
        {label}
      </span>
    </motion.button>
  );
}
