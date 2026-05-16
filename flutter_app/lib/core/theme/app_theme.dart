import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors
  static const Color primaryColor = Color(0xFF58CC02); // Duolingo green
  static const Color secondaryColor = Color(0xFFFF9600); // Orange
  static const Color accentColor = Color(0xFF1CB0F6); // Blue
  static const Color errorColor = Color(0xFFFF4B4B); // Red
  static const Color warningColor = Color(0xFFFFC800); // Yellow
  static const Color successColor = Color(0xFF58CC02); // Green
  
  // Neutrals
  static const Color darkText = Color(0xFF3C3C3C);
  static const Color lightText = Color(0xFF777777);
  static const Color borderColor = Color(0xFFE5E5E5);
  static const Color backgroundColor = Color(0xFFF7F7F7);
  static const Color cardColor = Colors.white;
  
  // Gamification colors
  static const Color streakColor = Color(0xFFFF9600);
  static const Color xpColor = Color(0xFFFFC800);
  static const Color gemColor = Color(0xFF1CB0F6);
  static const Color heartColor = Color(0xFFFF4B4B);
  
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: backgroundColor,
      cardColor: cardColor,
      fontFamily: GoogleFonts.nunito().fontFamily,
      
      // AppBar
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: true,
        backgroundColor: cardColor,
        foregroundColor: darkText,
        titleTextStyle: GoogleFonts.nunito(
          fontSize: 18.sp,
          fontWeight: FontWeight.w700,
          color: darkText,
        ),
      ),
      
      // Elevated Button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: Size(double.infinity, 50.h),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.r),
          ),
          textStyle: GoogleFonts.nunito(
            fontSize: 16.sp,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      
      // Outlined Button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: const BorderSide(color: borderColor, width: 2),
          minimumSize: Size(double.infinity, 50.h),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12.r),
          ),
          textStyle: GoogleFonts.nunito(
            fontSize: 16.sp,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      
      // Text Button
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: accentColor,
          textStyle: GoogleFonts.nunito(
            fontSize: 14.sp,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      
      // Input Decoration
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cardColor,
        contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.r),
          borderSide: const BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.r),
          borderSide: const BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.r),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.r),
          borderSide: const BorderSide(color: errorColor),
        ),
        labelStyle: GoogleFonts.nunito(
          fontSize: 14.sp,
          color: lightText,
        ),
      ),
      
      // Card
      cardTheme: CardTheme(
        elevation: 0,
        color: cardColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16.r),
        ),
      ),
      
      // Bottom Navigation
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: cardColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: lightText,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: GoogleFonts.nunito(fontSize: 12.sp),
        unselectedLabelStyle: GoogleFonts.nunito(fontSize: 12.sp),
      ),
      
      // Progress Indicator
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: primaryColor,
        linearTrackColor: borderColor,
      ),
      
      // Snackbar
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12.r),
        ),
        contentTextStyle: GoogleFonts.nunito(fontSize: 14.sp),
      ),
    );
  }
  
  static ThemeData get darkTheme {
    // Similar configuration for dark theme
    return lightTheme.copyWith(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF1F1F1F),
      cardColor: const Color(0xFF2C2C2C),
      appBarTheme: lightTheme.appBarTheme.copyWith(
        backgroundColor: const Color(0xFF2C2C2C),
      ),
    );
  }
  
  // Text Styles
  static TextStyle get heading1 => GoogleFonts.nunito(
    fontSize: 28.sp,
    fontWeight: FontWeight.w800,
    color: darkText,
  );
  
  static TextStyle get heading2 => GoogleFonts.nunito(
    fontSize: 24.sp,
    fontWeight: FontWeight.w700,
    color: darkText,
  );
  
  static TextStyle get heading3 => GoogleFonts.nunito(
    fontSize: 20.sp,
    fontWeight: FontWeight.w700,
    color: darkText,
  );
  
  static TextStyle get body1 => GoogleFonts.nunito(
    fontSize: 16.sp,
    fontWeight: FontWeight.w600,
    color: darkText,
  );
  
  static TextStyle get body2 => GoogleFonts.nunito(
    fontSize: 14.sp,
    fontWeight: FontWeight.w500,
    color: lightText,
  );
  
  static TextStyle get caption => GoogleFonts.nunito(
    fontSize: 12.sp,
    fontWeight: FontWeight.w500,
    color: lightText,
  );
  
  static TextStyle get button => GoogleFonts.nunito(
    fontSize: 16.sp,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );
}
