import { useState } from 'react'
import { formatRupiah } from '@/lib/utils'
import { X, Banknote, CreditCard, Tag, Percent, QrCode } from 'lucide-react'

interface Props {
  subtotal: number
  onConfirm: (method: string, amountPaid: number, discount: number, tax: number) => void
  onClose: () => void
  loading: boolean
  qrisImageUrl?: string | null
}

const paymentMethods = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'transfer', label: 'Transfer', icon: CreditCard },
  { id: 'qris', label: 'QRIS', icon: QrCode },
]

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function PaymentModal({ subtotal, onConfirm, onClose, loading, qrisImageUrl }: Props) {
  const [method, setMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [discountType, setDiscountType] = useState<'nominal' | 'percent'>('nominal')
  const [discountValue, setDiscountValue] = useState('')
  const [taxPercent, setTaxPercent] = useState('')

  const discountAmount = discountValue === ''
    ? 0
    : discountType === 'percent'
      ? (subtotal * Math.min(Number(discountValue), 100)) / 100
      : Math.min(Number(discountValue), subtotal)

  const taxAmount = taxPercent === ''
    ? 0
    : (subtotal - discountAmount) * (Math.min(Number(taxPercent), 100) / 100)

  const total = Math.max(0, subtotal - discountAmount + taxAmount)
  const paid = Number(amountPaid) || 0
  const change = paid - total

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000,
    50000,
    100000,
    200000,
  ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">Proses Pembayaran</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Diskon */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase">Diskon</p>
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                <button
                  onClick={() => { setDiscountType('nominal'); setDiscountValue('') }}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    discountType === 'nominal'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Rp
                </button>
                <button
                  onClick={() => { setDiscountType('percent'); setDiscountValue('') }}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    discountType === 'percent'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                min={0}
                max={discountType === 'percent' ? 100 : subtotal}
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? 'Contoh: 10' : 'Nominal diskon'}
                className={inputClass}
              />
            </div>
          </div>

          {/* Pajak */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Percent size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase">Pajak (%)</p>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              value={taxPercent}
              onChange={e => setTaxPercent(e.target.value)}
              placeholder="Contoh: 11 untuk PPN 11%"
              className={inputClass}
            />
          </div>

          {/* Rincian harga */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">{formatRupiah(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Diskon {discountType === 'percent' ? `(${discountValue}%)` : ''}
                </span>
                <span className="text-red-500">- {formatRupiah(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pajak ({taxPercent}%)</span>
                <span className="text-orange-500">+ {formatRupiah(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-800">Total</span>
              <span className="text-indigo-700">{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Metode Bayar */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Metode Bayar</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                    method === id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Jumlah Bayar (tunai) */}
          {method === 'cash' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Jumlah Dibayar</p>
              <input
                type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="Masukkan nominal..."
                className={inputClass}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {quickAmounts.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmountPaid(String(a))}
                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                  >
                    {formatRupiah(a)}
                  </button>
                ))}
              </div>

              {paid >= total && total > 0 && (
                <div className="mt-3 bg-green-50 rounded-lg px-3 py-2 flex justify-between">
                  <span className="text-xs text-green-600 font-medium">Kembalian</span>
                  <span className="text-sm font-bold text-green-700">{formatRupiah(change)}</span>
                </div>
              )}
              {paid > 0 && paid < total && (
                <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 flex justify-between">
                  <span className="text-xs text-red-500 font-medium">Kurang</span>
                  <span className="text-sm font-bold text-red-600">{formatRupiah(total - paid)}</span>
                </div>
              )}
            </div>
          )}

          {/* QRIS */}
          {method === 'qris' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Scan QRIS</p>
              {qrisImageUrl ? (
                <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisImageUrl}
                    alt="QRIS Pembayaran"
                    className="w-52 h-52 object-contain rounded-lg bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-3">Scan & bayar sejumlah</p>
                  <p className="text-lg font-bold text-indigo-700">{formatRupiah(total)}</p>
                  <p className="text-[11px] text-gray-400 mt-1 text-center">
                    Pastikan nominal pada aplikasi pelanggan sesuai sebelum konfirmasi
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm text-amber-700 font-medium">QRIS belum diatur</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Unggah gambar QRIS di menu Pengaturan terlebih dahulu.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tombol Bayar */}
        <div className="px-5 pb-5">
          <button
            onClick={() => onConfirm(method, method === 'cash' ? paid : total, discountAmount, taxAmount)}
            disabled={
              loading ||
              (method === 'cash' && paid < total) ||
              (method === 'qris' && !qrisImageUrl) ||
              total <= 0
            }
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? 'Memproses...'
              : method === 'qris'
                ? `Sudah Dibayar · ${formatRupiah(total)}`
                : `Bayar ${formatRupiah(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}