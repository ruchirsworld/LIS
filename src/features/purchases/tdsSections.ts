// Common TDS the firm deducts on payments to vendors — picking one fills the
// rate, which can still be changed.
export const TDS_SECTIONS: { value: string; section: string; pct: number; label: string }[] = [
  { value: '', section: '', pct: 0, label: 'No TDS' },
  { value: '194C-1', section: '194C', pct: 1, label: '194C Contractor - individual / HUF (1%)' },
  { value: '194C-2', section: '194C', pct: 2, label: '194C Contractor - company / firm (2%)' },
  { value: '194J-2', section: '194J', pct: 2, label: '194J Technical services (2%)' },
  { value: '194J-10', section: '194J', pct: 10, label: '194J Professional fees (10%)' },
  { value: '194I-2', section: '194I', pct: 2, label: '194I Rent - machinery (2%)' },
  { value: '194I-10', section: '194I', pct: 10, label: '194I Rent - land / building (10%)' },
  { value: '194H-5', section: '194H', pct: 5, label: '194H Commission (5%)' },
  { value: '194Q-01', section: '194Q', pct: 0.1, label: '194Q Purchase of goods (0.1%)' },
  { value: 'other', section: 'Other', pct: 0, label: 'Other section' },
]
