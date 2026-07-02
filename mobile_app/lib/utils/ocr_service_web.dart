// ignore_for_file: avoid_web_libraries_in_flutter

import 'dart:html' as html;
import 'dart:js_util' as js_util;

class OcrService {
  static Future<String?> extractTextFromBase64(String base64Image) async {
    try {
      final dataUri = 'data:image/jpeg;base64,$base64Image';
      
      // Use dart:html window which is the real JS window object
      final promise = js_util.callMethod(html.window, 'performOCR', [dataUri]);
      final text = await js_util.promiseToFuture<dynamic>(promise);
      
      return text?.toString();
    } catch (e) {
      print('OCR Error (Web): $e');
      rethrow;
    }
  }
}
