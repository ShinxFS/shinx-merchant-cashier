import { formatRupiah } from '@/lib/utils'
import { Minus, Plus, Trash2 } from 'lucide-react'

export interface CartItemType {
  id: string
  name: string
  price: number
  quantity: number
  stock: number
  image_url?: string | null
}

export default function CartItem({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItemType
  onIncrease: (id: string) => void
  onDecrease: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">

      {/* Gambar */}
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">🛍️</span>
        )}
      </div>

      {/* Nama & Harga */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-gray-800 leading-tight line-clamp-3">{item.name}</p>
        <p className="text-[12px] text-indigo-600 font-semibold mt-0.5">
          {formatRupiah(item.price)}
        </p>
      </div>

      {/* Qty Control & Total */}
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-[13px] font-bold text-gray-800">
          {formatRupiah(item.price * item.quantity)}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onDecrease(item.id)}
            className="w-6 h-6 rounded-full border border-gray-400 bg-white flex items-center justify-center hover:bg-gray-100 text-gray-700"
          >
            <Minus size={10} />
          </button>
          <span className="text-[13px] font-semibold w-5 text-center text-gray-800">
            {item.quantity}
          </span>
          <button
            onClick={() => onIncrease(item.id)}
            disabled={item.quantity >= item.stock}
            className="w-6 h-6 rounded-full border border-gray-400 bg-white flex items-center justify-center hover:bg-gray-100 text-gray-700 disabled:opacity-40"
          >
            <Plus size={10} />
          </button>
          <button
            onClick={() => onRemove(item.id)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors ml-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}