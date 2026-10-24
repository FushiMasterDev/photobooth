# Photobooth web kiểu Life4Cuts cho điện thoại — Thiết kế

Ngày: 2026-10-24

## 1. Mục đích

Một trang web để **người quen của chủ dự án** mở link trên điện thoại và chụp ảnh kiểu photobooth Hàn Quốc (Life4Cuts): chụp liền nhiều kiểu, chọn 4 ảnh đẹp nhất, ghép vào khung trang trí rồi lưu hoặc gửi đi. Người chụp có thể là một mình, cặp đôi hoặc nhóm bạn.

Thành công = mở link là chụp được ngay, dải ảnh đủ đẹp để đăng story, và chủ dự án dễ dàng thêm hoặc sửa khung và filter sau này.

## 2. Mục tiêu

- Trải nghiệm giống tiệm Life4Cuts: chọn khung → chụp có đếm ngược → chọn 4/8 ảnh → chọn filter → nhận ảnh.
- Chạy tốt trên **Safari iOS và Chrome Android** (2 năm gần đây).
- **Dễ tái sử dụng và sửa:** khung và filter là dữ liệu khai báo. Thêm khung mới = thêm 1 mục cấu hình (kèm ảnh PNG nếu cần), không phải sửa logic.
- Giao diện tiếng Việt.

## 3. Không làm (non-goals)

- Không tài khoản, không đăng nhập, không thanh toán.
- Không máy chủ, không lưu ảnh lên cloud, không thư viện ảnh chung.
- Không in ảnh, không sticker kéo thả, không làm đẹp da hay AI.
- Không cần tối ưu cho máy tính (vẫn chạy được thì tốt, nhưng không ưu tiên).

## 4. Điều tuyệt đối không được xảy ra (anti-goals)

- Ảnh rời khỏi điện thoại người chụp (gửi lên bất kỳ server nào).
- Ảnh xuất ra khác hẳn những gì người chụp thấy lúc xem trước (sai tỉ lệ, bị cắt mất đầu, filter khác màu).
- Trên iPhone không chạy được: đây là nhóm người dùng chính.
- Phải cài app hay chờ tải lâu mới chụp được.

## 5. Ràng buộc kỹ thuật

- **HTML/CSS/JavaScript thuần, ES modules, không bước build, không framework, không npm dependency khi chạy.** Mở `index.html` qua bất kỳ static server nào là chạy.
- Camera dùng `navigator.mediaDevices.getUserMedia`, chỉ chạy trên **HTTPS** hoặc `localhost`.
- **Safari iOS không hỗ trợ `CanvasRenderingContext2D.filter`.** Filter khi xuất ảnh phải xử lý bằng pixel (`getImageData`/`putImageData`) hoặc cách tương đương chạy được trên Safari. Cấm dùng `ctx.filter`.
- Video trên iOS cần `playsinline` và `muted` để không bật toàn màn hình.
- Host tĩnh: GitHub Pages hoặc Vercel (đều có HTTPS sẵn).

## 6. Luồng sử dụng (đã chốt với chủ dự án)

1. **Màn hình chào:** tên trang và nút "Bắt đầu".
2. **Chọn khung:** 2 bố cục là dải dọc 4 ảnh (1x4) và lưới 2x2. Mỗi bố cục có vài mẫu màu hoặc trang trí. Xem trước bằng hình thu nhỏ.
3. **Chụp:**
   - Camera trước, xem trước **lật như gương**.
   - Khung xem trước được **cắt đúng tỉ lệ ô ảnh** của khung đã chọn (WYSIWYG).
   - Chụp **8 kiểu**, mỗi kiểu đếm ngược (mặc định 5 giây), hiện số đếm lớn và "3/8".
   - Chọn filter trước khi chụp và **thấy filter ngay trên màn hình xem trước** (chủ dự án hỏi thêm filter; xem mục 8).
   - Bấm "Bắt đầu chụp" một lần, sau đó tự chụp liên tục đủ 8 kiểu như ở tiệm. Có nút dừng để huỷ.
   - Ảnh lưu ở dạng **gốc, chưa áp filter**; filter chỉ áp lúc ghép, nên đổi filter sau đó không bị mất chất lượng.
