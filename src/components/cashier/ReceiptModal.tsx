'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { formatRupiah } from '@/lib/utils'
import { X, Printer, Share2 } from 'lucide-react'

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
  table_number?: number | null
  table_label?: string
}

export default function ReceiptModal({
  data,
  onClose,
}: {
  data: ReceiptData
  onClose: () => void
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [printing, setPrinting] = useState(false)

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }) + ' WIB'

  const paymentLabel: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    ewallet: 'E-Wallet',
    qris: 'QRIS',
  }

  // Ambil "foto" dari tampilan preview struk supaya hasil cetak & gambar identik dgn yg di layar
  const captureImage = async () => {
    const node = previewRef.current
    if (!node) return null
    return await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 3 })
  }

  // Cetak: render preview jadi gambar, lalu cetak gambarnya lewat iframe (andal di HP & desktop)
  const handlePrint = async () => {
    setPrinting(true)
    try {
      const dataUrl = await captureImage()
      if (!dataUrl) return

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) { iframe.remove(); return }

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        @page { size: 58mm auto; margin: 0; }
        html, body { margin: 0; padding: 0; }
        body { width: 58mm; }
        img { width: 100%; display: block; }
      </style></head><body><img src="${dataUrl}" /></body></html>`)
      doc.close()

      const win = iframe.contentWindow
      const imgEl = doc.querySelector('img')
      let fired = false
      const triggerPrint = () => {
        if (fired) return
        fired = true
        win?.focus()
        win?.print()
        setTimeout(() => iframe.remove(), 1000)
      }
      if (imgEl && !imgEl.complete) {
        imgEl.onload = triggerPrint
        setTimeout(triggerPrint, 1500) // fallback kalau onload tak terpicu
      } else {
        setTimeout(triggerPrint, 200)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPrinting(false)
    }
  }

  // Bagikan/simpan struk sebagai gambar PNG — jalan di semua kondisi (termasuk in-app browser & HP tanpa printer)
  const handleShare = async () => {
    setSharing(true)
    try {
      const dataUrl = await captureImage()
      if (!dataUrl) return
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `struk-${data.invoice_number}.png`, { type: 'image/png' })

      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>
      }

      if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Struk Pembayaran',
          text: `Struk ${data.invoice_number}`,
        })
      } else {
        // Fallback: download gambar
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `struk-${data.invoice_number}.png`
        a.click()
      }
    } catch (err) {
      // Diabaikan kalau user membatalkan dialog share
      console.error(err)
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
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
            <div ref={previewRef} className="bg-gray-50 rounded-xl p-4 font-mono text-xs space-y-1">
              <p className="text-center font-bold text-sm text-gray-900 placeholder-gray-400">{data.business_name}</p>
              {data.address && <p className="text-center text-gray-500">{data.address}</p>}
              {data.phone && <p className="text-center text-gray-500">{data.phone}</p>}
              <p className="text-center text-gray-300">{'- '.repeat(16)}</p>
              <p className="text-gray-600">No: {data.invoice_number}</p>
              <p className="text-gray-600">Tgl: {formatDate(data.created_at)}</p>
              {(data.table_label || data.table_number != null) && (
                <p className="text-gray-600">
                  Meja: {data.table_label ?? data.table_number}
                </p>
              )}
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
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="py-2.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Share2 size={15} />
                  {sharing ? 'Membuat...' : 'Bagikan'}
                </button>
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Printer size={15} />
                  {printing ? 'Menyiapkan...' : 'Cetak'}
                </button>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
