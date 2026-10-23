import { formatRupiah } from '@/lib/utils'
import { Plus } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  cost_price?: number
  stock: number
  image_url: string | null
  category?: { name: string; color: string } | null
  category2?: { name: string; color: string } | null
}

export default function ProductCard({
  product,
  onAdd,
  compactMode = false,
}: {
  product: Product
  onAdd: (product: Product) => void
  compactMode?: boolean
}) {
  const outOfStock = product.stock <= 0

  return (
    <button
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      className={`bg-white border text-left transition-all w-full ${
        compactMode ? 'rounded-lg p-2' : 'rounded-xl p-3'
      } ${
        outOfStock
          ? 'opacity-50 cursor-not-allowed border-gray-100'
          : 'border-gray-200 hover:border-indigo-300 hover:shadow-md active:scale-95'
      }`}
    >
      {!compactMode && (
        <div className="w-full aspect-square rounded-lg bg-gray-100 mb-2 overflow-hidden flex items-center justify-center">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🛍️</span>
          )}
        </div>
      )}

      <p className={`${compactMode ? 'text-xs sm:text-sm' : 'text-sm'} font-medium text-gray-800 leading-tight line-clamp-2`}>
        {product.name}
      </p>

      {(product.category || product.category2) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {[product.category, product.category2]
            .filter((c): c is { name: string; color: string } => !!c)
            .map((c, i) => (
              <span
                key={i}
                className={`inline-block ${compactMode ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5'} rounded font-medium`}
                style={{
                  backgroundColor: c.color + '20',
                  color: c.color,
                }}
              >
                {c.name}
              </span>
            ))}
        </div>
      )}

      <div className={`flex items-center justify-between gap-1 ${compactMode ? 'mt-1' : 'mt-2'}`}>
        <p className={`${compactMode ? 'text-xs sm:text-sm' : 'text-sm'} font-bold text-indigo-600`}>
          {formatRupiah(product.price)}
        </p>
        <div className="flex items-center gap-1">
          {outOfStock ? (
            <span className="text-xs text-red-400">Habis</span>
          ) : (
            <>
              <span className={`text-xs text-gray-400 ${compactMode ? 'hidden sm:inline' : ''}`}>
                Stok {product.stock}
              </span>
              <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                <Plus size={12} className="text-white" />
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  )
}