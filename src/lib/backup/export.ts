'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type JSZip from 'jszip'

const PAGE_SIZE = 500
const STORAGE_PAGE_SIZE = 100
const BACKUP_TABLES = [
  'payment_accounts',
  'categories',
  'products',
  'notification_logs',
  'transactions',
  'expenses',
  'hpp_products',
  'table_orders',
] as const

const IMPORTABLE_PROFILE_FIELDS = new Set([
  'business_name',
  'owner_name',
  'phone',
  'address',
  'language_code',
  'currency_code',
  'qris_image_url',
  'cashier_sound_url',
  'customer_sound_url',
  'cashier_tone',
  'customer_tone',
  'cashier_compact_mode',
  'low_stock_threshold',
  'created_at',
])

const IMPORTABLE_TABLE_FIELDS = {
  categories: ['id', 'name', 'color'],
  products: [
    'id',
    'name',
    'sku',
    'price',
    'cost_price',
    'stock',
    'unit',
    'image_url',
    'is_active',
    'category_id',
    'category_id_2',
    'updated_at',
  ],
  payment_accounts: ['id', 'bank_name', 'account_number', 'account_name', 'created_at'],
  notification_logs: ['id', 'event_type', 'title', 'message', 'metadata', 'created_at'],
  transactions: [
    'id',
    'created_by',
    'invoice_number',
    'subtotal',
    'discount',
    'tax',
    'total',
    'payment_method',
    'payment_account',
    'payment_details',
    'amount_paid',
    'change_amount',
    'table_number',
    'status',
    'created_at',
  ],
  transaction_items: [
    'id',
    'transaction_id',
    'product_id',
    'product_name',
    'quantity',
    'unit_price',
    'cost_price',
    'subtotal',
    'note',
  ],
  expenses: ['id', 'title', 'amount', 'category', 'notes', 'date', 'created_at'],
  hpp_products: [
    'id',
    'business_type',
    'product_name',
    'product_code',
    'category',
    'units',
    'inputs',
    'total_cost',
    'hpp_per_unit',
    'break_even_point',
    'target_margin',
    'min_price',
    'recommended_price',
    'created_at',
  ],
  table_orders: [
    'id',
    'table_number',
    'customer_name',
    'total',
    'status',
    'payment_method',
    'items',
    'note',
    'created_at',
    'updated_at',
  ],
} satisfies Record<(typeof BACKUP_TABLES)[number] | 'transaction_items', string[]>

type BackupRow = Record<string, unknown>

function isRecord(value: unknown): value is BackupRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function omitFields(row: BackupRow, fields: string[]) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !fields.includes(key))
  )
}

function pickFields(row: BackupRow, fields: readonly string[]) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => fields.includes(key))
  )
}

function getBackupRows(zip: JSZip, path: string) {
  const file = zip.file(path)
  if (!file) throw new Error(`Backup is missing ${path}.`)

  return file.async('string').then(content => {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error(`Backup file ${path} is not valid JSON.`)
    }

    if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
      throw new Error(`Backup file ${path} must contain a JSON array of records.`)
    }

    return parsed
  })
}

