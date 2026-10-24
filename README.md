# Photobooth

Photobooth kiểu Life4Cuts dành cho điện thoại, dùng HTML/CSS/JavaScript thuần và ES modules. Không cần bước build hay cài gói npm. Ảnh được xử lý ngay trên thiết bị, không tải lên máy chủ.

## Chạy trên máy

Tại thư mục dự án, chạy:

```sh
python3 -m http.server 8000
```

Mở <http://localhost:8000>. Camera chỉ hoạt động qua `localhost` hoặc HTTPS. Khi thử trên điện thoại, dùng liên kết HTTPS; địa chỉ HTTP qua IP mạng nội bộ của máy tính không đủ để cấp quyền camera.

Mỗi lần bấm nút tròn **Chụp** sẽ chụp ngay một kiểu; đủ 8 kiểu thì chọn 4 ảnh yêu thích. **Chụp lại từ đầu** xoá các kiểu đã chụp; chỉ đổi được camera khi chưa có ảnh.

Tham số kiểm thử: `?noclip` tắt `MediaRecorder` để thử luồng chỉ chụp ảnh.

Khi thiết bị hỗ trợ clip, trang giữ các khung hình nhỏ chưa lọc của khoảng 2 giây gần nhất. Bấm chụp sẽ giữ bộ khung hình đó cho kiểu ảnh và bắt đầu bộ đệm mới. **Tạo clip** chỉ hiện khi cả 8 kiểu đều có khung hình; clip phát lại 4 kiểu đã chọn trong khung với bộ lọc hiện tại. Không ghi video trong lúc chụp.

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

Mở `js/filters.js`, sao chép một object trong `FILTERS`, đổi `id` thành giá trị duy nhất và đặt `name` bằng tiếng Việt. `params` chứa các thông số màu và hiệu ứng; có thể bỏ qua thông số dùng giá trị mặc định:

```js
{
  id: 'hong-nhe',
  name: 'Hồng nhẹ',
  params: { exposure: 0.08, temperature: 0.2, tint: 0.15, fade: 0.03 },
}
```

| Thông số | Mặc định | Tác dụng |
| --- | --- | --- |
| `exposure` | `0` | Độ phơi sáng tính theo stop: `1` nhân đôi độ sáng, `-1` giảm một nửa. |
| `contrast` | `0` | Tương phản quanh mức sáng 0.5, với hệ số `1 + contrast`. Giá trị dương tăng tương phản, âm giảm. |
| `saturation` | `1` | Độ bão hoà: `0` là đen trắng, lớn hơn `1` làm màu đậm hơn. |
| `temperature` | `0` | Dương tăng đỏ và giảm xanh dương (ấm), âm cho tông lạnh. |
| `tint` | `0` | Dương giảm kênh xanh lá, tạo sắc hồng/magenta; âm tăng xanh lá. |
| `fade` | `0` | Từ `0` đến `1`, nâng vùng đen và làm bạc màu. |
| `vignette` | `0` | Từ `0` đến `1`, làm tối các góc ảnh và giữ sáng ở giữa. |
| `grain` | `0` | Từ `0` đến `1`, thêm hạt ngẫu nhiên với cùng lượng nhiễu cho R, G, B của mỗi pixel. |

`applyFilter(imageData, filter)` nhận cả object bộ lọc và dữ liệu ảnh có `data`, `width`, `height`. Hàm xử lý theo thứ tự phơi sáng → tương phản → bạc màu → nhiệt độ và tint → bão hoà → tối góc → hạt. Hàm sửa trực tiếp bộ đệm `Uint8ClampedArray`, giới hạn kết quả về 0–255, giữ nguyên alpha, trả lại chính `imageData`, và bỏ qua xử lý pixel khi mọi thông số là mặc định (`params: {}` cho bộ lọc Gốc).

Ba bảng tra màu được lưu theo object bộ lọc; khi thay đổi thông số trong lúc chạy, tạo object bộ lọc mới thay vì sửa object cũ. Trọng số tối góc được lưu theo kích thước ảnh. Xem trước camera, ảnh ghép và clip đều truyền cùng object bộ lọc qua hàm này; hạt được tạo ngẫu nhiên ở mỗi lần vẽ. Chỉ lọc bản dùng để hiển thị hoặc ghép; ảnh chụp gốc và nguồn clip luôn được giữ chưa lọc. Không dùng thuộc tính lọc màu của Canvas 2D vì Safari iOS không hỗ trợ.

## Đổi số kiểu chụp và thiết lập clip

Sửa `js/config.js`: `SHOTS` là số kiểu chụp (mặc định 8), `PICK` là số ảnh chọn (4). `CLIP_MS` (2000 ms) là độ dài tối đa của bộ đệm trước mỗi lần chụp; `CLIP_FPS` (10 hình/giây) là tốc độ lấy và phát lại khung hình clip. Các thiết lập chung khác cũng nằm tại đây: `EXPORT_TYPE` (`image/jpeg`), `EXPORT_QUALITY` (0.92) và `PREVIEW_MAX_W` (480 px).
