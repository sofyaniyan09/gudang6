import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../widgets/glass_card.dart';
import '../main.dart'; // for supabase client

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _isLoading = true;
  String _nama = '';
  String _idNumber = '';
  String _role = '';
  String? _avatarUrl;
  String? _coverUrl;

  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      // Dapatkan data user terbaru dari server untuk memastikan metadata (foto) terupdate
      final userResponse = await supabase.auth.getUser();
      final user = userResponse.user;
      if (user == null) return;

      final data = await supabase
          .from('profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _nama = data?['nama'] ?? '';
          _idNumber = data?['id_number'] ?? '';
          _role = data?['role'] ?? '';
          _avatarUrl = user.userMetadata?['avatar_url'];
          _coverUrl = user.userMetadata?['cover_url'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memuat profil: $e')),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _updateNama() async {
    final controller = TextEditingController(text: _nama);
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF181C23),
        title: const Text('Ubah Nama', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Masukkan nama baru',
            hintStyle: TextStyle(color: Colors.grey),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );

    if (result != null && result.trim().isNotEmpty && result != _nama) {
      setState(() => _isLoading = true);
      try {
        await supabase.from('profiles').upsert({'id': supabase.auth.currentUser!.id, 'nama': result.trim()});
        setState(() => _nama = result.trim());
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nama berhasil diubah!')));
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengubah nama: $e')));
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _updatePassword() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF181C23),
        title: const Text('Ubah Password', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
          obscureText: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Masukkan password baru',
            hintStyle: TextStyle(color: Colors.grey),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      setState(() => _isLoading = true);
      try {
        await supabase.auth.updateUser(UserAttributes(password: result));
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password berhasil diubah!')));
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengubah password: $e')));
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _updatePhoto() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (image == null) return;

    setState(() => _isLoading = true);
    try {
      final user = supabase.auth.currentUser!;
      final bytes = await image.readAsBytes();
      final fileExt = image.name.split('.').last;
      final fileName = '${DateTime.now().millisecondsSinceEpoch}.$fileExt';
      final path = 'avatars/${user.id}/$fileName';

      await supabase.storage.from('inspeksi_foto').uploadBinary(
        path,
        bytes,
        fileOptions: const FileOptions(upsert: true),
      );

      final publicUrl = supabase.storage.from('inspeksi_foto').getPublicUrl(path);

      await supabase.auth.updateUser(UserAttributes(
        data: {'avatar_url': publicUrl},
      ));

      setState(() {
        _avatarUrl = publicUrl;
      });

      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Foto profil berhasil diubah!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengunggah foto: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateCoverPhoto() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (image == null) return;

    setState(() => _isLoading = true);
    try {
      final user = supabase.auth.currentUser!;
      final bytes = await image.readAsBytes();
      final fileExt = image.name.split('.').last;
      final fileName = 'cover_${DateTime.now().millisecondsSinceEpoch}.$fileExt';
      final path = 'avatars/${user.id}/$fileName';

      await supabase.storage.from('inspeksi_foto').uploadBinary(
        path,
        bytes,
        fileOptions: const FileOptions(upsert: true),
      );

      final publicUrl = supabase.storage.from('inspeksi_foto').getPublicUrl(path);

      await supabase.auth.updateUser(UserAttributes(
        data: {'cover_url': publicUrl},
      ));

      setState(() {
        _coverUrl = publicUrl;
      });

      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Foto sampul berhasil diubah!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengunggah foto sampul: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight,
            ),
        child: Stack(
          children: [
            // 1. Cover Photo at the very back (Bleeding to top and covering the whole background)
            Positioned.fill(
              child: GestureDetector(
                onTap: _updateCoverPhoto,
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF181C23),
                    image: _coverUrl != null
                        ? DecorationImage(
                            image: NetworkImage(_coverUrl!),
                            fit: BoxFit.cover,
                            alignment: Alignment.topCenter,
                          )
                        : null,
                  ),
                  child: Stack(
                    children: [
                      // Gradient Overlay: clear at top, dark in the middle and bottom to create a textured background
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: const [0.0, 0.65, 0.85],
                        colors: [
                          Colors.transparent, // Tetap terang di bagian atas sampai tengah
                          Colors.transparent, // Mulai gradasi dari batas Ganti Nama & Password
                          const Color(0xFF10131B), // Gelap penuh di bagian bawah (Logout)
                        ],
                      ),
                    ),
                  ),
                ),
                      if (_coverUrl == null)
                        const Align(
                          alignment: Alignment.topCenter,
                          child: Padding(
                            padding: EdgeInsets.only(top: 100),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.add_photo_alternate,
                                    size: 40, color: Color(0xFF414754)),
                                SizedBox(height: 8),
                                Text('Tambah Foto Sampul', style: TextStyle(color: Color(0xFF414754))),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),

          // 2. Foreground content (Avatar, Text, Cards)
          Column(
            children: [
              const SizedBox(height: 80), // Push down to center of cover photo

              // Avatar & Name
              Center(
                child: Column(
                  children: [
                    Stack(
                      children: [
                        Container(
                          width: 110,
                          height: 110,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF181C23),
                            border: Border.all(color: const Color(0xFFC0C6D6), width: 3),
                            image: _avatarUrl != null
                                ? DecorationImage(
                                    image: NetworkImage(_avatarUrl!),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                          ),
                          child: _avatarUrl == null
                              ? const Icon(Icons.person, size: 50, color: Color(0xFFC0C6D6))
                              : null,
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: GestureDetector(
                            onTap: _updatePhoto,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: Color(0xFFAAC7FF),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.camera_alt, size: 18, color: Color(0xFF003064)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _nama.isNotEmpty ? _nama : 'Tanpa Nama',
                      style: const TextStyle(
                        fontSize: 24, 
                        fontWeight: FontWeight.bold, 
                        color: Colors.white,
                        shadows: [
                          Shadow(offset: Offset(0, 2), blurRadius: 4, color: Colors.black87),
                          Shadow(offset: Offset(0, 1), blurRadius: 8, color: Colors.black54),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'ID: $_idNumber | ${_role.toUpperCase()}',
                      style: const TextStyle(
                        fontSize: 14, 
                        color: Color(0xFFE0E2ED), // Mencerahkan warnanya sedikit agar kontras
                        letterSpacing: 1,
                        fontWeight: FontWeight.w500,
                        shadows: [
                          Shadow(offset: Offset(0, 1), blurRadius: 4, color: Colors.black87),
                          Shadow(offset: Offset(0, 1), blurRadius: 8, color: Colors.black54),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 40),

              // Menu Sections (Overlapping the cover photo)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  children: [
                    // First Section (Profile details / Edit)
                    GlassCard(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.person_outline, color: Color(0xFFAAC7FF)),
                            title: const Text('Ganti Nama', style: TextStyle(color: Colors.white)),
                            trailing: const Icon(Icons.chevron_right, color: Color(0xFFC0C6D6)),
                            onTap: _updateNama,
                          ),
                          const Divider(color: Color(0xFF414754), height: 1),
                          ListTile(
                            leading: const Icon(Icons.lock_outline, color: Color(0xFFAAC7FF)),
                            title: const Text('Ganti Password', style: TextStyle(color: Colors.white)),
                            trailing: const Icon(Icons.chevron_right, color: Color(0xFFC0C6D6)),
                            onTap: _updatePassword,
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 24),

                    // Second Section (Settings / Logout)
                    GlassCard(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.logout, color: Color(0xFFFFB4AB)),
                            title: const Text('Logout', style: TextStyle(color: Color(0xFFFFB4AB), fontWeight: FontWeight.bold)),
                            onTap: () async {
                              await supabase.auth.signOut();
                              if (mounted) {
                                Navigator.of(context, rootNavigator: true).pushReplacement(
                                  MaterialPageRoute(builder: (context) => const LoginPage()),
                                );
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 48), // Bottom padding
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      ),
    );
      },
    );
  }
}
