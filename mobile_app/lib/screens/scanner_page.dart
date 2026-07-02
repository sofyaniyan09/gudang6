import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../utils/route_observer.dart';
import '../utils/ocr_service.dart';
import '../main.dart';
import 'scanned_containers_page.dart';

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> with RouteAware, TitleUpdater<ScannerPage> {
  @override
  String get pageTitle => 'Scanner OCR';
  @override
  String? get pageSubtitle => 'Pindai Shipping Mark';
  
  bool _isProcessing = false;
  String _statusMessage = '';
  
  final ImagePicker _picker = ImagePicker();

  Future<void> _startScan() async {
    setState(() {
      _isProcessing = true;
      _statusMessage = 'Menyiapkan kamera...';
    });

    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1080,
        maxHeight: 1080,
        imageQuality: 85,
      );

      if (photo == null) {
        setState(() {
          _isProcessing = false;
          _statusMessage = '';
        });
        return;
      }

      setState(() {
        _statusMessage = 'Mengubah format gambar...';
      });

      final bytes = await photo.readAsBytes();
      final base64Image = base64Encode(bytes);

      setState(() {
        _statusMessage = 'Memproses OCR (Membaca Teks)...';
      });

      String? text;
      try {
        text = await OcrService.extractTextFromBase64(base64Image);
      } catch (ocrError) {
        _showError('OCR Error: $ocrError');
        return;
      }

      if (text == null || text.trim().isEmpty) {
        _showError('Tidak ada teks yang terdeteksi dari foto.\n\n(OCR returned empty result)');
        return;
      }

      setState(() {
        _statusMessage = 'Mencari kecocokan di database...';
      });

      // Fetch distinct nama_material
      final response = await supabase
          .from('penerimaan_kapal')
          .select('nama_material');
          
      final List<dynamic> data = response as List<dynamic>;
      final Set<String> distinctMaterials = data
          .map((e) => e['nama_material']?.toString() ?? '')
          .where((e) => e.isNotEmpty)
          .toSet();

      final String lowerOcrText = text.toLowerCase();
      String? matchedMaterial;

      // Find the longest matching material name to avoid partial short matches
      int longestMatchLength = 0;
      for (final material in distinctMaterials) {
        if (lowerOcrText.contains(material.toLowerCase())) {
          if (material.length > longestMatchLength) {
            longestMatchLength = material.length;
            matchedMaterial = material;
          }
        }
      }

      if (matchedMaterial != null) {
        if (!mounted) return;
        setState(() {
          _isProcessing = false;
        });
        
        // Navigate to the scanned containers page
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ScannedContainersPage(
              scannedItemName: matchedMaterial!,
            ),
          ),
        );
      } else {
        _showError('Tidak ditemukan barang yang cocok dengan hasil pindaian:\n\n$text');
      }

    } catch (e) {
      _showError('Terjadi kesalahan: $e');
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    setState(() {
      _isProcessing = false;
    });
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF101319),
        title: const Text('Gagal', style: TextStyle(color: Colors.white)),
        content: Text(msg, style: const TextStyle(color: Color(0xFFC0C6D6))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: Color(0xFF3E90FF))),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: _isProcessing
          ? Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircularProgressIndicator(color: Color(0xFF3E90FF)),
                const SizedBox(height: 24),
                Text(
                  _statusMessage,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            )
          : Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.document_scanner_outlined,
                  size: 100,
                  color: Color(0xFFC0C6D6),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Pindai Shipping Mark\nuntuk mencari barang',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFC0C6D6),
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 32),
                ElevatedButton.icon(
                  onPressed: _startScan,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3E90FF),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                  icon: const Icon(Icons.camera_alt),
                  label: const Text(
                    'Buka Kamera',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
    );
  }
}
