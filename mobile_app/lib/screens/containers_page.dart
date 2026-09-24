import 'package:flutter/material.dart';
import '../utils/route_observer.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import '../main.dart';
import 'items_page.dart';
import 'dashboard_page.dart';
import '../widgets/obsidian_scaffold.dart';
import '../widgets/glass_card.dart';
import '../utils/app_locale.dart';

class ContainersPage extends StatefulWidget {
  final String namaFile;
  final String cleanName;

  const ContainersPage({
    super.key,
    required this.namaFile,
    required this.cleanName,
  });

  @override
  State<ContainersPage> createState() => _ContainersPageState();
}

class _ContainersPageState extends State<ContainersPage> with RouteAware, TitleUpdater<ContainersPage> {
  @override
  String get pageTitle => AppLocale.t('container_list');
  @override
  String? get pageSubtitle => widget.cleanName;
  bool _isLoading = true;
  List<Map<String, dynamic>> _containers = [];
  int _selectedIndex = 1;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchContainers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchContainers() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
    });

    try {
      List<dynamic> allData = [];
      bool hasMore = true;
      int from = 0;
      const int limit = 1000;

      while (hasMore) {
        final response = await supabase
            .from('penerimaan_kapal')
            .select('nomor_kontainer, status_inspeksi, tanggal_inspeksi')
            .eq('nama_file', widget.namaFile)
            .range(from, from + limit - 1);
            
        final List<dynamic> batch = response as List<dynamic>;
        allData.addAll(batch);
        from += limit;
        if (batch.length < limit) {
          hasMore = false;
        }
      }

      final Map<String, Map<String, dynamic>> containerMap = {};

      for (var row in allData) {
        var containerNo = row['nomor_kontainer']?.toString();
        if (containerNo == null || containerNo.trim().isEmpty) {
          containerNo = AppLocale.t('no_container');
        }
        final status = row['status_inspeksi'] ?? 'Menunggu Inspeksi';
        final tgl = row['tanggal_inspeksi'];

        if (!containerMap.containsKey(containerNo)) {
          containerMap[containerNo] = {
            'nomor_kontainer': containerNo,
            'tipe': '-',
            'total_items': 0,
            'completed_items': 0,
            'latest_date': DateTime.fromMillisecondsSinceEpoch(0),
          };
        }

        containerMap[containerNo]!['total_items'] += 1;
        
        if (status == 'Sesuai' || status == 'Tidak Sesuai' || status == 'Tidak Perlu Dicek') {
          containerMap[containerNo]!['completed_items'] += 1;
        }
        
        if (tgl != null) {
          try {
            final parsedDate = DateTime.parse(tgl.toString().replaceAll(RegExp(r'(Z|\+00:00|\+00)$'), ''));
            final currentMax = containerMap[containerNo]!['latest_date'] as DateTime;
            if (parsedDate.isAfter(currentMax)) {
              containerMap[containerNo]!['latest_date'] = parsedDate;
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
                return dateB.compareTo(dateA); // Descending (terbaru di atas)
              }

              return a['nomor_kontainer'].compareTo(b['nomor_kontainer']);
            });
        });
      }
    } catch (e) {
      if (mounted) {
        if (_containers.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(AppLocale.t('connection_unstable'))),
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
    final displayedContainers = _searchQuery.isEmpty 
        ? _containers 
        : _containers.where((c) => c['nomor_kontainer'].toString().toLowerCase().contains(_searchQuery.toLowerCase())).toList();

    return ObsidianScaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ValueListenableBuilder<bool>(
            valueListenable: globalSearchActive,
            builder: (context, isSearchActive, child) {
              if (!isSearchActive) return SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: TextField(
                  controller: _searchController,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                decoration: InputDecoration(
                  hintText: AppLocale.t('search_container'),
                  hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                  prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  suffixIcon: _searchQuery.isNotEmpty 
                      ? IconButton(
                          icon: Icon(Icons.clear, color: Theme.of(context).colorScheme.onSurfaceVariant),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = '';
                            });
                          },
                        ) 
                      : null,
                  filled: true,
                  fillColor: Theme.of(context).colorScheme.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
              ),
            );
            },
          ),
          // List Content
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary))
                : displayedContainers.isEmpty
                    ? Center(child: Text(AppLocale.t('no_container_found'), style: TextStyle(color: Colors.grey)))
                    : RefreshIndicator(
                        onRefresh: _fetchContainers,
                        color: Theme.of(context).colorScheme.primary,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(24),
                          itemCount: displayedContainers.length,
                          itemBuilder: (context, index) {
                            final container = displayedContainers[index];
                            final total = container['total_items'] as int;
                            final completed = container['completed_items'] as int;
                            final double progress = total > 0 ? completed / total : 0.0;
                            final int progressPercent = (progress * 100).round();
                            
                            final latestDate = container['latest_date'] as DateTime;
                            String latestDateStr = AppLocale.t('not_updated_yet');
                            if (latestDate.millisecondsSinceEpoch > 0) {
                              latestDateStr = '${latestDate.day.toString().padLeft(2, '0')}/${latestDate.month.toString().padLeft(2, '0')}/${latestDate.year} ${latestDate.hour.toString().padLeft(2, '0')}:${latestDate.minute.toString().padLeft(2, '0')}';
                            }

                            return GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => ItemsPage(
                                      namaFile: widget.namaFile,
                                      nomorKontainer: container['nomor_kontainer'],
                                      tipe: container['tipe'],
                                    ),
                                  ),
                                ).then((_) => _fetchContainers()); // Refresh upon return
                              },
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 16.0),
                                child: GlassCard(
                                  padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(
                                        color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Icon(Icons.inventory_2, color: Theme.of(context).colorScheme.primary, size: 24),
                                    ),
                                    SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            container['nomor_kontainer'],
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: Theme.of(context).colorScheme.onSurface,
                                            ),
                                          ),
                                          SizedBox(height: 2),
                                          Text(
                                            '${AppLocale.t('type')}: ${container['tipe']} • $total ${AppLocale.t('item')}',
                                            style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
                                          ),
                                          SizedBox(height: 2),
                                          Row(
                                            children: [
                                              Icon(Icons.access_time, size: 12, color: Color(0xFF8B91A0)),
                                              SizedBox(width: 4),
                                              Text(
                                                '${AppLocale.t('update')}: $latestDateStr',
                                                style: TextStyle(fontSize: 11, color: Color(0xFF8B91A0)),
                                              ),
                                            ],
                                          ),
                                          SizedBox(height: 12),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Flexible(
                                                child: Text(
                                                  '$completed/$total ${AppLocale.t('items_inspected')}',
                                                  style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              SizedBox(width: 4),
                                              Text(
                                                '$progressPercent%',
                                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary),
                                              ),
                                            ],
                                          ),
                                          SizedBox(height: 6),
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(4),
                                            child: LinearProgressIndicator(
                                              value: progress,
                                              backgroundColor: const Color(0xFF31353D),
                                              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF33A9FF)),
                                              minHeight: 6,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    SizedBox(width: 8),
                                    Icon(Icons.chevron_right, color: Theme.of(context).dividerColor, size: 20),
                                    ],
                                  ),
                                ),
                                ),
                              );
                          },
                        ),
                      ),
          ),
        ],
      ),
      );
  }
}
