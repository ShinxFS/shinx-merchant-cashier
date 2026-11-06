'use client'
import { LocalizedText, translateText, useLanguage } from '@/lib/language'


import { useState } from 'react'
import { useCurrency } from '@/lib/currency'
import { X, Banknote, CreditCard, Tag, Percent, QrCode, WalletCards } from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'

interface Props {
  subtotal: number
  onConfirm: (
    method: PaymentMethod | 'mixed',
    amountPaid: number,
    discount: number,
    tax: number,
    paymentAccount: PaymentAccount | null,
    paymentDetails: PaymentDetail[],
  ) => void
  onClose: () => void
  loading: boolean
  qrisImageUrl?: string | null
  paymentAccounts?: PaymentAccount[]
  onSound?: () => void
}

export interface PaymentAccount {
  id: string
  bank_name: string
  account_number: string
  account_name: string
}

export type PaymentMethod = 'cash' | 'transfer' | 'qris'

export interface PaymentDetail {
  method: PaymentMethod
  amount: number
  paymentAccount: PaymentAccount | null
}

const paymentMethods = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'transfer', label: 'Transfer', icon: CreditCard },
  { id: 'qris', label: 'QRIS', icon: QrCode },
  { id: 'mixed', label: 'Split', icon: WalletCards },
] as const

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function PaymentModal({ subtotal, onConfirm, onClose, loading, qrisImageUrl, paymentAccounts = [], onSound }: Props) {
  const localizedLanguage = useLanguage().language

  const { formatCurrency, currency } = useCurrency()
  const [method, setMethod] = useState<PaymentMethod | 'mixed'>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [discountType, setDiscountType] = useState<'nominal' | 'percent'>('nominal')
  const [discountValue, setDiscountValue] = useState('')
  const [taxPercent, setTaxPercent] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [mixedCashAmount, setMixedCashAmount] = useState('')
  const [mixedTransferAmount, setMixedTransferAmount] = useState('')
  const [mixedQrisAmount, setMixedQrisAmount] = useState('')
  const [mixedCashEdited, setMixedCashEdited] = useState(false)

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
  const mixedCashPaid = Number(mixedCashAmount) || 0
  const mixedTransferPaid = Number(mixedTransferAmount) || 0
  const mixedQrisPaid = Number(mixedQrisAmount) || 0
  const mixedNonCashPaid = mixedTransferPaid + mixedQrisPaid
  const mixedCashContribution = Math.max(0, total - mixedNonCashPaid)
  const mixedAmountPaid = mixedCashPaid + mixedNonCashPaid
  const mixedChange = Math.max(0, mixedCashPaid - mixedCashContribution)
  const selectedAccount = paymentAccounts.find(account => account.id === selectedAccountId) ?? null
  const mixedPaymentDetails: PaymentDetail[] = [
    ...(mixedCashContribution > 0 ? [{ method: 'cash' as const, amount: mixedCashContribution, paymentAccount: null }] : []),
    ...(mixedTransferPaid > 0 ? [{ method: 'transfer' as const, amount: mixedTransferPaid, paymentAccount: selectedAccount }] : []),
    ...(mixedQrisPaid > 0 ? [{ method: 'qris' as const, amount: mixedQrisPaid, paymentAccount: null }] : []),
  ]
  const mixedValid =
    mixedPaymentDetails.length >= 2 &&
    mixedCashPaid >= 0 &&
    mixedTransferPaid >= 0 &&
    mixedQrisPaid >= 0 &&
    mixedNonCashPaid <= total &&
    mixedCashPaid + mixedNonCashPaid >= total &&
    (mixedCashContribution > 0 ? mixedCashPaid >= mixedCashContribution : mixedCashPaid === 0) &&
    (mixedTransferPaid === 0 || selectedAccount !== null) &&
    (mixedQrisPaid === 0 || Boolean(qrisImageUrl))

  const quickAmounts = (currency === 'IDR'
    ? [Math.ceil(total / 1000) * 1000, 50000, 100000, 200000]
    : [Math.ceil(total / 10) * 10, 50, 100, 200]
  ).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)

  const triggerSound = () => {
    if (onSound) onSound()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{<LocalizedText text={"Proses Pembayaran"} />}</h3>
          <button
            onClick={() => {
              triggerSound()
              onClose()
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Diskon */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase">{<LocalizedText text={"Diskon"} />}</p>
            </div>
            <div className="flex gap-2">
              <div className="flex h-[42px] w-24 shrink-0 rounded-lg border border-gray-300 bg-white p-1 text-xs" role="group" aria-label={translateText("Jenis diskon", localizedLanguage)}>
                <button
                  type="button"
                  onClick={() => {
                    triggerSound()
                    setDiscountType('nominal')
                    setDiscountValue('')
                  }}
                  aria-pressed={discountType === 'nominal'}
                  className={`flex-1 rounded-md font-semibold transition-colors ${
                    discountType === 'nominal'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-white hover:text-gray-800'
                  }`}
                >
                  {<LocalizedText text={"\r\n                  Rp\r\n                "} />}</button>
                <button
                  type="button"
                  onClick={() => {
                    triggerSound()
                    setDiscountType('percent')
                    setDiscountValue('')
                  }}
                  aria-pressed={discountType === 'percent'}
                  className={`flex-1 rounded-md font-semibold transition-colors ${
                    discountType === 'percent'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-white hover:text-gray-800'
                  }`}
                >
                  {<LocalizedText text={"\r\n                  %\r\n                "} />}</button>
              </div>
              <input
                type="number"
                min={0}
                max={discountType === 'percent' ? 100 : subtotal}
                step={discountType === 'percent' ? 1 : 'any'}
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? translateText("Contoh: 10", localizedLanguage) : translateText("Nominal diskon", localizedLanguage)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Pajak */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Percent size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase">{<LocalizedText text={"Pajak (%)"} />}</p>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              value={taxPercent}
              onChange={e => setTaxPercent(e.target.value)}
              placeholder={translateText("Contoh: 11 untuk PPN 11%", localizedLanguage)}
              className={inputClass}
            />
          </div>

          {/* Rincian harga */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{<LocalizedText text={"Subtotal"} />}</span>
              <span className="text-gray-700">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {<LocalizedText text={"\r\n                  Diskon "} />}{discountType === 'percent' ? `(${discountValue}%)` : ''}
                </span>
                <span className="text-red-500">{<LocalizedText text={"- "} />}{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{<LocalizedText text={"Pajak ("} />}{taxPercent}{<LocalizedText text={"%)"} />}</span>
                <span className="text-orange-500">{<LocalizedText text={"+ "} />}{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-800">{<LocalizedText text={"Total"} />}</span>
              <span className="text-indigo-700">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Metode Bayar */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{<LocalizedText text={"Metode Bayar"} />}</p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {paymentMethods.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    triggerSound()
                    setMethod(id)
                    if (id === 'mixed' && mixedCashAmount === '') {
                      setMixedCashAmount(String(total))
                      setMixedCashEdited(false)
                    }
                  }}
                  aria-pressed={method === id}
                  className={`flex min-w-0 flex-col items-center gap-1 py-2.5 rounded-xl border px-1 text-[9px] font-medium transition-all sm:gap-1.5 sm:px-2 sm:py-3 sm:text-xs ${
                    method === id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Icon size={16} className="shrink-0 sm:h-[18px] sm:w-[18px]" />
                  <LocalizedText text={label} />
                </button>
              ))}
            </div>
          </div>

          {method === 'mixed' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                <LocalizedText text="Masukkan nominal yang diterima dari tiap metode. Nominal tunai boleh lebih untuk kembalian." />
              </p>
              <div className="rounded-xl border border-gray-200 p-3">
                <label htmlFor="mixed-cash-amount" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  <LocalizedText text="Tunai Diterima" />
                </label>
                <input
                  id="mixed-cash-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={mixedCashAmount}
                  onChange={e => {
                    setMixedCashAmount(e.target.value)
                    setMixedCashEdited(true)
                  }}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div className="rounded-xl border border-gray-200 p-3">
                <label htmlFor="mixed-transfer-amount" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  <LocalizedText text="Nominal Transfer" />
                </label>
                <input
                  id="mixed-transfer-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={mixedTransferAmount}
                  onChange={e => {
                    setMixedTransferAmount(e.target.value)
                    if (!mixedCashEdited) {
                      setMixedCashAmount(String(Math.max(0, total - (Number(e.target.value) || 0) - mixedQrisPaid)))
                    }
                  }}
                  placeholder="0"
                  className={inputClass}
                />
                {mixedTransferPaid > 0 && (
                  paymentAccounts.length > 0 ? (
                    <CustomSelect
                      value={selectedAccountId}
                      onValueChange={setSelectedAccountId}
                      ariaLabel={translateText('Pilih Rekening Tujuan', localizedLanguage)}
                      options={[
                        {
                          value: '',
                          label: translateText('Pilih Rekening Tujuan', localizedLanguage),
                        },
                        ...paymentAccounts.map(account => ({
                          value: account.id,
                          label: `${account.bank_name} · ${account.account_number} · ${account.account_name}`,
                        })),
                      ]}
                      className={`${inputClass} mt-2 pr-9 text-left`}
                    />
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      <LocalizedText text="Belum ada rekening transfer" />
                    </p>
                  )
                )}
              </div>
              <div className="rounded-xl border border-gray-200 p-3">
                <label htmlFor="mixed-qris-amount" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  <LocalizedText text="Nominal QRIS" />
                </label>
                <input
                  id="mixed-qris-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={mixedQrisAmount}
                  onChange={e => {
                    setMixedQrisAmount(e.target.value)
                    if (!mixedCashEdited) {
                      setMixedCashAmount(String(Math.max(0, total - mixedTransferPaid - (Number(e.target.value) || 0))))
                    }
                  }}
                  placeholder="0"
                  className={inputClass}
                />
                {mixedQrisPaid > 0 && (
                  qrisImageUrl ? (
                    <div className="mt-3 flex flex-col items-center rounded-lg bg-gray-50 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrisImageUrl}
                        alt={translateText("QRIS Pembayaran", localizedLanguage)}
                        className="h-40 w-40 rounded-lg bg-white object-contain"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        <LocalizedText text="Scan & bayar sejumlah" /> {formatCurrency(mixedQrisPaid)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      <LocalizedText text="QRIS belum diatur" />
                    </p>
                  )
                )}
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500"><LocalizedText text="Total Diterima" /></span>
                  <span className="font-medium text-gray-800">{formatCurrency(mixedAmountPaid)}</span>
                </div>
                {mixedAmountPaid >= total && total > 0 && (
                  <div className="mt-1 flex justify-between text-green-700">
                    <span><LocalizedText text="Kembalian" /></span>
                    <span className="font-semibold">{formatCurrency(mixedChange)}</span>
                  </div>
                )}
                {mixedAmountPaid < total && (
                  <div className="mt-1 flex justify-between text-red-600">
                    <span><LocalizedText text="Kurang" /></span>
                    <span className="font-semibold">{formatCurrency(total - mixedAmountPaid)}</span>
                  </div>
                )}
                {mixedNonCashPaid > total && (
                  <p className="mt-1 text-xs text-red-600">
                    <LocalizedText text="Nominal transfer dan QRIS tidak boleh melebihi total." />
                  </p>
                )}
                {mixedPaymentDetails.length < 2 && (
                  <p className="mt-1 text-xs text-amber-700">
                    <LocalizedText text="Gunakan minimal dua metode pembayaran." />
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rekening Transfer */}
          {method === 'transfer' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{<LocalizedText text={"Pilih Rekening Tujuan"} />}</p>
              {paymentAccounts.length > 0 ? (
                <div className="space-y-2">
                  {paymentAccounts.map(account => (
                    <button
                      type="button"
                      key={account.id}
                      onClick={() => {
                        triggerSound()
                        setSelectedAccountId(account.id)
                      }}
                      aria-pressed={selectedAccountId === account.id}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${selectedAccountId === account.id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-gray-200 bg-white hover:border-indigo-300"}`}
                    >
                      <p className="text-sm font-semibold text-indigo-900">{account.bank_name}</p>
                      <p className="text-sm text-indigo-800 tracking-wide">{account.account_number}</p>
                      <p className="text-xs text-indigo-600">{<LocalizedText text={"a.n. "} />}{account.account_name}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-sm font-medium text-amber-700">{<LocalizedText text={"Belum ada rekening transfer"} />}</p>
                  <p className="text-xs text-amber-600 mt-1">{<LocalizedText text={"Tambahkan rekening di menu Pengaturan."} />}</p>
                </div>
              )}
            </div>
          )}

          {/* Jumlah Bayar (tunai) */}
          {method === 'cash' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{<LocalizedText text={"Jumlah Dibayar"} />}</p>
              <input
                type="number"
                step="any"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder={translateText("Masukkan nominal...", localizedLanguage)}
                className={inputClass}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {quickAmounts.map(a => (
                  <button
                    key={a}
                    onClick={() => {
                      triggerSound()
                      setAmountPaid(String(a))
                    }}
                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                  >
                    {formatCurrency(a)}
                  </button>
                ))}
              </div>

              {paid >= total && total > 0 && (
                <div className="mt-3 bg-green-50 rounded-lg px-3 py-2 flex justify-between">
                  <span className="text-xs text-green-600 font-medium">{<LocalizedText text={"Kembalian"} />}</span>
                  <span className="text-sm font-bold text-green-700">{formatCurrency(change)}</span>
                </div>
              )}
              {paid > 0 && paid < total && (
                <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 flex justify-between">
                  <span className="text-xs text-red-500 font-medium">{<LocalizedText text={"Kurang"} />}</span>
                  <span className="text-sm font-bold text-red-600">{formatCurrency(total - paid)}</span>
                </div>
              )}
            </div>
          )}

          {/* QRIS */}
          {method === 'qris' && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{<LocalizedText text={"Scan QRIS"} />}</p>
              {qrisImageUrl ? (
                <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisImageUrl}
                    alt={translateText("QRIS Pembayaran", localizedLanguage)}
                    className="w-52 h-52 object-contain rounded-lg bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-3">{<LocalizedText text={"Scan & bayar sejumlah"} />}</p>
                  <p className="text-lg font-bold text-indigo-700">{formatCurrency(total)}</p>
                  <p className="text-[11px] text-gray-400 mt-1 text-center">
                    {<LocalizedText text={"\r\n                    Pastikan nominal pada aplikasi pelanggan sesuai sebelum konfirmasi\r\n                  "} />}</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm text-amber-700 font-medium">{<LocalizedText text={"QRIS belum diatur"} />}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {<LocalizedText text={"\r\n                    Unggah gambar QRIS di menu Pengaturan terlebih dahulu.\r\n                  "} />}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tombol Bayar */}
        <div className="px-5 pb-5">
          <button
            onClick={() => {
              triggerSound()
              const details: PaymentDetail[] = method === 'mixed'
                ? mixedPaymentDetails
                : [{ method, amount: total, paymentAccount: method === 'transfer' ? selectedAccount : null }]
              onConfirm(
                method,
                method === 'cash' ? paid : method === 'mixed' ? mixedAmountPaid : total,
                discountAmount,
                taxAmount,
                method === 'transfer' ? selectedAccount : null,
                details,
              )
            }}
            disabled={
              loading ||
              (method === 'cash' && paid < total) ||
              (method === 'qris' && !qrisImageUrl) ||
              (method === 'transfer' && !selectedAccountId) ||
              (method === 'mixed' && !mixedValid) ||
              total <= 0
            }
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <LocalizedText text={"Memproses..."} />
              : (method === 'qris' || (method === 'mixed' && mixedValid))
                ? `${translateText('Sudah Dibayar · ', localizedLanguage)}${formatCurrency(total)}`
                : `${translateText('Bayar ', localizedLanguage)}${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}