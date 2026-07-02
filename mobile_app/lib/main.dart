import 'package:flutter/material.dart';
import 'dart:ui';
import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'screens/dashboard_page.dart';
import 'widgets/obsidian_scaffold.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'widgets/glass_card.dart';

// Konstanta Supabase
const supabaseUrl = 'https://ubfseivosripbfongkcp.supabase.co';
const supabaseKey = 'sb_publishable_kabeekdg65dyS86snIaTVA_ihsnp0u1';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseKey,
  );

  ErrorWidget.builder = (FlutterErrorDetails details) {
    return Material(
      child: Container(
        color: Colors.red,
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Text(
            details.exceptionAsString() + '\n\n' + (details.stack?.toString() ?? ''),
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
        ),
      ),
    );
  };

  runApp(const GudangMobileApp());
}

final supabase = Supabase.instance.client;

class GudangMobileApp extends StatelessWidget {
  const GudangMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gudang 6 Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF10131B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFAAC7FF), // primary
          onPrimary: Color(0xFF003064), // on-primary
          surface: Color(0xFF181C23), // surface-container-low
          onSurface: Color(0xFFE0E2ED), // on-surface
          onSurfaceVariant: Color(0xFFC0C6D6), // on-surface-variant
          error: Color(0xFFFFB4AB),
          onError: Color(0xFF690005),
        ),
        textTheme: ThemeData.dark().textTheme.apply(
              bodyColor: const Color(0xFFE0E2ED),
              displayColor: const Color(0xFFE0E2ED),
            ),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final StreamSubscription<AuthState> _authStateSubscription;

  @override
  void initState() {
    super.initState();
    _authStateSubscription = supabase.auth.onAuthStateChange.listen((data) {
      if (mounted) {
        setState(() {}); // Rebuild on any auth state change (login, logout, token refresh)
      }
    });
  }

  @override
  void dispose() {
    _authStateSubscription.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = supabase.auth.currentSession;
    
    if (session == null) {
      return const LoginPage();
    }
    
    if (session.isExpired) {
      // Sesi tersimpan tapi kadaluarsa. Supabase sedang mencoba refresh.
      // Tampilkan loading screen sementara menunggu hasil refresh token.
      return const Scaffold(
        backgroundColor: Color(0xFF10131B),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFFAAC7FF)),
        ),
      );
    }
    
    return const DashboardPage();
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _idController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passFocus = FocusNode();
  final _scrollController = ScrollController();
  
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    // Menghapus logika auto-scroll paksa agar transisi kolom menjadi natural
  }

  Future<void> _login() async {
    final idNumber = _idController.text.trim();
    final password = _passwordController.text;

    if (idNumber.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nomor ID dan Password harus diisi')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final loginEmail = idNumber.contains('@') ? idNumber : '$idNumber@gudang6.com';
      
      final response = await supabase.auth.signInWithPassword(
        email: loginEmail,
        password: password,
      );

      if (response.user != null) {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const DashboardPage()),
          );
        }
      }
    } on AuthException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Nomor ID atau Password salah'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Terjadi kesalahan yang tidak terduga'),
            backgroundColor: Theme.of(context).colorScheme.error,
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

  @override
  void dispose() {
    _idController.dispose();
    _passwordController.dispose();
    _passFocus.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Mendapatkan tinggi layar asli untuk background agar tidak memendek (squish)
    final double physicalScreenHeight = MediaQuery.sizeOf(context).height;

    return Scaffold(
      backgroundColor: Colors.black,
      resizeToAvoidBottomInset: true, // Sangat penting: Biarkan browser mengecilkan kanvas secara alami
      body: Stack(
        children: [
          // Background Image (Tinggi statis agar tidak rusak saat keyboard muncul)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: physicalScreenHeight,
            child: Image.asset(
              'assets/login_bg.png',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
          ),
          
          // Logo Teks di Kiri Atas
          Positioned(
            top: MediaQuery.paddingOf(context).top + 20,
            left: 24,
            child: const Text(
              'Gudang 6',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
          ),
          
          // Konten Utama yang merespons keyboard dengan elegan
          Positioned.fill(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end, // Selalu menempel di bawah
              children: [
                // Ruang kosong fleksibel di atas, akan menghilang saat keyboard muncul
                const Spacer(),
                
                // Kontainer Kaca (Bisa menyusut menjadi scrollable jika layar terlalu kecil)
                Flexible(
                  flex: 10,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(80),
                    ),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10.0, sigmaY: 10.0),
                      child: Container(
                        width: double.infinity,
                        // Menghapus height statis agar kontainer menyesuaikan isi formulirnya
                        decoration: BoxDecoration(
                          color: const Color(0xFF10131B).withOpacity(0.75),
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(80),
                          ),
                          border: Border(
                            top: BorderSide(color: Colors.white.withOpacity(0.1)),
                            left: BorderSide(color: Colors.white.withOpacity(0.1)),
                          ),
                        ),
                        // Scroll view ini yang menyelamatkan kita saat keyboard muncul!
                        child: SingleChildScrollView(
                          controller: _scrollController,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const SizedBox(height: 40),
                                
                                // Input fields
                                _buildTextField(
                                  controller: _idController,
                                  hint: 'Email or ID',
                                  isPassword: false,
                                ),
                                const SizedBox(height: 16),
                                _buildTextField(
                                  controller: _passwordController,
                                  focusNode: _passFocus,
                                  hint: 'Password',
                                  isPassword: true,
                                ),
                                
                                const SizedBox(height: 16),
                                Row(
                                  children: [
                                    SizedBox(
                                      height: 24,
                                      width: 24,
                                      child: Checkbox(
                                        value: true,
                                        onChanged: (v) {},
                                        activeColor: const Color(0xFFAAC7FF),
                                        checkColor: const Color(0xFF003064),
                                        side: BorderSide(color: Colors.white.withOpacity(0.5)),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      'Remember me',
                                      style: TextStyle(color: const Color(0xFFE0E2ED).withOpacity(0.7), fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 32),
                                
                                // Submit Button
                                SizedBox(
                                  height: 56,
                                  child: FilledButton(
                                    style: FilledButton.styleFrom(
                                      backgroundColor: const Color(0xFFAAC7FF),
                                      foregroundColor: const Color(0xFF003064),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                    ),
                                    onPressed: _isLoading ? null : _login,
                                    child: _isLoading
                                        ? const SizedBox(
                                            width: 24,
                                            height: 24,
                                            child: CircularProgressIndicator(color: Color(0xFF003064), strokeWidth: 2.5),
                                          )
                                        : const Text(
                                            'Sign in',
                                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                                          ),
                                  ),
                                ),
                                const SizedBox(height: 40),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    FocusNode? focusNode,
    required String hint,
    required bool isPassword,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF181C23).withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        obscureText: isPassword && _obscurePassword,
        scrollPadding: const EdgeInsets.only(bottom: 160.0), // Memaksa Flutter menggulir ekstra sejauh 160px ke bawah agar tombol ikut terlihat!

        style: const TextStyle(color: Color(0xFFE0E2ED), fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: const Color(0xFFE0E2ED).withOpacity(0.4), fontWeight: FontWeight.w400),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    color: const Color(0xFFE0E2ED).withOpacity(0.4),
                  ),
                  onPressed: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        ),
      ),
    );
  }
}
