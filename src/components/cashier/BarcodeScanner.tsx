'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { X, ScanLine } from 'lucide-react'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    let stopped = false

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (result && !stopped) {
            stopped = true
            reader.reset()
            onDetected(result.getText())
          }
        }
      )
      .catch((err) => {
        const name = (err as Error)?.name
        if (name === 'NotAllowedError') {
          setError('Izin kamera ditolak. Aktifkan akses kamera di browser lalu coba lagi.')
        } else if (name === 'NotFoundError') {
          setError('Kamera tidak ditemukan di perangkat ini.')
        } else {
          setError('Tidak bisa mengakses kamera. Pastikan halaman dibuka via HTTPS atau localhost.')
        }
      })

    return () => {
      stopped = true
      reader.reset()
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 text-white">
        <div className="flex items-center gap-2">
          <ScanLine size={18} />
          <span className="font-semibold text-sm">Scan Barcode</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
          <X size={22} />
        </button>
      </div>

      {/* Video / Error */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center px-8">
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-5 py-2 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20"
            >
              Tutup
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Bingkai panduan */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
            <p className="absolute bottom-10 left-0 right-0 text-center text-white/80 text-sm px-6">
              Arahkan kamera ke barcode produk
            </p>
          </>
        )}
      </div>
    </div>
  )
}
