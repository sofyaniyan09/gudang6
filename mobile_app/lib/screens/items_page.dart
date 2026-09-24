import 'dart:convert';
import 'package:flutter/material.dart';
import '../utils/route_observer.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import '../main.dart';
import 'inspection_page.dart';
import 'dashboard_page.dart';
import '../widgets/obsidian_scaffold.dart';
import '../utils/share_service.dart';
import '../utils/app_locale.dart';

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
  String get pageTitle => AppLocale.t('items');
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

        if (widget.nomorKontainer == AppLocale.t('no_container')) {
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

  void _showPhotoPreview(BuildContext context, List<String> imageUrls, int initialIndex) {
    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(0),
          child: Stack(
            children: [
              PageView.builder(
                itemCount: imageUrls.length,
                controller: PageController(initialPage: initialIndex),
                itemBuilder: (context, index) {
                  return InteractiveViewer(
                    child: Image.network(imageUrls[index], fit: BoxFit.contain),
                  );
                },
              ),
              Positioned(
                top: 40,
                right: 20,
                child: IconButton(
                  icon: Icon(Icons.close, color: Colors.white, size: 30),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
            ],
          ),
        );
      },
    );
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
              if (!isSearchActive) return SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    controller: _searchController,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                    decoration: InputDecoration(
                      hintText: AppLocale.t('search_item'),
                      hintStyle: TextStyle(color: Color(0xFF8B91A0)),
                      prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      suffixIcon: _searchController.text.isNotEmpty 
                          ? IconButton(
                              icon: Icon(Icons.clear, color: Colors.grey),
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
          SizedBox(height: 16),

          // Items List
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary))
                : _filteredItems.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.isEmpty ? AppLocale.t('no_items') : AppLocale.t('item_not_found'),
                          style: TextStyle(color: Colors.grey),
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

                          Color statusColor = Theme.of(context).colorScheme.onSurface.withOpacity(0.1); // Default border color
                          if (status == 'Sesuai') {
                            statusColor = const Color(0xFF6EE7B7);
                          } else if (status == 'Tidak Sesuai') {
                            statusColor = Theme.of(context).colorScheme.error;
                          } else if (status == 'Tidak Perlu Dicek') {
                            statusColor = Theme.of(context).colorScheme.onSurface;
                          }

                          List<String> photoUrls = [];
                          final fotoData = item['foto_inspeksi'];
                          if (fotoData != null && fotoData.toString().isNotEmpty) {
                            try {
                              final List<dynamic> parsed = jsonDecode(fotoData.toString());
                              photoUrls = parsed.map((e) => e.toString()).toList();
                            } catch (e) {
                              photoUrls = [fotoData.toString()];
                            }
                          }

                          final bool isHighlighted = widget.highlightItemName != null &&
                              item['nama_material'] == widget.highlightItemName;
                          
                          Color backgroundColor = isSelected 
                              ? Theme.of(context).colorScheme.primary.withOpacity(0.3) 
                              : Theme.of(context).colorScheme.onSurface.withOpacity(0.03);
                              
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
                                      : (isSelected ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.onSurface.withOpacity(0.08)),
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
                                          '${item['original_no']}. ${item['nama_material'] ?? AppLocale.t('no_name')}',
                                          maxLines: isExpanded ? null : 4,
                                          overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                            color: Theme.of(context).colorScheme.onSurface,
                                          ),
                                        ),
                                        SizedBox(height: 6),
                                        Row(
                                          children: [
                                            Flexible(
                                              child: Text(
                                                'PO: ${item['po_number'] ?? '-'} | Qty: ${item['jumlah_data'] ?? '-'}',
                                                style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            SizedBox(width: 12),
                                            Container(
                                              width: 32,
                                              height: 4,
                                              decoration: BoxDecoration(
                                                color: statusColor,
                                                borderRadius: BorderRadius.circular(2),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  SizedBox(width: 14),

                                  if (photoUrls.isNotEmpty) ...[
                                    SizedBox(width: 14),
                                    SizedBox(
                                      height: 104, // Space for ~2 vertical photos
                                      width: 48,   // Narrow width for more text space
                                      child: ListView.separated(
                                        padding: EdgeInsets.zero,
                                        scrollDirection: Axis.vertical,
                                        itemCount: photoUrls.length,
                                        separatorBuilder: (context, idx) => SizedBox(height: 6),
                                        itemBuilder: (context, idx) {
                                          return GestureDetector(
                                            onTap: () => _showPhotoPreview(context, photoUrls, idx),
                                            child: Container(
                                              width: 48,
                                              height: 48,
                                              decoration: BoxDecoration(
                                                borderRadius: BorderRadius.circular(8),
                                                border: Border.all(color: const Color(0xFFE5E7EB).withOpacity(0.2)),
                                                image: DecorationImage(
                                                  image: NetworkImage(photoUrls[idx]),
                                                  fit: BoxFit.cover,
                                                ),
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ],
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
          : Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [

                FloatingActionButton(
                  heroTag: 'inspect_fab',
                  onPressed: _goToInspection,
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  elevation: 4,
                  shape: const CircleBorder(),
                  child: Badge(
                    label: Text(
                      '${_selectedIds.length}',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                    backgroundColor: const Color(0xFFE53935),
                    child: Icon(Icons.assignment, color: Theme.of(context).colorScheme.onPrimary),
                  ),
                ),
              ],
            ),
    );
  }

  void _showSequentialShareDialog() {
    final selectedItems = _allItems.where((item) => _selectedIds.contains(item['id'])).toList();
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return _SequentialShareDialog(
          items: selectedItems,
          namaFile: widget.namaFile,
          nomorKontainer: widget.nomorKontainer,
        );
      },
    );
  }
}

class _SequentialShareDialog extends StatefulWidget {
  final List<Map<String, dynamic>> items;
  final String namaFile;
  final String nomorKontainer;

  const _SequentialShareDialog({
    required this.items,
    required this.namaFile,
    required this.nomorKontainer,
  });

  @override
  State<_SequentialShareDialog> createState() => _SequentialShareDialogState();
}

class _SequentialShareDialogState extends State<_SequentialShareDialog> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Theme.of(context).colorScheme.surface,
      title: Text(
        AppLocale.t('sequential_share'),
        style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            AppLocale.t('sequential_share_desc'),
            style: TextStyle(color: Colors.grey[400], fontSize: 14),
          ),
          SizedBox(height: 20),
          ...List.generate(widget.items.length, (index) {
            final item = widget.items[index];
            final namaMaterial = item['nama_material'] ?? 'Unknown';
            final isDone = index < _currentIndex;
            final isCurrent = index == _currentIndex;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12.0),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isDone
                      ? Colors.grey[800]
                      : (isCurrent ? const Color(0xFF00C853) : Theme.of(context).dividerColor),
                  minimumSize: const Size(double.infinity, 48),
                ),
                onPressed: (isDone || !isCurrent) ? null : () => _shareSingleItem(item),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        '${AppLocale.t('send')}: $namaMaterial',
                        style: TextStyle(color: isDone ? Colors.grey[500] : Theme.of(context).colorScheme.onSurface),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isDone)
                      Icon(Icons.check_circle, color: Colors.green)
                    else if (isCurrent)
                      Icon(Icons.send, color: Theme.of(context).colorScheme.onSurface)
                  ],
                ),
              ),
            );
          }),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(AppLocale.t('close'), style: TextStyle(color: Theme.of(context).colorScheme.primary)),
        ),
      ],
    );
  }

  Future<void> _shareSingleItem(Map<String, dynamic> item) async {
    // Format the text specifically for this item
    final cleanFileName = widget.namaFile.replaceAll('.xlsx', '').replaceAll('.xls', '');
    final match = RegExp(r'\d+').firstMatch(cleanFileName);
    final noKapal = match != null ? match.group(0) : cleanFileName;
    final noUrut = item['original_no'] ?? 0;
    
    // We only send Name/ID staff, V[nomor_kapal], nomor kontainer, and nomor urut data barang
    // Wait, staff info is in 'penerimaan_kapal' table or current user? The user said "nama dan no id staf".
    final namaStaf = item['nama_staf'] ?? 'Admin';
    final idStaf = item['id_staf'] ?? '';
    
    final stafText = idStaf.isNotEmpty ? '$namaStaf/$idStaf' : namaStaf;
    
    final text = 'v$noKapal ${widget.nomorKontainer} $noUrut';
    final fullText = '$stafText\n$text';

    final fotoUrl = item['foto_inspeksi'];

    try {
      if (fotoUrl != null && fotoUrl.toString().startsWith('[') && fotoUrl.toString().endsWith(']')) {
        // Ini adalah array JSON dari multi-upload baru
        List<dynamic> decoded = [];
        try {
          decoded = jsonDecode(fotoUrl);
        } catch (_) {}
        
        List<String> urls = decoded.map((e) => e.toString()).toList();
        await ShareService.shareAll(
          context: context,
          text: fullText,
          imageUrls: urls,
        );
      } else {
        // Ini adalah URL tunggal (format lama) atau null
        await ShareService.shareItem(
          context: context,
          text: fullText,
          imageUrl: fotoUrl?.toString(),
        );
      }
      
      setState(() {
        _currentIndex++;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }
}