4. **Chọn ảnh:** lưới 8 ảnh vừa chụp, chạm để chọn đúng 4 ảnh. Thứ tự chạm = thứ tự trong khung, mỗi ảnh hiện số thứ tự; chạm lại để bỏ chọn. Nút tiếp tục chỉ bật khi đã chọn đủ 4.
5. **Chọn filter:** đổi filter lần cuối, xem trước trên dải ảnh hoàn chỉnh. Các filter: Gốc, Đen trắng, Tông ấm, Sáng da (danh sách nằm trong cấu hình).
6. **Nhận ảnh:**
   - Nút **Chia sẻ** dùng `navigator.share({ files })` để gửi thẳng sang Instagram hoặc Zalo. Nếu máy không hỗ trợ thì ẩn nút này.
   - Nút **Lưu ảnh** tải file PNG/JPEG về máy.
   - Clip "behind": video ngắn ghép các khoảnh khắc lúc chụp (xem mục 7).
   - Nút "Chụp lại" quay về bước 2.

## 7. Clip "behind" (tính năng cuối, làm sau cùng)

Giống video Life4Cuts tặng kèm: khung đã chọn, nhưng mỗi ô là **đoạn video ngắn (khoảng 2 giây) quay ngay trước khi chụp** kiểu đó.

- Lúc chụp: dùng `MediaRecorder` ghi khoảng 2 giây cuối của mỗi lần đếm ngược thành 1 đoạn riêng.
- Lúc xuất: phát 4 đoạn của 4 ảnh đã chọn cùng lúc, vẽ vào canvas khung theo từng frame, rồi ghi canvas bằng `canvas.captureStream()` + `MediaRecorder` → 1 file video.
- Clip áp cùng filter với ảnh. Được phép xuất clip ở độ phân giải thấp hơn ảnh (ví dụ một nửa) để điện thoại xử lý kịp.
- Định dạng theo trình duyệt: Safari ra `video/mp4`, Chrome ra `video/webm` hoặc mp4 nếu hỗ trợ. Chọn bằng `MediaRecorder.isTypeSupported`.
- **Nếu máy không hỗ trợ `MediaRecorder` thì ẩn tính năng, không để hỏng luồng chính.**
- Phần này phải tách riêng (1 module) để các bước 1 đến 6 chạy hoàn chỉnh dù chưa có nó.

## 8. Cấu trúc để tái sử dụng và sửa

### Khung (`frames`)
Mỗi khung là 1 object khai báo, ví dụ:

```js
{
  id: 'strip-pink',
  name: 'Dải hồng',
  layout: 'strip',            // 'strip' (1x4) | 'grid' (2x2)
  width: 600, height: 1800,   // kích thước ảnh xuất (px)
  background: '#ffd6e0',      // màu nền, hoặc
  backgroundImage: null,      // đường dẫn PNG nền (tùy chọn)
  overlayImage: null,         // PNG trong suốt phủ lên trên ảnh (tùy chọn)
  slots: [ { x, y, w, h }, ... ],   // 4 ô ảnh, toạ độ px trên ảnh xuất
  caption: { text: '{date}', x, y, font, color }  // chữ ở chân khung (tùy chọn)
}
```

- Tỉ lệ ô ảnh lấy từ `slots[0]` (4 ô cùng tỉ lệ). Camera xem trước và ảnh chụp cắt theo tỉ lệ này.
- Kích thước gợi ý: dải 1x4 600×1800 (2×6 inch @300dpi), lưới 2x2 1200×1800 (4×6 inch).
- Khởi đầu có khoảng 3 khung dải và 3 khung lưới, chỉ dùng màu nền và chữ. Ảnh PNG trang trí là tùy chọn, chủ dự án tự thêm sau.

