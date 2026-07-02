import 'dart:convert';
import 'package:flutter/material.dart';
import '../utils/route_observer.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import '../main.dart';
import 'inspection_page.dart';
import 'dashboard_page.dart';
import '../widgets/obsidian_scaffold.dart';

class ItemsPage extends StatefulWidget {
  final String namaFile;
  final String nomorKontainer;
  final String tipe;
  final String? highlightItemName;

  const ItemsPage({
    super.key,
    required this.namaFile,
    required this.nomorKontainer,
    required this.tipe,
    this.highlightItemName,
  });

  @override
  State<ItemsPage> createState() => _ItemsPageState();
}

class _ItemsPageState extends State<ItemsPage> with RouteAware, TitleUpdater<ItemsPage> {
  @override
  String get pageTitle => 'Data Barang';
  @override
  String? get pageSubtitle => widget.nomorKontainer;
  bool _isLoading = true;
  List<Map<String, dynamic>> _allItems = [];
  List<Map<String, dynamic>> _filteredItems = [];
  int _selectedIndex = 1;
  
  final Set<int> _selectedIds = {}; // using 'id' from database
  final Set<int> _expandedIds = {};
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchItems();
    _searchController.addListener(_filterItems);
    globalSelectAllTrigger.addListener(_onGlobalSelectAll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    globalSelectAllTrigger.removeListener(_onGlobalSelectAll);
    // ensure we clear the state when leaving
    Future.microtask(() => globalIsAllSelected.value = false);
    super.dispose();
  }

  void _onGlobalSelectAll() {
    _toggleSelectAll();
  }

