import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  const String webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a1f1c899-3d52-4165-a30d-a8a3fe22045b';
  
  try {
    final response = await http.post(
      Uri.parse(webhookUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'msgtype': 'text',
        'text': {'content': 'Uji coba dari Antigravity bot'}
      }),
    );
    print('WeCom text response status: ${response.statusCode}');
    print('WeCom text response body: ${response.body}');
  } catch (e) {
    print('Error: $e');
  }
}
