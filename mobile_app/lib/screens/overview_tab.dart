import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:fl_chart/fl_chart.dart';
import '../main.dart';
import '../widgets/glass_card.dart';
import 'package:intl/intl.dart';
import 'items_page.dart';

class OverviewTab extends StatefulWidget {
  const OverviewTab({super.key});

  @override
  State<OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends State<OverviewTab> {
  RealtimeChannel? _realtimeChannel;
  bool _isLoading = true;

  // Pie Chart Data
  int _totalContainers = 0;
  int _selesai = 0;
  int _onProses = 0;
  int _belumDiupdate = 0;

  // Ongoing Updates List
  List<Map<String, dynamic>> _ongoingUpdates = [];

  // Bar Chart Data
  List<Map<String, dynamic>> _dailyActivity = [];

  @override
  void initState() {
    super.initState();
    _fetchOverviewData();
    _setupRealtime();
  }

  void _setupRealtime() {
    _realtimeChannel = supabase.channel('public:penerimaan_kapal')
      ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'penerimaan_kapal',
          callback: (payload) {
            print('Realtime update received in OverviewTab: ${payload.toString()}');
            _fetchOverviewData();
          })
      ..subscribe();
  }
  
  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _fetchOverviewData() async {
    // Hanya tampilkan loading layar penuh jika data masih kosong (pertama kali buka)
    if (_ongoingUpdates.isEmpty) {
      setState(() {
        _isLoading = true;
      });
    }

    try {
      // Fetch up to 2000 items to get a good picture of the data
      // For a real production app, we should use a backend RPC call or aggregation view.
      List<dynamic> allRows = [];
      int from = 0;
      const int limit = 1000;
      bool hasMore = true;

      while (hasMore) {
        final response = await supabase
            .from('penerimaan_kapal')
            .select('nama_file, nomor_kontainer, status_inspeksi, tanggal_inspeksi, created_at')
            .range(from, from + limit - 1);
            
        final List<dynamic> data = response;
        allRows.addAll(data);

        if (data.length < limit) {
          hasMore = false;
        } else {
          from += limit;
        }
      }

      Map<String, Map<String, dynamic>> containerMap = {};

      for (var row in allRows) {
        final file = row['nama_file']?.toString() ?? 'Tanpa File';
        final noKontainer =
            row['nomor_kontainer']?.toString() ?? 'Tanpa Kontainer';
        final key = '${file}_${noKontainer}';

        if (!containerMap.containsKey(key)) {
          containerMap[key] = {
            'file': file,
            'kontainer': noKontainer,
            'tipe': row['tipe']?.toString() ?? '',
            'totalItems': 0,
            'inspectedItems': 0,
            'latestUpdate': null,
          };
        }

        containerMap[key]!['totalItems'] =
            (containerMap[key]!['totalItems'] as int) + 1;

        final status = row['status_inspeksi']?.toString() ?? '';
        
        if (row['created_at'] != null) {
          try {
            final createDate = DateTime.parse(row['created_at'].toString()).toLocal();
            final currentLatest = containerMap[key]!['latestUpdate'] as DateTime?;
            if (currentLatest == null || createDate.isAfter(currentLatest)) {
              containerMap[key]!['latestUpdate'] = createDate;
            }
          } catch (e) {
            // ignore
          }
        }

        // Note: Do not ignore 'Belum Diupdate' here to match Web Dashboard logic
        if (status != '' &&
            status != 'Menunggu Inspeksi' &&
            status != '-') {
          containerMap[key]!['inspectedItems'] =
              (containerMap[key]!['inspectedItems'] as int) + 1;

          if (row['tanggal_inspeksi'] != null) {
            try {
              final itemDate =
                  DateTime.parse(row['tanggal_inspeksi'].toString().replaceAll(RegExp(r'(Z|\+00:00|\+00)$'), '')).toLocal();
              final currentLatest =
                  containerMap[key]!['latestUpdate'] as DateTime?;
              if (currentLatest == null || itemDate.isAfter(currentLatest)) {
                containerMap[key]!['latestUpdate'] = itemDate;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      int total = containerMap.length;
      int selesai = 0;
      int onProses = 0;
      int belum = 0;
      Map<String, int> dailyCounts = {};

      List<Map<String, dynamic>> ongoingList = [];

      for (var container in containerMap.values) {
        final inspected = container['inspectedItems'] as int;
        final totalItems = container['totalItems'] as int;
        final latestUpdate = container['latestUpdate'] as DateTime?;

        if (inspected == 0) {
          belum++;
        } else if (inspected == totalItems) {
          selesai++;
        } else {
          onProses++;
          // Add to ongoing list
          ongoingList.add({
            'nama_file': container['file'],
            'nomor_kontainer': container['kontainer'],
            'tipe': container['tipe'],
            'status_inspeksi': 'On Proses',
            'tanggal_inspeksi': latestUpdate?.toIso8601String() ?? '',
            'progress': '${inspected}/${totalItems}',
            'percentage': (inspected / totalItems * 100).round(),
          });
        }

        // Aggregate daily activity for any updated container
        if (inspected > 0 && latestUpdate != null) {
          final dateStr = DateFormat('yyyy-MM-dd').format(latestUpdate);
          dailyCounts[dateStr] = (dailyCounts[dateStr] ?? 0) + 1;
        }
      }

      // Sort ongoing list by percentage descending
      ongoingList.sort((a, b) {
        final pctA = a['percentage'] as int? ?? 0;
        final pctB = b['percentage'] as int? ?? 0;
        return pctB.compareTo(pctA); // descending
      });

      // Limit to latest 10
      if (ongoingList.length > 10) {
        ongoingList = ongoingList.sublist(0, 10);
      }

      // Prepare 7 days buckets
      final today = DateTime.now();
      final todayStart = DateTime(today.year, today.month, today.day);
      List<Map<String, dynamic>> activity = [];
      
      String getDayName(int weekday) {
        switch (weekday) {
          case 1: return 'Sen';
          case 2: return 'Sel';
          case 3: return 'Rab';
          case 4: return 'Kam';
          case 5: return 'Jum';
          case 6: return 'Sab';
          case 7: return 'Min';
          default: return '';
        }
      }

      for (int i = 6; i >= 0; i--) {
        final d = todayStart.subtract(Duration(days: i));
        final dateStr = DateFormat('yyyy-MM-dd').format(d);
        final label = i == 0 ? 'Hari Ini' : getDayName(d.weekday);
        activity.add({
          'date': dateStr,
          'label': label,
          'val': 0, // Number of containers updated
        });
      }

      // Add to daily activity
      for (var container in containerMap.values) {
        final inspected = container['inspectedItems'] as int;
        final total = container['totalItems'] as int;
        final latestUpdate = container['latestUpdate'] as DateTime?;

        if (inspected > 0 && inspected == total && latestUpdate != null) {
          final updateStart =
              DateTime(latestUpdate.year, latestUpdate.month, latestUpdate.day);
          int diffDays = todayStart.difference(updateStart).inDays;
          if (diffDays < 0) diffDays = 0; // Fix timezone mismatch pushing date into future
          
          if (diffDays >= 0 && diffDays < 7) {
            final bucketIndex = 6 - diffDays;
            if (bucketIndex >= 0 && bucketIndex < 7) {
              activity[bucketIndex]['val'] = (activity[bucketIndex]['val'] as int) + 1;
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          _totalContainers = total;
          _selesai = selesai;
          _onProses = onProses;
          _belumDiupdate = belum;
          _dailyActivity = activity;
          _ongoingUpdates = ongoingList;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        if (_ongoingUpdates.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Koneksi tidak stabil. Gagal memuat data ringkasan.')),
          );
        }
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
          child: CircularProgressIndicator(color: Color(0xFFAAC7FF)));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.only(
          left: 24.0, right: 24.0, top: 16.0, bottom: 100.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [


          // Status Update Pie Chart
          GlassCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'STATUS UPDATE',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF8B91A0),
                      letterSpacing: 1.5),
                ),
                const SizedBox(height: 24),
                AspectRatio(
                  aspectRatio: 15 / 9,
                  child: Row(
                    children: [
                      Expanded(
                        flex: 1, // Kiri: Diagram Pie (50%)
                        child: Stack(
                          children: [
                            PieChart(
                              PieChartData(
                                sectionsSpace: 2,
                                centerSpaceRadius: 28, // Diperkecil lagi agar super aman dari overflow
                                sections: _getPieSections(),
                              ),
                            ),
                            Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    '$_totalContainers',
                                    style: const TextStyle(
                                        fontSize: 20, // Diperkecil
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFFE0E2ED)),
                                  ),
                                  const Text(
                                    'OVERALL',
                                    style: TextStyle(
                                        fontSize: 8, // Diperkecil
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.0,
                                        color: Color(0xFF8B91A0)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1, // Kanan: Keterangan (50%)
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildLegend('Selesai', _selesai, const Color(0xFF4ADE80)),
                            const SizedBox(height: 12),
                            _buildLegend('On Proses', _onProses, const Color(0xFFFB923C)),
                            const SizedBox(height: 12),
                            _buildLegend('Belum Update', _belumDiupdate, const Color(0xFF3E90FF)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Aktivitas Line Chart
          GlassCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'AKTIVITAS 7 HARI TERAKHIR',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF8B91A0),
                      letterSpacing: 1.5),
                ),
                const SizedBox(height: 24),
                AspectRatio(
                  aspectRatio: 15 / 9,
                  child: LineChart(
                    LineChartData(
                      maxY: _getMaxY(),
                      minY: 0,
                      lineTouchData: LineTouchData(
                        enabled: false,
                        getTouchedSpotIndicator: (LineChartBarData barData, List<int> spotIndexes) {
                          return spotIndexes.map((index) {
                            return TouchedSpotIndicatorData(
                              const FlLine(color: Colors.transparent), 
                              FlDotData(show: false), 
                            );
                          }).toList();
                        },
                        touchTooltipData: LineTouchTooltipData(
                          tooltipBgColor: Colors.transparent,
                          tooltipPadding: const EdgeInsets.only(bottom: 8),
                          tooltipMargin: 0,
                          getTooltipItems: (List<LineBarSpot> lineBarsSpot) {
                            return lineBarsSpot.map((lineBarSpot) {
                              return LineTooltipItem(
                                lineBarSpot.y.toInt().toString(),
                                const TextStyle(
                                    color: Color(0xFFE0E2ED), 
                                    fontWeight: FontWeight.bold, 
                                    fontSize: 12),
                              );
                            }).toList();
                          },
                        ),
                      ),
                      showingTooltipIndicators: _dailyActivity.asMap().entries.map((e) {
                         return ShowingTooltipIndicators([LineBarSpot(
                           _getLineChartBarData(),
                           0,
                           _getLineChartBarData().spots[e.key],
                         )]);
                      }).toList(),
                      titlesData: FlTitlesData(
                        show: true,
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            interval: 1,
                            getTitlesWidget: (double value, TitleMeta meta) {
                              if (value.toInt() >= 0 && value.toInt() < _dailyActivity.length) {
                                return Padding(
                                  padding: const EdgeInsets.only(top: 8.0),
                                  child: Text(
                                    _dailyActivity[value.toInt()]['label'],
                                    style: const TextStyle(color: Color(0xFF8B91A0), fontSize: 11),
                                  ),
                                );
                              }
                              return const SizedBox();
                            },
                          ),
                        ),
                        leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      ),
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: 10,
                        getDrawingHorizontalLine: (value) {
                          return FlLine(
                            color: Colors.white.withOpacity(0.05),
                            strokeWidth: 1,
                          );
                        },
                      ),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [_getLineChartBarData()],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Ongoing Updates
          const Text(
            'Ongoing Container Updates',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFFE0E2ED),
            ),
          ),
          const SizedBox(height: 16),
          _ongoingUpdates.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Center(
                      child: Text('Belum ada pembaruan kontainer.',
                          style: TextStyle(color: Color(0xFF8B91A0)))),
                )
              : ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _ongoingUpdates.length,
                  itemBuilder: (context, index) {
                    final item = _ongoingUpdates[index];
                    final status =
                        item['status_inspeksi']?.toString() ?? 'Belum Diupdate';
                    final dateStr = item['tanggal_inspeksi']?.toString() ?? '';

                    String dateFormatted = '';
                    if (dateStr.isNotEmpty) {
                      try {
                        final d = DateTime.parse(dateStr.replaceAll(RegExp(r'(Z|\+00:00|\+00)$'), ''));
                        dateFormatted =
                            DateFormat('dd MMM yy, HH:mm').format(d);
                      } catch (e) {
                        dateFormatted = dateStr;
                      }
                    }

                    Color statusColor = const Color(0xFF9CA3AF);
                    if (status.toLowerCase() == 'selesai')
                      statusColor = const Color(0xFF4ADE80);
                    else if (status.toLowerCase() == 'on proses' ||
                        status.toLowerCase() == 'proses revisi')
                      statusColor = const Color(0xFFFB923C);

                    return GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => ItemsPage(
                              namaFile: item['nama_file']?.toString() ?? '',
                              nomorKontainer:
                                  item['nomor_kontainer']?.toString() ?? '',
                              tipe: item['tipe']?.toString() ?? '',
                            ),
                          ),
                        ).then((_) {
                          // Refresh dashboard (Ongoing) ketika kembali dari halaman update
                          _fetchOverviewData();
                        });
                      },
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.03),
                          borderRadius: BorderRadius.circular(16),
                          border:
                              Border.all(color: Colors.white.withOpacity(0.05)),
                        ),
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ATAS: Nama Kontainer
                            Text(
                              item['nomor_kontainer']?.toString() ??
                                  'Tanpa Nomor',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFE0E2ED),
                                  fontSize: 16),
                            ),
                            const SizedBox(height: 4),
                            // ATAS: Nama Kapal (File)
                            Text(
                              item['nama_file']?.toString() ?? '',
                              style: const TextStyle(
                                  color: Color(0xFF8B91A0), fontSize: 12),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            
                            const SizedBox(height: 16),
                            
                            // BAWAH: Waktu Terakhir Update & Indikator (Progress Bar)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  dateFormatted,
                                  style: const TextStyle(
                                      color: Color(0xFF6B7280), fontSize: 11),
                                ),
                                SizedBox(
                                  width: 100,
                                  child: LinearProgressIndicator(
                                    value: (item['percentage'] as int? ?? 0) /
                                        100.0,
                                    backgroundColor:
                                        Colors.white.withOpacity(0.1),
                                    valueColor:
                                        AlwaysStoppedAnimation<Color>(statusColor),
                                    minHeight: 4,
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ],
      ),
    );
  }

  List<PieChartSectionData> _getPieSections() {
    if (_totalContainers == 0) {
      return [
        PieChartSectionData(
          color: Colors.white.withOpacity(0.1),
          value: 1,
          title: '',
          radius: 40,
        )
      ];
    }

    PieChartSectionData createSection(Color color, int value) {
      final double pct = _totalContainers == 0 ? 0 : (value / _totalContainers * 100);
      return PieChartSectionData(
        color: color,
        value: value.toDouble(),
        title: pct >= 5 ? '${pct.round()}%' : '',
        radius: 28, // Diperkecil lagi agar sangat proporsional di layar kecil
        titleStyle: const TextStyle(
          fontSize: 10, // Diperkecil
          fontWeight: FontWeight.bold,
          color: Colors.white,
          shadows: [Shadow(color: Colors.black26, blurRadius: 4)],
        ),
      );
    }

    return [
      if (_selesai > 0) createSection(const Color(0xFF4ADE80), _selesai),
      if (_onProses > 0) createSection(const Color(0xFFFB923C), _onProses),
      if (_belumDiupdate > 0) createSection(const Color(0xFF3E90FF), _belumDiupdate),
    ];
  }

  Widget _buildLegend(String title, int value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(color: Color(0xFFC0C6D6), fontSize: 10, fontWeight: FontWeight.w500),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          value.toString(),
          style: const TextStyle(
              color: Color(0xFFE0E2ED),
              fontWeight: FontWeight.bold,
              fontSize: 12),
        ),
      ],
    );
  }

  double _getMaxY() {
    double max = 5;
    for (var act in _dailyActivity) {
      double val = (act['val'] as int).toDouble();
      if (val > max) {
        max = val + 2;
      }
    }
    return max;
  }

  LineChartBarData _getLineChartBarData() {
    List<FlSpot> spots = [];
    for (int i = 0; i < _dailyActivity.length; i++) {
      spots.add(FlSpot(i.toDouble(), (_dailyActivity[i]['val'] as int).toDouble()));
    }

    return LineChartBarData(
      spots: spots,
      isCurved: false,
      color: const Color(0xFF10B981),
      barWidth: 2.5,
      isStrokeCapRound: true,
      dotData: FlDotData(
        show: true,
        getDotPainter: (spot, percent, barData, index) => FlDotCirclePainter(
          radius: 4,
          color: const Color(0xFF10131B),
          strokeWidth: 2.5,
          strokeColor: const Color(0xFF10B981),
        ),
      ),
      belowBarData: BarAreaData(
        show: true,
        gradient: LinearGradient(
          colors: [
            const Color(0xFF10B981).withOpacity(0.35),
            const Color(0xFF10B981).withOpacity(0.0),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
    );
  }
}
