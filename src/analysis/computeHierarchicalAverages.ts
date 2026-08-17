import { normalizeArray } from "./normalizeArray";

export interface TreeNode {
  avg: number;
  depth: number;
  size: number;
  start: number;
  end: number;
  children?: TreeNode[];
}

export const computeHierarchicalAverages = (samples: Float32Array<ArrayBuffer>): TreeNode => {
  const arr = normalizeArray(samples)

  const n = arr.length;
  const cs = new Float32Array(n + 1);
  cs[0] = 0;
  for (let i = 0; i < n; i++) {
    cs[i + 1] = cs[i] + arr[i];
  }

  const rec = (
    start: number,
    end: number,
    depth: number = 0
  ): TreeNode => {
    const len = end - start;
    const avg = (cs[end] - cs[start]) / len;
    const node: TreeNode = { avg, depth, size: len, start, end };
    if (len > 1) {
      const mid = start + (len >> 1);
      node.children = [
        rec(start, mid, depth + 1),
        rec(mid, end, depth + 1),
      ];
    }
    return node;
  };
  return rec(0, n);
};
