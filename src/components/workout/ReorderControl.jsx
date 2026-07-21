import { ChevronUp, ChevronDown } from 'lucide-react'

// Compact up/down reorder control designed to sit inside a card header.
export default function ReorderControl({ canMoveUp, canMoveDown, onMoveUp, onMoveDown }) {
  return (
    <div className="flex flex-col flex-shrink-0 -my-1">
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        className={`p-1 flex items-center justify-center transition-colors
          ${canMoveUp
            ? 'text-gray-400 active:text-gray-200'
            : 'text-gray-700 cursor-default'}`}
        aria-label="Move up"
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        className={`p-1 flex items-center justify-center transition-colors
          ${canMoveDown
            ? 'text-gray-400 active:text-gray-200'
            : 'text-gray-700 cursor-default'}`}
        aria-label="Move down"
      >
        <ChevronDown size={16} />
      </button>
    </div>
  )
}
