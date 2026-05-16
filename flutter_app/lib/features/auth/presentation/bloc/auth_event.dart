part of 'auth_bloc.dart';

@freezed
class AuthEvent with _$AuthEvent {
  const factory AuthEvent.appStarted() = AppStarted;
  
  const factory AuthEvent.loginRequested({
    required String email,
    required String password,
  }) = LoginRequested;
  
  const factory AuthEvent.registerRequested({
    required String email,
    required String password,
    required String role,
    required String fullName,
    String? phoneNumber,
    String? dateOfBirth,
  }) = RegisterRequested;
  
  const factory AuthEvent.logoutRequested() = LogoutRequested;
  
  const factory AuthEvent.refreshToken() = RefreshToken;
}
