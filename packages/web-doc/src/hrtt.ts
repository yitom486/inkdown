/** 华人头条（52hrtt.com）资讯正文页：通用选择器会被导航碎片 `.content` 截胡，需站点特化 */

export function isHrttNewsHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === '52hrtt.com' || host.endsWith('.52hrtt.com')
}
