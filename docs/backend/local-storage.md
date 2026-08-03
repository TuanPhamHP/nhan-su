# Local File Storage

Service quản lý file lưu **trực tiếp trên disk server**, trả về URL **vĩnh viễn** (không presigned).

Song song và **không thay thế** S3 storage — hai loại storage phục vụ mục đích khác nhau. Bảng chọn khi thêm feature mới:

| Tiêu chí                                | Dùng S3 (`FileUploadService`)   | Dùng Local (`LocalStorageService`) |
| --------------------------------------- | ------------------------------- | ---------------------------------- |
| Dữ liệu nhạy cảm (ảnh chấm công, hợp đồng, BHXH…) | ✅                        | ❌                                  |
| Nhúng vào HTML (ảnh/video trong body, editor content) | ❌ (URL có TTL, embed die) | ✅ (URL vĩnh viễn)                |
| Attachment/download tài liệu private     | ✅                              | ❌                                  |
| Asset public (banner, logo, media inline) | ⚠ (cần signed URL mỗi lần)     | ✅                                  |
| Bandwidth lớn, scale ngang               | ✅                              | ❌ (đơn instance, disk giới hạn)    |

---

## Kiến trúc

```
src/common/
├── services/
│   ├── file-upload.service.ts       ← S3 (private, presigned)
│   ├── s3-storage.provider.ts
│   └── local-storage.service.ts     ← Local disk (public, vĩnh viễn) ← NEW
└── common.module.ts                 ← @Global(), export cả hai
```

`LocalStorageService` là **@Global** — inject trực tiếp ở bất kỳ đâu, không cần import module.

---

## Cấu trúc thư mục

Tổ chức giống S3 pattern, tự phân vùng theo ngày:

```
uploads/                                      ← root, cấu hình qua LOCAL_STORAGE_PATH
├── announcements/
│   └── inline/                               ← media chèn vào body announcement
│       └── 2026/08/03/{uuid}.jpg
├── {domain-tương-lai}/
│   └── {sub-prefix}/YYYY/MM/DD/{uuid}.{ext}
└── .gitkeep
```

URL public được ghép: `{APP_URL}/uploads/{relativePath}`.

Ví dụ: `http://localhost:6868/uploads/announcements/inline/2026/08/03/6c9c…3f.jpg`

---

## API service

### `save()` — Generic, dùng cho helper mới

Module tự chọn `prefix`, service tự thêm `YYYY/MM/DD/{uuid}.{ext}`.

```typescript
const result = await localStorageService.save({
  buffer: file.buffer,
  prefix: 'blog-posts/inline',   // KHÔNG bắt đầu bằng /, KHÔNG kết thúc bằng /
  ext: 'jpg',
  mimeType: 'image/jpeg',
});

result.publicUrl    // http://localhost:6868/uploads/blog-posts/inline/2026/08/03/xxx.jpg
result.relativePath // blog-posts/inline/2026/08/03/xxx.jpg
```

### `delete()` — Xoá file theo public URL

```typescript
await localStorageService.delete(publicUrl);
// Silent no-op nếu URL không thuộc local storage hoặc file không tồn tại (ENOENT).
```

### `isLocalUrl()` — Detect URL thuộc local hay S3

Hữu ích khi cùng field có thể lưu cả 2 loại (di chuyển dần từ S3 sang local hoặc ngược lại).

```typescript
if (localStorageService.isLocalUrl(url)) {
  // URL local, không cần sign
} else {
  // URL S3, gọi fileUploadService.getPresignedUrl(url)
}
```

### Domain helpers — Wrap `save()` cho từng use case

Thêm method mới ở cuối class khi có nhu cầu. Pattern chuẩn:

```typescript
async saveXxx(file: Express.Multer.File): Promise<LocalUploadResult> {
  // 1. Validate mime + size — throw BadRequestException với message tiếng Việt
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    throw new BadRequestException('Chỉ chấp nhận ...');
  }
  if (file.size > MAX_SIZE) {
    throw new BadRequestException('File không được vượt quá ...MB');
  }

  // 2. Map mime → ext
  const ext = MIME_TO_EXT[file.mimetype];

  // 3. Gọi save() với prefix cố định cho domain này
  return this.save({
    buffer: file.buffer,
    prefix: '{domain}/{sub}',
    ext,
    mimeType: file.mimetype,
  });
}
```

Đã có sẵn:

