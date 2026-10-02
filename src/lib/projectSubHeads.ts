// The only Chart of Accounts sub-heads offered when recording a Project
// expense — in the Expenses → Project form and in the Excel bulk-add sheet.
// Everything else in the Chart of Accounts still exists and still shows on
// existing records, reports and the Admin/Trips forms; this just keeps the
// Project entry list short.
export const PROJECT_SUB_HEAD_CODES = [
  '10.1', '10.4', '10.8',
  '20.1', '20.4', '20.6', '20.7',
  '30.1', '30.2', '30.3', '30.4', '30.5', '30.6',
  '40.1', '40.2', '40.4',
] as const

export function isProjectSubHeadCode(code: string): boolean {
  return (PROJECT_SUB_HEAD_CODES as readonly string[]).includes(code)
}
