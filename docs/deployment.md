# Deployment

## Yêu cầu

- Docker
- Apache2 (trên server deploy)

## Build

Chạy script `build.sh` tại root project:

```bash
./build.sh
```

Script sẽ:

1. Dùng Docker image `node:22.21-slim` với Yarn 1.22.22
2. Chạy `yarn install --frozen-lockfile` và `yarn generate` (static build)
3. Output static files vào `.output/public/`
4. Sinh file cấu hình Apache `city-tower.sonthanh.net.vn.conf` với `DocumentRoot` trỏ vào đường dẫn tuyệt đối của `.output/public/`

## Deploy lên Apache

Sau khi build xong:

```bash
# Copy config vào Apache
sudo cp city-tower.sonthanh.net.vn.conf /etc/apache2/sites-available/

# Enable site
sudo a2ensite city-tower.sonthanh.net.vn.conf

# Reload Apache
sudo systemctl reload apache2
```

## Cấu hình Apache

File `city-tower.sonthanh.net.vn.conf` được sinh tự động với nội dung:

- **ServerName:** `city-tower.sonthanh.net.vn`
- **DocumentRoot:** đường dẫn tuyệt đối tới `.output/public/`
- **SPA fallback:** `FallbackResource /index.html` — mọi route không khớp file tĩnh sẽ trả về `index.html`
- **Log:** `city-tower.sonthanh.net.vn-error.log` và `city-tower.sonthanh.net.vn-access.log`

## Environment Variables

Cấu hình trong file `.env` trước khi build:

```env
NUXT_PUBLIC_API_KEY=           # API key xác thực với backend
NUXT_BASE_API_URL=             # Base URL của REST API
```

Các biến này được nhúng vào static files lúc build, nên cần build lại khi thay đổi.

## Re-deploy

Khi có thay đổi code hoặc env:

```bash
# Build lại
./build.sh

# Reload Apache (config đã có sẵn, chỉ cần reload nếu config thay đổi)
sudo systemctl reload apache2
```
