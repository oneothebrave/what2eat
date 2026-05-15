import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Restaurant } from '../types';

interface SlotMachineProps {
  restaurants: Restaurant[];
  isRolling: boolean;
  onComplete: (restaurant: Restaurant) => void;
}

// Build a very long repeated list for seamless scroll illusion
function buildScrollList(items: Restaurant[], repeats = 6): Restaurant[] {
  const result: Restaurant[] = [];
  for (let i = 0; i < repeats; i++) {
    result.push(...items.map(r => ({ ...r, id: r.id + i * 10000 })));
  }
  return result;
}

const CARD_HEIGHT = 72; // px
const VISIBLE_CARDS = 5;
const WINDOW_HEIGHT = CARD_HEIGHT * VISIBLE_CARDS;

export function SlotMachine({ restaurants, isRolling, onComplete }: SlotMachineProps) {
  const scrollList = buildScrollList(restaurants, 8);
  const [phase, setPhase] = useState<'idle' | 'fast' | 'slowing' | 'stopping' | 'stopped'>('idle');
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  useEffect(() => {
    if (isRolling && restaurants.length > 0) {
      setPhase('fast');
      setIsShaking(true);
      let speed = 40; // ms per step
      let step = 0;
      const totalFastSteps = 30;
      const totalSlowSteps = 20;

      const tick = () => {
        step++;
        setDisplayIndex(prev => (prev - 1 + scrollList.length) % scrollList.length);

        if (step < totalFastSteps) {
          // Fast phase
          intervalRef.current = setTimeout(tick, speed);
        } else if (step < totalFastSteps + totalSlowSteps) {
          // Slowing phase - exponential easing
          const progress = (step - totalFastSteps) / totalSlowSteps;
          speed = 40 + Math.pow(progress, 2) * 280;
          setPhase('slowing');
          intervalRef.current = setTimeout(tick, speed);
        } else {
          // Stopping phase - mechanical clunk steps
          setPhase('stopping');
          setIsShaking(false);

          // Mechanical "clunk" - a few more ticks with increasing delay
          const clunkSteps = [180, 280, 400];
          let clunkIdx = 0;

          const clunk = () => {
            if (clunkIdx < clunkSteps.length) {
              setDisplayIndex(prev => (prev - 1 + scrollList.length) % scrollList.length);
              const delay = clunkSteps[clunkIdx];
              clunkIdx++;
              timeoutRef.current = setTimeout(clunk, delay);
            } else {
              // Final stop
              setPhase('stopped');

              // Pick winner
              const winnerIdx = Math.floor(Math.random() * restaurants.length);
              setDisplayIndex(winnerIdx);

              timeoutRef.current = setTimeout(() => {
                onComplete(restaurants[winnerIdx]);
              }, 300);
            }
          };

          timeoutRef.current = setTimeout(clunk, clunkSteps[clunkIdx++]);
        }
      };

      intervalRef.current = setTimeout(tick, speed);
    } else if (!isRolling) {
      clearTimers();
      setPhase('idle');
      setIsShaking(false);
    }

    return clearTimers;
  }, [isRolling, restaurants]);

  // Generate indices for the visible window
  const getVisibleItems = () => {
    const items = [];
    const half = Math.floor(VISIBLE_CARDS / 2);
    for (let i = -half; i <= half; i++) {
      const idx = ((displayIndex + i) % scrollList.length + scrollList.length) % scrollList.length;
      items.push({ item: scrollList[idx], offset: i });
    }
    return items;
  };

  const visibleItems = getVisibleItems();

  return (
    <div className="relative flex flex-col items-center">
      {/* Machine body */}
      <motion.div
        className="relative w-full"
        animate={isShaking ? {
          x: [0, -1, 1, -1, 0, 1, -1, 0],
          y: [0, 0, -1, 0, 1, 0, -1, 0],
        } : { x: 0, y: 0 }}
        transition={isShaking ? {
          duration: 0.12,
          repeat: Infinity,
          ease: 'linear',
        } : { duration: 0.2 }}
      >
        {/* Slot window */}
        <div
          className="slot-window rounded-lg relative"
          style={{ height: `${WINDOW_HEIGHT}px` }}
        >
          {/* Active center highlight */}
          <div className="slot-active-highlight" />

          {/* Speed lines - visible during fast phase */}
          <AnimatePresence>
            {(phase === 'fast') && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: `${10 + i * 12}%`,
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent 10%, rgba(0,212,255,0.15) 50%, transparent 90%)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.8, 0] }}
                    transition={{
                      duration: 0.08,
                      repeat: Infinity,
                      delay: i * 0.01,
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Cards */}
          <div className="relative h-full overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleItems.map(({ item, offset }) => {
                const isCenter = offset === 0;
                const isStopped = phase === 'stopped';

                return (
                  <motion.div
                    key={`${item.id}-${offset}`}
                    className="ticket-card absolute left-2 right-2 flex items-center"
                    style={{
                      top: `${WINDOW_HEIGHT / 2 + offset * CARD_HEIGHT - CARD_HEIGHT / 2}px`,
                      height: `${CARD_HEIGHT - 4}px`,
                      borderRadius: '6px',
                      zIndex: isCenter ? 6 : 1,
                    }}
                    initial={{ opacity: 0.3 }}
                    animate={{
                      opacity: isCenter ? 1 : Math.max(0.15, 1 - Math.abs(offset) * 0.35),
                      scale: isCenter && isStopped ? 1.04 : isCenter ? 1.02 : 1 - Math.abs(offset) * 0.04,
                      borderColor: isCenter && isStopped
                        ? 'rgba(0,212,255,0.6)'
                        : isCenter
                          ? 'rgba(0,212,255,0.3)'
                          : 'rgba(30,45,61,0.8)',
                      boxShadow: isCenter && isStopped
                        ? '0 0 20px rgba(0,212,255,0.25), inset 0 0 20px rgba(0,212,255,0.05)'
                        : 'none',
                      backgroundColor: isCenter
                        ? '#131d28'
                        : '#0d1520',
                    }}
                    transition={{
                      duration: phase === 'fast' ? 0.04 : 0.15,
                      ease: 'easeOut',
                    }}
                  >
                    {/* Left indicator strip */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                      style={{
                        background: isCenter
                          ? 'var(--color-accent)'
                          : 'var(--color-card-border)',
                        opacity: isCenter ? 1 : 0.3,
                      }}
                    />

                    {/* Content */}
                    <div className="ml-5 flex-1 min-w-0">
                      <div
                        className="font-mono-tech text-sm tracking-wide truncate"
                        style={{
                          color: isCenter ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                        }}
                      >
                        {item.name}
                      </div>
                      {item.cuisine && (
                        <div
                          className="font-mono-tech text-[9px] tracking-widest mt-0.5 truncate"
                          style={{ color: 'var(--color-text-dim)' }}
                        >
                          {item.cuisine?.toUpperCase()} · {item.distance}
                        </div>
                      )}
                    </div>

                    {/* Right: ID/index */}
                    <div
                      className="font-mono-tech text-[9px] mr-3"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      #{String(item.id % 10000).padStart(3, '0')}
                    </div>

                    {/* Scan line effect on active card */}
                    {isCenter && phase !== 'idle' && (
                      <motion.div
                        className="absolute inset-0 rounded-md pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, transparent 0%, rgba(0,212,255,0.04) 50%, transparent 100%)',
                        }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Phase indicator */}
          <div
            className="absolute top-1 right-2 font-mono-tech text-[8px] tracking-widest"
            style={{ color: 'var(--color-text-dim)', zIndex: 15 }}
          >
            {phase === 'fast' && '◉ COUNTING'}
            {phase === 'slowing' && '◉ PROCESSING'}
            {phase === 'stopping' && '◉ LOCKING'}
            {phase === 'stopped' && '◉ LOCKED'}
          </div>
        </div>
      </motion.div>

      {/* Bottom data strip */}
      <div
        className="w-full mt-2 px-3 py-1.5 rounded font-mono-tech text-[9px] flex justify-between"
        style={{
          background: 'rgba(13,17,23,0.8)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-dim)',
        }}
      >
        <span>POOL: <span style={{ color: 'var(--color-accent)' }}>{restaurants.length}</span> ENTRIES</span>
        <span>ALG: <span style={{ color: 'var(--color-accent)' }}>RAND-v4</span></span>
        <span>
          STATUS:{' '}
          <span style={{
            color: phase === 'stopped' ? 'var(--color-success)' : 'var(--color-accent)',
          }}>
            {phase === 'stopped' ? 'MATCH' : phase.toUpperCase()}
          </span>
        </span>
      </div>
    </div>
  );
}
