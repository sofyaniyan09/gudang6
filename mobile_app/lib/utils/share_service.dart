import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import 'package:supabase_flutter/supabase_flutter.dart';

class ShareService {
  static const List<String> webhookUrls = [
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a1f1c899-3d52-4165-a30d-a8a3fe22045b',
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=09cd17d4-d64a-457c-8091-c328e709aa4a',
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=d7498c77-8c2a-4648-b7d1-cd75d606b4dc',
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=f7f3e6cc-30d5-49bb-b24b-2f61a9ae93a2',
    'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=64b510b9-3be2-4127-a535-fbb73805c2a8',
  ];

  static int _currentWebhookIndex = 0;

  static String _getNextWebhookUrl() {
    final url = webhookUrls[_currentWebhookIndex];
    _currentWebhookIndex = (_currentWebhookIndex + 1) % webhookUrls.length;
    return url;
  }

  static bool _isQueueProcessing = false;

  static Future<void> processWecomQueue() async {
    // Di web browser, CORS memblokir panggilan ke WeCom.
    // Biarkan wecom_worker.js (Node.js di server) yang memproses antrean.
    if (kIsWeb) {
      debugPrint('Web terdeteksi: antrean WeCom akan diproses oleh worker server.');
      return;
    }
    if (_isQueueProcessing) return;
    _isQueueProcessing = true;

    try {
      final supabase = Supabase.instance.client;
      debugPrint('Memulai pemrosesan antrean WeCom...');

      while (true) {
        // Ambil 1 antrean tertua yang berstatus pending
        final queueResp = await supabase
            .from('wecom_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', ascending: true)
            .limit(1);

        if (queueResp.isEmpty) {
          debugPrint('Semua antrean WeCom sudah habis.');
          break; // Selesai
        }

        final task = queueResp.first;
        final taskId = task['id'];
        
        // Tandai processing dengan optimistic locking (hanya jika masih pending)
        final updateResp = await supabase
            .from('wecom_queue')
            .update({'status': 'processing'})
            .eq('id', taskId)
            .eq('status', 'pending')
            .select();

        if (updateResp.isEmpty) {
          // Gagal update, artinya device lain sudah mengambil task ini
          continue;
        }

        try {
          final payload = task['payload'] as Map<String, dynamic>;
          final text = payload['text'] as String;
          final imageUrls = List<String>.from(payload['imageUrls'] ?? []);

          await shareBackground(text: text, imageUrls: imageUrls);

          // Tandai sukses
          await supabase
              .from('wecom_queue')
              .update({'status': 'completed'})
              .eq('id', taskId);
              
        } catch (taskError) {
          debugPrint('Gagal memproses antrean $taskId: $taskError');
          await supabase
              .from('wecom_queue')
              .update({'status': 'failed'})
              .eq('id', taskId);
        }
      }

      debugPrint('Selesai memproses antrean WeCom.');

    } catch (e) {
      debugPrint('Error pada processWecomQueue: $e');
    } finally {
      _isQueueProcessing = false;
    }
  }

