# Photobooth

Photobooth kiểu Life4Cuts dành cho điện thoại, dùng HTML/CSS/JavaScript thuần và ES modules. Không cần bước build hay cài gói npm. Ảnh được xử lý ngay trên thiết bị, không tải lên máy chủ.

Hiện đã có các hàm tiện ích, dữ liệu khung và bộ lọc; giao diện chụp ảnh sẽ được bổ sung ở các bước tiếp theo. Hướng dẫn mở trang và triển khai bên dưới áp dụng khi có `index.html`.

## Chạy trên máy

Tại thư mục dự án, chạy:

```sh
python3 -m http.server 8000
```

Mở <http://localhost:8000>. Camera chỉ hoạt động qua `localhost` hoặc HTTPS. Khi thử trên điện thoại, dùng liên kết HTTPS; địa chỉ HTTP qua IP mạng nội bộ của máy tính không đủ để cấp quyền camera.

Chạy kiểm thử với Node.js 22:

```sh
npm test
```

## Triển khai

- **GitHub Pages:** đưa mã nguồn lên kho GitHub, mở **Settings → Pages**, chọn **Deploy from a branch**, chọn nhánh chứa mã nguồn và thư mục **/ (root)**, rồi lưu. Mở liên kết HTTPS được cung cấp.
- **Vercel:** nhập kho GitHub vào một dự án mới, chọn cấu hình **Other**, để trống lệnh build và đặt thư mục đầu ra là `.` (gốc dự án), rồi triển khai. Mở liên kết HTTPS được cung cấp.

Giữ nguyên cấu trúc thư mục khi triển khai. Không cần máy chủ ứng dụng hay dịch vụ lưu ảnh.

## Thêm khung

Mở `js/frames.js` và thêm một dòng vào `FRAMES`. Cách nhanh nhất là dùng lại bố cục có sẵn:

```js
{ ...STRIP, id: 'strip-mint', name: 'Dải bạc hà', background: '#d8f5e6' },
{ ...GRID, id: 'grid-hoa', name: 'Lưới hoa', background: '#ffffff', overlayImage: 'assets/frames/hoa.png' },
```

Sửa toạ độ ô trong `STRIP` hoặc `GRID` sẽ đổi bố cục của mọi khung dùng nó. Muốn khung có bố cục riêng thì viết đầy đủ các trường:


1. Đổi `id` thành giá trị duy nhất và đặt `name` bằng tiếng Việt.
2. Chọn `layout: 'strip'` (dải 1×4) hoặc `'grid'` (lưới 2×2), rồi đặt `width`, `height`, `background`.
3. Khai báo đúng 4 ô trong `slots`, theo thứ tự ảnh xuất hiện. Mọi `x`, `y`, `w`, `h` đều tính bằng pixel trên ảnh xuất; gốc tọa độ ở góc trên trái. Các ô phải nằm trong khung, có kích thước dương và cùng tỉ lệ `w / h`. `slotAspect(frame)` lấy tỉ lệ từ ô đầu tiên để dùng cho camera.
4. Giữ `backgroundImage` và `overlayImage` là `null` nếu không dùng ảnh trang trí. Nếu cần, tạo thư mục `assets/frames/`, thêm PNG và đặt đường dẫn tương đối như `'assets/frames/hoa.png'`. Ảnh nền nằm sau ảnh chụp; ảnh phủ nằm trên ảnh chụp và cần trong suốt ở các ô ảnh. Dùng PNG cùng kích thước với khung và lưu ngay trong dự án.
5. Đặt `caption` hoặc `null` nếu không muốn chữ. Chú thích có `text`, `x`, `y`, `font`, `color`, `align: 'center'`. Giữ chuỗi `{date}` trong `text`; khi ghép ảnh, chuỗi này sẽ được thay bằng `formatDate(new Date())`, theo dạng `dd.MM.yyyy`.

Các khung có sẵn dùng dải 600×1800 hoặc lưới 1200×1800. Chỉ cần thêm object dữ liệu, không phải sửa logic để thêm một mẫu khung.

## Thêm bộ lọc

Mở `js/filters.js`, sao chép một object trong `FILTERS`, đổi `id` thành giá trị duy nhất và đặt `name` bằng tiếng Việt. `matrix` chứa đúng 20 số, chia thành 4 hàng × 5 cột theo thứ tự hàng:

```js
{
  id: 'hong-nhe',
  name: 'Hồng nhẹ',
  matrix: [
    1, 0, 0, 0, 10,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 5,
    0, 0, 0, 1, 0,
  ],
}
```

Mỗi hàng tạo một kênh đầu ra, lần lượt là đỏ, xanh lá, xanh dương và alpha (độ đục). Bốn cột đầu là hệ số nhân với các kênh R, G, B, A gốc; cột cuối là lượng cộng trực tiếp theo đơn vị **0–255**, không phải 0–1. Ví dụ hàng đầu tính `R_mới = m0*R + m1*G + m2*B + m3*A + m4`. Giữ hàng alpha là `[0, 0, 0, 1, 0]` để bảo toàn độ đục.

`applyMatrix(imageData, matrix)` sửa trực tiếp bộ đệm `Uint8ClampedArray`, tự giới hạn giá trị về 0–255, trả lại chính `imageData`, và bỏ qua xử lý pixel nếu ma trận là đồng nhất (bộ lọc Gốc). Dùng cùng ma trận cho xem trước và xuất ảnh, chỉ lọc trên bản dùng để hiển thị hoặc ghép; ảnh chụp gốc phải luôn được giữ chưa lọc. Không dùng thuộc tính lọc màu của Canvas 2D vì Safari iOS không hỗ trợ.

## Đổi số kiểu chụp và thời gian đếm ngược

Sửa `js/config.js`: `SHOTS` là số kiểu chụp (mặc định 8), `COUNTDOWN_SEC` là số giây đếm ngược mỗi kiểu (mặc định 5). Các thiết lập chung khác cũng nằm tại đây: `PICK` (4 ảnh chọn), `CLIP_MS` (2000 ms), `EXPORT_TYPE` (`image/jpeg`), `EXPORT_QUALITY` (0.92) và `PREVIEW_MAX_W` (480 px).
