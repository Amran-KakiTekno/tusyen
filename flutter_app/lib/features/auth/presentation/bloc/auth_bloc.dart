import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';

part 'auth_bloc.freezed.dart';
part 'auth_event.dart';
part 'auth_state.dart';

@injectable
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _authRepository;
  final FlutterSecureStorage _secureStorage;

  AuthBloc(this._authRepository, this._secureStorage) : super(const AuthState.initial()) {
    on<AppStarted>(_onAppStarted);
    on<LoginRequested>(_onLoginRequested);
    on<RegisterRequested>(_onRegisterRequested);
    on<LogoutRequested>(_onLogoutRequested);
    on<RefreshToken>(_onRefreshToken);
  }

  Future<void> _onAppStarted(AppStarted event, Emitter<AuthState> emit) async {
    emit(const AuthState.loading());
    
    try {
      final token = await _secureStorage.read(key: 'access_token');
      
      if (token != null && token.isNotEmpty) {
        // Validate token and get user info
        final user = await _authRepository.getCurrentUser();
        
        if (user != null) {
          emit(AuthState.authenticated(user));
        } else {
          emit(const AuthState.unauthenticated());
        }
      } else {
        emit(const AuthState.unauthenticated());
      }
    } catch (e) {
      emit(const AuthState.unauthenticated());
    }
  }

  Future<void> _onLoginRequested(LoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthState.loading());
    
    try {
      final result = await _authRepository.login(
        email: event.email,
        password: event.password,
      );
      
      await result.fold(
        (failure) async => emit(AuthState.error(failure.message)),
        (user) async {
          emit(AuthState.authenticated(user));
        },
      );
    } catch (e) {
      emit(AuthState.error('Login failed: $e'));
    }
  }

  Future<void> _onRegisterRequested(RegisterRequested event, Emitter<AuthState> emit) async {
    emit(const AuthState.loading());
    
    try {
      final result = await _authRepository.register(
        email: event.email,
        password: event.password,
        role: event.role,
        fullName: event.fullName,
        phoneNumber: event.phoneNumber,
        dateOfBirth: event.dateOfBirth,
      );
      
      await result.fold(
        (failure) async => emit(AuthState.error(failure.message)),
        (user) async {
          emit(AuthState.authenticated(user));
        },
      );
    } catch (e) {
      emit(AuthState.error('Registration failed: $e'));
    }
  }

  Future<void> _onLogoutRequested(LogoutRequested event, Emitter<AuthState> emit) async {
    emit(const AuthState.loading());
    
    try {
      await _secureStorage.delete(key: 'access_token');
      await _secureStorage.delete(key: 'refresh_token');
      
      emit(const AuthState.unauthenticated());
    } catch (e) {
      emit(AuthState.error('Logout failed: $e'));
    }
  }

  Future<void> _onRefreshToken(RefreshToken event, Emitter<AuthState> emit) async {
    try {
      final result = await _authRepository.refreshToken();
      
      result.fold(
        (failure) => emit(const AuthState.unauthenticated()),
        (_) => null, // Token refreshed silently
      );
    } catch (e) {
      emit(const AuthState.unauthenticated());
    }
  }
}
