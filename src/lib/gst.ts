// GSTIN / PAN helpers. A GSTIN is 15 characters: 2-digit state code, the
// holder's 10-character PAN, an entity number, "Z", and a check character.

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
}

export function cleanGstin(v: string | null | undefined): string {
  return String(v ?? '').replace(/\s+/g, '').toUpperCase()
}

export function isValidGstin(v: string | null | undefined): boolean {
  return GSTIN_PATTERN.test(cleanGstin(v))
}

export function isValidPan(v: string | null | undefined): boolean {
  return PAN_PATTERN.test(String(v ?? '').trim().toUpperCase())
}

/** The PAN inside a GSTIN (characters 3–12), or '' if it is not a GSTIN. */
export function panOfGstin(v: string | null | undefined): string {
  const g = cleanGstin(v)
  return GSTIN_PATTERN.test(g) ? g.slice(2, 12) : ''
}

/** The 2-digit state code at the front of a GSTIN, or '' when there is none. */
export function stateCodeOfGstin(v: string | null | undefined): string {
  const g = cleanGstin(v)
  return /^\d{2}/.test(g) ? g.slice(0, 2) : ''
}

export function stateNameOfCode(code: string | null | undefined): string {
  return code ? GST_STATES[code] ?? '' : ''
}

/** "27 — Maharashtra" for a GSTIN or state code, '' if unknown. */
export function stateLabelOfGstin(v: string | null | undefined): string {
  const code = stateCodeOfGstin(v)
  const name = stateNameOfCode(code)
  return name ? `${code} — ${name}` : ''
}

/** Indian financial year (April–March) a date falls in, e.g. "2025-26". */
export function financialYearOf(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  return `${start}-${String(start + 1).slice(2)}`
}
