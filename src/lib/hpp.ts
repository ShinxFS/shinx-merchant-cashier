// Util perhitungan Harga Pokok Penjualan (HPP) untuk 3 jenis bisnis.
// Semua fungsi murni (tanpa side-effect) agar mudah dipakai ulang & dites.

export type BusinessType = 'manufaktur' | 'retail' | 'jasa'

export interface HppResult {
  totalCost: number       // total biaya untuk seluruh unit/layanan
  hppPerUnit: number      // HPP per unit/layanan
  breakEvenPoint: number  // pendapatan minimal agar impas (= totalCost)
}

export interface PriceRecommendation {
  minPrice: number          // harga minimum (margin 0%)
  recommendedPrice: number  // harga rekomendasi sesuai target margin
}

// Bantu konversi input form (string/number/undefined) ke angka aman.
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface ManufakturInput {
  bahanUtama?: number | string
  bahanPendukung?: number | string
  kemasan?: number | string
  upahProduksi?: number | string
  bonus?: number | string
  listrik?: number | string
  lainnya?: number | string
  units?: number | string
}

export interface RetailInput {
  hargaBeliSatuan?: number | string
  diskon?: number | string
  ongkir?: number | string
  biayaImport?: number | string
  penyimpanan?: number | string
  lainnya?: number | string
  units?: number | string
}

export interface JasaInput {
  upah?: number | string
  komisi?: number | string
  material?: number | string
  peralatan?: number | string
  listrik?: number | string
  lainnya?: number | string
  jumlahLayanan?: number | string
}

const finalize = (totalCost: number, divisor: number): HppResult => {
  const safeDivisor = divisor > 0 ? divisor : 1
  const total = Math.max(0, totalCost)
  return {
    totalCost: total,
    hppPerUnit: total / safeDivisor,
    breakEvenPoint: total,
  }
}

export const calcManufaktur = (i: ManufakturInput): HppResult => {
  const bahan = num(i.bahanUtama) + num(i.bahanPendukung) + num(i.kemasan)
  const tenagaKerja = num(i.upahProduksi) + num(i.bonus)
  const overhead = num(i.listrik) + num(i.lainnya)
  return finalize(bahan + tenagaKerja + overhead, num(i.units))
}

export const calcRetail = (i: RetailInput): HppResult => {
  const units = num(i.units)
  const pembelian = num(i.hargaBeliSatuan) * (units > 0 ? units : 1) - num(i.diskon)
  const tambahan = num(i.ongkir) + num(i.biayaImport) + num(i.penyimpanan) + num(i.lainnya)
  return finalize(pembelian + tambahan, units)
}

export const calcJasa = (i: JasaInput): HppResult => {
  const tenagaKerja = num(i.upah) + num(i.komisi)
  const material = num(i.material) + num(i.peralatan)
  const operasional = num(i.listrik) + num(i.lainnya)
  return finalize(tenagaKerja + material + operasional, num(i.jumlahLayanan))
}

// marginPct = persen margin keuntungan atas harga jual (mis. 20 berarti 20%).
export const recommendPrice = (hppPerUnit: number, marginPct: number): PriceRecommendation => {
  const m = Math.min(Math.max(num(marginPct), 0), 95) / 100
  return {
    minPrice: hppPerUnit,
    recommendedPrice: m < 1 ? hppPerUnit / (1 - m) : hppPerUnit,
  }
}