function getPublicMediaPath(url: string) {
  try {
    const path = new URL(url).pathname
    const marker = '/storage/v1/object/public/product-images/'
    const markerIndex = path.indexOf(marker)
    if (markerIndex === -1) return null
    return decodeURIComponent(path.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

function remapMediaUrl(
  value: unknown,
  sourceOwnerId: string,
  mediaUrls: Map<string, string>
) {
  if (typeof value !== 'string' || !value) return value

  const path = getPublicMediaPath(value)
  if (!path) return value
  if (!path.startsWith(`${sourceOwnerId}/`)) {
    throw new Error('Backup contains a media URL outside the backed-up store folder.')
  }

  const targetUrl = mediaUrls.get(path)
  if (!targetUrl) {
    throw new Error('A referenced store media file is missing from the backup archive.')
  }
  return targetUrl
}

async function insertRows(
  supabase: SupabaseClient,
  tableName: string,
  rows: BackupRow[]
) {
  for (let start = 0; start < rows.length; start += 100) {
    const { error } = await supabase
      .from(tableName)
      .insert(rows.slice(start, start + 100))

    if (error) throw new Error(`Failed to import ${tableName}: ${error.message}`)
  }
}

async function removeRows(
  supabase: SupabaseClient,
  tableName: string,
  ownerId: string
) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('user_id', ownerId)

  if (error) throw new Error(`Failed to roll back ${tableName}: ${error.message}`)
}

async function rollbackImport(
  supabase: SupabaseClient,
  ownerId: string,
  originalProfile: BackupRow,
  uploadedPaths: string[]
) {
  const failures: string[] = []
  for (const tableName of [
    'table_orders',
    'expenses',
    'hpp_products',
    'notification_logs',
    'payment_accounts',
    'transactions',
    'products',
    'categories',
  ]) {
    try {
      await removeRows(supabase, tableName, ownerId)
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (uploadedPaths.length > 0) {
    for (let start = 0; start < uploadedPaths.length; start += 100) {
      const { error } = await supabase.storage
        .from('product-images')
        .remove(uploadedPaths.slice(start, start + 100))
      if (error) failures.push(`Failed to roll back uploaded media: ${error.message}`)
    }
  }

  const profileFields = omitFields(originalProfile, ['id'])
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileFields)
    .eq('id', ownerId)
  if (profileError) failures.push(`Failed to restore destination profile: ${profileError.message}`)

  return failures
}

async function fetchOwnedRows(
  supabase: SupabaseClient,
  tableName: string,
  ownerId: string
) {
  const rows: Record<string, unknown>[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', ownerId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to export ${tableName}: ${error.message}`)

    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
    offset += PAGE_SIZE
  }
}

async function fetchTransactionItems(
  supabase: SupabaseClient,
  transactionIds: string[]
) {
  const rows: Record<string, unknown>[] = []

  for (let start = 0; start < transactionIds.length; start += 100) {
    const transactionIdBatch = transactionIds.slice(start, start + 100)
    let offset = 0

    while (true) {
      const { data, error } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', transactionIdBatch)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(`Failed to export transaction items: ${error.message}`)

      const page = data ?? []
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  return rows
}

async function listStorageFiles(
  supabase: SupabaseClient,
  folderPath: string,
  collectedFiles: string[] = []
) {
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage
      .from('product-images')
      .list(folderPath, { limit: STORAGE_PAGE_SIZE, offset })

    if (error) throw new Error(`Failed to list store media: ${error.message}`)

    const entries = data ?? []
    for (const entry of entries) {
      const path = `${folderPath}/${entry.name}`
      if (entry.id === null) {
        await listStorageFiles(supabase, path, collectedFiles)
      } else {
        collectedFiles.push(path)
      }
    }

    if (entries.length < STORAGE_PAGE_SIZE) return collectedFiles
    offset += STORAGE_PAGE_SIZE
  }
}

export async function createOwnerBackup(supabase: SupabaseClient) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Your session has expired. Sign in again and retry.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) throw new Error(`Failed to read store profile: ${profileError.message}`)
  if (profile.role !== 'owner') {
    throw new Error('Only the store owner can export a backup.')
  }

  const tableEntries = await Promise.all(
    BACKUP_TABLES.map(async tableName => [
      tableName,
      await fetchOwnedRows(supabase, tableName, user.id),
    ] as const)
  )
  const tables = Object.fromEntries(tableEntries)
  const transactions = tables.transactions
  const transactionIds = transactions
    .map(transaction => transaction.id)
    .filter((id): id is string => typeof id === 'string')
  const transactionItems = await fetchTransactionItems(supabase, transactionIds)
  const storageFiles = await listStorageFiles(supabase, user.id)

  const { default: JSZip } = await import('jszip')
  const archive = new JSZip()
  const exportedAt = new Date().toISOString()

  archive.file('data/profiles.json', JSON.stringify([profile], null, 2))
  archive.file('data/transaction_items.json', JSON.stringify(transactionItems, null, 2))
  for (const [tableName, rows] of tableEntries) {
    archive.file(`data/${tableName}.json`, JSON.stringify(rows, null, 2))
  }

  for (const path of storageFiles) {
    const { data, error } = await supabase.storage.from('product-images').download(path)
    if (error) throw new Error(`Failed to download store media: ${error.message}`)
    archive.file(`storage/product-images/${path}`, data)
  }

  archive.file(
    'README.txt',
    [
      'Shinx Merchant Cashier store backup',
      `Created: ${exportedAt}`,
      `Store profile ID: ${user.id}`,
      '',
      'Data tables are exported as JSON files in the data/ directory.',
      'Files from the product-images storage bucket are in storage/product-images/.',
      'Authentication credentials are not included.',
      'Staff accounts are not included and must be recreated separately.',
      'QR token records are not included; generate new table QR codes after restoring.',
      'Import this archive from Settings into an empty owner account in the destination project.',
    ].join('\n')
  )

  const blob = await archive.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  })
  const timestamp = exportedAt.replace(/[:.]/g, '-')

  return {
    blob,
    filename: `shinx-store-backup-${timestamp}.zip`,
  }
}

