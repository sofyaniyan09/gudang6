// Secara default akan menggunakan versi mobile (Google ML Kit)
// Namun jika dikompilasi untuk Web (dart.library.html tersedia), maka akan menggunakan versi Web (Tesseract.js)
export 'ocr_service_mobile.dart'
    if (dart.library.html) 'ocr_service_web.dart';
