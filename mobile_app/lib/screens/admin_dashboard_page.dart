import 'package:flutter/material.dart';
import '../main.dart';
import '../widgets/obsidian_scaffold.dart';
import 'admin_container_detail_page.dart';
import '../utils/app_locale.dart';

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _files = [];
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadFiles();
  }

  Future<void> _loadFiles() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final response = await supabase
          .from('penerimaan_kapal')
          .select('nama_file, created_at, nomor_kontainer, status_inspeksi');

      final List<dynamic> data = response as List<dynamic>;

      // Group by nama_file
      final Map<String, Map<String, dynamic>> fileMap = {};

      for (var row in data) {
        final namaFile = row['nama_file']?.toString() ?? 'Unknown';
        final container = row['nomor_kontainer']?.toString() ?? AppLocale.t('no_container');
        final status = row['status_inspeksi']?.toString() ?? '';

        if (!fileMap.containsKey(namaFile)) {
          fileMap[namaFile] = {
            'nama_file': namaFile,
            'created_at': row['created_at'],
            'count': 1,
            'containers': <String>{container},
            'inspectedCount': (status.isNotEmpty && status != 'Menunggu Inspeksi' && status != '-') ? 1 : 0,
          };
        } else {
          fileMap[namaFile]!['count'] = (fileMap[namaFile]!['count'] as int) + 1;
          (fileMap[namaFile]!['containers'] as Set<String>).add(container);
          if (status.isNotEmpty && status != 'Menunggu Inspeksi' && status != '-') {
            fileMap[namaFile]!['inspectedCount'] = (fileMap[namaFile]!['inspectedCount'] as int) + 1;
          }
        }
      }

      final filesList = fileMap.values.toList();
      // Urutkan berdasarkan waktu pembuatan terbaru (dari nama file atau created_at jika ada)
      filesList.sort((a, b) {
        final dateA = DateTime.tryParse(a['created_at'] ?? '') ?? DateTime(2000);
        final dateB = DateTime.tryParse(b['created_at'] ?? '') ?? DateTime(2000);
        return dateB.compareTo(dateA); // Descending
      });

      if (mounted) {
        setState(() {
          _files = filesList;
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

  void _logout() async {
    await supabase.auth.signOut();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/'); // Will trigger auth gate in main.dart
    }
  }

  @override
  Widget build(BuildContext context) {
    return ObsidianScaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(AppLocale.t('admin_share_hub'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
            Text(AppLocale.t('native_share_report'), style: TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.logout, color: Colors.white70),
            onPressed: _logout,
            tooltip: AppLocale.t('logout'),
          ),
        ],
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
              : _files.isEmpty
                  ? Center(
                      child: Text(
                        AppLocale.t('no_ship_data'),
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadFiles,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _files.length,
                        itemBuilder: (context, index) {
                          final file = _files[index];
                          final filename = (file['nama_file'] as String)
                              .replaceAll('.xlsx', '')
                              .replaceAll('.xls', '');
                          final containerCount = (file['containers'] as Set<String>).length;
                          final itemCount = file['count'] as int;
                          final inspectedCount = file['inspectedCount'] as int;
                          final progressPercent = itemCount > 0
                              ? ((inspectedCount / itemCount) * 100).round()
                              : 0;

                          return Card(
                            color: Theme.of(context).colorScheme.surface,
                            elevation: 4,
                            margin: const EdgeInsets.only(bottom: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(color: Color(0xFF2C313D)),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              leading: Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  Icons.directions_boat,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                              title: Text(
                                filename,
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(height: 4),
                                  Text(
                                    AppLocale.t('containers_items').replaceAll('{containers}', containerCount.toString()).replaceAll('{items}', itemCount.toString()),
                                    style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13),
                                  ),
                                  SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(4),
                                          child: LinearProgressIndicator(
                                            value: itemCount > 0 ? inspectedCount / itemCount : 0,
                                            backgroundColor: const Color(0xFF2C313D),
                                            color: progressPercent == 100 ? Colors.green : Colors.orange,
                                            minHeight: 6,
                                          ),
                                        ),
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        '$progressPercent%',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: progressPercent == 100 ? Colors.green : Colors.orange,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => AdminContainerDetailPage(
                                      namaFile: file['nama_file'],
                                    ),
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
