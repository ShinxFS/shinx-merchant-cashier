'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useCurrency } from '@/lib/currency'
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react'

export interface CartItemType {
  id: string
  name: string
  price: number
  quantity: number
  stock: number
  image_url?: string | null
  note?: string
}

export default function CartItem({
  item,
  onIncrease,
  onDecrease,
  onSetQuantity,
  onNoteChange,
  onRemove,
}: {
  item: CartItemType
  onIncrease: (id: string, isRepeat?: boolean) => void
  onDecrease: (id: string, isRepeat?: boolean) => void
  onSetQuantity: (id: string, quantity: number) => void
  onNoteChange: (id: string, note: string) => void
  onRemove: (id: string) => void
}) {
  const localizedLanguage = useLanguage().language
  const { formatCurrency } = useCurrency()
  const [editingQuantity, setEditingQuantity] = useState(false)
  const [quantityDraft, setQuantityDraft] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const holdDelayRef = useRef<number | null>(null)
  const repeatIntervalRef = useRef<number | null>(null)
  const holdActivatedRef = useRef(false)
  const itemRef = useRef(item)
  useLayoutEffect(() => {
    itemRef.current = item
  }, [item])

  const stopHold = () => {
    if (holdDelayRef.current !== null) {
      window.clearTimeout(holdDelayRef.current)
      holdDelayRef.current = null
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
  }

  useEffect(() => () => {
    if (holdDelayRef.current !== null) window.clearTimeout(holdDelayRef.current)
    if (repeatIntervalRef.current !== null) window.clearInterval(repeatIntervalRef.current)
  }, [])

  const startHold = (direction: 'increase' | 'decrease', pointerId: number, button: HTMLButtonElement) => {
    holdActivatedRef.current = false
    try {
      button.setPointerCapture(pointerId)
    } catch {
      // Pointer capture is unavailable in some embedded browsers.
    }

    holdDelayRef.current = window.setTimeout(() => {
      holdActivatedRef.current = true
      const repeat = () => {
        const currentItem = itemRef.current
        const canChange = direction === 'increase'
          ? currentItem.quantity < currentItem.stock
          : currentItem.quantity > 1

        if (!canChange) {
          stopHold()
          return
        }

        if (direction === 'increase') onIncrease(currentItem.id, true)
        else onDecrease(currentItem.id, true)
      }

      repeat()
      if (direction === 'decrease' ? itemRef.current.quantity > 1 : itemRef.current.quantity < itemRef.current.stock) {
        repeatIntervalRef.current = window.setInterval(repeat, 100)
      }
    }, 400)
  }

  const handlePointerUp = () => stopHold()

  const handlePointerCancel = () => {
    stopHold()
    holdActivatedRef.current = false
  }

  const handleQuantityClick = (direction: 'increase' | 'decrease') => {
    if (holdActivatedRef.current) {
      holdActivatedRef.current = false
      return
    }
    if (direction === 'increase') onIncrease(item.id)
    else onDecrease(item.id)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, direction: 'increase' | 'decrease') => {
    if (event.button !== 0) return
    startHold(direction, event.pointerId, event.currentTarget)
  }

  const commitQuantity = () => {
    const currentItem = itemRef.current
    const nextQuantity = Number(quantityDraft)
    if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 1) {
      setQuantityDraft(String(currentItem.quantity))
    } else {
      const boundedQuantity = Math.min(nextQuantity, Math.max(1, currentItem.stock))
      if (boundedQuantity !== currentItem.quantity) onSetQuantity(currentItem.id, boundedQuantity)
      setQuantityDraft(String(boundedQuantity))
    }
    setEditingQuantity(false)
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">

      {/* Gambar */}
      <div className="w-12 h-12 self-start rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">{<LocalizedText text={"🛍️"} />}</span>
        )}
      </div>

      {/* Nama & Harga */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-gray-800 leading-tight line-clamp-3">{item.name}</p>
        <p className="text-[12px] text-indigo-600 font-semibold mt-0.5">
          {formatCurrency(item.price)}
        </p>
        {noteOpen && (
          <textarea
            value={item.note ?? ''}
            onChange={event => onNoteChange(item.id, event.target.value)}
            placeholder={translateText('Contoh: tanpa gula, es sedikit...', localizedLanguage)}
            rows={2}
            className="mt-2 w-full max-w-[60vw] resize-x rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            aria-label={`${translateText('Catatan', localizedLanguage)} ${item.name}`}
          />
        )}
      </div>

      {/* Qty Control & Total */}
      <div className="flex flex-shrink-0 self-start flex-col items-end gap-1.5">
        <p className="text-[13px] font-bold text-gray-800">
          {formatCurrency(item.price * item.quantity)}
        </p>
        <div className="flex items-center gap-1">
          <button
            onPointerDown={event => handlePointerDown(event, 'decrease')}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={() => handleQuantityClick('decrease')}
            className="w-5 h-5 rounded-full border border-gray-400 bg-white flex items-center justify-center hover:bg-gray-100 text-gray-700 select-none touch-none"
          >
            <Minus size={9} />
          </button>
          {editingQuantity ? (
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={`${translateText('Jumlah ', localizedLanguage)}${item.name}`}
              autoFocus
              value={quantityDraft}
              onFocus={event => event.currentTarget.select()}
              onChange={event => setQuantityDraft(event.target.value)}
              onBlur={commitQuantity}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  setQuantityDraft(String(itemRef.current.quantity))
                  setEditingQuantity(false)
                }
              }}
              className="h-5 w-4 border-b border-indigo-400 bg-white text-center text-xs font-semibold text-gray-800 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              aria-label={`${translateText('Edit jumlah ', localizedLanguage)}${item.name}`}
              onClick={() => {
                setQuantityDraft(String(item.quantity))
                setEditingQuantity(true)
              }}
              className="h-5 w-4 bg-transparent p-0 text-center text-xs font-semibold text-gray-800 hover:text-indigo-600"
            >
              {item.quantity}
            </button>
          )}
          <button
            onPointerDown={event => handlePointerDown(event, 'increase')}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={() => handleQuantityClick('increase')}
            disabled={item.quantity >= item.stock}
            className="w-5 h-5 rounded-full border border-gray-400 bg-white flex items-center justify-center hover:bg-gray-100 text-gray-700 disabled:opacity-40 select-none touch-none"
          >
            <Plus size={9} />
          </button>
          <button
            type="button"
            onClick={() => setNoteOpen(open => !open)}
            aria-label={`${translateText(item.note?.trim() ? 'Edit catatan' : 'Tambah catatan', localizedLanguage)} ${item.name}`}
            aria-expanded={noteOpen}
            title={translateText(item.note?.trim() ? 'Edit catatan' : 'Tambah catatan', localizedLanguage)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
              item.note?.trim() || noteOpen
                ? 'text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}