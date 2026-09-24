import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

void main() async {
  const String webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a1f1c899-3d52-4165-a30d-a8a3fe22045b';
  
  // Create a dummy image or text
  final bytes = List<int>.filled(10, 0); // Not a real image, should fail gracefully
  final base64String = base64Encode(bytes);
  final md5Hash = md5.convert(bytes).toString();

  try {
    final response = await http.post(
      Uri.parse(webhookUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'msgtype': 'image',
        'image': {
          'base64': base64String,
          'md5': md5Hash
        }
      }),
    );
    print('WeCom image response status: ${response.statusCode}');
    print('WeCom image response body: ${response.body}');
  } catch (e) {
    print('Error: $e');
  }
}
