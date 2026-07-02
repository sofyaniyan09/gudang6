import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

class OcrService {
  static Future<String?> extractTextFromBase64(String base64Image) async {
    try {
      // Decode base64 to bytes
      final bytes = base64Decode(base64Image);
      
      // Get temporary directory
      final dir = await getTemporaryDirectory();
      final tempFile = File('${dir.path}/temp_ocr_image_${DateTime.now().millisecondsSinceEpoch}.jpg');
      
      // Write bytes to temp file
      await tempFile.writeAsBytes(bytes);
      
      // Initialize ML Kit Text Recognizer
      final textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final inputImage = InputImage.fromFile(tempFile);
      
      // Process image
      final RecognizedText recognizedText = await textRecognizer.processImage(inputImage);
      
      // Clean up temp file
      await tempFile.delete();
      await textRecognizer.close();
      
      return recognizedText.text;
    } catch (e) {
      print('OCR Error (Mobile): $e');
      rethrow;
    }
  }
}
