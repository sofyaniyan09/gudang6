import 'package:flutter/material.dart';
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
      home: supabase.auth.currentSession != null ? const DashboardPage() : const LoginPage(),
    );
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
  bool _isLoading = false;
  bool _obscurePassword = true;

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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ObsidianScaffold(
      body: Stack(
        children: [
          // Background Logo Silhouette
          Positioned.fill(
            child: Center(
              child: Opacity(
                opacity: 0.1, // Siluet tipis
                child: Image.asset(
                  'assets/logo_transparent.png',
                  width: MediaQuery.of(context).size.width * 0.8,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          
          // Form Content
          SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: MediaQuery.of(context).size.height - MediaQuery.of(context).padding.top,
              ),
              child: IntrinsicHeight(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                  const Spacer(),
                  GlassCard(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset(
                          'assets/logo_transparent.png',
                          height: 80,
                          fit: BoxFit.contain,
                        ),
                        const SizedBox(height: 24),
                        const Text(
                          'Penerimaan Material CC#6',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFE0E2ED), // on-surface
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 40),
                        
                        // Input fields
                        _buildTextField(
                          controller: _idController,
                          hint: 'Crew ID or Email',
                          icon: Icons.badge_outlined,
                          isPassword: false,
                        ),
                        const SizedBox(height: 16),
                        _buildTextField(
                          controller: _passwordController,
                          hint: 'Password',
                          icon: Icons.lock_outline,
                          isPassword: true,
                        ),
                        
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            Switch(
                              value: true,
                              onChanged: (v) {},
                              activeColor: const Color(0xFFAAC7FF),
                            ),
                            const Text(
                              'Remember Me',
                              style: TextStyle(color: Color(0xFFC0C6D6)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                        
                        // Submit Button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFFAAC7FF),
                              foregroundColor: const Color(0xFF003064), // on-primary
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
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        'Access Inventory',
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                                      ),
                                      SizedBox(width: 8),
                                      Icon(Icons.arrow_forward, size: 20),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ),
          ),
        ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    required bool isPassword,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF181C23), // surface-container-low
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF414754)), // outline-variant
      ),
      child: TextField(
        controller: controller,
        obscureText: isPassword && _obscurePassword,
        style: const TextStyle(color: Color(0xFFE0E2ED), fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF8B91A0)), // outline
          prefixIcon: Icon(icon, color: const Color(0xFF8B91A0)),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    color: const Color(0xFF8B91A0),
                  ),
                  onPressed: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }
}
