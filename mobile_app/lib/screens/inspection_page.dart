import 'dart:io';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../utils/route_observer.dart';
import '../utils/share_service.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_speed_dial/flutter_speed_dial.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import '../main.dart';
import 'dashboard_page.dart';
import '../widgets/obsidian_scaffold.dart';
import '../widgets/glass_card.dart';
import '../utils/app_locale.dart';

class InspectionPage extends StatefulWidget {
  final List<Map<String, dynamic>> selectedItems;
  final String nomorKontainer;

  const InspectionPage({
    super.key,
    required this.selectedItems,
    required this.nomorKontainer,
  });

  @override
  State<InspectionPage> createState() => _InspectionPageState();
}

class _InspectionPageState extends State<InspectionPage>
    with RouteAware, TitleUpdater<InspectionPage> {
  final ValueNotifier<bool> isDialOpen = ValueNotifier(false);
  @override
  String get pageTitle => AppLocale.t('inspection');
  @override
  String? get pageSubtitle => widget.nomorKontainer;
  final _supabase = Supabase.instance.client;
  final _picker = ImagePicker();

  bool _isLoading = false;
  List<XFile> _newImages = [];
  List<String> _existingImages = [];
  String? _status;
  int _selectedIndex = 1;
  bool _hasBeenUpdated = false;

  @override
  void initState() {
    super.initState();

    if (widget.selectedItems.isNotEmpty) {
      _hasBeenUpdated = widget.selectedItems.any((item) {
        final status = item['status_inspeksi'];
        final foto = item['foto_inspeksi'];
        bool hasStatus = status != null && status != 'Menunggu Inspeksi';
        bool hasFoto = foto != null && foto != '[]' && foto.toString().trim().isNotEmpty;
        return hasStatus || hasFoto;
      });
      // Jika semua item memiliki status yang sama, tampilkan. Jika tidak, default "Sesuai"
      final firstSt = widget.selectedItems.first['status_inspeksi'];
      final allSameSt = widget.selectedItems
          .every((item) => item['status_inspeksi'] == firstSt);
      if (allSameSt && (firstSt == 'Sesuai' || firstSt == 'Tidak Sesuai')) {
        _status = firstSt;
      }

      // Load foto jika semuanya memiliki foto yang sama
      final firstPhoto = widget.selectedItems.first['foto_inspeksi'];
      final allSamePhoto = widget.selectedItems
          .every((item) => item['foto_inspeksi'] == firstPhoto);

      if (allSamePhoto &&
          firstPhoto != null &&
          firstPhoto.toString().isNotEmpty) {
        try {
          final List<dynamic> parsed = jsonDecode(firstPhoto);
          _existingImages = parsed.map((e) => e.toString()).toList();
        } catch (e) {
          _existingImages = [firstPhoto.toString()];
        }
      }
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final pickedFile = await _picker.pickImage(
      source: source,
      imageQuality: 70,
      maxWidth: 1024,
    );

    if (pickedFile != null) {
      setState(() {
        _newImages.add(pickedFile);
      });
    }
  }

  Future<void> _pickMultiImageFromGallery() async {
    final pickedFiles = await _picker.pickMultiImage(
      imageQuality: 70,
      maxWidth: 1024,
    );

    if (pickedFiles.isNotEmpty) {
      setState(() {
        _newImages.addAll(pickedFiles);
      });
    }
  }

  void _removeNewImage(int index) {
    setState(() {
      _newImages.removeAt(index);
    });
  }

  void _removeExistingImage(int index) {
    setState(() {
      _existingImages.removeAt(index);
    });
  }

  void _showImagePreview(ImageProvider imageProvider) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          alignment: Alignment.center,
          children: [
            InteractiveViewer(
              minScale: 0.5,
              maxScale: 4.0,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image(image: imageProvider, fit: BoxFit.contain),
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitInspection() async {
    if (_status == null ||
        (_status != 'Tidak Perlu Dicek' &&
            _existingImages.isEmpty &&
            _newImages.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.t('warning_photo_status_required')),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);

    try {
      // Session is managed automatically by Supabase. No need to manual refresh.

      List<String> allPhotoUrls = List.from(_existingImages);

      // Upload all new images
      for (int i = 0; i < _newImages.length; i++) {
        final xfile = _newImages[i];
        final fileName =
            '${DateTime.now().millisecondsSinceEpoch}_${widget.nomorKontainer}_$i.jpg';
        final storagePath = 'inspeksi/$fileName';

        if (kIsWeb) {
          // Fix Web crash: Upload via REST API bypasses JS Interop CanvasKit errors
          final session = _supabase.auth.currentSession;
          if (session == null) throw Exception(AppLocale.t('session_expired'));
          
          final bytes = await xfile.readAsBytes();
          final url = Uri.parse('$supabaseUrl/storage/v1/object/inspeksi_foto/$storagePath');
          final request = http.Request('POST', url);
          request.headers['Authorization'] = 'Bearer ${session.accessToken}';
          request.headers['apikey'] = supabaseKey;
          request.headers['Content-Type'] = xfile.mimeType ?? 'image/jpeg';
          request.bodyBytes = bytes;
          
          final response = await request.send();
          if (response.statusCode >= 400) {
             final respStr = await response.stream.bytesToString();
             throw Exception('${AppLocale.t('upload_failed_web')} $respStr');
          }
        } else {
          await _supabase.storage.from('inspeksi_foto').upload(
                storagePath,
                File(xfile.path),
                fileOptions:
                    const FileOptions(cacheControl: '3600', upsert: true),
              );
        }

        final url =
            _supabase.storage.from('inspeksi_foto').getPublicUrl(storagePath);
        allPhotoUrls.add(url);
      }

      final photosJson = jsonEncode(allPhotoUrls);
      final currentTimestamp = DateTime.now().toIso8601String();

      // Fetch Staff Profile
      String idStaf = '';
      String namaStaf = '';
      try {
        final user = _supabase.auth.currentUser;
        if (user != null) {
          final profileData = await _supabase
              .from('profiles')
              .select('id_number, nama')
              .eq('id', user.id)
              .single();
          idStaf = profileData['id_number']?.toString() ?? '';
          namaStaf = profileData['nama']?.toString() ?? '';
        }
      } catch (e) {
        debugPrint('Gagal mengambil profil staf: $e');
      }
      // Ambil properti dari widget sebelum di-pop
      final itemsToUpdate = List<Map<String, dynamic>>.from(widget.selectedItems);
      final noKontainer = widget.nomorKontainer;
      final photosToShare = List<String>.from(allPhotoUrls);

      // 2. BULK UPDATE KE DATABASE DULU (Tunggu sampai selesai)
      for (var item in itemsToUpdate) {
        try {
          await _supabase.from('penerimaan_kapal').update({
            'status_inspeksi': _status,
            'foto_inspeksi': photosJson,
            'tanggal_inspeksi': currentTimestamp,
            'id_staf': idStaf,
            'nama_staf': namaStaf,
          }).eq('id', item['id']);
        } catch (updateError) {
          debugPrint('Update dengan id_staf gagal, mencoba fallback: $updateError');
          try {
            await _supabase.from('penerimaan_kapal').update({
              'status_inspeksi': _status,
              'foto_inspeksi': photosJson,
              'tanggal_inspeksi': currentTimestamp,
            }).eq('id', item['id']);
          } catch (fallbackError) {
            debugPrint('Fallback update juga gagal: $fallbackError');
            throw Exception('${AppLocale.t('error')}: $fallbackError');
          }
        }
      }

      // 3. Tampilkan sukses & tutup halaman (sekarang aman karena database sudah diupdate)
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(AppLocale.t('saving_multiple_data').replaceAll('{count}', itemsToUpdate.length.toString())),
            backgroundColor: const Color(0xFF10B981),
            duration: const Duration(seconds: 4),
          ),
        );
        nav.pop();
      }

      // 4. WECOM PUSH: Lakukan secara asinkron di latar belakang (Fire & Forget)
      Future.microtask(() async {

        // Push to WeCom after database update finishes
        try {
          final stafText = idStaf.isNotEmpty ? '$namaStaf/$idStaf' : namaStaf;

          // Extract nomor kapal from nama_file if available
          String noKapal = '';
          if (itemsToUpdate.isNotEmpty && itemsToUpdate.first.containsKey('nama_file')) {
            final namaFile = itemsToUpdate.first['nama_file']?.toString() ?? '';
            final cleanFileName = namaFile.replaceAll('.xlsx', '').replaceAll('.xls', '');
            final match = RegExp(r'\d+').firstMatch(cleanFileName);
            noKapal = match != null ? match.group(0)! : cleanFileName;
          }

          // Extract original_no and format
          List<int> numbers = itemsToUpdate
              .map((item) => (item['original_no'] as num?)?.toInt() ?? 0)
              .where((n) => n > 0)
              .toList();
          numbers.sort();
          String itemNumbersStr = _formatNumbers(numbers);

          String wecomStatus = '';
          if (_status == 'Sesuai') {
            wecomStatus = '[Sesuai / 合格]';
          } else if (_status == 'Tidak Sesuai') {
            wecomStatus = '[Tidak Sesuai / 不合格]';
          } else if (_status == 'Tidak Perlu Dicek') {
            wecomStatus = '[Barang Tidak Perlu Dicek / 物品无需检查]';
          }

          final text = 'v$noKapal $noKontainer $itemNumbersStr $wecomStatus'.trim();
          final fullText = '$stafText\n$text';

          // Masukkan payload ke antrean database
          await _supabase.from('wecom_queue').insert({
            'payload': {
              'text': fullText,
              'imageUrls': photosToShare,
            }
          });
          
          debugPrint('Laporan berhasil dimasukkan ke Antrean WeCom.');
          
          // Trigger pemrosesan antrean di latar belakang
          ShareService.processWecomQueue();
          
        } catch (wecomError) {
          debugPrint('WeCom Push Error: $wecomError');
        }
      });
    } catch (e) {
      debugPrint('ERROR ASLI: $e');
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('${AppLocale.t('failed')}: $e'),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 10),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String _formatNumbers(List<int> numbers) {
    if (numbers.isEmpty) return '';
    List<String> ranges = [];
    int start = numbers[0];
    int end = numbers[0];

    for (int i = 1; i < numbers.length; i++) {
      if (numbers[i] == end + 1) {
        end = numbers[i];
      } else {
        if (start == end) {
          ranges.add('$start');
        } else {
          ranges.add('$start-$end');
        }
        start = numbers[i];
        end = numbers[i];
      }
    }
    if (start == end) {
      ranges.add('$start');
    } else {
      ranges.add('$start-$end');
    }
    return ranges.join(', ');
  }

  Future<void> _resetInspection() async {
    setState(() {
      _isLoading = true;
    });

    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);

    try {
      // BULK UPDATE: Update semua baris yang dipilih menjadi 'Menunggu Inspeksi' dan foto kosong
      for (var item in widget.selectedItems) {
        await _supabase.from('penerimaan_kapal').update({
          'status_inspeksi': 'Menunggu Inspeksi',
          'foto_inspeksi': '[]',
          'tanggal_inspeksi': null,
        }).eq('id', item['id']);
      }

      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(AppLocale.t('reset_success')),
            backgroundColor: const Color(0xFFF59E0B),
          ),
        );
        nav.pop();
      }
    } catch (e) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('${AppLocale.t('reset_failed')}$e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    isDialOpen.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ObsidianScaffold(
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 8.0, right: 8.0),
        child: SpeedDial(
          buttonSize: const Size(48.0, 48.0),
          childrenButtonSize: const Size(48.0, 48.0),
          openCloseDial: isDialOpen,
          shape: const CircleBorder(),
          icon: Icons.menu,
          activeIcon: Icons.close,
          animationCurve: Curves.easeOutBack,
          animationDuration: const Duration(milliseconds: 300),
          spacing: 12,
          spaceBetweenChildren: 12,
          backgroundColor: Theme.of(context).colorScheme.primary,
          foregroundColor: Colors.white,
          overlayColor: Colors.transparent, // Transparan karena kita pakai BackdropFilter
        elevation: 8,
        children: [
          SpeedDialChild(
            shape: const CircleBorder(),
            child: _isLoading 
                ? SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
                : Icon(Icons.cloud_upload_outlined),
            backgroundColor: Colors.green,
            foregroundColor: Colors.white,
            label: AppLocale.t('save_upload'),
            labelStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
            onTap: _isLoading ? null : _submitInspection,
          ),
          SpeedDialChild(
            shape: const CircleBorder(),
            child: Icon(Icons.photo_library_outlined),
            backgroundColor: Colors.white,
            foregroundColor: Theme.of(context).colorScheme.primary,
            label: AppLocale.t('choose_from_gallery'),
            labelStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
            onTap: _pickMultiImageFromGallery,
          ),
          SpeedDialChild(
            shape: const CircleBorder(),
            child: Icon(Icons.camera_alt_outlined),
            backgroundColor: Colors.white,
            foregroundColor: Theme.of(context).colorScheme.primary,
            label: AppLocale.t('open_camera'),
            labelStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
            onTap: () => _pickImage(ImageSource.camera),
          ),
          if (_hasBeenUpdated)
            SpeedDialChild(
              shape: const CircleBorder(),
              child: Icon(Icons.refresh),
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              label: AppLocale.t('reset_data'),
              labelStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
              onTap: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: Text(AppLocale.t('reset_data_title'),
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
                    content: Text(AppLocale.t('reset_data_desc')),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: Text(AppLocale.t('cancel'))),
                      FilledButton(
                        style: FilledButton.styleFrom(
                            backgroundColor:
                                const Color(0xFFEF4444)),
                        onPressed: () {
                          Navigator.pop(context);
                          _resetInspection();
                        },
                        child: Text(AppLocale.t('yes_reset')),
                      ),
                    ],
                  ),
                );
              },
            ),
          if (!_hasBeenUpdated)
            SpeedDialChild(
              shape: const CircleBorder(),
              child: Icon(Icons.block),
              backgroundColor: const Color(0xFFFCD34D),
              foregroundColor: Colors.black,
              label: AppLocale.t('skip_item'),
              labelStyle: TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
              onTap: _isLoading
                  ? null
                  : () {
                      setState(() => _status = 'Tidak Perlu Dicek');
                      _submitInspection();
                    },
            ),
        ],
      ),
    ),
      body: Stack(
        children: [
          Column(
            children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Container Info Card
                  GlassCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: widget.selectedItems.length,
                          separatorBuilder: (context, index) => Divider(
                              color: Theme.of(context).dividerColor, height: 1),
                          itemBuilder: (context, index) {
                            final item = widget.selectedItems[index];
                            return InkWell(
                              onTap: () {
                                showDialog(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    title: Text(AppLocale.t('item_detail'),
                                        style: TextStyle(
                                            fontWeight: FontWeight.bold)),
                                    content: SingleChildScrollView(
                                      child: Text(
                                        item['nama_material']?.toString() ??
                                            AppLocale.t('no_name'),
                                        style: TextStyle(
                                            fontSize: 14, height: 1.5),
                                      ),
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: Text(AppLocale.t('close')),
                                      ),
                                    ],
                                  ),
                                );
                              },
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 32,
                                      alignment: Alignment.center,
                                      child: Text(
                                          '${item['original_no'] ?? index + 1}',
                                          style: TextStyle(
                                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                                              fontWeight: FontWeight.bold)),
                                    ),
                                    SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        item['nama_material']?.toString() ??
                                            AppLocale.t('no_name'),
                                        style: TextStyle(
                                            color: Theme.of(context).colorScheme.onSurface,
                                            fontSize: 13,
                                            height: 1.3),
                                        maxLines:
                                            widget.selectedItems.length == 1
                                                ? null
                                                : 3,
                                        overflow:
                                            widget.selectedItems.length == 1
                                                ? null
                                                : TextOverflow.ellipsis,
                                      ),
                                    ),
                                    SizedBox(width: 12),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: Theme.of(context).colorScheme.primary
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        item['jumlah_data']?.toString() ?? '-',
                                        style: TextStyle(
                                            color: Theme.of(context).colorScheme.primary,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 13),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 24),

                  // Grid Foto (Only show if there are photos)
                  if (_existingImages.isNotEmpty || _newImages.isNotEmpty) ...[
                    Text(AppLocale.t('documentation_photo'),
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    SizedBox(height: 12),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                      ),
                      itemCount: _existingImages.length + _newImages.length,
                      itemBuilder: (context, index) {
                        if (index < _existingImages.length) {
                          return Stack(
                            fit: StackFit.expand,
                            children: [
                              GestureDetector(
                                onTap: () => _showImagePreview(NetworkImage(_existingImages[index])),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(_existingImages[index],
                                      fit: BoxFit.cover),
                                ),
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: GestureDetector(
                                  onTap: () => _removeExistingImage(index),
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                        color: Colors.black54,
                                        shape: BoxShape.circle),
                                    child: Icon(Icons.close,
                                        color: Colors.white, size: 16),
                                  ),
                                ),
                              ),
                            ],
                          );
                        } else {
                          final fileIndex = index - _existingImages.length;
                          final imageProvider = kIsWeb
                              ? NetworkImage(_newImages[fileIndex].path) as ImageProvider
                              : FileImage(File(_newImages[fileIndex].path)) as ImageProvider;
                              
                          return Stack(
                            fit: StackFit.expand,
                            children: [
                              GestureDetector(
                                onTap: () => _showImagePreview(imageProvider),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image(image: imageProvider, fit: BoxFit.cover),
                                ),
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: GestureDetector(
                                  onTap: () => _removeNewImage(fileIndex),
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                        color: Colors.black54,
                                        shape: BoxShape.circle),
                                    child: Icon(Icons.close,
                                        color: Colors.white, size: 16),
                                  ),
                                ),
                              ),
                            ],
                          );
                        }
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Sticky Bottom Section (Status Dropdown Only)
          Container(
            padding: const EdgeInsets.fromLTRB(24, 16, 88, 24), // 88px right padding prevents overlap with FAB
            decoration: const BoxDecoration(
              color: Colors.transparent,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Theme.of(context).dividerColor),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              height: 48, // Tinggi disesuaikan dengan FAB yang baru
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  dropdownColor: Theme.of(context).colorScheme.surface,
                  value: ['Sesuai', 'Tidak Sesuai'].contains(_status) ? _status : null,
                  hint: Text(
                      _status == 'Tidak Perlu Dicek' ? AppLocale.t('not_need_check') : AppLocale.t('choose_status'),
                      style: TextStyle(
                          fontSize: 14,
                          color: _status == 'Tidak Perlu Dicek' ? Theme.of(context).colorScheme.onSurface : null,
                          fontWeight: _status == 'Tidak Perlu Dicek' ? FontWeight.w600 : null,
                      )),
                  isExpanded: true,
                  icon: Icon(Icons.expand_more,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                  items: [
                    DropdownMenuItem(
                        value: 'Sesuai',
                        child: Text('Sesuai / 合格',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 14))),
                    DropdownMenuItem(
                        value: 'Tidak Sesuai',
                        child: Text('Tidak Sesuai / 不合格',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 14))),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _status = val);
                  },
                ),
              ),
            ),
          ),
            ],
          ),
          ValueListenableBuilder<bool>(
            valueListenable: isDialOpen,
            builder: (context, isOpen, child) {
              if (!isOpen) return SizedBox.shrink();
              return Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8.0, sigmaY: 8.0),
                  child: Container(
                    color: Colors.black.withOpacity(0.4),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
