import 'package:flutter/material.dart';
import '../utils/route_observer.dart';
import '../main.dart';
import 'items_page.dart';
import '../widgets/obsidian_scaffold.dart';
import '../widgets/glass_card.dart';
import '../utils/app_locale.dart';

class ScannedContainersPage extends StatefulWidget {
  final String scannedItemName;

  const ScannedContainersPage({
    super.key,
    required this.scannedItemName,
  });

  @override
  State<ScannedContainersPage> createState() => _ScannedContainersPageState();
}

class _ScannedContainersPageState extends State<ScannedContainersPage> with RouteAware, TitleUpdater<ScannedContainersPage> {
  @override
  String get pageTitle => AppLocale.t('scan_result');
  @override
  String? get pageSubtitle => widget.scannedItemName;
  
  bool _isLoading = true;
  List<Map<String, dynamic>> _containers = [];

  @override
  void initState() {
    super.initState();
    _fetchContainers();
  }

  Future<void> _fetchContainers() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
    });

    try {
      final response = await supabase
          .from('penerimaan_kapal')
          .select('nama_file, nomor_kontainer, status_inspeksi, tanggal_inspeksi')
          // Using ilike to make it case-insensitive and allow partial matches
          // But since OCR might have small typos, exact or ilike might be tricky
          // For now we use ilike to find matches containing the string or exactly matching.
          .ilike('nama_material', '%${widget.scannedItemName}%');
          
      final List<dynamic> data = response as List<dynamic>;

      // Group by nama_file + nomor_kontainer
      final Map<String, Map<String, dynamic>> containerMap = {};

      for (var row in data) {
        var containerNo = row['nomor_kontainer']?.toString();
        if (containerNo == null || containerNo.trim().isEmpty) {
          containerNo = 'Tanpa Kontainer';
        }
        final namaFile = row['nama_file']?.toString() ?? 'Tanpa File';
        final status = row['status_inspeksi'] ?? 'Menunggu Inspeksi';
        final tgl = row['tanggal_inspeksi'];

        final key = '${namaFile}_$containerNo';

        if (!containerMap.containsKey(key)) {
          containerMap[key] = {
            'nama_file': namaFile,
            'nomor_kontainer': containerNo,
            'tipe': '-',
            'total_items': 0,
            'completed_items': 0,
            'latest_date': DateTime.fromMillisecondsSinceEpoch(0),
          };
        }

        containerMap[key]!['total_items'] += 1;
        
        if (status == 'Sesuai' || status == 'Tidak Sesuai' || status == 'Tidak Perlu Dicek') {
          containerMap[key]!['completed_items'] += 1;
        }
        
        if (tgl != null) {
          try {
            final parsedDate = DateTime.parse(tgl.toString().replaceAll(RegExp(r'(Z|\+00:00|\+00)$'), ''));
            final currentMax = containerMap[key]!['latest_date'] as DateTime;
            if (parsedDate.isAfter(currentMax)) {
              containerMap[key]!['latest_date'] = parsedDate;
            }
          } catch (_) {}
        }
      }

      if (mounted) {
        setState(() {
          _containers = containerMap.values.toList()
            ..sort((a, b) {
              final totalA = a['total_items'] as int;
              final compA = a['completed_items'] as int;
              final isA100 = totalA > 0 && totalA == compA;

              final totalB = b['total_items'] as int;
              final compB = b['completed_items'] as int;
              final isB100 = totalB > 0 && totalB == compB;

              if (isA100 && !isB100) return -1;
              if (!isA100 && isB100) return 1;

              final dateA = a['latest_date'] as DateTime;
              final dateB = b['latest_date'] as DateTime;

              if (dateA != dateB) {
                return dateB.compareTo(dateA);
              }

              return a['nomor_kontainer'].compareTo(b['nomor_kontainer']);
            });
        });
      }
    } catch (e) {
      if (mounted) {
        if (_containers.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(AppLocale.t('scanned_containers_error'))),
          );
        }
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
  Widget build(BuildContext context) {
    return ObsidianScaffold(
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary))
          : _containers.isEmpty
              ? Center(
                  child: Text(
                    AppLocale.t('no_container_for_item'),
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  itemCount: _containers.length,
                  itemBuilder: (context, index) {
                    final container = _containers[index];
                    final total = container['total_items'] as int;
                    final completed = container['completed_items'] as int;
                    final progress = total > 0 ? completed / total : 0.0;
                    final containerNo = container['nomor_kontainer'];
                    final namaFile = container['nama_file'];
                    
                    final latestDate = container['latest_date'] as DateTime;
                    String latestDateStr = AppLocale.t('not_updated');
                    if (latestDate.millisecondsSinceEpoch > 0) {
                      latestDateStr = '${latestDate.day.toString().padLeft(2, '0')}/${latestDate.month.toString().padLeft(2, '0')}/${latestDate.year} ${latestDate.hour.toString().padLeft(2, '0')}:${latestDate.minute.toString().padLeft(2, '0')}';
                    }

                    return GlassCard(
                      child: ListTile(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ItemsPage(
                                namaFile: namaFile,
                                nomorKontainer: containerNo,
                                tipe: container['tipe'],
                                highlightItemName: widget.scannedItemName,
                              ),
                            ),
                          );
                        },
                        title: Text(
                          containerNo,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(height: 4),
                            Text(
                              namaFile,
                              style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 12),
                            ),
                            SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: progress,
                                backgroundColor: const Color(0xFF2A2F3D),
                                color: progress == 1.0 ? Colors.green : Theme.of(context).colorScheme.primary,
                                minHeight: 6,
                              ),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  AppLocale.t('inspected_progress').replaceAll('{completed}', completed.toString()).replaceAll('{total}', total.toString()),
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                                    fontSize: 12,
                                  ),
                                ),
                                Row(
                                  children: [
                                    Icon(Icons.access_time, size: 12, color: Color(0xFF8B91A0)),
                                    SizedBox(width: 4),
                                    Text(
                                      latestDateStr,
                                      style: TextStyle(
                                        color: Color(0xFF8B91A0),
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                        trailing: Icon(
                          Icons.chevron_right,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
