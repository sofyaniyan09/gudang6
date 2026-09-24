import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../widgets/glass_card.dart';
import '../main.dart'; // for supabase client
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_locale.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _isLoading = true;

  bool get _isGoogleLinked {
    final user = supabase.auth.currentUser;
    if (user == null) return false;
    
    // Check if google is in the providers array in app_metadata
    final providers = user.appMetadata['providers'] as List<dynamic>?;
    if (providers != null && providers.contains('google')) {
      return true;
    }
    
    // Also check identities as fallback
    final identities = user.identities;
    if (identities != null) {
      for (final identity in identities) {
        if (identity.provider == 'google') return true;
      }
    }
    return false;
  }
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
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(AppLocale.t('change_name'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: TextField(
          controller: controller,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
          decoration: InputDecoration(
            hintText: AppLocale.t('enter_new_name'),
            hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(AppLocale.t('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: Text(AppLocale.t('save')),
          ),
        ],
      ),
    );

    if (result != null && result.trim().isNotEmpty && result != _nama) {
      setState(() => _isLoading = true);
      try {
        await supabase.from('profiles').upsert({'id': supabase.auth.currentUser!.id, 'nama': result.trim()});
        setState(() => _nama = result.trim());
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocale.t('name_changed'))));
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${AppLocale.t('name_change_failed')}: $e')));
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
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(AppLocale.t('change_password'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: TextField(
          controller: controller,
          obscureText: true,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
          decoration: InputDecoration(
            hintText: AppLocale.t('enter_new_password'),
            hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(AppLocale.t('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: Text(AppLocale.t('save')),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      setState(() => _isLoading = true);
      try {
        await supabase.auth.updateUser(UserAttributes(password: result));
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocale.t('password_changed'))));
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${AppLocale.t('password_change_failed')}: $e')));
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

      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocale.t('photo_changed'))));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${AppLocale.t('photo_change_failed')}: $e')));
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

      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocale.t('cover_changed'))));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${AppLocale.t('cover_change_failed')}: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
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
                    color: Theme.of(context).colorScheme.surface,
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
                        stops: [0.0, 0.65, 0.85],
                        colors: [
                          Colors.transparent, // No white wash
                          Colors.transparent, 
                          Theme.of(context).scaffoldBackgroundColor, // Fades to solid background
                        ],
                      ),
                    ),
                  ),
                ),
                      if (_coverUrl == null)
                        Align(
                          alignment: Alignment.topCenter,
                          child: Padding(
                            padding: EdgeInsets.only(top: 100),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.add_photo_alternate,
                                    size: 40, color: Theme.of(context).dividerColor),
                                SizedBox(height: 8),
                                Text(AppLocale.t('add_cover_photo'), style: TextStyle(color: Theme.of(context).dividerColor)),
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
              SizedBox(height: 80), // Push down to center of cover photo

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
                            color: Theme.of(context).colorScheme.surface,
                            border: Border.all(color: Theme.of(context).colorScheme.onSurfaceVariant, width: 3),
                            image: _avatarUrl != null
                                ? DecorationImage(
                                    image: NetworkImage(_avatarUrl!),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                          ),
                          child: _avatarUrl == null
                              ? Icon(Icons.person, size: 50, color: Theme.of(context).colorScheme.onSurfaceVariant)
                              : null,
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: GestureDetector(
                            onTap: _updatePhoto,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primary,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.camera_alt, size: 18, color: Theme.of(context).colorScheme.onPrimary),
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 16),
                    Text(
                      _nama.isNotEmpty ? _nama : AppLocale.t('no_name'),
                      style: TextStyle(
                        fontSize: 24, 
                        fontWeight: FontWeight.bold, 
                        color: Colors.white,
                        shadows: [
                          Shadow(offset: Offset(0, 2), blurRadius: 4, color: Colors.black87),
                          Shadow(offset: Offset(0, 1), blurRadius: 8, color: Colors.black54),
                        ],
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'ID: $_idNumber | ${_role.toUpperCase()}',
                      style: TextStyle(
                        fontSize: 14, 
                        color: Theme.of(context).colorScheme.onSurface, // Mencerahkan warnanya sedikit agar kontras
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

              SizedBox(height: 40),

              // Menu Sections (Overlapping the cover photo)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  children: [
                    // First Section (Profile details / Edit)
                    GlassCard(
                      child: Builder(
                        builder: (context) {
                          final iconColor = Theme.of(context).brightness == Brightness.light 
                              ? Colors.blueAccent[700] 
                              : Colors.blueAccent[100];
                          return Column(
                        children: [
                            ListTile(
                              leading: Icon(Icons.person_outline, color: iconColor),
                              title: Text(AppLocale.t('change_name'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
                              trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
                              onTap: _updateNama,
                            ),
                            Divider(color: Theme.of(context).dividerColor, height: 1),
                            ListTile(
                              leading: Icon(Icons.lock_outline, color: iconColor),
                              title: Text(AppLocale.t('change_password'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
                              trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
                              onTap: _updatePassword,
                            ),
                            Divider(color: Theme.of(context).dividerColor, height: 1),
                            ListTile(
                              leading: Icon(Icons.account_circle, color: iconColor),
                              title: Text(AppLocale.t('google_account'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
                              trailing: _isGoogleLinked 
                                  ? Text(AppLocale.t('linked'), style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold))
                                  : Text(AppLocale.t('link_account'), style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
                              onTap: _isGoogleLinked ? null : () async {
                                try {
                                  await supabase.auth.linkIdentity(OAuthProvider.google, redirectTo: 'io.supabase.gudang6://login-callback/');
                                } catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                      content: Text(AppLocale.t('link_google_failed')), 
                                      backgroundColor: Theme.of(context).colorScheme.error
                                    ));
                                  }
                                }
                              },
                            ),
                            ],
                          );
                        },
                      ),
                    ),
                    
                    
                    // Admin Section
                    if (_role.toLowerCase() == 'admin') ...[
                      SizedBox(height: 24),
                      Text(AppLocale.t('admin_panel'), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1.5)),
                      SizedBox(height: 8),
                      GlassCard(
                        child: Builder(
                          builder: (context) {
                            final iconColor = Theme.of(context).brightness == Brightness.light 
                                ? Colors.blueAccent[700] 
                                : Colors.blueAccent[100];
                            return Column(
                              children: [
                                ListTile(
                                  leading: Icon(Icons.image_search, color: iconColor),
                                  title: Text(AppLocale.t('change_logo'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
                                  trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
                                  onTap: () async {
                                    final XFile? image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                                    if (image == null) return;
                                    
                                    setState(() => _isLoading = true);
                                    try {
                                      final bytes = await image.readAsBytes();
                                      final fileExt = image.name.split('.').last;
                                      final path = 'public/logo_transparent.png';
                                      
                                      await supabase.storage.from('inspeksi_foto').uploadBinary(
                                        path,
                                        bytes,
                                        fileOptions: const FileOptions(upsert: true),
                                      );
                                      
                                      final publicUrl = supabase.storage.from('inspeksi_foto').getPublicUrl(path);
                                      // Force reload image by appending timestamp
                                      final timestampedUrl = '$publicUrl?t=${DateTime.now().millisecondsSinceEpoch}';
                                      
                                      // Save to SharedPreferences so all users can pull it if needed,
                                      // but normally we can just fetch it directly.
                                      // To make it broadcast to all devices immediately without restart, we can store it in a global notifier.
                                      // For now we'll just update SharedPreferences.
                                      final prefs = await SharedPreferences.getInstance();
                                      await prefs.setString('app_logo_url', timestampedUrl);
                                      globalLogoUrl.value = timestampedUrl;
                                      
                                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(AppLocale.t('logo_changed'))));
                                    } catch (e) {
                                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${AppLocale.t('logo_change_failed')}: $e')));
                                    } finally {
                                      setState(() => _isLoading = false);
                                    }
                                  },
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ],

                    SizedBox(height: 24),

                    // Second Section (Settings / Logout)
                    GlassCard(
                      child: Builder(
                        builder: (context) {
                          final iconColor = Theme.of(context).brightness == Brightness.light 
                              ? Colors.blueAccent[700] 
                              : Colors.blueAccent[100];
                          return Column(
                            children: [
                              // === Bahasa / 语言 ===
                              ListTile(
                                leading: Icon(Icons.language, color: iconColor),
                                title: Text(AppLocale.t('language'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
                                trailing: ValueListenableBuilder<String>(
                                  valueListenable: globalLocale,
                                  builder: (context, locale, _) {
                                    return DropdownButton<String>(
                                      value: locale,
                                      underline: const SizedBox(),
                                      dropdownColor: Theme.of(context).colorScheme.surface,
                                      items: const [
                                        DropdownMenuItem(value: 'id', child: Text('Indonesia')),
                                        DropdownMenuItem(value: 'zh', child: Text('简体中文')),
                                      ],
                                      onChanged: (value) {
                                        if (value != null) {
                                          AppLocale.setLocale(value);
                                        }
                                      },
                                    );
                                  },
                                ),
                              ),
                              Divider(color: Theme.of(context).dividerColor, height: 1),
                              // === Tema Gelap ===
                              ValueListenableBuilder<ThemeMode>(                                valueListenable: globalThemeMode,
                                builder: (context, themeMode, _) {
                                  final isDark = themeMode == ThemeMode.dark;
                                  return SwitchListTile(
                                    secondary: Icon(isDark ? Icons.dark_mode_outlined : Icons.light_mode_outlined, color: iconColor),
                                    title: Text(AppLocale.t('dark_theme'), style: TextStyle(color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
                                    value: isDark,
                                    activeColor: Theme.of(context).colorScheme.primary,
                                    inactiveTrackColor: Colors.grey.withOpacity(0.3),
                                    onChanged: (value) async {
                                      final newMode = value ? ThemeMode.dark : ThemeMode.light;
                                      globalThemeMode.value = newMode;
                                      final prefs = await SharedPreferences.getInstance();
                                      await prefs.setString('theme', value ? 'dark' : 'light');
                                    },
                                  );
                                },
                              ),
                              Divider(color: Theme.of(context).dividerColor, height: 1),
                              ListTile(
                                leading: Icon(Icons.logout, color: Colors.redAccent),
                                title: Text(AppLocale.t('logout'), style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
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
                          );
                        },
                      ),
                    ),
                    
                    SizedBox(height: 48), // Bottom padding
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
