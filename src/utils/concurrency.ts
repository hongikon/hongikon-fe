/** 작업을 최대 `limit` 개씩 동시에 돌린다. 결과 순서는 입력 순서와 같다(Promise.allSettled 와 같은 모양). */
export async function settleWithConcurrency<T, R>(
  inputs: readonly T[],
  limit: number,
  run: (input: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(inputs.length)
  let next = 0
  const worker = async () => {
    while (next < inputs.length) {
      const index = next++
      try {
        results[index] = { status: 'fulfilled', value: await run(inputs[index]) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker))
  return results
}
