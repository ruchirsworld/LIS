// Amount in words, Indian style (lakh / crore), as a tax invoice requires:
// 1,16,000.50 -> "Rupees One Lakh Sixteen Thousand and Paise Fifty Only".

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? ONES[h] + ' Hundred' : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}

function wholeNumberInWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  return [
    crore ? wholeNumberInWords(crore) + ' Crore' : '',
    lakh ? belowHundred(lakh) + ' Lakh' : '',
    thousand ? belowHundred(thousand) + ' Thousand' : '',
    rest ? belowThousand(rest) : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function amountInWords(amount: number): string {
  const abs = Math.abs(Math.round(amount * 100))
  const rupees = Math.floor(abs / 100)
  const paise = abs % 100
  const sign = amount < 0 ? 'Minus ' : ''
  return (
    sign +
    'Rupees ' +
    wholeNumberInWords(rupees) +
    (paise ? ' and Paise ' + belowHundred(paise) : '') +
    ' Only'
  )
}
