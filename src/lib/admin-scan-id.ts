const ADMIN_SCAN_ID = /^[0-9a-f]{8,128}$/i

export function isAdminScanId(value: string): boolean {
  return ADMIN_SCAN_ID.test(value)
}
