import { motion } from 'framer-motion';

interface HUDDecoProps {
  isActive: boolean;
}

// Animated scanning ring
export function HUDDeco({ isActive }: HUDDecoProps) {
  return (
    <div className="relative flex items-center justify-center py-2">
      {/* Central display bar */}
      <div
        className="w-full flex items-center gap-2 px-3 py-2 rounded font-mono-tech text-[9px]"
        style={{
          background: 'rgba(0,212,255,0.03)',
          border: '1px solid rgba(0,212,255,0.1)',
          color: 'var(--color-text-dim)',
        }}
      >
        {/* Left metrics */}
        <div className="flex items-center gap-2 flex-1">
          <motion.div
            className="w-1 h-1 rounded-full"
            style={{ background: 'var(--color-accent)' }}
            animate={isActive ? { opacity: [1, 0.2, 1] } : { opacity: 0.3 }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
          <span>RNG ENGINE ACTIVE</span>
        </div>

        {/* Center digits */}
        <div style={{ color: 'var(--color-accent)', letterSpacing: '0.2em' }}>
          <motion.span
            animate={isActive ? {
              opacity: [1, 0.5, 1],
            } : {}}
            transition={{ duration: 0.1, repeat: Infinity }}
          >
            {isActive ? Math.floor(Math.random() * 9999).toString().padStart(4, '0') : '----'}
          </motion.span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span>ENTROPY OK</span>
          <motion.div
            className="w-1 h-1 rounded-full"
            style={{ background: 'var(--color-success)' }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}

// Animated horizontal divider with data labels
export function DataDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <motion.div
        className="flex-1 h-px"
        style={{ background: 'var(--color-border)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <span
        className="font-mono-tech text-[8px] tracking-widest px-2"
        style={{ color: 'var(--color-text-dim)' }}
      >
        {label}
      </span>
      <motion.div
        className="flex-1 h-px"
        style={{ background: 'var(--color-border)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

// Flickering number counter for UI decoration
export function FlickerNumber({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="flex flex-col items-center p-2 rounded"
      style={{
        background: 'rgba(0,212,255,0.03)',
        border: '1px solid var(--color-border)',
        minWidth: '60px',
      }}
    >
      <motion.span
        className="font-orbitron font-bold text-lg"
        style={{ color: 'var(--color-accent)' }}
        key={value}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {value}
      </motion.span>
      <span
        className="font-mono-tech text-[8px] tracking-widest mt-0.5"
        style={{ color: 'var(--color-text-dim)' }}
      >
        {label}
      </span>
    </div>
  );
}