### Filter (`filters`)
Mỗi filter là 1 object khai báo có **một nguồn sự thật duy nhất** cho cả xem trước lẫn xuất ảnh, để hai bên không lệch màu. Gợi ý: ma trận màu 4×5 (kiểu `feColorMatrix`) cộng các thông số đơn giản, kèm 1 hàm thuần áp ma trận lên `ImageData`. Cách hiện filter trên camera trực tiếp (CSS `filter`, SVG `feColorMatrix`, hoặc vẽ video lên canvas) để người làm chọn, miễn là **màu xem trước khớp màu xuất ảnh trên cả iOS lẫn Android** (anti-goal mục 4).

### Thông số chung (`config`)
Số kiểu chụp (8), số ảnh chọn (4), giây đếm ngược (5), độ dài clip (2s), định dạng xuất (JPEG chất lượng 0.92), tất cả nằm ở 1 chỗ.

### Gợi ý chia module
`frames.js` (dữ liệu khung), `filters.js` (dữ liệu và hàm filter), `camera.js` (mở/đóng camera, chụp khung hình đã cắt), `compose.js` (ghép ảnh vào khung → canvas), `behind.js` (clip), `share.js` (chia sẻ/lưu), `app.js` (các màn hình và trạng thái). Đây là gợi ý, người làm được phép gộp hay tách khác nếu hợp lý hơn.

## 9. Lỗi và quyền

- Người dùng từ chối quyền camera: hiện hướng dẫn bật lại quyền (khác nhau giữa iOS và Android) và nút thử lại.
- Không có camera, hoặc trang không chạy trên HTTPS: báo rõ bằng tiếng Việt.
- Khi rời màn hình chụp hoặc chụp xong: tắt camera (`track.stop()`).
- Mở trong trình duyệt nhúng của Zalo hay Messenger mà không có camera: gợi ý "Mở bằng Safari/Chrome".

## 10. Kiểm thử

- Logic thuần (tính vùng cắt theo tỉ lệ, toạ độ ô, hàm filter trên `ImageData`) có test nhỏ chạy bằng `node --test`, không cần cài gì.
- Thử bằng tay trên trình duyệt máy tính qua `localhost`, sau đó **chủ dự án thử trên iPhone và Android thật** qua link HTTPS.

## 11. Các quyết định do Claude tự chọn (chủ dự án cần xem lại)

- Công nghệ: HTML/JS thuần, không framework, host tĩnh.
- 8 kiểu chụp, chọn 4, đếm ngược 5 giây (Life4Cuts thật dùng khoảng 10 giây; chỉ cần đổi 1 số trong cấu hình).
- **Ảnh xuất ra cũng lật như gương**, giống hệt lúc xem trước.
- Có **nút đổi camera trước/sau**, vì chụp nhóm thường nhờ người khác cầm máy bằng camera sau. Camera sau thì không lật.
- Filter chọn trước khi chụp (thấy trực tiếp) và đổi lại được sau khi chụp.
- Clip "behind" làm sau cùng, máy không hỗ trợ thì ẩn đi.
- Không có nút chụp lại từng kiểu: chụp dư 8 kiểu đã thay cho việc đó.
- Chụp tự động liên tục 8 kiểu sau một lần bấm; chữ `{date}` hiện theo dạng `dd.MM.yyyy`.

## 12. Để người làm tự quyết

- Thiết kế giao diện cụ thể (màu, font, bố cục nút), miễn dễ bấm bằng một tay và hợp phong cách photobooth Hàn Quốc dễ thương.
- Mẫu màu và chữ cụ thể của các khung khởi đầu.
- Cách hiện filter trên camera trực tiếp (theo ràng buộc ở mục 8).
- Cách cắt và ghép đoạn video cho clip "behind".
