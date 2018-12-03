let arr = [
  { id: 'a', count: 4 },
  { id: 'b', count: 6 },
  { id: 'c', count: 1 },
  { id: 'd', count: 9 },
  { id: 'e', count: 2 },
  { id: 'f', count: 5 },
]

console.log(arr.sort(function (a, b) {
  if (a.count > b.count) return 1
  if (a.count < b.count) return -1
  return 0
}))
