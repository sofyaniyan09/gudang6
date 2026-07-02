import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../main.dart';
import '../widgets/glass_card.dart';
import 'containers_page.dart';
import '../utils/route_observer.dart';

class ShipTab extends StatefulWidget {
  const ShipTab({super.key});

  @override
  State<ShipTab> createState() => _ShipTabState();
}

class _ShipTabState extends State<ShipTab> with RouteAware, TitleUpdater<ShipTab> {
  RealtimeChannel? _realtimeChannel;
  @override
  String get pageTitle => 'Daftar Armada';

  bool _isLoading = true;
  List<Map<String, dynamic>> _ships = [];

  @override
  void initState() {
    super.initState();
    _fetchShips();
    _setupRealtime();
  }

  void _setupRealtime() {
    _realtimeChannel = supabase.channel('public:penerimaan_kapal_ships')
      ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'penerimaan_kapal',
          callback: (payload) {
            print('Realtime update received in ShipTab');
            _fetchShips();
          })
      ..subscribe();
  }
  
  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _fetchShips() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
    });

    try {
      List<dynamic> allRows = [];
      int from = 0;
      const int limit = 1000;
      bool hasMore = true;

      while (hasMore) {
        final response = await supabase
            .from('penerimaan_kapal')
            .select('nama_file, nomor_kontainer, status_inspeksi')
            .range(from, from + limit - 1);
            
        final List<dynamic> data = response;
        allRows.addAll(data);

        if (data.length < limit) {
          hasMore = false;
        } else {
          from += limit;
        }
      }

      final Map<String, Map<String, dynamic>> shipDataMap = {};

      for (var row in allRows) {
        final rawName = row['nama_file']?.toString() ?? '';
        final cleanName = _cleanShipName(rawName);

        if (cleanName.isNotEmpty) {
          if (!shipDataMap.containsKey(cleanName)) {
            shipDataMap[cleanName] = {
              'raw_nama_file': rawName,
              'clean_name': cleanName,
              'total_items': 0,
              'inspected_items': 0,
              'containers': <String>{},
            };
          }
          
          final map = shipDataMap[cleanName]!;
          map['total_items'] = (map['total_items'] as int) + 1;
          
          final status = row['status_inspeksi']?.toString() ?? '';
          if (status != '' && status != 'Menunggu Inspeksi' && status != '-') {
            map['inspected_items'] = (map['inspected_items'] as int) + 1;
          }
          
          final containerNo = row['nomor_kontainer']?.toString() ?? '';
          if (containerNo.isNotEmpty) {
            (map['containers'] as Set<String>).add(containerNo);
          }
        }
      }
      
      final uniqueShips = shipDataMap.values.toList();

      if (mounted) {
        setState(() {
          _ships = uniqueShips;
        });
      }
    } catch (e) {
      if (mounted && _ships.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Koneksi tidak stabil. Gagal memuat data kapal.'),
            backgroundColor: Colors.redAccent,
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

  String _cleanShipName(String rawName) {
    if (rawName.isEmpty) return '';
    return rawName.replaceAll(RegExp(r'\.[^.]+$'), '');
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFFAAC7FF)))
                : _ships.isEmpty
                    ? const Center(
                        child: Text('Belum ada data armada kapal.',
                            style: TextStyle(color: Colors.grey)))
                    : RefreshIndicator(
                        onRefresh: _fetchShips,
                        color: const Color(0xFF0057C2),
                        child: ListView.builder(
                          padding: const EdgeInsets.all(24),
                          itemCount: _ships.length,
                          itemBuilder: (context, index) {
                            final ship = _ships[index];

                            return GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => ContainersPage(
                                      namaFile: ship['raw_nama_file'],
                                      cleanName: ship['clean_name'],
                                    ),
                                  ),
                                );
                              },
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 16.0),
                                child: GlassCard(
                                  padding: const EdgeInsets.all(16),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 56,
                                        height: 56,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF3E90FF)
                                              .withOpacity(0.2),
                                          borderRadius:
                                              BorderRadius.circular(16),
                                        ),
                                        child: const Icon(
                                            Icons.directions_boat_filled_rounded,
                                            color: Color(0xFFAAC7FF),
                                            size: 28),
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              ship['clean_name'],
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFFE0E2ED),
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              '${(ship['containers'] as Set<String>).length} Kontainer',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: const Color(0xFFE0E2ED)
                                                    .withOpacity(0.6),
                                              ),
                                            ),
                                            const SizedBox(height: 12),
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: LinearProgressIndicator(
                                                    value: (ship['total_items'] as int) > 0 ? ((ship['inspected_items'] as int) / (ship['total_items'] as int)) : 0.0,
                                                    backgroundColor: Colors.white.withOpacity(0.1),
                                                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF3E90FF)),
                                                    minHeight: 4,
                                                    borderRadius: BorderRadius.circular(2),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Text(
                                                  '${(ship['total_items'] as int) > 0 ? (((ship['inspected_items'] as int) / (ship['total_items'] as int)) * 100).round() : 0}%',
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFFE0E2ED),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.chevron_right,
                                          color: Color(0xFFAAC7FF)),
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
