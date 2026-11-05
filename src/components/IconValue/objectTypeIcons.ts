/** Default semantic glyphs. Instance images, device categories and action/status icons stay separate. */
export const objectTypeIcons: Readonly<Record<string, string>> = Object.freeze({
  device: 'HddOutlined',
  product: 'CodeSandboxOutlined',
  deviceGroup: 'GroupOutlined',
  space: 'EnvironmentOutlined',
  area: 'GlobalOutlined',
  user: 'UserOutlined',
  org: 'ApartmentOutlined',
  position: 'IdcardOutlined',
  role: 'SafetyCertificateOutlined',
  alarmOccurrence: 'AlertOutlined',
  notificationAttempt: 'SendOutlined'
})

/** Resolve by authoritative type ID; unknown types keep one neutral glyph in every consumer. */
export function getObjectTypeIcon(typeId?: string): string {
  return typeId && Object.hasOwn(objectTypeIcons, typeId) ? objectTypeIcons[typeId] : 'AppstoreOutlined'
}