  static Future<void> _sendTextToWeCom(String text, String url) async {
    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'msgtype': 'text',
          'text': {'content': text}
        }),
      );
      final json = jsonDecode(response.body);
      if (json['errcode'] != 0) {
        throw Exception('WeCom text error: ${json['errmsg']}');
      }
      debugPrint('WeCom text response: ${response.body}');
    } catch (e) {
      debugPrint('Error sending text to WeCom: $e');
      rethrow;
    }
  }

  static Future<void> _sendImageBytesToWeCom(Uint8List bytes, String url) async {
    try {
      if (bytes.lengthInBytes > 2 * 1024 * 1024) {
        throw Exception('Ukuran gambar melebihi 2MB, WeCom menolak.');
      }

      final base64String = base64Encode(bytes);
      final md5Hash = md5.convert(bytes).toString();

      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'msgtype': 'image',
          'image': {
            'base64': base64String,
            'md5': md5Hash
          }
        }),
      );
      final json = jsonDecode(response.body);
      if (json['errcode'] != 0) {
        throw Exception('WeCom image error: ${json['errmsg']}');
      }
      debugPrint('WeCom image response: ${response.body}');
    } catch (e) {
      debugPrint('Error sending image to WeCom: $e');
      rethrow;
    }
  }

  /// Membagikan konten di background (tanpa UI context)
  static Future<String> shareBackground({
    required String text,
    required List<String> imageUrls,
  }) async {
    int successImages = 0;
    int failedImages = 0;
    final String currentUrl = _getNextWebhookUrl();
    
    try {
      await _sendTextToWeCom(text, currentUrl);
      // Beri jeda 1.5 detik (Kapasitas ganda karena load balancing 2 API)
      await Future.delayed(const Duration(milliseconds: 1500));
      
      final validUrls = imageUrls.where((url) => url.isNotEmpty).toList();
      for (int i = 0; i < validUrls.length; i++) {
        final bytes = await _downloadFileBytes(validUrls[i]);
        if (bytes != null) {
          try {
            await _sendImageBytesToWeCom(bytes, currentUrl);
            successImages++;
            // Jeda antar foto
            await Future.delayed(const Duration(milliseconds: 1500));
          } catch (e) {
            failedImages++;
          }
        } else {
          failedImages++;
        }
      }
      
      if (validUrls.isEmpty) {
        return 'Teks berhasil dikirim ke WeCom (tanpa foto).';
      } else if (failedImages == 0) {
        return 'Berhasil dikirim ke WeCom beserta $successImages foto.';
      } else {
        return 'Teks terkirim ke WeCom. $successImages foto berhasil, $failedImages gagal (mungkin > 2MB).';
      }
    } catch (e) {
      debugPrint('Share Background Error: $e');
      // Lempar error agar processWecomQueue tahu ini gagal dan tidak menandai sebagai 'completed'
      throw Exception('Gagal mengirim ke WeCom: $e');
    }
  }

  /// Membagikan konten tunggal (1 teks dan 1 gambar) ke WeCom Group
  static Future<void> shareItem({
    required BuildContext context,
    required String text,
    required String? imageUrl,
  }) async {
    try {
      if (context.mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => const Center(
            child: CircularProgressIndicator(),
          ),
        );
      }

      await Supabase.instance.client.from('wecom_queue').insert({
        'payload': {
          'text': text,
          'imageUrls': imageUrl != null && imageUrl.isNotEmpty ? [imageUrl] : [],
        }
      });
      
      // Jalankan proses WeCom di background
      processWecomQueue();

      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Laporan ditambahkan ke Antrean WeCom'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (context.mounted && Navigator.canPop(context)) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      if (context.mounted) {
        await Clipboard.setData(ClipboardData(text: text));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Teks disalin ke papan klip (Gagal mengantre: $e)'),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  /// Membagikan konten keseluruhan (1 teks dan multi-gambar) ke WeCom Group
  static Future<void> shareAll({
    required BuildContext context,
    required String text,
    required List<String> imageUrls,
  }) async {
    try {
      if (context.mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => const Center(
            child: CircularProgressIndicator(),
          ),
        );
      }

      await Supabase.instance.client.from('wecom_queue').insert({
        'payload': {
          'text': text,
          'imageUrls': imageUrls.where((url) => url.isNotEmpty).toList(),
        }
      });
      
      // Jalankan proses WeCom di background
      processWecomQueue();

      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Semua Laporan ditambahkan ke Antrean WeCom'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (context.mounted && Navigator.canPop(context)) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      if (context.mounted) {
        await Clipboard.setData(ClipboardData(text: text));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Teks disalin ke papan klip (Gagal mengantre: $e)'),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  /// Fungsi internal untuk mengunduh bytes file
  static Future<Uint8List?> _downloadFileBytes(String url) async {
    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        return response.bodyBytes;
      }
    } catch (e) {
      debugPrint('Error downloading file bytes: $e');
    }
    return null;
  }
}
