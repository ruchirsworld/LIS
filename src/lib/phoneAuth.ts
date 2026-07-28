// Phone+PIN accounts are real Supabase Auth email/password users under the
// hood — the phone number becomes a synthesized internal email so no SMS
// provider is required. Must match the transform in
// supabase/functions/admin-create-user/index.ts exactly.

export function phoneToSyntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@phone.lis.internal`
}

/** True for phone-like input (10+ digits, no @) so the login form can accept either identifier. */
export function looksLikePhone(input: string): boolean {
  return !input.includes('@') && input.replace(/\D/g, '').length >= 10
}
