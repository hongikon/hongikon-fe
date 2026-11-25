/**
 * 제보 사진에서 촬영 위치(GPS) 등 메타데이터를 지운다. JPEG 는 GPS·XMP, PNG 는 eXIf·텍스트 청크(아래 `stripPngMetadata`).
 *
 * Android 의 `expo-image-picker` 는 사진을 다시 압축할 때 원본 EXIF(위치 포함)를 그대로
 * 옮겨 붙인다. 앨범 사진에는 집·기숙사 같은 촬영 위치가 들어 있을 수 있어, 서버로
 * 보내기 전에 GPS 정보만 0 으로 지운다. 회전 방향(Orientation) 등 나머지 EXIF 는 남겨야
 * 사진이 돌아가지 않는다. XMP(위치가 들어갈 수 있는 또 다른 메타데이터) 구간은 통째로 뺀다.
 *
 * 네이티브 모듈 없이 바이트만 다룬다. 형식을 해석하지 못하면 원본을 그대로 돌려준다.
 */

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }
const GPS_IFD_TAG = 0x8825
const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0'

function startsWithAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/** EXIF(TIFF) 블록 안의 GPS IFD 를 비운다. `tiffStart` 는 "II"/"MM" 위치, `end` 는 APP1 끝. */
function wipeGpsInExif(bytes: Uint8Array, tiffStart: number, end: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const little = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49
  const big = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d
  if (!little && !big) return
  const u16 = (at: number) => view.getUint16(at, little)
  const u32 = (at: number) => view.getUint32(at, little)
  const inRange = (at: number, length: number) => at >= tiffStart && at + length <= end

  const ifd0 = tiffStart + u32(tiffStart + 4)
  if (!inRange(ifd0, 2)) return
  const ifd0Count = u16(ifd0)
  let gpsIfd = -1
  for (let i = 0; i < ifd0Count; i++) {
    const entry = ifd0 + 2 + i * 12
    if (!inRange(entry, 12)) return
    if (u16(entry) === GPS_IFD_TAG) gpsIfd = tiffStart + u32(entry + 8)
  }
  if (gpsIfd < 0 || !inRange(gpsIfd, 2)) return

  const gpsCount = u16(gpsIfd)
  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsIfd + 2 + i * 12
    if (!inRange(entry, 12)) break
    const size = (TYPE_SIZES[u16(entry + 2)] ?? 1) * u32(entry + 4)
    if (size > 4) {
      const valueAt = tiffStart + u32(entry + 8)
      if (inRange(valueAt, size)) bytes.fill(0, valueAt, valueAt + size)
    }
    bytes.fill(0, entry, entry + 12)
  }
  // 항목 수를 0 으로 — 읽는 쪽에는 빈 GPS 정보로 보인다.
  view.setUint16(gpsIfd, 0, little)
}

/** JPEG 이면 GPS 를 지운 새 바이트 배열을, 아니면(또는 해석 실패 시) 원본을 돌려준다. */
export function stripJpegLocation(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input
  try {
    const bytes = new Uint8Array(input) // 원본은 건드리지 않는다
    const keep: Array<[number, number]> = [[0, 2]]
    let sawImageData = false
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return input
      const marker = bytes[offset + 1]
      // SOS(이미지 데이터 시작) 부터는 끝까지 그대로 둔다.
      if (marker === 0xda) {
        keep.push([offset, bytes.length])
        sawImageData = true
        break
      }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
      const segmentEnd = offset + 2 + length
      if (length < 2 || segmentEnd > bytes.length) return input
      let drop = false
      if (marker === 0xe1) {
        const payload = offset + 4
        if (startsWithAscii(bytes, payload, 'Exif\0\0')) {
          wipeGpsInExif(bytes, payload + 6, segmentEnd)
        } else if (startsWithAscii(bytes, payload, XMP_HEADER)) {
          drop = true
        }
      }
      if (!drop) keep.push([offset, segmentEnd])
      offset = segmentEnd
    }
    if (!sawImageData) return input
    const total = keep.reduce((sum, [from, to]) => sum + (to - from), 0)
    const output = new Uint8Array(total)
    let cursor = 0
    for (const [from, to] of keep) {
      output.set(bytes.subarray(from, to), cursor)
      cursor += to - from
    }
    return output
  } catch {
    return input
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** 위치·촬영 정보가 들어갈 수 있는 PNG 메타데이터 청크. 그림을 그리는 데는 필요 없다. */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt'])

/**
 * PNG 에서 EXIF(eXIf)·텍스트(tEXt/iTXt/zTXt) 청크를 뺀다. 나머지 청크는 바이트 그대로
 * 옮기므로 CRC 를 다시 계산할 필요가 없다. PNG 가 아니거나 해석하지 못하면 원본을 돌려준다.
 */
export function stripPngMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 8 || PNG_SIGNATURE.some((b, i) => input[i] !== b)) return input
  try {
    const keep: Array<[number, number]> = [[0, 8]]
    let offset = 8
    let sawEnd = false
    while (offset + 12 <= input.length) {
      const length = ((input[offset] << 24) | (input[offset + 1] << 16) | (input[offset + 2] << 8) | input[offset + 3]) >>> 0
      const type = String.fromCharCode(input[offset + 4], input[offset + 5], input[offset + 6], input[offset + 7])
      const chunkEnd = offset + 12 + length // 길이(4) + 타입(4) + 데이터 + CRC(4)
      if (chunkEnd > input.length) return input
      if (!PNG_METADATA_CHUNKS.has(type)) keep.push([offset, chunkEnd])
      offset = chunkEnd
      if (type === 'IEND') {
        sawEnd = true
        break
      }
    }
    if (!sawEnd) return input
    const total = keep.reduce((sum, [from, to]) => sum + (to - from), 0)
    const output = new Uint8Array(total)
    let cursor = 0
    for (const [from, to] of keep) {
      output.set(input.subarray(from, to), cursor)
      cursor += to - from
    }
    return output
  } catch {
    return input
  }
}
