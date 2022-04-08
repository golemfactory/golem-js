export default function range(start: number, end: number, step = 1): number[] {
  const list: number[] = [];
  for (let index = start; index < end; index += step) list.push(index);
  return list;
}
