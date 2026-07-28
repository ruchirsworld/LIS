import { supabase } from './supabase'

/** Uploads a compressed image to the private 'receipts' bucket and returns its storage path. */
export async function uploadReceipt(blob: Blob, folder = 'expenses'): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

/** Bucket is private, so viewing a receipt needs a short-lived signed URL rather than a public link. */
export async function getReceiptUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300)
  if (error) return null
  return data.signedUrl
}
