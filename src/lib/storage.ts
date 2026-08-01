import { supabase } from './supabase'

/** Uploads a compressed image to the private 'receipts' bucket and returns its storage path. */
export async function uploadReceipt(blob: Blob, folder = 'expenses'): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Uploads a vendor bill receipt to Google Drive (via the upload-vendor-receipt
 * Edge Function) instead of Supabase Storage, and returns a receipt_path
 * value tagged with the "drive:" prefix so getReceiptUrl knows how to open it. */
export async function uploadReceiptToDrive(blob: Blob, fileName: string): Promise<string> {
  const base64Data = await blobToBase64(blob)
  const { data, error } = await supabase.functions.invoke('upload-vendor-receipt', {
    body: { fileName, mimeType: blob.type || 'image/jpeg', data: base64Data },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return `drive:${data.id}`
}

/** Bucket is private, so viewing a receipt needs a short-lived signed URL rather than a public link.
 * Drive-hosted receipts (receipt_path starting with "drive:") link straight to Drive instead. */
export async function getReceiptUrl(path: string): Promise<string | null> {
  if (path.startsWith('drive:')) {
    return `https://drive.google.com/file/d/${path.slice('drive:'.length)}/view`
  }
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300)
  if (error) return null
  return data.signedUrl
}
