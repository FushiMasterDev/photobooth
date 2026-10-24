export function coverCrop(srcW, srcH, aspect) {
  if (srcW / srcH > aspect) {
    const sw = srcH * aspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }

  const sh = srcW / aspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

export function formatDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).padStart(4, '0');
  return `${day}.${month}.${year}`;
}

export function toggleSelection(selected, index, max) {
  if (selected.includes(index)) {
    return selected.filter(value => value !== index);
  }
  return selected.length < max ? [...selected, index] : [...selected];
}

export function cameraErrorMessage(err, ctx) {
  if (!ctx.secure) {
    return 'Camera chỉ hoạt động trên HTTPS hoặc localhost. Vui lòng mở trang bằng liên kết HTTPS.';
  }
  if (!ctx.hasMediaDevices) {
    return 'Trình duyệt này không hỗ trợ camera. Nếu đang mở trong Zalo hoặc Messenger, hãy mở liên kết bằng Safari hoặc Chrome.';
  }

  switch (err?.name) {
    case 'NotAllowedError':
      return 'Bạn chưa cấp quyền camera. Trên iPhone, hãy bật quyền camera cho Safari trong Cài đặt; trên Android, hãy bật quyền camera trong cài đặt trang web của Chrome, rồi thử lại.';
    case 'NotFoundError':
      return 'Không tìm thấy camera trên thiết bị. Hãy kiểm tra camera rồi thử lại.';
    case 'NotReadableError':
      return 'Không thể mở camera. Camera có thể đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
    default:
      return 'Không thể mở camera. Vui lòng thử lại.';
  }
}
