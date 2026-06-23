import { formatRupiah } from '@/lib/utils'
import { X, Printer } from 'lucide-react'

interface ReceiptItem {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface ReceiptData {
  invoice_number: string
  created_at: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payment_method: string
  amount_paid: number
  change_amount: number
  business_name: string
  address?: string
  phone?: string
}

export default function ReceiptModal({
  data,
  onClose,
}: {
  data: ReceiptData
  onClose: () => void
}) {
  const handlePrint = () => window.print()

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const paymentLabel: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    ewallet: 'E-Wallet',
    qris: 'QRIS',
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        #receipt-print { display: none; }
        @media print {
          @page { size: 58mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; }
          #receipt-print {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 58mm;
          }
          #receipt-print > div {
            max-width: 100% !important;
            width: 100% !important;
            font-size: 9px !important;
            line-height: 1.35 !important;
            padding: 3mm 2mm !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Print-only version */}
      <div id="receipt-print">
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '12px', color: '#000', maxWidth: '300px', margin: '0 auto', padding: '16px', lineHeight: 1.4 }}>

          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px' }}>{data.business_name}</p>
            {data.address && <p style={{ margin: '3px 0 0' }}>{data.address}</p>}
            {data.phone && <p style={{ margin: '2px 0 0' }}>{data.phone}</p>}
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Info transaksi */}
          <p style={{ margin: 0 }}>No&nbsp;&nbsp;: {data.invoice_number}</p>
          <p style={{ margin: '2px 0 0' }}>Tgl&nbsp;: {formatDate(data.created_at)}</p>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Daftar item */}
          {data.items.map((item, i) => (
            <div key={i} style={{ marginBottom: '5px' }}>
              <p style={{ margin: 0 }}>{item.product_name}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity} x {formatRupiah(item.unit_price)}</span>
                <span>{formatRupiah(item.subtotal)}</span>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Ringkasan */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span><span>{formatRupiah(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Diskon</span><span>-{formatRupiah(data.discount)}</span>
            </div>
          )}
          {data.tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pajak</span><span>+{formatRupiah(data.tax)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '3px' }}>
            <span>TOTAL</span><span>{formatRupiah(data.total)}</span>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Pembayaran */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bayar ({paymentLabel[data.payment_method]})</span>
            <span>{formatRupiah(data.amount_paid)}</span>
          </div>
          {data.payment_method === 'cash' && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Kembali</span><span>{formatRupiah(data.change_amount)}</span>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          <p style={{ textAlign: 'center', margin: '4px 0 0' }}>~ Terima kasih ~</p>
        </div>
      </div>

      {/* Modal UI */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">

          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Struk Pembayaran</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Preview Struk */}
          <div className="p-5">
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs space-y-1">
              <p className="text-center font-bold text-sm text-gray-900 placeholder-gray-400">{data.business_name}</p>
              {data.address && <p className="text-center text-gray-500">{data.address}</p>}
              {data.phone && <p className="text-center text-gray-500">{data.phone}</p>}
              <p className="text-center text-gray-300">{'- '.repeat(16)}</p>
              <p className="text-gray-600">No: {data.invoice_number}</p>
              <p className="text-gray-600">Tgl: {formatDate(data.created_at)}</p>
              <p className="text-gray-300">{'- '.repeat(16)}</p>

              {data.items.map((item, i) => (
                <div key={i}>
                  <p className="text-gray-700">{item.product_name}</p>
                  <div className="flex justify-between text-gray-500 pl-2">
                    <span>{item.quantity}x {formatRupiah(item.unit_price)}</span>
                    <span>{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))}

              <p className="text-gray-300">{'- '.repeat(16)}</p>
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatRupiah(data.subtotal)}</span>
              </div>
              {data.discount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Diskon</span><span>-{formatRupiah(data.discount)}</span>
                </div>
              )}
              {data.tax > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>Pajak</span><span>+{formatRupiah(data.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 text-sm border-t border-gray-200 pt-1">
                <span>TOTAL</span><span>{formatRupiah(data.total)}</span>
              </div>
              <p className="text-gray-300">{'- '.repeat(16)}</p>
              <div className="flex justify-between text-gray-600">
                <span>Bayar ({paymentLabel[data.payment_method]})</span>
                <span>{formatRupiah(data.amount_paid)}</span>
              </div>
              {data.payment_method === 'cash' && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Kembali</span><span>{formatRupiah(data.change_amount)}</span>
                </div>
              )}
              <p className="text-center text-gray-400 pt-2">— Terima kasih! —</p>
            </div>

            {/* Tombol */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Printer size={15} />
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}