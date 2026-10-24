const IDENTITY = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

export const FILTERS = [
  { id: 'original', name: 'Gốc', matrix: [...IDENTITY] },
  {
    id: 'bw', name: 'Đen trắng',
    matrix: [
      0.299, 0.587, 0.114, 0, 0,
      0.299, 0.587, 0.114, 0, 0,
      0.299, 0.587, 0.114, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'warm', name: 'Tông ấm',
    matrix: [
      1.08, 0, 0, 0, 8,
      0, 1.0, 0, 0, 2,
      0, 0, 0.88, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: 'bright', name: 'Sáng da',
    matrix: [
      1.05, 0, 0, 0, 18,
      0, 1.02, 0, 0, 16,
      0, 0, 1.0, 0, 20,
      0, 0, 0, 1, 0,
    ],
  },
];

export function applyMatrix(imageData, matrix) {
  if (matrix.every((value, index) => value === IDENTITY[index])) {
    return imageData;
  }

  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // Giữ các kênh gốc để mỗi hàng dùng cùng một pixel đầu vào.
    // Uint8ClampedArray tự giới hạn và làm tròn kết quả về 0–255.
    data[i] = matrix[0] * r + matrix[1] * g + matrix[2] * b + matrix[3] * a + matrix[4];
    data[i + 1] = matrix[5] * r + matrix[6] * g + matrix[7] * b + matrix[8] * a + matrix[9];
    data[i + 2] = matrix[10] * r + matrix[11] * g + matrix[12] * b + matrix[13] * a + matrix[14];
    data[i + 3] = matrix[15] * r + matrix[16] * g + matrix[17] * b + matrix[18] * a + matrix[19];
  }
  return imageData;
}
