export const normalizeArray = (arr: Float32Array): Float32Array => {
  const arrLen = arr.length;
  let min = arr[0],
    max = arr[0];
  for (let i = 1; i < arrLen; i++) {
    min = arr[i] < min ? arr[i] : min;
    max = arr[i] > max ? arr[i] : max;
  }
  const scale = 1 / (max - min);
  const normalizedArray = new Float32Array(arrLen);
  for (let i = 0; i < arrLen; i++) {
    normalizedArray[i] = (arr[i] - min) * scale;
  }

  return normalizedArray;
};
