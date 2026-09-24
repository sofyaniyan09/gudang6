import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../utils/route_observer.dart';
import '../utils/ocr_service.dart';
import '../main.dart';
import 'scanned_containers_page.dart';
import '../utils/app_locale.dart';

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> with RouteAware, TitleUpdater<ScannerPage> {
  @override
  String get pageTitle => AppLocale.t('scanner_ocr');
  @override
  String? get pageSubtitle => AppLocale.t('scan_shipping_mark');
  
  bool _isProcessing = false;
  String _statusMessage = '';
  
  final ImagePicker _picker = ImagePicker();

  Future<void> _startScan() async {
    setState(() {
      _isProcessing = true;
      _statusMessage = AppLocale.t('preparing_camera');
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
        _statusMessage = AppLocale.t('formatting_image');
      });

      final bytes = await photo.readAsBytes();
      final base64Image = base64Encode(bytes);

      setState(() {
        _statusMessage = AppLocale.t('processing_ocr');
      });

      String? text;
      try {
        text = await OcrService.extractTextFromBase64(base64Image);
      } catch (ocrError) {
        _showError('${AppLocale.t('ocr_error')}$ocrError');
        return;
      }

      if (text == null || text.trim().isEmpty) {
        _showError(AppLocale.t('no_text_detected'));
        return;
      }

      setState(() {
        _statusMessage = AppLocale.t('searching_database');
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
        _showError('${AppLocale.t('no_match_found')}$text');
      }

    } catch (e) {
      _showError('${AppLocale.t('error_occurred')}$e');
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
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(AppLocale.t('failed'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: Text(msg, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK', style: TextStyle(color: Theme.of(context).colorScheme.primary)),
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
                CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
                SizedBox(height: 24),
                Text(
                  _statusMessage,
                  style: TextStyle(
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
                Icon(
                  Icons.document_scanner_outlined,
                  size: 100,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                SizedBox(height: 24),
                Text(
                  AppLocale.t('scan_shipping_mark_desc'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 16,
                  ),
                ),
                SizedBox(height: 32),
                ElevatedButton.icon(
                  onPressed: _startScan,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                  icon: Icon(Icons.camera_alt),
                  label: Text(
                    AppLocale.t('open_camera'),
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
    );
  }
}
