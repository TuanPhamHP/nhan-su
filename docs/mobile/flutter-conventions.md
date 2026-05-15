# Mobile — Flutter Conventions

## Project Structure

```
lib/
├── main.dart
├── app.dart                    ← MaterialApp, router setup
│
├── core/
│   ├── constants/
│   │   ├── api_constants.dart
│   │   └── app_constants.dart
│   ├── errors/
│   │   └── exceptions.dart
│   ├── network/
│   │   ├── api_client.dart     ← Dio instance + interceptors
│   │   └── api_response.dart   ← Wrapper model
│   ├── storage/
│   │   └── secure_storage.dart ← Token lưu flutter_secure_storage
│   └── utils/
│       ├── date_utils.dart
│       └── format_utils.dart
│
├── features/
│   ├── auth/
│   │   ├── data/
│   │   │   ├── models/         ← LoginResponseModel, UserModel
│   │   │   └── repositories/   ← AuthRepositoryImpl
│   │   ├── domain/
│   │   │   ├── entities/       ← User entity
│   │   │   └── repositories/   ← AuthRepository interface
│   │   └── presentation/
│   │       ├── screens/        ← LoginScreen
│   │       ├── widgets/
│   │       └── providers/      ← Riverpod providers
│   │
│   ├── attendance/             ← CheckInScreen, AttendanceHistoryScreen
│   ├── leave/                  ← LeaveRequestScreen, LeaveListScreen
│   ├── employee/               ← ProfileScreen
│   ├── payroll/                ← PayslipScreen
│   └── dashboard/              ← HomeScreen
│
└── shared/
    ├── widgets/                ← AppButton, AppTextField, LoadingWidget
    └── theme/                  ← AppTheme, AppColors, AppTextStyles
```

---

## API Client — Dio + Interceptors

```dart
// core/network/api_client.dart
class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
    ));

    _dio.interceptors.addAll([
      AuthInterceptor(),   // tự thêm Bearer token
      LoggingInterceptor(),
    ]);
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? params}) async {
    final response = await _dio.get(path, queryParameters: params);
    return response.data;
  }

  Future<T> post<T>(String path, {dynamic body}) async {
    final response = await _dio.post(path, data: body);
    return response.data;
  }
}
```

---

## State Management — Riverpod

```dart
// features/attendance/presentation/providers/attendance_provider.dart

final attendanceProvider = AsyncNotifierProvider<AttendanceNotifier, AttendanceState>(
  AttendanceNotifier.new,
);

class AttendanceNotifier extends AsyncNotifier<AttendanceState> {
  @override
  Future<AttendanceState> build() async {
    final record = await ref.read(attendanceRepositoryProvider).getTodayRecord();
    return AttendanceState(todayRecord: record);
  }

  Future<void> checkIn() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final record = await ref.read(attendanceRepositoryProvider).checkIn();
      return AttendanceState(todayRecord: record);
    });
  }
}
```

---

## Models — Phải match với Transformer output của Backend

```dart
// features/attendance/data/models/attendance_record_model.dart
class AttendanceRecordModel {
  final String id;
  final String date;
  final String? checkInAt;
  final String? checkOutAt;
  final int lateMinutes;
  final int earlyMinutes;
  final String status;

  const AttendanceRecordModel({
    required this.id,
    required this.date,
    this.checkInAt,
    this.checkOutAt,
    required this.lateMinutes,
    required this.earlyMinutes,
    required this.status,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id'] as String,
      date: json['date'] as String,
      checkInAt: json['checkInAt'] as String?,
      checkOutAt: json['checkOutAt'] as String?,
      lateMinutes: json['lateMinutes'] as int,
      earlyMinutes: json['earlyMinutes'] as int,
      status: json['status'] as String,
    );
  }
}
```

---

## Quy tắc

- Token lưu bằng `flutter_secure_storage` — không dùng SharedPreferences cho auth data
- Mọi API call qua `ApiClient` — không dùng `http` package trực tiếp
- Không hardcode base URL — dùng `ApiConstants` và build flavors (dev/staging/prod)
- Mọi DateTime từ API là ISO string — parse và hiển thị theo timezone địa phương
- Push notification dùng **FCM** — token FCM gửi lên server khi login