export async function importOwnerBackup(
  supabase: SupabaseClient,
  file: File,
  onProgress: (message: string) => void
) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const profileRows = await getBackupRows(zip, 'data/profiles.json')

  if (profileRows.length !== 1 || typeof profileRows[0].id !== 'string' || profileRows[0].role !== 'owner') {
    throw new Error('Backup must contain exactly one owner profile.')
  }

  const sourceOwnerId = profileRows[0].id
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Your session has expired. Sign in again and retry.')

  const { data: destinationProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) throw new Error(`Failed to read destination profile: ${profileError.message}`)
  if (destinationProfile.role !== 'owner') {
    throw new Error('Only the destination store owner can import a backup.')
  }

  onProgress('Memvalidasi data backup...')
  const tableEntries = await Promise.all(
    BACKUP_TABLES.map(async tableName => [
      tableName,
      await getBackupRows(zip, `data/${tableName}.json`),
    ] as const)
  )
  const tables = Object.fromEntries(tableEntries) as Record<(typeof BACKUP_TABLES)[number], BackupRow[]>
  const transactionItems = await getBackupRows(zip, 'data/transaction_items.json')
  const sourceTransactionIds = new Set(
    tables.transactions.map(row => row.id).filter((id): id is string => typeof id === 'string')
  )
  const sourceProductIds = new Set(
    tables.products.map(row => row.id).filter((id): id is string => typeof id === 'string')
  )
  const sourceCategoryIds = new Set(
    tables.categories.map(row => row.id).filter((id): id is string => typeof id === 'string')
  )

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceOwnerId)) {
    throw new Error('Backup contains an invalid owner ID.')
  }

  for (const [tableName, rows] of tableEntries) {
    for (const row of rows) {
      if (row.user_id !== sourceOwnerId) {
        throw new Error(`Backup contains a record that does not belong to its owner in ${tableName}.`)
      }
    }
  }

  for (const item of transactionItems) {
    if (
      typeof item.transaction_id !== 'string' ||
      !sourceTransactionIds.has(item.transaction_id) ||
      (item.product_id !== null && item.product_id !== undefined &&
        (typeof item.product_id !== 'string' || !sourceProductIds.has(item.product_id)))
    ) {
      throw new Error('Backup contains a transaction item with an invalid relation.')
    }
  }

  for (const product of tables.products) {
    for (const categoryField of ['category_id', 'category_id_2']) {
      const categoryId = product[categoryField]
      if (categoryId !== null && categoryId !== undefined &&
        (typeof categoryId !== 'string' || !sourceCategoryIds.has(categoryId))) {
        throw new Error('Backup contains a product with an invalid category relation.')
      }
    }
  }

  onProgress('Memastikan akun tujuan masih kosong...')
  const destinationChecks = await Promise.all(
    [
      ...BACKUP_TABLES.map(tableName =>
        supabase.from(tableName).select('id').limit(1)
      ),
      supabase.from('transaction_items').select('id').limit(1),
      supabase.storage.from('product-images').list(user.id, { limit: 1 }),
    ]
  )

  for (const result of destinationChecks) {
    if (result.error) {
      throw new Error(`Unable to verify that the destination is empty: ${result.error.message}`)
    }
    if (result.data && result.data.length > 0) {
      throw new Error('Import requires a new, empty store account. The destination already contains data or media.')
    }
  }

  const mediaPrefix = `storage/product-images/${sourceOwnerId}/`
  const mediaFiles = Object.values(zip.files).filter(entry =>
    !entry.dir && entry.name.startsWith(mediaPrefix)
  )
  const uploadedPaths: string[] = []
  const mediaUrls = new Map<string, string>()
  let writesStarted = false

  try {
    onProgress('Menyalin file media toko...')
    for (const entry of mediaFiles) {
      const relativePath = entry.name.slice(mediaPrefix.length)
      const parts = relativePath.split('/')
      if (!relativePath || parts.some(part => !part || part === '.' || part === '..')) {
        throw new Error('Backup contains an invalid media file path.')
      }

      const sourcePath = `${sourceOwnerId}/${relativePath}`
      const destinationPath = `${user.id}/${relativePath}`
      const blob = await entry.async('blob')
      writesStarted = true
      const { error } = await supabase.storage
        .from('product-images')
        .upload(destinationPath, blob, { upsert: false })

      if (error) throw new Error(`Failed to import store media: ${error.message}`)
      uploadedPaths.push(destinationPath)
      mediaUrls.set(
        sourcePath,
        supabase.storage.from('product-images').getPublicUrl(destinationPath).data.publicUrl
      )
    }

    const sourceProfile = profileRows[0]
    const profileFields = Object.fromEntries(
      Object.entries(sourceProfile).filter(([field]) => IMPORTABLE_PROFILE_FIELDS.has(field))
    )
    if (!('currency_code' in profileFields) && typeof sourceProfile.currency === 'string') {
      profileFields.currency_code = sourceProfile.currency
    }
    const profilePayload = {
      ...profileFields,
      qris_image_url: remapMediaUrl(sourceProfile.qris_image_url, sourceOwnerId, mediaUrls),
      cashier_sound_url: remapMediaUrl(sourceProfile.cashier_sound_url, sourceOwnerId, mediaUrls),
      customer_sound_url: remapMediaUrl(sourceProfile.customer_sound_url, sourceOwnerId, mediaUrls),
    }

    onProgress('Mengimpor data toko...')
    writesStarted = true
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', user.id)
    if (updateProfileError) {
      throw new Error(`Failed to import store profile: ${updateProfileError.message}`)
    }

    const destinationRows = {
      categories: tables.categories.map(row => ({
        ...pickFields(row, IMPORTABLE_TABLE_FIELDS.categories),
        user_id: user.id,
      })),
      products: tables.products.map(row => ({
        ...pickFields(row, IMPORTABLE_TABLE_FIELDS.products),
        user_id: user.id,
        image_url: remapMediaUrl(row.image_url, sourceOwnerId, mediaUrls),
      })),
      payment_accounts: tables.payment_accounts.map(row => ({
        ...pickFields(row, IMPORTABLE_TABLE_FIELDS.payment_accounts),
        user_id: user.id,
      })),
      notification_logs: tables.notification_logs.map(row => ({
        ...pickFields(row, IMPORTABLE_TABLE_FIELDS.notification_logs),
        user_id: user.id,
      })),
      transactions: tables.transactions.map(row => ({
        ...pickFields(row, IMPORTABLE_TABLE_FIELDS.transactions),
        user_id: user.id,
        created_by: row.created_by === sourceOwnerId ? user.id : null,
      })),
      transaction_items: transactionItems.map(row =>
        pickFields(row, IMPORTABLE_TABLE_FIELDS.transaction_items)
      ),
    }

    await insertRows(supabase, 'categories', destinationRows.categories)
    await insertRows(supabase, 'table_orders', tables.table_orders.map(row => ({
      ...pickFields(row, IMPORTABLE_TABLE_FIELDS.table_orders),
      user_id: user.id,
    })))
    await insertRows(supabase, 'products', destinationRows.products)
    await insertRows(supabase, 'payment_accounts', destinationRows.payment_accounts)
    await insertRows(supabase, 'notification_logs', destinationRows.notification_logs)
    await insertRows(supabase, 'transactions', destinationRows.transactions)
    await insertRows(supabase, 'transaction_items', destinationRows.transaction_items)
    await insertRows(supabase, 'expenses', tables.expenses.map(row => ({
      ...pickFields(row, IMPORTABLE_TABLE_FIELDS.expenses),
      user_id: user.id,
    })))
    await insertRows(supabase, 'hpp_products', tables.hpp_products.map(row => ({
      ...pickFields(row, IMPORTABLE_TABLE_FIELDS.hpp_products),
      user_id: user.id,
    })))

    return {
      recordCount: BACKUP_TABLES.reduce((count, tableName) => count + tables[tableName].length, 0)
        + transactionItems.length,
      mediaCount: mediaFiles.length,
    }
  } catch (error) {
    if (!writesStarted) throw error

    const rollbackErrors = await rollbackImport(
      supabase,
      user.id,
      destinationProfile as BackupRow,
      uploadedPaths
    )
    if (rollbackErrors.length > 0) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} Import rollback was incomplete: ${rollbackErrors.join('; ')}`
      )
    }
    throw error
  }
}
