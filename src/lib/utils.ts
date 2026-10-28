export const generateInvoice = () => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Date.now().toString().slice(-4)}`
}