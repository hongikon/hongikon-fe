export const clockText = (at: number) => {
  const d = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')
  const today = new Date()
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  return `${sameDay ? '' : `${d.getMonth() + 1}/${d.getDate()} `}${two(d.getHours())}:${two(d.getMinutes())}`
}

/** Always with the date, for lists that span days. */
export const dateTimeText = (at: number) => {
  const d = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`
}
