import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/obsidian_scaffold.dart';
import '../widgets/obsidian_scaffold.dart';
import '../utils/share_service.dart';
import '../utils/app_locale.dart';

class AdminContainerDetailPage extends StatefulWidget {
  final String namaFile;
  const AdminContainerDetailPage({super.key, required this.namaFile});

  @override
  State<AdminContainerDetailPage> createState() => _AdminContainerDetailPageState();
}

class _AdminContainerDetailPageState extends State<AdminContainerDetailPage> {
  bool _isLoading = true;
  String _errorMessage = '';
  
  // Group items by nomor_kontainer
  Map<String, List<Map<String, dynamic>>> _containerGroups = {};

  @override
  void initState() {
    super.initState();
    _loadItems();
  }

  Future<void> _loadItems() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final response = await supabase
          .from('penerimaan_kapal')
          .select('*')
          .eq('nama_file', widget.namaFile);

      final List<dynamic> data = response as List<dynamic>;

      final Map<String, List<Map<String, dynamic>>> groups = {};

      for (var row in data) {
        final container = row['nomor_kontainer']?.toString() ?? AppLocale.t('no_container');
        if (!groups.containsKey(container)) {
          groups[container] = [];
        }
        groups[container]!.add(row as Map<String, dynamic>);
      }

      // Sort items inside each container by ID or row number
      for (var key in groups.keys) {
        groups[key]!.sort((a, b) {
          final idA = a['id'] as int? ?? 0;
          final idB = b['id'] as int? ?? 0;
          return idA.compareTo(idB);
        });
      }

      if (mounted) {
        setState(() {
          _containerGroups = groups;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    final cleanFileName = widget.namaFile.replaceAll('.xlsx', '').replaceAll('.xls', '');

    return ObsidianScaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(AppLocale.t('container_detail'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
            Text(cleanFileName, style: TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _errorMessage.isNotEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      '${AppLocale.t('failed_load_data')}$_errorMessage',
                      style: TextStyle(color: Colors.redAccent),
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : _containerGroups.isEmpty
                  ? Center(
                      child: Text(
                        AppLocale.t('no_items_found'),
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _containerGroups.length,
                      itemBuilder: (context, index) {
                        final containerNumber = _containerGroups.keys.elementAt(index);
                        final items = _containerGroups[containerNumber]!;

                        return Card(
                          color: Theme.of(context).colorScheme.surface,
                          elevation: 4,
                          margin: const EdgeInsets.only(bottom: 24),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Color(0xFF2C313D)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Container Header
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF1F242D),
                                  borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLocale.t('container_number'),
                                            style: TextStyle(
                                              color: Colors.white54,
                                              fontSize: 12,
                                            ),
                                          ),
                                          SizedBox(height: 4),
                                          Text(
                                            containerNumber,
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              
                              // List of Items
                              ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: items.length,
                                separatorBuilder: (context, index) => Divider(
                                  color: Color(0xFF2C313D),
                                  height: 1,
                                ),
                                itemBuilder: (context, itemIndex) {
                                  final item = items[itemIndex];
                                  final material = item['nama_material']?.toString() ?? AppLocale.t('item_without_name');
                                  final status = item['status_inspeksi']?.toString() ?? 'Menunggu Inspeksi';
                                  final ket = item['keterangan']?.toString() ?? '-';
                                  final hasPhoto = item['foto_barang'] != null && item['foto_barang'].toString().isNotEmpty;

                                  return Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Item details
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                material,
                                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                              ),
                                              SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: status.toLowerCase().contains('ok') 
                                                          ? Colors.green.withOpacity(0.2)
                                                          : (status == 'Menunggu Inspeksi' ? Colors.grey.withOpacity(0.2) : Colors.red.withOpacity(0.2)),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(
                                                      status,
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        color: status.toLowerCase().contains('ok') 
                                                            ? Colors.greenAccent
                                                            : (status == 'Menunggu Inspeksi' ? Colors.white70 : Colors.redAccent),
                                                      ),
                                                    ),
                                                  ),
                                                  if (hasPhoto) ...[
                                                    SizedBox(width: 8),
                                                    Icon(Icons.image, size: 14, color: Colors.blueAccent),
                                                  ]
                                                ],
                                              ),
                                              if (ket != '-') ...[
                                                SizedBox(height: 4),
                                                Text(
                                                  '${AppLocale.t('info')}$ket',
                                                  style: TextStyle(fontSize: 12, color: Colors.white60),
                                                ),
                                              ]
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
