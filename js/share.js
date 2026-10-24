export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Không tạo được tệp ảnh. Vui lòng thử lại.'));
    }, type, quality);
  });
}

export async function shareOrNull(file) {
  try {
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) return null;
  } catch {
    return null;
  }
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (error) {
    if (error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give Safari time to start reading the download before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