| Helper                              | Prefix                    | Mime allow                                 | Size max |
| ----------------------------------- | ------------------------- | ------------------------------------------ | -------- |
| `saveAnnouncementInlineMedia(file)` | `announcements/inline`    | JPG, PNG, GIF, WebP, MP4, WebM, MOV        | 5MB ảnh / 50MB video |

---

## Sử dụng ở Controller

**Local storage KHÔNG cần presign — không có TTL.** Trả URL trực tiếp trong response mà không cần bước sign như S3.

```typescript
@Post('upload-inline-media')
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
}))
async uploadInlineMedia(
  @UploadedFile() file: Express.Multer.File,
): Promise<{ url: string }> {
  const { publicUrl } = await this.localStorageService.saveAnnouncementInlineMedia(file);
  return { url: publicUrl };
}
```

**Transformer:** field lưu local URL — trả nguyên xi, không sign. Nếu cùng field có thể lưu cả S3 lẫn local (hybrid), controller dùng `isLocalUrl()` để phân nhánh.

---

## Static file serving

`main.ts` cấu hình `useStaticAssets` phục vụ toàn bộ `LOCAL_STORAGE_PATH` tại URL prefix `/uploads/`:

```typescript
app.useStaticAssets(uploadsDir, {
  prefix: '/uploads/',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
});
```

- `Cache-Control: immutable` — filename có UUID, không bao giờ đổi nội dung → cache vô hạn.
- Không có auth check → **không lưu dữ liệu nhạy cảm ở đây**.

---

## Environment variables

```env
APP_URL=http://localhost:6868   # ← đã có sẵn, dùng làm base cho public URL
LOCAL_STORAGE_PATH=uploads      # đường dẫn tương đối process.cwd() hoặc absolute
```

**Production:** trong Docker container, đặt `LOCAL_STORAGE_PATH=/app/uploads` và mount vào volume persistent (xem phần Deployment).

---

## Deployment

### Docker Compose

Volume `api_uploads` mount vào `/app/uploads` — persist qua rebuild container:

```yaml
services:
  api:
    environment:
      LOCAL_STORAGE_PATH: /app/uploads
    volumes:
      - api_uploads:/app/uploads

volumes:
  api_uploads:
```

### Backup

Volume `api_uploads` **PHẢI được backup** cùng routine với DB. Mất volume = mất toàn bộ ảnh/video đã upload, không có source of truth khác để phục hồi.

Ví dụ backup thủ công:

```bash
# Copy toàn bộ volume ra host
docker run --rm -v api_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

### Rotation / dọn dẹp

Hiện tại **không có auto-cleanup**. Nếu 1 record DB bị soft-delete, file trên disk vẫn còn — orphan. Khi cần cleanup:

1. Query các record đã soft-delete và extract URL từ HTML body.
2. Gọi `localStorageService.delete(url)` cho từng URL.
3. Chạy như cron job hoặc admin tool.

Chưa cần làm ngay — chỉ triển khai khi disk usage bắt đầu là vấn đề.

### Scale ngang

**Không hỗ trợ.** Nhiều instance API sẽ có volume disk riêng → file upload từ instance A không tồn tại trên instance B. Nếu buộc phải scale, chuyển sang:

- **Shared volume** (NFS, EFS) — chậm hơn local disk nhưng shared.
- **Public S3 prefix** — bucket cho phép public-read cho `announcements/inline/`, không cần signing, URL vĩnh viễn.

---

## Path traversal safety

`delete()` verify absolute path phải nằm trong `rootDir`:

```typescript
private isPathSafe(absPath: string): boolean {
  const resolved = resolve(absPath);
  return resolved === this.rootDir || resolved.startsWith(this.rootDir + sep);
}
```

`extractRelativePath()` từ chối URL có `..` hoặc bắt đầu bằng `/`. → attacker không thể xoá file ngoài `uploads/` qua public URL.

---

## Checklist khi thêm domain helper mới

- [ ] Tên method: `save{Domain}{Kind}(file)` — e.g. `saveBlogInlineImage`
- [ ] Prefix cố định: `{domain}/{sub}` — thêm vào bảng "Đã có sẵn" ở trên
- [ ] Validate mime + size, message tiếng Việt
- [ ] Return `LocalUploadResult` — controller dùng `publicUrl`
- [ ] KHÔNG sign, KHÔNG catch (validation errors phải throw ra ngoài)
- [ ] Nếu record DB có field lưu URL này và bị xoá → gọi `delete()` để tránh orphan
- [ ] Update bảng "Đã có sẵn" trong doc này
