import 'dart:io';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import '../utils/route_observer.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_speed_dial/flutter_speed_dial.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import '../main.dart';
import 'dashboard_page.dart';
import '../widgets/obsidian_scaffold.dart';
import '../widgets/glass_card.dart';

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
  String get pageTitle => 'Inspeksi Barang';
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
                  icon: const Icon(Icons.close, color: Colors.white),
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
        const SnackBar(
          content: Text(
              'Peringatan: Status Barang dan Foto Dokumentasi wajib diisi!'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Validasi sesi aktif sebelum menyimpan data
      try {
        final res = await _supabase.auth.refreshSession();
        if (res.session == null) throw Exception("Sesi tidak valid");
      } catch (e) {
        await _supabase.auth.signOut();
        if (mounted) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (context) => const LoginPage()),
            (Route<dynamic> route) => false,
          );
        }
        return;
      }

      List<String> allPhotoUrls = List.from(_existingImages);

      // Upload all new images
      for (int i = 0; i < _newImages.length; i++) {
        final xfile = _newImages[i];
        final fileName =
            '${DateTime.now().millisecondsSinceEpoch}_${widget.nomorKontainer}_$i.jpg';
        final storagePath = 'inspeksi/$fileName';

        if (kIsWeb) {
          final bytes = await xfile.readAsBytes();
          await _supabase.storage.from('inspeksi_foto').uploadBinary(
                storagePath,
                bytes,
                fileOptions:
                    const FileOptions(cacheControl: '3600', upsert: true),
              );
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
          idStaf = profileData['id_number'] ?? '';
          namaStaf = profileData['nama'] ?? '';
        }
      } catch (e) {
        debugPrint('Gagal mengambil profil staf: $e');
      }

      // Tampilkan pemberitahuan dan langsung tutup halaman agar user bisa lanjut bekerja
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Memproses ${widget.selectedItems.length} data di latar belakang. Silakan lanjut bekerja!'),
            backgroundColor: const Color(0xFF3E90FF),
            duration: const Duration(seconds: 4),
          ),
        );
        Navigator.pop(context);
      }

      // BULK UPDATE: Lakukan secara asinkron di latar belakang (Fire & Forget)
      Future.microtask(() async {
        for (var item in widget.selectedItems) {
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
            } catch (_) {}
          }
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menyimpan: $e'),
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

  Future<void> _resetInspection() async {
    setState(() {
      _isLoading = true;
    });

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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Data inspeksi berhasil direset!'),
            backgroundColor: Color(0xFFF59E0B),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mereset: $e'),
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
          backgroundColor: const Color(0xFF3E90FF),
          foregroundColor: Colors.white,
          overlayColor: Colors.transparent, // Transparan karena kita pakai BackdropFilter
        elevation: 8,
        children: [
          SpeedDialChild(
            shape: const CircleBorder(),
            child: _isLoading 
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
                : const Icon(Icons.cloud_upload_outlined),
            backgroundColor: Colors.green,
            foregroundColor: Colors.white,
            label: 'Simpan / Upload',
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
            onTap: _isLoading ? null : _submitInspection,
          ),
          SpeedDialChild(
            shape: const CircleBorder(),
            child: const Icon(Icons.photo_library_outlined),
            backgroundColor: Colors.white,
            foregroundColor: const Color(0xFF3E90FF),
            label: 'Pilih dari Galeri',
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
            onTap: () => _pickImage(ImageSource.gallery),
          ),
          SpeedDialChild(
            shape: const CircleBorder(),
            child: const Icon(Icons.camera_alt_outlined),
            backgroundColor: Colors.white,
            foregroundColor: const Color(0xFF3E90FF),
            label: 'Buka Kamera',
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
            onTap: () => _pickImage(ImageSource.camera),
          ),
          if (_hasBeenUpdated)
            SpeedDialChild(
              shape: const CircleBorder(),
              child: const Icon(Icons.refresh),
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              label: 'Reset Data',
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
              onTap: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Reset Data?',
                        style: TextStyle(color: Colors.white)),
                    content: const Text(
                        'Apakah Anda yakin ingin menghapus foto dan mereset status barang ini?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Batal')),
                      FilledButton(
                        style: FilledButton.styleFrom(
                            backgroundColor:
                                const Color(0xFFEF4444)),
                        onPressed: () {
                          Navigator.pop(context);
                          _resetInspection();
                        },
                        child: const Text('Ya, Reset'),
                      ),
                    ],
                  ),
                );
              },
            ),
          if (!_hasBeenUpdated)
            SpeedDialChild(
              shape: const CircleBorder(),
              child: const Icon(Icons.block),
              backgroundColor: const Color(0xFFFCD34D),
              foregroundColor: Colors.black,
              label: 'Skip Barang',
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black),
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
                          separatorBuilder: (context, index) => const Divider(
                              color: Color(0xFF414754), height: 1),
                          itemBuilder: (context, index) {
                            final item = widget.selectedItems[index];
                            return InkWell(
                              onTap: () {
                                showDialog(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    title: const Text('Detail Barang',
                                        style: TextStyle(
                                            fontWeight: FontWeight.bold)),
                                    content: SingleChildScrollView(
                                      child: Text(
                                        item['nama_material']?.toString() ??
                                            '-',
                                        style: const TextStyle(
                                            fontSize: 14, height: 1.5),
                                      ),
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(context),
                                        child: const Text('Tutup'),
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
                                          style: const TextStyle(
                                              color: Color(0xFFC0C6D6),
                                              fontWeight: FontWeight.bold)),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        item['nama_material']?.toString() ??
                                            '-',
                                        style: const TextStyle(
                                            color: Color(0xFFE0E2ED),
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
                                    const SizedBox(width: 12),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF3E90FF)
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        item['jumlah_data']?.toString() ?? '-',
                                        style: const TextStyle(
                                            color: Color(0xFFAAC7FF),
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
                  const SizedBox(height: 24),

                  // Grid Foto (Only show if there are photos)
                  if (_existingImages.isNotEmpty || _newImages.isNotEmpty) ...[
                    const Text('Foto Dokumentasi',
                        style: TextStyle(
                            color: Color(0xFFE0E2ED),
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    const SizedBox(height: 12),
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
                                    child: const Icon(Icons.close,
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
                                    child: const Icon(Icons.close,
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
                color: const Color(0xFF181C23),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF414754)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              height: 48, // Tinggi disesuaikan dengan FAB yang baru
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  dropdownColor: const Color(0xFF181C23),
                  value: ['Sesuai', 'Tidak Sesuai'].contains(_status) ? _status : null,
                  hint: Text(
                      _status == 'Tidak Perlu Dicek' ? '⏭️ Tidak Perlu Dicek' : 'Pilih Status Inspeksi',
                      style: TextStyle(
                          fontSize: 14,
                          color: _status == 'Tidak Perlu Dicek' ? const Color(0xFFE0E2ED) : null,
                          fontWeight: _status == 'Tidak Perlu Dicek' ? FontWeight.w600 : null,
                      )),
                  isExpanded: true,
                  icon: const Icon(Icons.expand_more,
                      color: Color(0xFFC0C6D6)),
                  items: const [
                    DropdownMenuItem(
                        value: 'Sesuai',
                        child: Text('✅ Sesuai',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFE0E2ED),
                                fontSize: 14))),
                    DropdownMenuItem(
                        value: 'Tidak Sesuai',
                        child: Text('❌ Tidak Sesuai',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFE0E2ED),
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
              if (!isOpen) return const SizedBox.shrink();
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
