import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:path/path.dart' as p;
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:crypto/crypto.dart';

class AuthException implements Exception {
  AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AuthenticatedUser {
  const AuthenticatedUser({
    required this.id,
    required this.role,
    required this.provider,
    this.email,
    this.name,
    this.avatarUrl,
  });

  factory AuthenticatedUser.fromJson(Map<String, dynamic> json) {
    return AuthenticatedUser(
      id: json['id']?.toString() ?? '',
      email: json['email'] as String?,
      name: json['name'] as String? ?? json['displayName'] as String?,
      role: json['role']?.toString() ?? 'USER',
      provider: json['provider']?.toString() ?? 'credentials',
      avatarUrl: json['avatarUrl'] as String? ?? json['image'] as String?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'email': email,
        'name': name,
        'role': role,
        'provider': provider,
        'avatarUrl': avatarUrl,
      };

  final String id;
  final String? email;
  final String? name;
  final String role;
  final String provider;
  final String? avatarUrl;
}

class AuthService {
  AuthService._internal() {
    _dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: (options, handler) async {
          if (_shouldSkipAuth(options)) {
            handler.next(options);
            return;
          }
          try {
            await ensureFreshToken();
          } catch (_) {
            // ignore and proceed; request may still fail with 401 which will trigger retry logic
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (_shouldRetryOnAuthError(error)) {
            try {
              await _refreshAccessToken();
              final requestOptions = error.requestOptions;
              requestOptions.headers['Authorization'] = 'Bearer $_token';
              requestOptions.extra['__authRetried'] = true;
              final response = await _dio.fetch(requestOptions);
              handler.resolve(response);
              return;
            } catch (_) {
              // fall through to original error
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  static final AuthService instance = AuthService._internal();

  static const String _tokenKey = 'moa_interview_mobile_access_token';
  static const String _tokenExpiryKey = 'moa_interview_mobile_token_expiry';
  static const String _userKey = 'moa_interview_mobile_user';
  static const String _avatarNonceKey = 'moa_interview_mobile_avatar_nonce';
  static const String _defaultBaseUrl = 'https://www.moa.tools';
  static const String _baseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: _defaultBaseUrl);
  static const Duration _tokenRefreshWindow = Duration(hours: 6);

  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 60),
      headers: const {
        'Accept': 'application/json',
        'User-Agent':
            'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.80 Mobile Safari/537.36',
        'Referer': 'https://www.moa.tools/video-create',
        'Origin': 'https://www.moa.tools',
        'X-Requested-With': 'XMLHttpRequest',
      },
    ),
  );

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthenticatedUser? _currentUser;
  String? _token;
  DateTime? _tokenExpiry;
  bool _isRefreshingToken = false;
  Completer<void>? _refreshCompleter;
  String? _avatarNonce;

  final ValueNotifier<AuthenticatedUser?> userNotifier =
      ValueNotifier<AuthenticatedUser?>(null);

  AuthenticatedUser? get currentUser => _currentUser;
  String? get profileImageUrlWithCacheBust =>
      _applyAvatarNonce(_currentUser?.avatarUrl);

  Dio get client => _dio;
  String? get token => _token;
  String? get profileImageUrl => _currentUser?.avatarUrl;

  bool get isLoggedIn => _token != null && _currentUser != null;

  Future<void> restoreSession() async {
    final storedToken = await _storage.read(key: _tokenKey);
    final storedUser = await _storage.read(key: _userKey);
    final storedExpiry = await _storage.read(key: _tokenExpiryKey);
    _avatarNonce = await _storage.read(key: _avatarNonceKey);

    if (storedToken != null && storedToken.isNotEmpty) {
      _token = storedToken;
      _dio.options.headers['Authorization'] = 'Bearer $storedToken';
    }

    if (storedExpiry != null && storedExpiry.isNotEmpty) {
      final parsed = DateTime.tryParse(storedExpiry);
      if (parsed != null) {
        _tokenExpiry = parsed;
      }
    }

    if (storedUser != null && storedUser.isNotEmpty) {
      try {
        final Map<String, dynamic> json =
            jsonDecode(storedUser) as Map<String, dynamic>;
        final restoredUser = _mapUser(AuthenticatedUser.fromJson(json));
        _currentUser = restoredUser;
        userNotifier.value = restoredUser;
      } catch (error) {
        await _storage.delete(key: _userKey);
      }
    }

    if (_token != null) {
      try {
        await ensureFreshToken();
      } catch (error) {
        debugPrint('Token refresh during restore failed: $error');
      }
      try {
        await refreshProfile(); // 최신 프로필(아바타 포함) 동기화
      } catch (error) {
        debugPrint('Profile refresh during restore failed: $error');
      }
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _tokenExpiryKey);
    await _storage.delete(key: _userKey);
    _dio.options.headers.remove('Authorization');
    _token = null;
    _tokenExpiry = null;
    _refreshCompleter = null;
    _isRefreshingToken = false;
    _currentUser = null;
    userNotifier.value = null;

    try {
      await GoogleSignIn().signOut();
    } catch (_) {
      // ignore silently
    }

    try {
      await UserApi.instance.logout();
    } catch (_) {
      // ignore silently (user may not be logged in with Kakao)
    }
  }

  /// 계정 삭제 (영구적으로 사용자 데이터 삭제)
  Future<void> deleteAccount() async {
    if (!isLoggedIn) {
      throw AuthException('로그인이 필요합니다.');
    }

    try {
      await _dio.delete<Map<String, dynamic>>(
        '/api/mobile/auth/delete-account',
      );
      // 계정 삭제 성공 시 로그아웃 처리
      await logout();
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, '계정 삭제에 실패했습니다.'));
    } catch (_) {
      throw AuthException('계정 삭제 처리 중 오류가 발생했습니다.');
    }
  }

  /// 서버에서 최신 프로필(아바타 포함)을 불러와 동기화
  Future<void> refreshProfile() async {
    if (!isLoggedIn) return;
    try {
      final response = await _dio.get<Map<String, dynamic>>('/api/mobile/profile/me');
      final data = response.data;
      final userPayload = data?['user'] as Map<String, dynamic>?;
      if (userPayload == null) return;

      var refreshedUser = _mapUser(AuthenticatedUser.fromJson(userPayload));
      // 서버에서 avatarUrl을 보내지 않으면 기존 값을 유지
      if ((refreshedUser.avatarUrl == null || refreshedUser.avatarUrl!.isEmpty) &&
          _currentUser?.avatarUrl != null &&
          _currentUser!.avatarUrl!.isNotEmpty) {
        refreshedUser = AuthenticatedUser(
          id: refreshedUser.id,
          role: refreshedUser.role,
          provider: refreshedUser.provider,
          email: refreshedUser.email,
          name: refreshedUser.name,
          avatarUrl: _currentUser!.avatarUrl,
        );
      }

      _currentUser = refreshedUser;
      userNotifier.value = refreshedUser;
      await _storage.write(
        key: _userKey,
        value: jsonEncode(refreshedUser.toJson()),
      );
    } on DioException catch (error) {
      debugPrint('refreshProfile failed: ${error.message}');
    } catch (error) {
      debugPrint('refreshProfile failed: $error');
    }
  }

  Future<AuthenticatedUser> loginWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/auth/login1',
        data: {'email': email, 'password': password},
      );
      return _persistSession(response.data);
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, '이메일 로그인에 실패했습니다.'));
    } catch (_) {
      throw AuthException('이메일 로그인 중 오류가 발생했습니다.');
    }
  }

  Future<AuthenticatedUser> signup({
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/auth/signup',
        data: {'email': email, 'password': password, 'name': name},
      );
      return _persistSession(response.data);
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, '회원가입에 실패했습니다.'));
    } catch (_) {
      throw AuthException('회원가입 처리 중 오류가 발생했습니다.');
    }
  }

  Future<AuthenticatedUser> loginWithGoogle() async {
    try {
      const webClientId = String.fromEnvironment(
        'GOOGLE_WEB_CLIENT_ID',
        defaultValue:
            '77003894803-uaam3bvlvqva6786u9k5d7pgqt0nkj46.apps.googleusercontent.com',
      );
      const androidClientId = String.fromEnvironment(
        'GOOGLE_ANDROID_CLIENT_ID',
        defaultValue:
            '77003894803-d8k0o6r140qbmrsiakbkoo2haa9t0ug8.apps.googleusercontent.com',
      );
      const iosClientId = String.fromEnvironment(
        'GOOGLE_IOS_CLIENT_ID',
        defaultValue:
            '77003894803-v2b3cn8lakdn2hd8l2drldofeovvue0o.apps.googleusercontent.com',
      );

      final GoogleSignInAccount? account = await GoogleSignIn(
        scopes: const ['email', 'profile'],
        serverClientId: webClientId.isEmpty ? null : webClientId,
        clientId: defaultTargetPlatform == TargetPlatform.iOS
            ? (iosClientId.isEmpty ? null : iosClientId)
            : (androidClientId.isEmpty ? null : androidClientId),
      ).signIn();

      if (account == null) {
        throw AuthException('Google 로그인이 취소되었습니다.');
      }

      final GoogleSignInAuthentication auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        throw AuthException('Google 토큰을 가져올 수 없습니다.');
      }

      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/auth/google',
        data: {'idToken': idToken},
      );
      return _persistSession(response.data);
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, 'Google 로그인에 실패했습니다.'));
    } on AuthException {
      rethrow;
    } catch (_) {
      throw AuthException('Google 로그인 처리 중 오류가 발생했습니다.');
    }
  }

  Future<AuthenticatedUser> loginWithKakao() async {
    try {
      OAuthToken token;
      try {
        final bool isInstalled = await isKakaoTalkInstalled();
        if (isInstalled) {
          token = await UserApi.instance.loginWithKakaoTalk();
        } else {
          token = await UserApi.instance.loginWithKakaoAccount();
        }
      } catch (error) {
        throw AuthException('카카오 로그인이 취소되었습니다.');
      }

      // 카카오 사용자 정보 가져오기 (프로필 이미지 포함)
      String? profileImageUrl;
      try {
        final kakaoUser = await UserApi.instance.me();
        profileImageUrl = kakaoUser.kakaoAccount?.profile?.profileImageUrl;
        debugPrint('[Auth] Kakao profile image: $profileImageUrl');
      } catch (e) {
        debugPrint('[Auth] Failed to get Kakao user info: $e');
      }

      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/auth/kakao',
        data: {
          'accessToken': token.accessToken,
          'profileImageUrl': profileImageUrl,
        },
      );
      final user = await _persistSession(response.data);

      // 서버가 avatarUrl을 주지 않는 경우, 카카오에서 받은 프로필 URL을 직접 반영
      if ((user.avatarUrl == null || user.avatarUrl!.isEmpty) &&
          profileImageUrl != null &&
          profileImageUrl.isNotEmpty) {
        final patchedUser = _mapUser(
          AuthenticatedUser(
            id: user.id,
            role: user.role,
            provider: user.provider,
            email: user.email,
            name: user.name,
            avatarUrl: profileImageUrl,
          ),
        );
        _currentUser = patchedUser;
        userNotifier.value = patchedUser;
        await _storage.write(
          key: _userKey,
          value: jsonEncode(patchedUser.toJson()),
        );
        return patchedUser;
      }

      return user;
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, '카카오 로그인에 실패했습니다.'));
    } on AuthException {
      rethrow;
    } catch (_) {
      throw AuthException('카카오 로그인 처리 중 오류가 발생했습니다.');
    }
  }

  Future<AuthenticatedUser> loginWithApple() async {
    try {
      // 보안을 위한 nonce 생성
      final rawNonce = _generateNonce();
      final nonce = _sha256ofString(rawNonce);

      // Apple Sign In 실행 (일부 기기/OS에서 Future가 끝나지 않는 경우 대비)
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: nonce,
      ).timeout(
        const Duration(seconds: 120),
        onTimeout: () => throw TimeoutException('apple_sign_in'),
      );

      // 사용자 정보 추출
      final identityToken = credential.identityToken;
      if (identityToken == null) {
        throw AuthException('Apple 인증 토큰을 가져올 수 없습니다.');
      }

      // 이름 정보 (최초 로그인 시에만 제공됨)
      String? displayName;
      if (credential.givenName != null || credential.familyName != null) {
        final givenName = credential.givenName ?? '';
        final familyName = credential.familyName ?? '';
        displayName = '$familyName$givenName'.trim();
        if (displayName.isEmpty) displayName = null;
      }

      // 서버로 전송
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/auth/apple',
        data: {
          'identityToken': identityToken,
          'authorizationCode': credential.authorizationCode,
          'user': credential.userIdentifier,
          'email': credential.email,
          'displayName': displayName,
          'rawNonce': rawNonce,
        },
      );

      return _persistSession(response.data);
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        throw AuthException('Apple 로그인이 취소되었습니다.');
      } else if (e.code == AuthorizationErrorCode.failed) {
        throw AuthException('Apple 로그인에 실패했습니다.');
      } else if (e.code == AuthorizationErrorCode.notHandled) {
        throw AuthException('Apple 로그인을 처리할 수 없습니다.');
      } else {
        throw AuthException('Apple 로그인 중 오류가 발생했습니다: ${e.message}');
      }
    } on TimeoutException {
      throw AuthException(
        'Apple 로그인 응답이 없습니다. 잠시 후 다시 시도하거나 설정에서 Apple ID를 확인해 주세요.',
      );
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, 'Apple 로그인에 실패했습니다.'));
    } on AuthException {
      rethrow;
    } catch (error) {
      debugPrint('[Auth] Apple login error: $error');
      throw AuthException('Apple 로그인 처리 중 오류가 발생했습니다.');
    }
  }

  // Nonce 생성 헬퍼 함수
  String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }

  String _sha256ofString(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<AuthenticatedUser> updateProfile({
    required String name,
    File? imageFile,
  }) async {
    if (!isLoggedIn) {
      throw AuthException('로그인이 필요합니다.');
    }

    final formData = FormData();
    formData.fields.add(MapEntry('name', name));

    if (imageFile != null) {
      final fileName = p.basename(imageFile.path);
      formData.files.add(
        MapEntry(
          'image',
          await MultipartFile.fromFile(
            imageFile.path,
            filename: fileName,
          ),
        ),
      );
    }

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/profile/update',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      final data = response.data;
      if (data == null) {
        throw AuthException('프로필 정보를 업데이트하지 못했습니다.');
      }

      final userPayload = data['user'];
      if (userPayload is! Map<String, dynamic>) {
        throw AuthException('업데이트된 사용자 정보를 확인할 수 없습니다.');
      }

      var updatedUser = _mapUser(AuthenticatedUser.fromJson(userPayload));
      // 서버가 avatarUrl을 보내지 않는 경우 기존 값을 유지해 프로필 이미지가 사라지지 않도록 함
      if ((updatedUser.avatarUrl == null || updatedUser.avatarUrl!.isEmpty) &&
          _currentUser?.avatarUrl != null &&
          _currentUser!.avatarUrl!.isNotEmpty) {
        updatedUser = AuthenticatedUser(
          id: updatedUser.id,
          role: updatedUser.role,
          provider: updatedUser.provider,
          email: updatedUser.email,
          name: updatedUser.name,
          avatarUrl: _currentUser!.avatarUrl,
        );
      }
      _currentUser = updatedUser;
      userNotifier.value = updatedUser;
      await _storage.write(
        key: _userKey,
        value: jsonEncode(updatedUser.toJson()),
      );

      final updatedToken = data['token']?.toString();
      if (updatedToken != null && updatedToken.isNotEmpty) {
        _token = updatedToken;
        _dio.options.headers['Authorization'] = 'Bearer $updatedToken';
        await _storage.write(key: _tokenKey, value: updatedToken);
        await _saveTokenExpiry(_decodeExpiry(updatedToken));
      }

      // 아바타를 새로 업로드한 경우 캐시 버스트용 nonce를 갱신
      if (imageFile != null) {
        _avatarNonce = DateTime.now().millisecondsSinceEpoch.toString();
        await _storage.write(key: _avatarNonceKey, value: _avatarNonce!);
      }

      return updatedUser;
    } on DioException catch (error) {
      throw AuthException(_extractMessage(error, '프로필 업데이트에 실패했습니다.'));
    } catch (_) {
      throw AuthException('프로필 업데이트 중 오류가 발생했습니다.');
    }
  }

  Future<AuthenticatedUser> _persistSession(
    Map<String, dynamic>? payload,
  ) async {
    if (payload == null) {
      throw AuthException('서버 응답이 올바르지 않습니다.');
    }

    final token = payload['token']?.toString();
    final userJson = payload['user'];

    if (token == null || userJson is! Map<String, dynamic>) {
      throw AuthException('인증 정보를 확인할 수 없습니다.');
    }

    final user = _mapUser(AuthenticatedUser.fromJson(userJson));
    _token = token;
    _currentUser = user;
    userNotifier.value = user;

    _dio.options.headers['Authorization'] = 'Bearer $token';
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(
      key: _userKey,
      value: jsonEncode(user.toJson()),
    );
    await _saveTokenExpiry(_decodeExpiry(token));

    return user;
  }

  Future<void> ensureFreshToken({bool force = false}) async {
    if (!isLoggedIn) return;
    if (!force && !_shouldRefreshNow()) return;
    if (_isRefreshingToken) {
      await _refreshCompleter?.future;
      return;
    }
    await _refreshAccessToken();
  }

  bool _shouldRefreshNow() {
    final expiry = _tokenExpiry;
    if (expiry == null) return false;
    final now = DateTime.now();
    if (now.isAfter(expiry)) {
      return true;
    }
    return now.isAfter(expiry.subtract(_tokenRefreshWindow));
  }

  Future<void> _refreshAccessToken() async {
    if (!isLoggedIn) {
      throw AuthException('로그인이 필요합니다.');
    }
    if (_isRefreshingToken) {
      await _refreshCompleter?.future;
      return;
    }
    _isRefreshingToken = true;
    final completer = Completer<void>();
    _refreshCompleter = completer;
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/mobile/auth/refresh',
        options: Options(
          extra: const {
            'skipAuthRefresh': true,
            'skipAuthRetry': true,
          },
        ),
      );
      await _persistSession(response.data);
      completer.complete();
    } on DioException catch (error) {
      completer.completeError(error);
      await logout();
      throw AuthException(_extractMessage(error, '세션이 만료되었습니다. 다시 로그인해 주세요.'));
    } finally {
      _isRefreshingToken = false;
      _refreshCompleter = null;
    }
  }

  Future<void> _saveTokenExpiry(DateTime? expiry) async {
    _tokenExpiry = expiry;
    if (expiry != null) {
      await _storage.write(
        key: _tokenExpiryKey,
        value: expiry.toIso8601String(),
      );
    } else {
      await _storage.delete(key: _tokenExpiryKey);
    }
  }

  DateTime? _decodeExpiry(String token) {
    try {
      return JwtDecoder.getExpirationDate(token);
    } catch (_) {
      return null;
    }
  }

  bool _shouldSkipAuth(RequestOptions options) {
    return options.extra['skipAuthRefresh'] == true;
  }

  bool _shouldRetryOnAuthError(DioException error) {
    if (!isLoggedIn) return false;
    final requestOptions = error.requestOptions;
    if (requestOptions.extra['skipAuthRetry'] == true) return false;
    if (requestOptions.extra['__authRetried'] == true) return false;
    final statusCode = error.response?.statusCode;
    return statusCode == 401;
  }

  String _extractMessage(DioException error, String fallback) {
    final data = error.response?.data;
    if (data is Map && data['error'] is String) {
      return data['error'] as String;
    }
    return fallback;
  }

  AuthenticatedUser _mapUser(AuthenticatedUser user) {
    return AuthenticatedUser(
      id: user.id,
      role: user.role,
      provider: user.provider,
      email: user.email,
      name: user.name,
      avatarUrl: _resolveAvatarUrl(user.avatarUrl),
    );
  }

  String? _resolveAvatarUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('http://')) {
      // 일부 제공자(Kakao 등)에서 http를 돌려주는 경우, 안드로이드 cleartext 차단을 방지하기 위해 https로 승격
      return url.replaceFirst('http://', 'https://');
    }
    if (url.startsWith('https://')) {
      return url;
    }
    final sanitized = url.startsWith('/') ? url : '/$url';
    return '$_baseUrl$sanitized';
  }

  String? _applyAvatarNonce(String? url) {
    if (url == null || url.isEmpty) return null;
    if (_avatarNonce == null || _avatarNonce!.isEmpty) return url;
    final delimiter = url.contains('?') ? '&' : '?';
    return '$url${delimiter}v=$_avatarNonce';
  }
}

