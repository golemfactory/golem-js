export default function range(
  start: number,
  end: number,
  step: number = 1
): number[] {
  let list: number[] = [];
  for (let index = start; index < end; index += step) list.push(index);
  return list;
}