  void _updateGlobalSelectionState() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      globalIsAllSelected.value = _filteredItems.isNotEmpty && 
          _filteredItems.every((item) => _selectedIds.contains(item['id']));
    });
  }

  Future<void> _fetchItems() async {
    setState(() {
      _isLoading = true;
      _selectedIds.clear();
      _expandedIds.clear();
    });

    try {
      List<dynamic> allData = [];
      bool hasMore = true;
      int from = 0;
      const int limit = 1000;

      while (hasMore) {
        var filterBuilder = supabase
            .from('penerimaan_kapal')
            .select()
            .eq('nama_file', widget.namaFile);

        if (widget.nomorKontainer == 'Tanpa Kontainer') {
          filterBuilder = filterBuilder.or('nomor_kontainer.is.null,nomor_kontainer.eq.,nomor_kontainer.eq. ');
        } else {
          filterBuilder = filterBuilder.eq('nomor_kontainer', widget.nomorKontainer);
        }

        final response = await filterBuilder
            .order('id', ascending: true)
            .range(from, from + limit - 1);
            
        final List<dynamic> batch = response as List<dynamic>;
        allData.addAll(batch);
        from += limit;
        if (batch.length < limit) {
          hasMore = false;
        }
      }

      final List<Map<String, dynamic>> matchedItems = [];
      for (var row in allData) {
        final rowCopy = Map<String, dynamic>.from(row);
        rowCopy['original_no'] = matchedItems.length + 1;
        matchedItems.add(rowCopy);
      }

      if (mounted) {
        setState(() {
          _allItems = matchedItems;
          _filteredItems = List.from(_allItems);
        });
        _updateGlobalSelectionState();
      }
    } catch (e) {
      if (mounted) {
        if (_allItems.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Koneksi tidak stabil. Gagal memuat data barang.')),
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

  void _filterItems() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredItems = List.from(_allItems);
      } else {
        _filteredItems = _allItems.where((item) {
          final nama = (item['nama_material'] ?? '').toString().toLowerCase();
          final po = (item['po_number'] ?? '').toString().toLowerCase();
          return nama.contains(query) || po.contains(query);
        }).toList();
      }
    });
    _updateGlobalSelectionState();
  }

  void _toggleSelectAll() {
    setState(() {
      // Jika semua item yang difilter sudah terpilih, maka unselect semua (yang difilter).
      // Jika belum, select semua (yang difilter).
      bool allSelected = _filteredItems.every((item) => _selectedIds.contains(item['id']));
      
      for (var item in _filteredItems) {
        final id = item['id'];
        if (allSelected) {
          _selectedIds.remove(id);
        } else {
          _selectedIds.add(id);
        }
      }
    });
    _updateGlobalSelectionState();
  }

  void _toggleItem(int id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
        _expandedIds.remove(id);
      } else {
        _selectedIds.add(id);
        _expandedIds.add(id);
      }
    });
    _updateGlobalSelectionState();
  }

  void _goToInspection() {
    if (_selectedIds.isEmpty) return;

    final selectedItems = _allItems.where((item) => _selectedIds.contains(item['id'])).toList();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => InspectionPage(
          selectedItems: selectedItems,
          nomorKontainer: widget.nomorKontainer,
        ),
      ),
    ).then((_) {
      // Refresh setelah kembali
      _fetchItems();
    });
  }

  @override
  Widget build(BuildContext context) {
    return ObsidianScaffold(
      body: Column(
        children: [
          // Search Bar
          ValueListenableBuilder<bool>(
            valueListenable: globalSearchActive,
            builder: (context, isSearchActive, child) {
              if (!isSearchActive) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF181C23),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    controller: _searchController,
                    style: const TextStyle(color: Color(0xFFE0E2ED)),
                    decoration: InputDecoration(
                      hintText: 'Cari nama barang atau PO...',
                      hintStyle: const TextStyle(color: Color(0xFF8B91A0)),
                      prefixIcon: const Icon(Icons.search, color: Color(0xFFC0C6D6)),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      suffixIcon: _searchController.text.isNotEmpty 
                          ? IconButton(
                              icon: const Icon(Icons.clear, color: Colors.grey),
                              onPressed: () {
                                _searchController.clear();
                                _filterItems();
                              },
                            ) 
                          : null,
                    ),
                    onChanged: (value) => _filterItems(),
                  ),
                ),
              );
            },
          ),
          
          // List Actions removed as requested
          const SizedBox(height: 16),

          // Items List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFAAC7FF)))
                : _filteredItems.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.isEmpty ? 'Tidak ada barang.' : 'Barang tidak ditemukan.',
                          style: const TextStyle(color: Colors.grey),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(24, 0, 24, 100),
                        itemCount: _filteredItems.length,
                        itemBuilder: (context, index) {
                          final item = _filteredItems[index];
                          final id = item['id'];
                          final bool isSelected = _selectedIds.contains(id);
                          final bool isExpanded = _expandedIds.contains(id);
                          final status = item['status_inspeksi'] ?? 'Menunggu Inspeksi';

                          Color statusColor = Colors.transparent; // Barang yang belum dicek tidak diberi warna dot
                          Color statusBg = const Color(0xFF31353D);
                          if (status == 'Sesuai') {
                            statusColor = const Color(0xFF6EE7B7);
                            statusBg = const Color(0xFF064E3B);
                          } else if (status == 'Tidak Sesuai') {
                            statusColor = const Color(0xFFFFB4AB);
                            statusBg = const Color(0xFF93000A);
                          } else if (status == 'Tidak Perlu Dicek') {
                            statusColor = Colors.white;
                            statusBg = Colors.white24;
                          }

                          String? firstPhotoUrl;
                          final fotoData = item['foto_inspeksi'];
                          if (fotoData != null && fotoData.toString().isNotEmpty) {
                            try {
                              final List<dynamic> parsed = jsonDecode(fotoData.toString());
                              if (parsed.isNotEmpty) {
                                firstPhotoUrl = parsed.first.toString();
                              }
                            } catch (e) {
                              firstPhotoUrl = fotoData.toString();
                            }
                          }

                          final bool isHighlighted = widget.highlightItemName != null &&
                              item['nama_material'] == widget.highlightItemName;
                          
                          Color backgroundColor = isSelected 
                              ? const Color(0xFF3E90FF).withOpacity(0.3) 
                              : const Color(0x0B0B0C).withOpacity(0.7);
                              
                          if (isHighlighted && !isSelected) {
                            backgroundColor = const Color(0xFFEAB308).withOpacity(0.2); // Faint yellow
                          }

                          return GestureDetector(
                            onTap: () => _toggleItem(id),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: backgroundColor,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isHighlighted 
                                      ? const Color(0xFFEAB308).withOpacity(0.5) 
                                      : (isSelected ? const Color(0xFFAAC7FF) : Colors.white.withOpacity(0.08)),
                                  width: isSelected || isHighlighted ? 2 : 1,
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${item['original_no']}. ${item['nama_material'] ?? 'Tanpa Nama'}',
                                          maxLines: isExpanded ? null : 4,
                                          overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFFE0E2ED),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            Text(
                                              'PO: ${item['po_number'] ?? '-'} | Qty: ${item['jumlah_data'] ?? '-'}',
                                              style: const TextStyle(fontSize: 12, color: Color(0xFFC0C6D6)),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 14),

                                  // Right Actions & Photo
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          // Status Indicator Dot
                                          Container(
                                            width: 8,
                                            height: 8,
                                            decoration: BoxDecoration(
                                              color: statusColor,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          // Checkbox
                                          Container(
                                            width: 24,
                                            height: 24,
                                            decoration: BoxDecoration(
                                              color: isSelected ? const Color(0xFFAAC7FF) : Colors.transparent,
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(
                                                color: isSelected ? const Color(0xFFAAC7FF) : const Color(0xFF414754),
                                                width: 2,
                                              ),
                                            ),
                                            child: isSelected
                                                ? const Icon(Icons.check, size: 16, color: const Color(0xFF003064))
                                                : null,
                                          ),
                                        ],
                                      ),
                                      if (firstPhotoUrl != null) ...[
                                        const SizedBox(height: 10),
                                        // Thumbnail Foto
                                        Container(
                                          width: 48,
                                          height: 48,
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: const Color(0xFFE5E7EB).withOpacity(0.2)),
                                            image: DecorationImage(
                                              image: NetworkImage(firstPhotoUrl),
                                              fit: BoxFit.cover,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      floatingActionButton: _selectedIds.isEmpty
          ? null
          : FloatingActionButton(
              onPressed: _goToInspection,
              backgroundColor: const Color(0xFFAAC7FF),
              elevation: 4,
              shape: const CircleBorder(),
              child: Badge(
                label: Text(
                  '${_selectedIds.length}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                backgroundColor: const Color(0xFFE53935),
                offset: const Offset(8, -8),
                child: const Icon(Icons.fact_check_outlined, color: Color(0xFF003064), size: 28),
              ),
            ),
      );
  }
}
