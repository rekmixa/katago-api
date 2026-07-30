import { randomBytes, createHash } from 'crypto'

export function generateToken(size: number): string {
  return randomBytes(size).toString('hex')
}

export function md5(string: string): string {
  return createHash('md5')
    .update(string)
    .digest('hex')
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function bytesToSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  if (bytes === 0) {
    return '0 Byte'
  }

  const size = Math.floor(Math.floor(Math.log(bytes) / Math.log(1024)))

  return Math.round(bytes / Math.pow(1024, size)) + ' ' + sizes[size]
}

export function showUptime(): string {
  function format(time: number) {
    function pad(s: number): string {
      return (s < 10 ? '0' : '') + s
    }

    const hours = Math.floor(time / (60 * 60))
    const minutes = Math.floor((time % (60 * 60)) / 60)
    const seconds = Math.floor(time % 60)

    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds)
  }

  return format(process.uptime())
}

export function filePutContents(filename: string, content: string): void {
  require('fs').writeFile(filename, content, function(err: Error) {
    if (err) throw err
    console.log("It's saved!")
  })
}

export function convertTimeZone(date: Date | string, timeZone: string): Date {
  return new Date(
    (typeof date === 'string' ? new Date(date) : date).toLocaleString('en-US', {
      timeZone,
    }),
  )
}

export function replaceAll(string: string, search: string, replace: string) {
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  return string.replace(new RegExp(escapeRegExp(search), 'g'), replace)
}

export function arrayUnique<T>(array: T[]): T[] {
  return array.reduce((carry: T[], value: T): T[] => {
    if (carry.indexOf(value) === -1) {
      carry.push(value)
    }

    return carry
  }, [])
}
